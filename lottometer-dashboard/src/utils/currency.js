/**
 * Currency utility functions for LottoMeter Dashboard
 */

/**
 * formatCurrency(1234.56) → "$1,234.56"
 * formatCurrency(null) → "$0.00"
 */
export function formatCurrency(value) {
  const num = parseFloat(value)
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * formatVariance(12.00) → { text: "+$12.00", isPositive: true, isNegative: false }
 * formatVariance(-5.00) → { text: "-$5.00", isPositive: false, isNegative: true }
 * formatVariance(0) → { text: "$0.00", isPositive: false, isNegative: false }
 */
export function formatVariance(value) {
  const num = parseFloat(value)
  if (isNaN(num)) {
    return { text: '$0.00', isPositive: false, isNegative: false }
  }
  const abs = Math.abs(num)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)

  if (num > 0) {
    return { text: `+${formatted}`, isPositive: true, isNegative: false }
  } else if (num < 0) {
    return { text: `-${formatted}`, isPositive: false, isNegative: true }
  } else {
    return { text: formatted, isPositive: false, isNegative: false }
  }
}
