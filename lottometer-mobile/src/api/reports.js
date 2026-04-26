import api from './client';

export async function getShiftReport(shiftId) {
  const { data } = await api.get(`/reports/shift/${shiftId}`);
  return data;
}