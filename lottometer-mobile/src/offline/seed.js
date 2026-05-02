import { getDb } from './db';
import { getBooks } from '../api/books';
import { listSlots } from '../api/slots';
import { getTodaysBusinessDay } from '../api/businessDays';
import { getCurrentOpenShift, getShiftSummary } from '../api/shifts';
import { v4 as uuidv4 } from 'uuid';

const LENGTH_BY_PRICE = {
  '1.00': 300, '2.00': 150, '3.00': 100,
  '5.00': 60,  '10.00': 30, '20.00': 15,
};

export const seedLocalDatabase = async () => {
  /**
   * Called after successful online login and after each successful online sync.
   * Downloads everything needed for offline operation.
   * Never throws — failures are logged and return false.
   */
  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // 1. Seed LENGTH_BY_PRICE constants
    await db.runAsync(
      `INSERT OR REPLACE INTO local_constants (key, value, synced_at)
       VALUES (?, ?, ?)`,
      ['LENGTH_BY_PRICE', JSON.stringify(LENGTH_BY_PRICE), now]
    );

    // 2. Seed active books
    // getBooks() returns { books: [...] } directly (already unwrapped by api module)
    const booksData = await getBooks({ status: 'active' });
    const books = booksData.books || [];

    for (const book of books) {
      await db.runAsync(
        `INSERT OR REPLACE INTO local_books
         (server_id, store_id, book_name, barcode, static_code,
          start_position, ticket_price, slot_id, is_active,
          is_sold, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          book.book_id, book.store_id, book.book_name || '',
          book.barcode, book.static_code, book.start_position,
          parseFloat(book.ticket_price), book.slot_id,
          book.is_active ? 1 : 0, book.is_sold ? 1 : 0, now,
        ]
      );
    }

    // 3. Seed slots
    // listSlots() returns { slots: [...] } directly
    const slotsData = await listSlots();
    const slots = slotsData.slots || [];

    for (const slot of slots) {
      await db.runAsync(
        `INSERT OR REPLACE INTO local_slots
         (server_id, store_id, slot_name, ticket_price, synced_at)
         VALUES (?, ?, ?, ?, ?)`,
        [slot.slot_id, slot.store_id, slot.slot_name,
         parseFloat(slot.ticket_price), now]
      );
    }

    // 4. Seed today's business day
    try {
      // getTodaysBusinessDay() returns the business_day object directly
      const day = await getTodaysBusinessDay();

      const dayUuid = day.uuid || uuidv4();

      await db.runAsync(
        `INSERT OR REPLACE INTO local_business_days
         (server_id, uuid, store_id, business_date, status,
          opened_at, closed_at, total_sales, total_variance,
          sync_status, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [
          day.id, dayUuid, day.store_id,
          day.business_date, day.status,
          day.opened_at, day.closed_at,
          day.total_sales, day.total_variance, now,
        ]
      );

      // 5. Seed current open shift if one exists
      // getCurrentOpenShift() returns the shift object directly, or null
      const shift = await getCurrentOpenShift();

      if (shift) {
        const shiftUuid = shift.uuid || uuidv4();

        await db.runAsync(
          `INSERT OR REPLACE INTO local_employee_shifts
           (server_id, uuid, store_id, business_day_id,
            business_day_uuid, employee_id, shift_number,
            status, opened_at, closed_at, sync_status, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [
            shift.id, shiftUuid, shift.store_id,
            shift.business_day_id, dayUuid,
            shift.employee_id, shift.shift_number,
            shift.status, shift.opened_at, shift.closed_at, now,
          ]
        );

        // 6. Seed existing scans for the current shift
        // getShiftSummary() returns the summary object directly
        const summary = await getShiftSummary(shift.id);
        const scannedBooks = summary.scanned_books || [];

        for (const scan of scannedBooks) {
          await db.runAsync(
            `INSERT OR IGNORE INTO local_shift_books
             (server_id, uuid, store_id, shift_id, shift_uuid,
              static_code, scan_type, start_at_scan,
              is_last_ticket, scan_source, slot_id,
              scanned_at, scanned_by_user_id, sync_status, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              scan.id || null,         // ShiftBooks has composite PK, may be null
              scan.uuid || uuidv4(),
              scan.store_id,
              shift.id,
              shiftUuid,
              scan.static_code,
              scan.scan_type,
              scan.start_at_scan,
              scan.is_last_ticket ? 1 : 0,
              scan.scan_source,
              scan.slot_id,
              scan.scanned_at,
              scan.scanned_by_user_id,
              now,
            ]
          );
        }
      }
    } catch (e) {
      // No business day yet today — fine, will be created when shift opens
      console.log('[seed] No business day today:', e.message);
    }

    console.log('[seed] Local database seeded successfully');
    return true;
  } catch (error) {
    console.error('[seed] Seed failed:', error);
    return false;
  }
};

// Clear all local data (called on logout)
export const clearLocalDatabase = async () => {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM local_store;
    DELETE FROM local_user;
    DELETE FROM local_books;
    DELETE FROM local_slots;
    DELETE FROM local_business_days;
    DELETE FROM local_employee_shifts;
    DELETE FROM local_shift_books;
    DELETE FROM local_extra_sales;
    DELETE FROM sync_queue;
  `);
};
