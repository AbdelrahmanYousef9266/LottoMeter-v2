import { getDb } from './db';
import { getLengthForPrice } from './constants';
import { v4 as uuidv4 } from 'uuid';

// Parse barcode — mirrors server parse_barcode exactly.
// Lottery tickets: 13 digits; static_code = first 10, position = last 3.
export const parseBarcode = (barcode) => {
  let normalized = barcode.trim().replace(/\D/g, '');

  // ITF-14: strip last digit (check digit) from 14-digit barcodes
  // The actual EAN-13 barcode is the first 13 digits
  if (normalized.length === 14) {
    normalized = normalized.substring(0, 13);
  }

  if (normalized.length === 13) {
    const static_code = normalized.slice(0, 10);
    const position = parseInt(normalized.slice(10), 10);
    if (isNaN(position)) throw { code: 'INVALID_BARCODE', message: 'Invalid barcode format.' };
    return { static_code, position };
  }

  if (normalized.length >= 4) {
    const position = parseInt(normalized.slice(-3), 10);
    const static_code = normalized.slice(0, -3);
    if (isNaN(position)) throw { code: 'INVALID_BARCODE', message: 'Invalid barcode format.' };
    return { static_code, position };
  }

  throw { code: 'INVALID_BARCODE', message: 'Barcode too short.' };
};

// Main offline scan function — all 8 rules, mirrors scan_service.py
export const recordOfflineScan = async ({
  store_id,
  user_id,
  shift_server_id,
  shift_uuid,
  barcode,
  scan_type,
  force_sold = null,
}) => {
  const db = await getDb();
  const now = new Date().toISOString();

  // Parse barcode
  let static_code, position;
  try {
    ({ static_code, position } = parseBarcode(barcode));
  } catch (e) {
    throw { code: 'INVALID_BARCODE', message: 'Invalid barcode format.' };
  }

  // RULE 1: Book must exist locally
  const book = await db.getFirstAsync(
    'SELECT * FROM local_books WHERE static_code = ? AND store_id = ?',
    [static_code, store_id]
  );
  if (!book) {
    throw { code: 'BOOK_NOT_FOUND', message: 'No book found matching this barcode.' };
  }

  // RULE 2: Book must be active
  if (!book.is_active) {
    throw { code: 'BOOK_INACTIVE', message: 'This book is no longer active.' };
  }

  // RULE 3: Book must not be sold
  if (book.is_sold) {
    throw { code: 'BOOK_ALREADY_SOLD', message: 'This book has already been fully sold.' };
  }

  // RULE 4: No duplicate scan (same book, same type, same shift)
  const existingScan = await db.getFirstAsync(
    `SELECT id FROM local_shift_books
     WHERE shift_uuid = ? AND static_code = ? AND scan_type = ?`,
    [shift_uuid, static_code, scan_type]
  );
  if (existingScan) {
    throw { code: 'DUPLICATE_SCAN', message: `This book already has a ${scan_type} scan in this shift.` };
  }

  // RULE 5: Position must be within valid range
  const length = getLengthForPrice(book.ticket_price);
  if (!length) {
    throw { code: 'INVALID_PRICE', message: 'Unknown ticket price for this book.' };
  }
  if (position < 0 || position >= length) {
    throw {
      code: 'POSITION_OUT_OF_RANGE',
      message: `Position ${position} is out of range (0-${length - 1}).`,
    };
  }

  // Get open scan for close-phase validation
  const openScan = scan_type === 'close'
    ? await db.getFirstAsync(
        `SELECT start_at_scan FROM local_shift_books
         WHERE shift_uuid = ? AND static_code = ? AND scan_type = 'open'`,
        [shift_uuid, static_code]
      )
    : null;

  // RULE 6: Close scan requires open scan
  if (scan_type === 'close' && !openScan) {
    throw { code: 'NO_OPEN_SCAN', message: 'No open scan found for this book in this shift.' };
  }

  // RULE 7: Close position must be >= open position
  if (scan_type === 'close' && openScan && position < openScan.start_at_scan) {
    throw {
      code: 'POSITION_BEFORE_OPEN',
      message: `Close position (${position}) cannot be less than open position (${openScan.start_at_scan}).`,
    };
  }

  // RULE 8: Open scan not allowed after close scanning has started
  if (scan_type === 'open') {
    const hasCloseScan = await db.getFirstAsync(
      `SELECT id FROM local_shift_books
       WHERE shift_uuid = ? AND store_id = ? AND scan_type = 'close'`,
      [shift_uuid, store_id]
    );
    if (hasCloseScan) {
      throw { code: 'OPEN_AFTER_CLOSE', message: 'Cannot add open scans after close scanning has started.' };
    }
  }

  // Detect last ticket
  let isLastTicket = false;
  if (scan_type === 'close' && force_sold === null && openScan) {
    const lastPosition = length - 1;
    const hasMovement = position > openScan.start_at_scan;
    isLastTicket = position === lastPosition && hasMovement;
  } else if (force_sold === true) {
    isLastTicket = true;
  }

  // Save scan to local SQLite
  const scanUuid = uuidv4();
  await db.runAsync(
    `INSERT INTO local_shift_books
     (uuid, store_id, shift_uuid, static_code, scan_type,
      start_at_scan, is_last_ticket, scan_source, slot_id,
      scanned_at, scanned_by_user_id, force_sold,
      sync_status, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`,
    [scanUuid, store_id, shift_uuid, static_code, scan_type,
     position, isLastTicket ? 1 : 0, 'offline', book.slot_id,
     now, user_id, force_sold]
  );

  // Mark book as sold if last ticket
  if (isLastTicket || force_sold === true) {
    await db.runAsync(
      'UPDATE local_books SET is_sold = 1 WHERE static_code = ? AND store_id = ?',
      [static_code, store_id]
    );
  }

  // Add to sync queue
  const queueUuid = uuidv4();
  await db.runAsync(
    `INSERT INTO sync_queue
     (uuid, operation, entity_type, entity_uuid, payload,
      status, created_at)
     VALUES (?, 'create_scan', 'shift_book', ?, ?, 'pending', ?)`,
    [queueUuid, scanUuid,
     JSON.stringify({
       uuid: scanUuid,
       shift_server_id,
       shift_uuid,
       barcode,
       scan_type,
       force_sold,
       store_id,
       user_id,
     }),
     now]
  );

  // Calculate pending counts for response — only slot-assigned active books count
  const pendingOpen = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
     AND lb.slot_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM local_shift_books sb
       WHERE sb.shift_uuid = ? AND sb.static_code = lb.static_code
       AND sb.scan_type = 'open'
     )`,
    [store_id, shift_uuid]
  );

  const pendingClose = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
     AND lb.slot_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM local_shift_books sb
       WHERE sb.shift_uuid = ? AND sb.static_code = lb.static_code
       AND sb.scan_type = 'close'
     )`,
    [store_id, shift_uuid]
  );

  const isInitialized = pendingOpen.count === 0;

  // Return same shape as server response so ScanScreen processes it identically
  return {
    scan: {
      uuid: scanUuid,
      static_code,
      scan_type,
      start_at_scan: position,
      is_last_ticket: isLastTicket,
      scan_source: 'offline',
      scanned_at: now,
    },
    book: {
      book_id: book.server_id,
      static_code: book.static_code,
      ticket_price: book.ticket_price,
      is_sold: isLastTicket || force_sold === true,
    },
    pending_scans_remaining: isInitialized ? pendingClose.count : pendingOpen.count,
    is_initialized: isInitialized,
    running_totals: {
      books_scanned_open: 0,
      books_scanned_close: 0,
    },
    offline: true,
  };
};

// Get pending counts for current shift (used by loadShift when offline)
export const getOfflinePendingCounts = async (shift_uuid, store_id) => {
  const db = await getDb();

  const pendingOpen = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
     AND lb.slot_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM local_shift_books sb
       WHERE sb.shift_uuid = ? AND sb.static_code = lb.static_code
       AND sb.scan_type = 'open'
     )`,
    [store_id, shift_uuid]
  );

  const pendingClose = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM local_books lb
     WHERE lb.store_id = ? AND lb.is_active = 1 AND lb.is_sold = 0
     AND lb.slot_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM local_shift_books sb
       WHERE sb.shift_uuid = ? AND sb.static_code = lb.static_code
       AND sb.scan_type = 'close'
     )`,
    [store_id, shift_uuid]
  );

  return {
    books_pending_open: pendingOpen.count,
    books_pending_close: pendingClose.count,
    is_initialized: pendingOpen.count === 0,
  };
};
