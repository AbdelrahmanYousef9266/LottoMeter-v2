/**
 * Date/Time utility functions for LottoMeter Dashboard
 * All functions convert UTC timestamps to local time via native Date methods.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Internal: normalize any date input to "YYYY-MM-DD" in local time, for comparisons only
function toLocalYMD(dateString) {
  if (!dateString) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * formatLocalTime("2026-04-30T09:14:00Z") → "09:14 AM"
 */
export function formatLocalTime(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
}

// Keep formatTime as alias for backwards compatibility
export const formatTime = formatLocalTime

/**
 * formatLocalDate("2026-04-30T09:14:00Z") → "Apr 30, 2026"
 */
export function formatLocalDate(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// Keep formatDate as alias for backwards compatibility
export const formatDate = formatLocalDate

/**
 * formatLocalDateTime("2026-04-30T09:14:00Z") → "Apr 30 · 09:14 AM"
 */
export function formatLocalDateTime(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()} · ${formatLocalTime(dateString)}`
}

// Keep formatDateTime as alias for backwards compatibility
export const formatDateTime = formatLocalDateTime

/**
 * formatBusinessDate("2026-04-30") → "Wed, Apr 30, 2026"
 * Parses YYYY-MM-DD as local date to avoid timezone shift.
 */
export function formatBusinessDate(dateString) {
  if (!dateString) return '—'
  const ymd = toLocalYMD(dateString)
  if (!ymd) return '—'
  const [year, month, day] = ymd.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * getDayLabel("2026-04-30") → "Today" | "Yesterday" | "Wed, Apr 30, 2026"
 */
export function getDayLabel(dateString) {
  if (!dateString) return '—'
  const input = toLocalYMD(dateString)
  const today = toLocalYMD(new Date().toISOString().slice(0, 10))
  if (input === today) return 'Today'

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (input === toLocalYMD(yesterday.toISOString().slice(0, 10))) return 'Yesterday'

  return formatBusinessDate(dateString)
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
