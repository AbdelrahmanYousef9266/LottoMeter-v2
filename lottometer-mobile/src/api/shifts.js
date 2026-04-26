import api from './client';

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

export async function handoverSubshift(shiftId, payload) {
  const { data } = await api.post(`/shifts/${shiftId}/subshifts`, payload);
  return data;
}

export async function closeMainShift(shiftId, payload) {
  const { data } = await api.put(`/shifts/${shiftId}/close`, payload);
  return data;
}