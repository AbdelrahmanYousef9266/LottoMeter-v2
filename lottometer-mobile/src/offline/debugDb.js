import { getDb } from './db';

export const debugLocalDb = async () => {
  const db = await getDb();

  const books  = await db.getAllAsync('SELECT COUNT(*) as count FROM local_books');
  const slots  = await db.getAllAsync('SELECT COUNT(*) as count FROM local_slots');
  const days   = await db.getAllAsync('SELECT COUNT(*) as count FROM local_business_days');
  const shifts = await db.getAllAsync('SELECT COUNT(*) as count FROM local_employee_shifts');
  const scans  = await db.getAllAsync('SELECT COUNT(*) as count FROM local_shift_books');

  console.log('=== LOCAL DB STATUS ===');
  console.log('Books:',         books[0].count);
  console.log('Slots:',         slots[0].count);
  console.log('Business Days:', days[0].count);
  console.log('Shifts:',        shifts[0].count);
  console.log('Scans:',         scans[0].count);
  console.log('======================');
};
