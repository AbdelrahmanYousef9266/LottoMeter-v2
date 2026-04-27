/**
 * Book lengths by ticket price — must match the backend's LENGTH_BY_PRICE.
 * Source: SRS §5.1
 */
export const LENGTH_BY_PRICE = {
  '1.00': 150,
  '2.00': 150,
  '3.00': 100,
  '5.00': 60,
  '10.00': 30,
  '20.00': 30,
};

/**
 * Returns the book length (number of tickets) for a given ticket price.
 * Returns null if the price is invalid.
 */
export function lengthForPrice(ticketPrice) {
  return LENGTH_BY_PRICE[ticketPrice] ?? null;
}

/**
 * Last valid position for a book at this price (length - 1, since positions are 0-indexed).
 */
export function lastPositionFor(ticketPrice) {
  const len = lengthForPrice(ticketPrice);
  return len === null ? null : len - 1;
}

/**
 * Parse a barcode into (static_code, position).
 * Returns null if the barcode is too short.
 */
export function parseBarcode(barcode) {
  if (!barcode || barcode.length < 4) return null;
  return {
    static_code: barcode.slice(0, -3),
    position: parseInt(barcode.slice(-3), 10),
  };
}