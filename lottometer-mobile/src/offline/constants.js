// Mirrors server constants.py LENGTH_BY_PRICE
export const LENGTH_BY_PRICE = {
  '1.00': 300,
  '2.00': 150,
  '3.00': 100,
  '5.00': 60,
  '10.00': 30,
  '20.00': 15,
  '25.00': 12,
  '30.00': 10,
};

export const getLengthForPrice = (price) => {
  const key = parseFloat(price).toFixed(2);
  return LENGTH_BY_PRICE[key] || null;
};

export const getLastPosition = (price) => {
  const length = getLengthForPrice(price);
  return length ? length - 1 : null;
};
