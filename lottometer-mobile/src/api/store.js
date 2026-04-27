import api from './client';

export async function changeStorePin({ current_pin, new_pin }) {
  const { data } = await api.put('/store/settings/pin', { current_pin, new_pin });
  return data;
}