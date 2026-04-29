import api from './client';

export async function recordScan({ shift_id, barcode, scan_type, force_sold = null }) {
  const { data } = await api.post('/scan', { shift_id, barcode, scan_type, force_sold });
  return data;
}