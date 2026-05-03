import { getDb } from './db';

export const debugLocalDb = async () => {
  try {
    const db = await getDb();
    const tables = [
      'local_slots',
      'local_books',
      'local_business_days',
      'local_employee_shifts',
      'local_shift_books',
      'sync_queue',
    ];
    console.log('=== LOCAL DB STATUS ===');
    for (const table of tables) {
      const result = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      console.log(`${table}: ${result.count}`);
    }
    console.log('======================');
  } catch (e) {
    console.error('[debugDb] Error:', e.message);
  }
};
