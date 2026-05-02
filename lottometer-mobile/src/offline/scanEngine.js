/**
 * Offline Scan Engine — mirrors scan_service.py exactly.
 *
 * All 8 rules run locally against the SQLite DB.
 * Returns the same flat shape as the server so proceedWithScan
 * needs zero conditional logic around the result.
 *
 * Rule order matches server:
 *   1. Book must exist            → BOOK_NOT_FOUND
 *   2. Book not sold              → BOOK_ALREADY_SOLD   (checked before is_active, same as server)
 *   3. Book must be active        → BOOK_NOT_ACTIVE
 *   4. Position in range          → INVALID_POSITION
 *   5. Open rewrite blocked       → OPEN_RESCAN_BLOCKED (only if close scans exist AND book has prior open)
 *   6. Close needs open scan      → NO_OPEN_SCAN
 *   7. Close position >= open     → POSITION_BEFORE_OPEN
 *   8. force_sold validation      → FORCE_SOLD_REQUIRES_*
 *   9. Duplicate → overwrite      (matches server Rule 5 — NOT an error)
 *  10. Last ticket detection
 *  11. Persist scan + sync queue
 */

import { getDb } from './db';
import { getLengthForPrice } from './constants';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Barcode parsing — mirrors book_service.parse_barcode
// ---------------------------------------------------------------------------

export const parseBarcode = (barcode) => {
  let normalized = (barcode || '').trim();
  // ITF-14 normalisation: strip leading zero from 13-digit code
  if (normalized.length === 13 && normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  if (normalized.length < 4) {
    throw { code: 'INVALID_BARCODE', message: 'Barcode too short.' };
  }
  const position    = parseInt(normalized.slice(-3), 10);
  const static_code = normalized.slice(0, -3);
  if (isNaN(position)) {
    throw { code: 'INVALID_BARCODE', message: 'Could not parse position from barcode.' };
  }
  return { static_code, position };
};

// ---------------------------------------------------------------------------
// Local DB helpers
// ---------------------------------------------------------------------------

const getLocalBook = (db, static_code, store_id) =>
  db.getFirstAsync(
    'SELECT * FROM local_books WHERE static_code = ? AND store_id = ?',
    [static_code, store_id]
  );

const getExistingScan = (db, shift_id, static_code, scan_type, store_id) =>
  db.getFirstAsync(
    `SELECT * FROM local_shift_books
     WHERE shift_id = ? AND static_code = ? AND scan_type = ? AND store_id = ?`,
    [shift_id, static_code, scan_type, store_id]
  );

const getOpenScan = (db, shift_id, static_code, store_id) =>
  getExistingScan(db, shift_id, static_code, 'open', store_id);

const hasAnyCloseScan = async (db, shift_id, store_id) => {
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_shift_books
     WHERE shift_id = ? AND store_id = ? AND scan_type = 'close'`,
    [shift_id, store_id]
  );
  return row.count > 0;
};

// Resolve shift_uuid: prefer passed value, fall back to local_employee_shifts lookup
const resolveShiftUuid = async (db, shift_uuid, shift_id) => {
  if (shift_uuid) return shift_uuid;
  const row = await db.getFirstAsync(
    'SELECT uuid FROM local_employee_shifts WHERE server_id = ?',
    [shift_id]
  );
  return row?.uuid || uuidv4();
};

// ---------------------------------------------------------------------------
// Main offline scan — mirrors record_scan in scan_service.py
// ---------------------------------------------------------------------------

export const recordOfflineScan = async ({
  store_id,
  user_id,
  shift_id,
  shift_uuid,        // may be null/undefined — resolved below
  barcode,
  scan_type,
  force_sold = null,
}) => {
  const db = await getDb();

  // Parse barcode
  const { static_code, position } = parseBarcode(barcode);

  // Resolve shift UUID (needed for local_shift_books.shift_uuid NOT NULL)
  const resolvedShiftUuid = await resolveShiftUuid(db, shift_uuid, shift_id);

  // Rule 1 — book must exist
  const book = await getLocalBook(db, static_code, store_id);
  if (!book) {
    throw { code: 'BOOK_NOT_FOUND', message: 'No book found matching this barcode.' };
  }

  // Rule 2 — book must not be sold (checked before is_active, same order as server)
  if (book.is_sold) {
    throw { code: 'BOOK_ALREADY_SOLD', message: 'This book has already been fully sold.' };
  }

  // Rule 3 — book must be active
  if (!book.is_active) {
    throw { code: 'BOOK_NOT_ACTIVE', message: 'This book is not currently in a slot.' };
  }

  // Rule 4 (server Rule 6) — position in valid range
  const bookLength = getLengthForPrice(book.ticket_price);
  if (!bookLength) {
    throw { code: 'INVALID_PRICE', message: `Unknown ticket price: ${book.ticket_price}.` };
  }
  if (position < 0 || position >= bookLength) {
    throw {
      code: 'INVALID_POSITION',
      message: `Position ${position} out of range for $${book.ticket_price} book (0–${bookLength - 1}).`,
    };
  }

  // Rule 5 (server Rule 8) — open scan blocked if close scans exist AND book has prior open
  if (scan_type === 'open') {
    const closeStarted = await hasAnyCloseScan(db, shift_id, store_id);
    if (closeStarted) {
      const priorOpen = await getOpenScan(db, shift_id, static_code, store_id);
      if (priorOpen) {
        throw {
          code: 'OPEN_RESCAN_BLOCKED',
          message: 'Cannot rewrite open scan after closing has started on this shift.',
        };
      }
    }
  }

  // Rule 6 (server Rule 7) — close requires open scan + position >= open
  let openScan = null;
  if (scan_type === 'close') {
    openScan = await getOpenScan(db, shift_id, static_code, store_id);
    if (!openScan) {
      throw { code: 'NO_OPEN_SCAN', message: 'Cannot close — no open scan found for this book.' };
    }
    if (position < openScan.start_at_scan) {
      throw {
        code: 'POSITION_BEFORE_OPEN',
        message: `Close position (${position}) cannot be less than open position (${openScan.start_at_scan}).`,
      };
    }
  }

  // Rule 7 — force_sold validation
  if (force_sold === true) {
    if (scan_type !== 'close') {
      throw { code: 'FORCE_SOLD_REQUIRES_CLOSE', message: 'force_sold can only be used on close scans.' };
    }
    if (position !== bookLength - 1) {
      throw { code: 'FORCE_SOLD_REQUIRES_LAST_POSITION', message: 'force_sold requires position to be the last ticket.' };
    }
    const openCheck = openScan || await getOpenScan(db, shift_id, static_code, store_id);
    if (!openCheck || position <= openCheck.start_at_scan) {
      throw { code: 'FORCE_SOLD_REQUIRES_MOVEMENT', message: 'force_sold requires close position greater than open position.' };
    }
  }

  // Last ticket detection — mirrors server auto-detect logic
  let isLastTicket = false;
  if (force_sold === true) {
    isLastTicket = true;
  } else if (force_sold === null && scan_type === 'close') {
    const open = openScan || await getOpenScan(db, shift_id, static_code, store_id);
    if (open && position === bookLength - 1 && position > open.start_at_scan) {
      isLastTicket = true;
    }
  }

  const now  = new Date().toISOString();
  const soldThisScan = isLastTicket || force_sold === true;

  // Rule 8 (server Rule 5) — duplicate → overwrite; new → insert
  const existing = await getExistingScan(db, shift_id, static_code, scan_type, store_id);
  let scanUuid;

  if (existing) {
    // Overwrite — preserve UUID so sync queue can update the right record
    scanUuid = existing.uuid;
    await db.runAsync(
      `UPDATE local_shift_books
       SET start_at_scan = ?, is_last_ticket = ?, scan_source = 'offline',
           scanned_at = ?, scanned_by_user_id = ?, force_sold = ?,
           sync_status = 'pending', synced_at = NULL
       WHERE id = ?`,
      [position, isLastTicket ? 1 : 0, now, user_id, force_sold, existing.id]
    );
    // Update sync queue entry if one already exists, otherwise insert
    const existingQueue = await db.getFirstAsync(
      `SELECT id FROM sync_queue WHERE entity_uuid = ? AND status = 'pending'`,
      [scanUuid]
    );
    if (existingQueue) {
      await db.runAsync(
        `UPDATE sync_queue SET payload = ?, created_at = ? WHERE id = ?`,
        [
          JSON.stringify({ uuid: scanUuid, shift_id, shift_uuid: resolvedShiftUuid, barcode, scan_type, force_sold, store_id, user_id }),
          now,
          existingQueue.id,
        ]
      );
    } else {
      await db.runAsync(
        `INSERT INTO sync_queue (uuid, operation, entity_type, entity_uuid, payload, status, created_at)
         VALUES (?, 'create_scan', 'shift_book', ?, ?, 'pending', ?)`,
        [uuidv4(), scanUuid, JSON.stringify({ uuid: scanUuid, shift_id, shift_uuid: resolvedShiftUuid, barcode, scan_type, force_sold, store_id, user_id }), now]
      );
    }
  } else {
    // New scan
    scanUuid = uuidv4();
    await db.runAsync(
      `INSERT INTO local_shift_books
       (uuid, store_id, shift_id, shift_uuid, static_code, scan_type,
        start_at_scan, is_last_ticket, scan_source, slot_id,
        scanned_at, scanned_by_user_id, force_sold, sync_status, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?, ?, 'pending', NULL)`,
      [scanUuid, store_id, shift_id, resolvedShiftUuid, static_code, scan_type,
       position, isLastTicket ? 1 : 0, book.slot_id, now, user_id, force_sold]
    );
    await db.runAsync(
      `INSERT INTO sync_queue (uuid, operation, entity_type, entity_uuid, payload, status, created_at)
       VALUES (?, 'create_scan', 'shift_book', ?, ?, 'pending', ?)`,
      [uuidv4(), scanUuid, JSON.stringify({ uuid: scanUuid, shift_id, shift_uuid: resolvedShiftUuid, barcode, scan_type, force_sold, store_id, user_id }), now]
    );
  }

  // Mark book sold locally — mirrors server: is_sold = True, is_active = False
  if (soldThisScan) {
    await db.runAsync(
      'UPDATE local_books SET is_sold = 1, is_active = 0, slot_id = NULL WHERE static_code = ? AND store_id = ?',
      [static_code, store_id]
    );
  }

  // Compute pending counts — same queries used in getOfflinePendingCounts
  const { books_pending_open, books_pending_close } = await getOfflinePendingCounts(shift_id, store_id);
  const isInitialized = books_pending_open === 0;

  // Count scans done (for running_totals — matches server shape)
  const openCount  = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_shift_books WHERE shift_id = ? AND store_id = ? AND scan_type = 'open'`,
    [shift_id, store_id]
  );
  const closeCount = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_shift_books WHERE shift_id = ? AND store_id = ? AND scan_type = 'close'`,
    [shift_id, store_id]
  );

  // Return flat shape — identical to server response so proceedWithScan needs no changes
  return {
    scan: {
      uuid:           scanUuid,
      static_code,
      scan_type,
      start_at_scan:  position,
      is_last_ticket: isLastTicket,
      scan_source:    'offline',
      scanned_at:     now,
    },
    book: {
      book_id:      book.server_id,
      book_name:    book.book_name,
      static_code:  book.static_code,
      ticket_price: String(book.ticket_price),
      is_sold:      soldThisScan,
      is_active:    soldThisScan ? false : !!book.is_active,
    },
    running_totals: {
      books_scanned_open:  openCount.count,
      books_scanned_close: closeCount.count,
    },
    // Flat — matches server top-level fields consumed by proceedWithScan
    pending_scans_remaining: isInitialized ? books_pending_close : books_pending_open,
    is_initialized:          isInitialized,
    // Extras for loadShift re-use
    books_pending_open,
    books_pending_close,
    offline: true,
  };
};

// ---------------------------------------------------------------------------
// Pending counts helper — used by loadShift when offline
// ---------------------------------------------------------------------------

export const getOfflinePendingCounts = async (shift_id, store_id) => {
  const db = await getDb();

  const pendingOpen = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
       AND NOT EXISTS (
         SELECT 1 FROM local_shift_books sb
         WHERE sb.shift_id = ? AND sb.static_code = lb.static_code AND sb.scan_type = 'open'
       )`,
    [store_id, shift_id]
  );

  const pendingClose = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
       AND NOT EXISTS (
         SELECT 1 FROM local_shift_books sb
         WHERE sb.shift_id = ? AND sb.static_code = lb.static_code AND sb.scan_type = 'close'
       )`,
    [store_id, shift_id]
  );

  return {
    books_pending_open:  pendingOpen.count,
    books_pending_close: pendingClose.count,
    is_initialized:      pendingOpen.count === 0,
  };
};
