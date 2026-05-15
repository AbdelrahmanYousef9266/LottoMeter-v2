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

// ─── LOCAL READ HELPERS ───────────────────────────────────────────────────────

export const getLocalSlots = async (storeId) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       s.server_id        AS slot_id,
       s.slot_name,
       s.ticket_price,
       b.server_id        AS book_id,
       b.barcode,
       b.static_code,
       b.start_position,
       b.ticket_price     AS book_ticket_price
     FROM local_slots s
     LEFT JOIN local_books b
       ON b.slot_id  = s.server_id
      AND b.store_id = s.store_id
      AND b.is_active = 1
      AND b.is_sold   = 0
     WHERE s.store_id = ? AND s.is_deleted = 0
     GROUP BY s.server_id`,
    [storeId]
  );
  return rows.map(row => ({
    slot_id:      row.slot_id,
    slot_name:    row.slot_name,
    ticket_price: String(row.ticket_price),
    current_book: row.book_id ? {
      book_id:        row.book_id,
      barcode:        row.barcode,
      static_code:    row.static_code,
      start_position: row.start_position,
      ticket_price:   String(row.book_ticket_price),
    } : null,
  }));
};

export const getLocalBooksSummary = async (storeId) => {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT
       SUM(CASE WHEN is_active = 1 AND is_sold = 0 THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN is_sold  = 1                  THEN 1 ELSE 0 END) AS sold
     FROM local_books WHERE store_id = ?`,
    [storeId]
  );
  return { active: row?.active ?? 0, sold: row?.sold ?? 0 };
};

// ─── SYNC QUEUE STATE TRANSITIONS ────────────────────────────────────────────
//
// All writes to sync_queue.status flow through these helpers so status
// transitions are never scattered as inline SQL across the codebase.

// Returns the ISO timestamp at which the next retry should be attempted,
// using exponential backoff capped at 5 minutes.
const backoffAt = (retryCount) => {
  const secs = Math.min(Math.pow(2, retryCount), 300);
  return new Date(Date.now() + secs * 1000).toISOString();
};

export const markSyncItemSyncing = async (db, uuid) => {
  await db.runAsync(
    "UPDATE sync_queue SET status = 'syncing' WHERE uuid = ?",
    [uuid]
  );
};

export const markSyncItemSynced = async (db, uuid) => {
  await db.runAsync(
    "UPDATE sync_queue SET status = 'synced', synced_at = ? WHERE uuid = ?",
    [new Date().toISOString(), uuid]
  );
};

export const markSyncItemConflict = async (db, uuid, error) => {
  await db.runAsync(
    "UPDATE sync_queue SET status = 'conflict', last_error = ? WHERE uuid = ?",
    [error, uuid]
  );
};

// Called when an operation fails but has retries remaining.
// newRetryCount is the already-incremented value (item.retry_count + 1).
export const markSyncItemRetry = async (db, uuid, newRetryCount, error) => {
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'pending', retry_count = ?, last_error = ?, next_retry_at = ?
     WHERE uuid = ?`,
    [newRetryCount, error, backoffAt(newRetryCount), uuid]
  );
};

// Called when retry_count + 1 >= max_retries. Terminal — nothing auto-retries this row.
export const markSyncItemFailed = async (db, uuid, retryCount, error) => {
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'failed', retry_count = ?, last_error = ?
     WHERE uuid = ?`,
    [retryCount, error, uuid]
  );
};

// ─── MANUAL RETRY / DISCARD ───────────────────────────────────────────────────

// The only place retry_count is ever reset. Requires an explicit human action —
// nothing in the sync engine calls this automatically.
export const retryFailedSyncItem = async (uuid) => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'pending', retry_count = 0, last_error = NULL, next_retry_at = NULL
     WHERE uuid = ? AND status = 'failed'`,
    [uuid]
  );
  return db.getFirstAsync('SELECT * FROM sync_queue WHERE uuid = ?', [uuid]);
};

// Permanently removes a failed row the user has acknowledged as unrecoverable.
export const discardFailedSyncItem = async (uuid) => {
  const db = await getDb();
  const item = await db.getFirstAsync(
    'SELECT uuid, operation, entity_type, entity_uuid FROM sync_queue WHERE uuid = ?',
    [uuid]
  );
  if (item) {
    console.warn('[syncQueue] discarding failed item', {
      uuid: item.uuid,
      operation: item.operation,
      entity_type: item.entity_type,
      entity_uuid: item.entity_uuid,
    });
    await db.runAsync('DELETE FROM sync_queue WHERE uuid = ?', [uuid]);
  }
};

// ─── BULK QUERY HELPERS ───────────────────────────────────────────────────────

export const getFailedSyncItems = async () => {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT * FROM sync_queue WHERE status = 'failed' ORDER BY created_at DESC"
  );
};

export const getSyncQueueStats = async () => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status'
  );
  const stats = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };
  for (const row of rows) {
    if (row.status in stats) stats[row.status] = row.count;
  }
  return stats;
};
