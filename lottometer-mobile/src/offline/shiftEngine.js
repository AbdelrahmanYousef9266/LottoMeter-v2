import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';

const getTodayDate = () => new Date().toISOString().split('T')[0];

export const getOrCreateOfflineBusinessDay = async (store_id) => {
  const db = await getDb();
  const today = getTodayDate();
  const now = new Date().toISOString();

  let day = await db.getFirstAsync(
    `SELECT * FROM local_business_days WHERE store_id = ? AND business_date = ?`,
    [store_id, today]
  );
  if (day) return day;

  const dayUuid = uuidv4();
  await db.runAsync(
    `INSERT INTO local_business_days
     (server_id, uuid, store_id, business_date, status,
      opened_at, sync_status, synced_at)
     VALUES (NULL, ?, ?, ?, 'open', ?, 'pending', NULL)`,
    [dayUuid, store_id, today, now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue
     (uuid, operation, entity_type, entity_uuid, payload,
      status, created_at)
     VALUES (?, 'create_business_day', 'business_day', ?, ?, 'pending', ?)`,
    [uuidv4(), dayUuid,
     JSON.stringify({ uuid: dayUuid, store_id, business_date: today, opened_at: now }),
     now]
  );

  day = await db.getFirstAsync(
    'SELECT * FROM local_business_days WHERE uuid = ?',
    [dayUuid]
  );
  return day;
};

export const openOfflineShift = async (store_id, user_id) => {
  const db = await getDb();
  const now = new Date().toISOString();

  const existingOpen = await db.getFirstAsync(
    `SELECT * FROM local_employee_shifts WHERE store_id = ? AND status = 'open'`,
    [store_id]
  );
  if (existingOpen) {
    throw { code: 'SHIFT_ALREADY_OPEN', message: 'A shift is already open. Close it before opening a new one.' };
  }

  const businessDay = await getOrCreateOfflineBusinessDay(store_id);

  const lastShift = await db.getFirstAsync(
    `SELECT shift_number FROM local_employee_shifts
     WHERE business_day_uuid = ?
     ORDER BY shift_number DESC LIMIT 1`,
    [businessDay.uuid]
  );
  const shiftNumber = (lastShift?.shift_number || 0) + 1;

  const shiftUuid = uuidv4();
  let carriedForwardCount = 0;

  if (shiftNumber > 1) {
    const prevShift = await db.getFirstAsync(
      `SELECT * FROM local_employee_shifts
       WHERE business_day_uuid = ? AND shift_number = ?`,
      [businessDay.uuid, shiftNumber - 1]
    );

    if (prevShift && prevShift.shift_status === 'correct') {
      const closeScans = await db.getAllAsync(
        `SELECT * FROM local_shift_books WHERE shift_uuid = ? AND scan_type = 'close'`,
        [prevShift.uuid]
      );

      for (const scan of closeScans) {
        const book = await db.getFirstAsync(
          `SELECT * FROM local_books WHERE static_code = ? AND store_id = ?`,
          [scan.static_code, store_id]
        );
        if (!book || book.is_sold || !book.is_active) continue;

        const carryUuid = uuidv4();
        await db.runAsync(
          `INSERT INTO local_shift_books
           (uuid, store_id, shift_uuid, static_code, scan_type,
            start_at_scan, is_last_ticket, scan_source, slot_id,
            scanned_at, scanned_by_user_id, force_sold,
            sync_status, synced_at)
           VALUES (?, ?, ?, ?, 'open', ?, 0, 'carry_forward', ?,
                   ?, ?, NULL, 'pending', NULL)`,
          [carryUuid, store_id, shiftUuid, scan.static_code,
           scan.start_at_scan, scan.slot_id, now, user_id]
        );
        carriedForwardCount++;
      }
    }
  }

  await db.runAsync(
    `INSERT INTO local_employee_shifts
     (server_id, uuid, store_id, business_day_uuid,
      employee_id, shift_number, status, opened_at,
      sync_status, synced_at)
     VALUES (NULL, ?, ?, ?, ?, ?, 'open', ?, 'pending', NULL)`,
    [shiftUuid, store_id, businessDay.uuid, user_id, shiftNumber, now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue
     (uuid, operation, entity_type, entity_uuid, payload,
      status, created_at)
     VALUES (?, 'create_employee_shift', 'employee_shift', ?, ?, 'pending', ?)`,
    [uuidv4(), shiftUuid,
     JSON.stringify({
       uuid: shiftUuid,
       business_day_uuid: businessDay.uuid,
       store_id,
       user_id,
       shift_number: shiftNumber,
       opened_at: now,
       carried_forward_count: carriedForwardCount,
     }),
     now]
  );

  const pendingBooks = await db.getAllAsync(
    `SELECT lb.server_id, lb.static_code, lb.slot_id, lb.ticket_price
     FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
     AND NOT EXISTS (
       SELECT 1 FROM local_shift_books sb
       WHERE sb.shift_uuid = ? AND sb.static_code = lb.static_code
       AND sb.scan_type = 'open'
     )`,
    [store_id, shiftUuid]
  );

  return {
    employee_shift: {
      id: null,
      uuid: shiftUuid,
      shift_number: shiftNumber,
      status: 'open',
      opened_at: now,
      employee_id: user_id,
      business_day: {
        id: businessDay.server_id,
        uuid: businessDay.uuid,
        business_date: businessDay.business_date,
        status: businessDay.status,
      },
    },
    carried_forward_count: carriedForwardCount,
    pending_scans: pendingBooks,
    offline: true,
  };
};

export const closeOfflineShift = async ({
  store_id,
  shift_uuid,
  shift_server_id,
  user_id,
  cash_in_hand,
  gross_sales,
  cash_out,
  cancels = '0',
}) => {
  const db = await getDb();
  const now = new Date().toISOString();

  const shift = await db.getFirstAsync(
    'SELECT * FROM local_employee_shifts WHERE uuid = ? AND store_id = ?',
    [shift_uuid, store_id]
  );
  if (!shift) throw { code: 'SHIFT_NOT_FOUND', message: 'Shift not found.' };
  if (shift.status !== 'open') throw { code: 'SHIFT_ALREADY_CLOSED', message: 'Shift is already closed.' };

  const missingClose = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
     AND NOT EXISTS (
       SELECT 1 FROM local_shift_books sb
       WHERE sb.shift_uuid = ? AND sb.static_code = lb.static_code
       AND sb.scan_type = 'close'
     )`,
    [store_id, shift_uuid]
  );
  if (missingClose.count > 0) {
    throw { code: 'BOOKS_NOT_CLOSED', message: `${missingClose.count} book(s) still need close scans.` };
  }

  const scanPairs = await db.getAllAsync(
    `SELECT
       open_scan.static_code,
       open_scan.start_at_scan as open_pos,
       close_scan.start_at_scan as close_pos,
       close_scan.is_last_ticket,
       lb.ticket_price
     FROM local_shift_books open_scan
     JOIN local_shift_books close_scan
       ON open_scan.static_code = close_scan.static_code
       AND open_scan.shift_uuid = close_scan.shift_uuid
       AND close_scan.scan_type = 'close'
     JOIN local_books lb
       ON lb.static_code = open_scan.static_code
       AND lb.store_id = open_scan.store_id
     WHERE open_scan.shift_uuid = ?
       AND open_scan.scan_type = 'open'`,
    [shift_uuid]
  );

  let ticketsTotal = 0;
  for (const pair of scanPairs) {
    const ticketsSold = pair.is_last_ticket
      ? (pair.close_pos - pair.open_pos + 1)
      : (pair.close_pos - pair.open_pos);
    ticketsTotal += ticketsSold * parseFloat(pair.ticket_price);
  }

  const extraSales = await db.getFirstAsync(
    'SELECT SUM(value) as total FROM local_extra_sales WHERE shift_uuid = ?',
    [shift_uuid]
  );
  ticketsTotal += parseFloat(extraSales?.total || 0);

  const cashIn = parseFloat(cash_in_hand);
  const gross = parseFloat(gross_sales);
  const cashOut = parseFloat(cash_out);
  const cancelsVal = parseFloat(cancels);
  const expectedCash = gross + ticketsTotal - cashOut - cancelsVal;
  const difference = cashIn - expectedCash;
  const shiftStatus = difference === 0 ? 'correct' : difference > 0 ? 'over' : 'short';

  await db.runAsync(
    `UPDATE local_employee_shifts SET
     status = 'closed',
     closed_at = ?,
     cash_in_hand = ?,
     gross_sales = ?,
     cash_out = ?,
     cancels = ?,
     tickets_total = ?,
     expected_cash = ?,
     difference = ?,
     shift_status = ?,
     sync_status = 'pending'
     WHERE uuid = ?`,
    [now, cashIn, gross, cashOut, cancelsVal, ticketsTotal,
     expectedCash, difference, shiftStatus, shift_uuid]
  );

  await db.runAsync(
    `INSERT INTO sync_queue
     (uuid, operation, entity_type, entity_uuid, payload,
      status, created_at)
     VALUES (?, 'close_employee_shift', 'employee_shift', ?, ?, 'pending', ?)`,
    [uuidv4(), shift_uuid,
     JSON.stringify({
       shift_uuid,
       shift_server_id,
       store_id,
       user_id,
       cash_in_hand,
       gross_sales,
       cash_out,
       cancels,
       tickets_total: ticketsTotal,
       closed_at: now,
     }),
     now]
  );

  return {
    shift: {
      uuid: shift_uuid,
      status: 'closed',
      closed_at: now,
      cash_in_hand: cashIn,
      gross_sales: gross,
      cash_out: cashOut,
      cancels: cancelsVal,
      tickets_total: ticketsTotal,
      expected_cash: expectedCash,
      difference,
      shift_status: shiftStatus,
    },
    offline: true,
  };
};

export const getOfflineShiftSummary = async (shift_uuid, store_id) => {
  const db = await getDb();

  const scanPairs = await db.getAllAsync(
    `SELECT
       open_scan.static_code,
       open_scan.start_at_scan as open_pos,
       close_scan.start_at_scan as close_pos,
       close_scan.is_last_ticket,
       lb.ticket_price
     FROM local_shift_books open_scan
     JOIN local_shift_books close_scan
       ON open_scan.static_code = close_scan.static_code
       AND open_scan.shift_uuid = close_scan.shift_uuid
       AND close_scan.scan_type = 'close'
     JOIN local_books lb
       ON lb.static_code = open_scan.static_code
       AND lb.store_id = open_scan.store_id
     WHERE open_scan.shift_uuid = ?
       AND open_scan.scan_type = 'open'`,
    [shift_uuid]
  );

  let ticketsTotal = 0;
  for (const pair of scanPairs) {
    const ticketsSold = pair.is_last_ticket
      ? (pair.close_pos - pair.open_pos + 1)
      : (pair.close_pos - pair.open_pos);
    ticketsTotal += ticketsSold * parseFloat(pair.ticket_price);
  }

  const extraSales = await db.getFirstAsync(
    'SELECT SUM(value) as total FROM local_extra_sales WHERE shift_uuid = ?',
    [shift_uuid]
  );
  ticketsTotal += parseFloat(extraSales?.total || 0);

  const totalActive = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM local_books WHERE store_id = ? AND is_active = 1 AND is_sold = 0',
    [store_id]
  );

  const withClose = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_shift_books
     WHERE shift_uuid = ? AND scan_type = 'close'`,
    [shift_uuid]
  );

  const pendingClose = (totalActive?.count || 0) - (withClose?.count || 0);

  return {
    tickets_total: ticketsTotal.toFixed(2),
    books_total_active: totalActive?.count || 0,
    books_with_close: withClose?.count || 0,
    books_pending_close: pendingClose,
    offline: true,
  };
};
