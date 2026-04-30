import api from './client';

export const getCurrentOpenShift = async () => {
  const response = await api.get('/shifts');
  const shifts = response.data.shifts;
  return shifts.find(s => s.status === 'open') || null;
};

export async function openShift() {
  const { data } = await api.post('/shifts');
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
  return data;
}

// Legacy aliases — kept so CloseShiftModal's internal imports don't break
export const closeMainShift = closeShift;