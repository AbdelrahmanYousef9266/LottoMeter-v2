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