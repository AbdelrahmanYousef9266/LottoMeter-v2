import api from './client';

export async function listBusinessDays() {
  const { data } = await api.get('/business-days');
  return data;
}

export async function getTodaysBusinessDay() {
  const { data } = await api.get('/business-days/today');
  return data.business_day;
}

export async function getBusinessDay(id) {
  const { data } = await api.get(`/business-days/${id}`);
  return data;
}

export async function closeBusinessDay(id) {
  const { data } = await api.post(`/business-days/${id}/close`);
  return data.business_day;
}
