import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';

// ─── STORE ───────────────────────────────────────────────

export const saveLocalStore = async (store) => {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_store
       (id, server_id, store_code, store_name, scan_mode, synced_at)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [store.store_id, store.store_code, store.store_name,
       store.scan_mode || 'camera_single', new Date().toISOString()]
    );
  } catch (e) {
  }
};

// ─── USER ────────────────────────────────────────────────

export const saveLocalUser = async (user, storeId) => {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_user
       (id, server_id, username, role, store_id, synced_at)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [user.user_id, user.username, user.role,
       storeId, new Date().toISOString()]
    );
  } catch (e) {
  }
};

// ─── SLOTS ───────────────────────────────────────────────

export const saveLocalSlot = async (slot, storeId) => {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_slots
       (server_id, store_id, slot_name, ticket_price,
        is_deleted, synced_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [slot.slot_id, storeId, slot.slot_name,
       parseFloat(slot.ticket_price),
       slot.deleted_at ? 1 : 0, new Date().toISOString()]
    );
  } catch (e) {
  }
};

export const saveLocalSlots = async (slots, storeId) => {
  for (const slot of slots) {
    await saveLocalSlot(slot, storeId);
  }
};

export const deleteLocalSlot = async (slotId) => {
  try {
    const db = await getDb();
    await db.runAsync(
      `UPDATE local_slots SET is_deleted = 1 WHERE server_id = ?`,
      [slotId]
    );
  } catch (e) {
  }
};

// ─── BOOKS ───────────────────────────────────────────────

export const saveLocalBook = async (book, storeId) => {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_books
       (server_id, store_id, barcode, static_code, ticket_price,
        slot_id, is_active, is_sold, start_position, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [book.book_id, storeId, book.barcode, book.static_code,
       parseFloat(book.ticket_price), book.slot_id,
       book.is_active ? 1 : 0, book.is_sold ? 1 : 0,
       book.start_position, new Date().toISOString()]
    );
  } catch (e) {
  }
};

export const markLocalBookSold = async (staticCode, storeId) => {
  try {
    const db = await getDb();
    await db.runAsync(
      `UPDATE local_books SET is_sold = 1
       WHERE static_code = ? AND store_id = ?`,
      [staticCode, storeId]
    );
  } catch (e) {
  }
};

// ─── BUSINESS DAYS ───────────────────────────────────────

export const saveLocalBusinessDay = async (day, storeId) => {
  try {
    const db = await getDb();
    const existing = await db.getFirstAsync(
      'SELECT uuid FROM local_business_days WHERE server_id = ?',
      [day.id]
    );
    const dayUuid = existing?.uuid || day.uuid || uuidv4();

    await db.runAsync(
      `INSERT OR REPLACE INTO local_business_days
       (server_id, uuid, store_id, business_date, status,
        opened_at, closed_at, total_sales, total_variance,
        sync_status, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [day.id, dayUuid, storeId, day.business_date,
       day.status, day.opened_at, day.closed_at,
       day.total_sales, day.total_variance,
       new Date().toISOString()]
    );
    return dayUuid;
  } catch (e) {
    return null;
  }
};

// ─── EMPLOYEE SHIFTS ─────────────────────────────────────

export const saveLocalEmployeeShift = async (shift, businessDayUuid, storeId) => {
  try {
    const db = await getDb();
    const existing = await db.getFirstAsync(
      'SELECT uuid FROM local_employee_shifts WHERE server_id = ?',
      [shift.id]
    );
    const shiftUuid = existing?.uuid || shift.uuid || uuidv4();

    await db.runAsync(
      `INSERT OR REPLACE INTO local_employee_shifts
       (server_id, uuid, store_id, business_day_uuid,
        employee_id, shift_number, status, opened_at,
        closed_at, cash_in_hand, gross_sales, cash_out,
        cancels, tickets_total, expected_cash, difference,
        shift_status, sync_status, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [shift.id, shiftUuid, storeId, businessDayUuid,
       shift.employee_id, shift.shift_number, shift.status,
       shift.opened_at, shift.closed_at,
       shift.cash_in_hand, shift.gross_sales, shift.cash_out,
       shift.cancels || 0, shift.tickets_total,
       shift.expected_cash, shift.difference,
       shift.shift_status, new Date().toISOString()]
    );
    return shiftUuid;
  } catch (e) {
    return null;
  }
};

export const closeLocalEmployeeShift = async (shiftServerId, closeData) => {
  try {
    const db = await getDb();
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
       sync_status = 'synced'
       WHERE server_id = ?`,
      [closeData.closed_at, closeData.cash_in_hand,
       closeData.gross_sales, closeData.cash_out,
       closeData.cancels || 0, closeData.tickets_total,
       closeData.expected_cash, closeData.difference,
       closeData.shift_status, shiftServerId]
    );
  } catch (e) {
  }
};

// ─── SHIFT BOOKS (SCANS) ─────────────────────────────────

export const saveLocalScan = async (scan, shiftUuid, storeId, userId) => {
  try {
    const db = await getDb();
    const scanUuid = scan.uuid || uuidv4();

    await db.runAsync(
      `INSERT OR REPLACE INTO local_shift_books
       (server_id, uuid, store_id, shift_uuid, static_code,
        scan_type, start_at_scan, is_last_ticket, scan_source,
        slot_id, scanned_at, scanned_by_user_id, force_sold,
        sync_status, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [scan.id || null, scanUuid, storeId, shiftUuid,
       scan.static_code, scan.scan_type, scan.start_at_scan,
       scan.is_last_ticket ? 1 : 0, scan.scan_source || 'manual',
       scan.slot_id, scan.scanned_at, userId,
       scan.force_sold ? 1 : 0, new Date().toISOString()]
    );

  } catch (e) {
  }
};

// ─── EXTRA SALES ─────────────────────────────────────────

export const saveLocalExtraSale = async (sale, shiftUuid, storeId, userId) => {
  try {
    const db = await getDb();
    const saleUuid = sale.uuid || uuidv4();

    await db.runAsync(
      `INSERT OR IGNORE INTO local_extra_sales
       (server_id, uuid, store_id, shift_uuid, scanned_barcode,
        ticket_price, ticket_count, value, created_by_user_id,
        created_at, sync_status, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [sale.id || null, saleUuid, storeId, shiftUuid,
       sale.scanned_barcode, parseFloat(sale.ticket_price),
       sale.ticket_count, parseFloat(sale.value),
       userId, sale.created_at, new Date().toISOString()]
    );
  } catch (e) {
  }
};
