export const normalizeBarcode = (raw) => {
  if (!raw) return '';
  // Remove all non-digits and trim
  let normalized = raw.toString().trim().replace(/\D/g, '');
  // ITF-14: strip last digit (check digit) from 14-digit barcodes
  // The actual EAN-13 barcode is the first 13 digits
  if (normalized.length === 14) {
    normalized = normalized.substring(0, 13);
  }
  return normalized;
};

export const isValidBarcode = (barcode) => {
  return /^\d{13}$/.test(normalizeBarcode(barcode));
};
