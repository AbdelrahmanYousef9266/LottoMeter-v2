import { getDb } from './db';

export const debugLocalDb = async () => {
  try {
    const db = await getDb();
    if (!db) {
      console.log('[debugDb] DB not ready, skipping');
      return;
    }
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

    const shifts = await db.getAllAsync(
      'SELECT server_id, uuid, status FROM local_employee_shifts'
    );
    console.log('[db] shifts:', JSON.stringify(shifts));

    const scans = await db.getAllAsync(
      'SELECT uuid, scan_type, static_code FROM local_shift_books'
    );
    console.log('[db] scans:', JSON.stringify(scans));

    const syncItems = await db.getAllAsync(
      'SELECT operation, status, retry_count, last_error FROM sync_queue'
    );
    console.log('[sync check]', JSON.stringify(syncItems));

    console.log('======================');
  } catch (e) {
    console.error('[debugDb] Error:', e.message);
  }
};
