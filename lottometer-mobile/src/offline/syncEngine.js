import NetInfo from '@react-native-community/netinfo';
import { getDb } from './db';
import { openShift, closeShift } from '../api/shifts';
import { recordScan } from '../api/scan';
import { getTodaysBusinessDay } from '../api/businessDays';

let isSyncing = false;

// ─── SYNC INDIVIDUAL ITEMS ────────────────────────────────

const syncBusinessDay = async (db, item) => {
  const payload = JSON.parse(item.payload);
  try {
    // getTodaysBusinessDay already returns the day object directly
    const serverDay = await getTodaysBusinessDay();
    if (serverDay) {
      await db.runAsync(
        `UPDATE local_business_days
         SET server_id = ?, sync_status = 'synced', synced_at = ?
         WHERE uuid = ?`,
        [serverDay.id, new Date().toISOString(), payload.uuid]
      );
      return { success: true, server_id: serverDay.id };
    }
    return { success: false, error: 'No server business day returned' };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

const syncEmployeeShift = async (db, item) => {
  const payload = JSON.parse(item.payload);
  try {
    const res = await openShift();
    const serverShift = res.employee_shift;

    if (serverShift) {
      await db.runAsync(
        `UPDATE local_employee_shifts
         SET server_id = ?, sync_status = 'synced', synced_at = ?
         WHERE uuid = ?`,
        [serverShift.id, new Date().toISOString(), payload.uuid]
      );
      return { success: true, server_id: serverShift.id };
    }
    return { success: false, error: 'No server shift returned' };
  } catch (e) {
    if (e.code === 'SHIFT_ALREADY_OPEN') {
      await db.runAsync(
        `UPDATE local_employee_shifts
         SET sync_status = 'conflict', last_error = ?, synced_at = ?
         WHERE uuid = ?`,
        [e.message, new Date().toISOString(), payload.uuid]
      );
      return { success: false, conflict: true, error: e.message };
    }
    return { success: false, error: e.message };
  }
};

const syncScan = async (db, item) => {
  const payload = JSON.parse(item.payload);
  try {
    const localShift = await db.getFirstAsync(
      'SELECT server_id FROM local_employee_shifts WHERE uuid = ?',
      [payload.shift_uuid]
    );

    if (!localShift?.server_id) {
      return { success: false, error: 'Shift not yet synced to server' };
    }

    const res = await recordScan({
      shift_id: localShift.server_id,
      barcode: payload.barcode,
      scan_type: payload.scan_type,
      force_sold: payload.force_sold,
    });

    await db.runAsync(
      `UPDATE local_shift_books
       SET server_id = ?, sync_status = 'synced', synced_at = ?
       WHERE uuid = ?`,
      [res.scan?.id ?? null, new Date().toISOString(), payload.uuid]
    );

    return { success: true };
  } catch (e) {
    if (e.code === 'DUPLICATE_SCAN') {
      await db.runAsync(
        `UPDATE local_shift_books
         SET sync_status = 'synced', synced_at = ?
         WHERE uuid = ?`,
        [new Date().toISOString(), payload.uuid]
      );
      return { success: true, duplicate: true };
    }
    return { success: false, error: e.message || 'Scan sync failed' };
  }
};

const syncCloseShift = async (db, item) => {
  const payload = JSON.parse(item.payload);
  try {
    const localShift = await db.getFirstAsync(
      'SELECT server_id FROM local_employee_shifts WHERE uuid = ?',
      [payload.shift_uuid]
    );

    if (!localShift?.server_id) {
      return { success: false, error: 'Shift not yet synced — will retry' };
    }

    await closeShift(localShift.server_id, {
      cash_in_hand: payload.cash_in_hand,
      gross_sales: payload.gross_sales,
      cash_out: payload.cash_out,
      cancels: payload.cancels,
    });

    await db.runAsync(
      `UPDATE local_employee_shifts
       SET sync_status = 'synced', synced_at = ?
       WHERE uuid = ?`,
      [new Date().toISOString(), payload.shift_uuid]
    );

    return { success: true };
  } catch (e) {
    if (e.code === 'SHIFT_ALREADY_CLOSED') {
      await db.runAsync(
        `UPDATE local_employee_shifts
         SET sync_status = 'synced', synced_at = ?
         WHERE uuid = ?`,
        [new Date().toISOString(), payload.shift_uuid]
      );
      return { success: true, duplicate: true };
    }
    return { success: false, error: e.message };
  }
};

// ─── MAIN SYNC FUNCTION ───────────────────────────────────

export const syncPendingItems = async (onProgress) => {
  if (isSyncing) {
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  try {
    const db = await getDb();

    // Unlock items exhausted by previous failures so they get another chance
    await db.runAsync(
      `UPDATE sync_queue
       SET retry_count = 0, status = 'pending'
       WHERE status = 'pending' AND retry_count >= max_retries`
    );

    const pendingItems = await db.getAllAsync(
      `SELECT * FROM sync_queue
       WHERE status = 'pending' AND retry_count < max_retries
       ORDER BY
         CASE operation
           WHEN 'create_business_day'  THEN 1
           WHEN 'create_employee_shift' THEN 2
           WHEN 'create_scan'           THEN 3
           WHEN 'close_employee_shift'  THEN 4
           ELSE 5
         END,
         created_at ASC`
    );

    for (const item of pendingItems) {
      await db.runAsync(
        "UPDATE sync_queue SET status = 'syncing' WHERE uuid = ?",
        [item.uuid]
      );

      let result;
      switch (item.operation) {
        case 'create_business_day':
          result = await syncBusinessDay(db, item);
          break;
        case 'create_employee_shift':
          result = await syncEmployeeShift(db, item);
          break;
        case 'create_scan':
          result = await syncScan(db, item);
          break;
        case 'close_employee_shift':
          result = await syncCloseShift(db, item);
          break;
        default:
          result = { success: false, error: 'Unknown operation' };
      }

      if (result.success) {
        await db.runAsync(
          `UPDATE sync_queue SET status = 'synced', synced_at = ? WHERE uuid = ?`,
          [new Date().toISOString(), item.uuid]
        );
        synced++;
      } else if (result.conflict) {
        await db.runAsync(
          `UPDATE sync_queue SET status = 'conflict', last_error = ? WHERE uuid = ?`,
          [result.error, item.uuid]
        );
        conflicts++;
      } else {
        await db.runAsync(
          `UPDATE sync_queue
           SET status = 'pending', retry_count = retry_count + 1, last_error = ?
           WHERE uuid = ?`,
          [result.error, item.uuid]
        );
        failed++;
      }

      if (onProgress) {
        onProgress({
          synced, failed, conflicts,
          total: pendingItems.length,
          current: item.operation,
        });
      }
    }

  } finally {
    isSyncing = false;
  }

  return { synced, failed, conflicts };
};

// ─── CONNECTION LISTENER ──────────────────────────────────

export const startSyncListener = (onConnected, onDisconnected) => {
  return NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      if (onConnected) await onConnected();
    } else {
      if (onDisconnected) onDisconnected();
    }
  });
};

export const getPendingSyncCount = async () => {
  try {
    const db = await getDb();
    const result = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'"
    );
    return result?.count || 0;
  } catch {
    return 0;
  }
};

export const getFailedSyncCount = async () => {
  try {
    const db = await getDb();
    const result = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM sync_queue
       WHERE status = 'failed'
          OR (status = 'pending' AND retry_count >= max_retries)`
    );
    return result?.count || 0;
  } catch {
    return 0;
  }
};
