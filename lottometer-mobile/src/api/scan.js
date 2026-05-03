import api from './client';
import { getDb } from '../offline/db';
import { saveLocalScan, markLocalBookSold } from '../offline/localDb';
import { getSessionContext } from '../offline/sessionStore';
import { debugLocalDb } from '../offline/debugDb';

export async function recordScan({ shift_id, barcode, scan_type, force_sold = null }) {
  const { data } = await api.post('/scan', { shift_id, barcode, scan_type, force_sold });

  // Write-through: save scan to local DB (fire and forget)
  try {
    console.log('[scan write] attempting write, shift_id:', shift_id);
    const { storeId, userId } = getSessionContext();
    console.log('[scan write] session context — storeId:', storeId, 'userId:', userId);
    console.log('[scan write] data.scan present:', !!data.scan);

    if (storeId && userId && data.scan) {
      (async () => {
        try {
          const db = await getDb();
          const localShift = await db.getFirstAsync(
            'SELECT uuid FROM local_employee_shifts WHERE server_id = ?',
            [shift_id]
          );
          console.log('[scan write] shift_id:', shift_id, 'localShift:', localShift);

          if (localShift?.uuid) {
            await saveLocalScan(
              { ...data.scan, static_code: data.book?.static_code, id: null },
              localShift.uuid,
              storeId,
              userId
            );
            if (data.book?.is_sold) {
              await markLocalBookSold(data.book.static_code, storeId);
            }
            console.log('[scan write] saved to local DB');
          } else {
            console.warn('[scan write] shift not found in local DB, shift_id:', shift_id);
          }
          debugLocalDb().catch(console.warn);
        } catch (e) {
          console.error('[scan write] FAILED:', e.message);
        }
      })();
    } else {
      console.warn('[scan write] skipped — missing storeId, userId, or data.scan');
    }
  } catch (e) {
    console.error('[scan write] FAILED:', e.message);
  }

  return data;
}
