import api, { saveToken, clearToken } from './client';

export async function login({ store_code, username, password }) {
  const { data } = await api.post('/auth/login', { store_code, username, password });
  await saveToken(data.token);
  return data;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch (_) {
    // Best-effort
  }
  await clearToken();
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}