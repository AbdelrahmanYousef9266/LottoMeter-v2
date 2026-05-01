/**
 * Date/Time utility functions for LottoMeter Dashboard
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * formatDate("2026-04-30T09:14:00Z") → "Apr 30, 2026"
 */
export function formatDate(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * formatDateTime("2026-04-30T09:14:00Z") → "Apr 30, 2026 · 09:14 AM"
 */
export function formatDateTime(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  const datePart = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  const timePart = formatTime(dateString)
  return `${datePart} · ${timePart}`
}

/**
 * formatTime("2026-04-30T09:14:00Z") → "09:14 AM"
 */
export function formatTime(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
}

/**
 * getDayLabel("2026-04-30") → "Today" | "Yesterday" | "Apr 28, 2026"
 */
export function getDayLabel(dateString) {
  if (!dateString) return '—'
  const inputDate = formatBusinessDate(dateString)
  const today = formatBusinessDate(new Date().toISOString().slice(0, 10))
  if (inputDate === today) return 'Today'

  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = formatBusinessDate(yesterdayDate.toISOString().slice(0, 10))
  if (inputDate === yesterday) return 'Yesterday'

  return formatDate(dateString)
}

/**
 * formatBusinessDate("2026-04-30") → "2026-04-30" (parse without timezone shift)
 * Parses YYYY-MM-DD string treating it as local date, not UTC.
 */
export function formatBusinessDate(dateString) {
  if (!dateString) return '—'
  // If it's already a YYYY-MM-DD string, return as-is to avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString
  }
  // For ISO strings, extract the date portion in local time
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * formatDuration(startString, endString) → "2h 34m"
 */
export function formatDuration(startString, endString) {
  if (!startString || !endString) return '—'
  const start = new Date(startString)
  const end = new Date(endString)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—'
  const diffMs = end - start
  if (diffMs < 0) return '—'
  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
