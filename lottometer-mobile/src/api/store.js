import api from './client';

export async function changeStorePin({ current_pin, new_pin }) {
  const { data } = await api.put('/store/settings/pin', { current_pin, new_pin });
  return data;
}

export async function changeScanMode(scanMode) {
  const { data } = await api.put('/store/settings/scan-mode', {
    scan_mode: scanMode,
  });
  return data;
}

export async function setStorePin({ pin, confirm_pin }) {
  const { data } = await api.put('/store/pin', { pin, confirm_pin });
  return data; // { message }
}

export async function verifyStorePin({ pin }) {
  const { data } = await api.post('/store/verify-pin', { pin });
  return data; // { valid: true }
}