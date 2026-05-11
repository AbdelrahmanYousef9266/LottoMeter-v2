import { getDb } from './db';
import { getTodaysBusinessDay } from '../api/businessDays';
import { listShifts } from '../api/shifts';
import { listSlots } from '../api/slots';
import { getBooks } from '../api/books';
import { v4 as uuidv4 } from 'uuid';

export const seedLocalDatabase = async (storeId, userId) => {
  try {
    const db = await getDb();
    const now = new Date().toISOString();

    // 1. Seed slots
    try {
      const slotsData = await listSlots();
      const slots = slotsData.slots || [];
      for (const slot of slots) {
        await db.runAsync(
          `INSERT OR REPLACE INTO local_slots
           (server_id, store_id, slot_name, ticket_price,
            is_deleted, synced_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [slot.slot_id, storeId, slot.slot_name,
           parseFloat(slot.ticket_price),
           slot.deleted_at ? 1 : 0, now]
        );
      }
    } catch (e) {
    }

    // 2. Seed active books
    try {
      const booksData = await getBooks();
      const books = (booksData.books || []).filter(b => b.is_active);
      for (const book of books) {
        await db.runAsync(
          `INSERT OR REPLACE INTO local_books
           (server_id, store_id, barcode, static_code,
            ticket_price, slot_id, is_active, is_sold,
            start_position, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [book.book_id, storeId, book.barcode, book.static_code,
           parseFloat(book.ticket_price), book.slot_id,
           book.is_active ? 1 : 0, book.is_sold ? 1 : 0,
           book.start_position, now]
        );
      }
    } catch (e) {
    }

    // 3. Seed today's business day
    // getTodaysBusinessDay() returns the business_day object directly
    try {
      const day = await getTodaysBusinessDay();
      if (day) {
        const dayUuid = day.uuid || uuidv4();
        // DELETE before INSERT so repeated seeds never accumulate duplicate rows
        // for the same (store_id, business_date). No UNIQUE constraint on that
        // pair exists in the schema, so INSERT OR REPLACE would append instead
        // of replace.
        await db.runAsync(
          `DELETE FROM local_business_days WHERE store_id = ? AND business_date = ?`,
          [storeId, day.business_date]
        );
        await db.runAsync(
          `INSERT INTO local_business_days
           (server_id, uuid, store_id, business_date, status,
            opened_at, closed_at, total_sales, total_variance,
            sync_status, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [day.id, dayUuid, storeId, day.business_date,
           day.status, day.opened_at, day.closed_at,
           day.total_sales, day.total_variance, now]
        );

        // 4. Seed open shift if exists
        try {
          const shiftsRes = await listShifts({
            business_day_id: day.id, status: 'open',
          });
          const shifts = shiftsRes.shifts || [];
          for (const shift of shifts) {
            const shiftUuid = shift.uuid || uuidv4();
            await db.runAsync(
              `INSERT OR REPLACE INTO local_employee_shifts
               (server_id, uuid, store_id, business_day_uuid,
                employee_id, shift_number, status, opened_at,
                closed_at, sync_status, synced_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
              [shift.id, shiftUuid, storeId, dayUuid,
               shift.employee_id, shift.shift_number,
               shift.status, shift.opened_at, shift.closed_at,
               now]
            );
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }

    return true;
  } catch (error) {
    console.error('[seed] Seed failed:', error.message);
    return false;
  }
};

export const clearShiftData = async () => {
  try {
    const db = await getDb();
    await db.execAsync(`
      DELETE FROM local_shift_books;
      DELETE FROM local_employee_shifts;
      DELETE FROM local_business_days;
      DELETE FROM local_extra_sales;
      DELETE FROM sync_queue;
    `);
    console.error('[seed] Shift data cleared');
  } catch (e) {
    console.error('[seed] Clear shift data failed:', e.message);
  }
};

export const clearLocalDatabase = async () => {
  try {
    const db = await getDb();
    await db.execAsync(`
      DELETE FROM local_store;
      DELETE FROM local_user;
      DELETE FROM local_slots;
      DELETE FROM local_books;
      DELETE FROM local_business_days;
      DELETE FROM local_employee_shifts;
      DELETE FROM local_shift_books;
      DELETE FROM local_extra_sales;
      DELETE FROM sync_queue;
    `);
  } catch (e) {
    console.error('[seed] Clear failed:', e.message);
  }
};
