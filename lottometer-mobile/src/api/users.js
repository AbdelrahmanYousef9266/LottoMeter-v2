import api from './client';

export async function listUsers() {
  const { data } = await api.get('/users');
  return data.users || [];
}

export async function createUser({ username, password, role }) {
  const { data } = await api.post('/users', { username, password, role });
  return data.user;
}

export async function updateUser(userId, payload) {
  // payload may contain: username, role, new_password
  const { data } = await api.put(`/users/${userId}`, payload);
  return data.user;
}

export async function deleteUser(userId) {
  await api.delete(`/users/${userId}`);
}