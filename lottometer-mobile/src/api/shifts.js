import api from './client';
import { getDb } from '../offline/db';
import { saveLocalBusinessDay, saveLocalEmployeeShift, closeLocalEmployeeShift } from '../offline/localDb';
import { getSessionContext } from '../offline/sessionStore';
import { getTodaysBusinessDay } from './businessDays';

export const getCurrentOpenShift = async () => {
  const response = await api.get('/shifts');
  const shifts = response.data.shifts;
  return shifts.find(s => s.status === 'open') || null;
};

export async function openShift() {
  const { data } = await api.post('/shifts');

  // Write-through: save business day + shift to local DB (fire and forget)
  const { storeId } = getSessionContext();
  if (storeId && data.employee_shift) {
    (async () => {
      try {
        const shift = data.employee_shift;
        const db = await getDb();
        // Look up business day uuid — may already be seeded
        let dayRow = await db.getFirstAsync(
          'SELECT uuid FROM local_business_days WHERE server_id = ?',
          [shift.business_day_id]
        );
        if (!dayRow) {
          // Business day not seeded yet (first shift of the day) — fetch and save
          const day = await getTodaysBusinessDay();
          if (day) {
            const dayUuid = await saveLocalBusinessDay(day, storeId);
            if (dayUuid) dayRow = { uuid: dayUuid };
          }
        }
        if (dayRow?.uuid) {
          await saveLocalEmployeeShift(shift, dayRow.uuid, storeId);
        }
      } catch (e) {
        console.warn('[shifts] write-through openShift:', e.message);
      }
    })();
  }

  return data;
}

export async function listShifts(params = {}) {
  const { data } = await api.get('/shifts', { params });
  return data;
}

export async function getShift(shiftId) {
  const { data } = await api.get(`/shifts/${shiftId}`);
  return data;
}

export async function getShiftSummary(shiftId) {
  const { data } = await api.get(`/shifts/${shiftId}/summary`);
  return data;
}

// Kept for CloseShiftModal backward compatibility (same endpoint, new name)
export const getSubshiftSummary = getShiftSummary;

export async function closeShift(shiftId, payload) {
  const { data } = await api.put(`/shifts/${shiftId}/close`, payload);

  // Write-through: update shift in local DB (fire and forget)
  // Note: closeShift response uses key 'shift' (openShift uses 'employee_shift')
  const { storeId } = getSessionContext();
  if (storeId && data.shift) {
    closeLocalEmployeeShift(shiftId, data.shift).catch(e =>
      console.warn('[shifts] write-through closeShift:', e.message)
    );
  }

  return data;
}

// Legacy aliases — kept so CloseShiftModal's internal imports don't break
export const closeMainShift = closeShift;
