import api from './client';

export async function submitComplaint({ subject, message }) {
  const { data } = await api.post('/complaints', { subject, message });
  return data;
}
