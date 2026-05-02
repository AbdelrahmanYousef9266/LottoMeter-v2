// Fallback constants used when local DB hasn't been seeded yet.
// The server-authoritative version is stored in local_constants after first login.

export const LENGTH_BY_PRICE = {
  '1.00': 300,
  '2.00': 150,
  '3.00': 100,
  '5.00': 60,
  '10.00': 30,
  '20.00': 15,
};

export const getLengthForPrice = (price) => {
  const key = parseFloat(price).toFixed(2);
  return LENGTH_BY_PRICE[key] || null;
};
