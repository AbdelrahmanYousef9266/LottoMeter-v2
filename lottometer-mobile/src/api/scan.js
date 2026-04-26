import api from './client';

export async function recordScan({ shift_id, barcode, scan_type }) {
  const { data } = await api.post('/scan', { shift_id, barcode, scan_type });
  return data;
}