export const LENGTH_BY_PRICE = {
  '1.00': 300,
  '2.00': 150,
  '3.00': 100,
  '5.00': 60,
  '10.00': 30,
  '20.00': 15,
  '25.00': 12,
  '30.00': 10,
}

export const getTicketsRemaining = (closePosition, ticketPrice) => {
  if (closePosition === null || closePosition === undefined) return null
  const key = parseFloat(ticketPrice).toFixed(2)
  const totalLength = LENGTH_BY_PRICE[key]
  if (!totalLength) return null
  return totalLength - closePosition - 1
}
