import api from './client';
import { getDb } from '../offline/db';
import { saveLocalScan, markLocalBookSold } from '../offline/localDb';
import { getSessionContext } from '../offline/sessionStore';

export async function recordScan({ shift_id, barcode, scan_type, force_sold = null }) {
  const { data } = await api.post('/scan', { shift_id, barcode, scan_type, force_sold });

  // Write-through: save scan to local DB (fire and forget)
  try {
    const { storeId, userId } = getSessionContext();
    if (storeId && userId && data.scan) {
      (async () => {
        try {
          const db = await getDb();
          const localShift = await db.getFirstAsync(
            'SELECT uuid FROM local_employee_shifts WHERE server_id = ?',
            [shift_id]
          );
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
          }
        } catch (e) {
          console.error('[scan write] FAILED:', e.message);
        }
      })();
    }
  } catch (e) {
    console.error('[scan write] FAILED:', e.message);
  }

  return data;
}
