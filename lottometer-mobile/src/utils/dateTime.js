// Normalize a server UTC string that may lack a timezone suffix.
// The Flask API returns bare ISO strings like "2026-05-10T04:48:34.548042"
// (no Z). JS Date treats those as local time, so we force UTC by appending Z.
const toUtc = (s) =>
  s && !s.endsWith('Z') && !s.includes('+') ? s + 'Z' : s;

// Format a UTC timestamp to local time — e.g. "09:14 AM"
export const formatLocalTime = (utcString) => {
  if (!utcString) return '—';
  return new Date(toUtc(utcString)).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Format a UTC timestamp to local date — e.g. "May 10, 2026"
export const formatLocalDate = (utcString) => {
  if (!utcString) return '—';
  return new Date(toUtc(utcString)).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format a UTC timestamp to local date + time — e.g. "May 10, 09:14 AM"
export const formatLocalDateTime = (utcString) => {
  if (!utcString) return '—';
  return new Date(toUtc(utcString)).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Format business_date (DATE only, no time) — e.g. "Wednesday, April 30 2026"
// business_date comes as "2026-04-30" string — parse without timezone shift
export const formatBusinessDate = (dateString) => {
  if (!dateString) return '—';
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format a duration between two UTC timestamps — e.g. "2h 15m", "45m", "3h"
// If endUtc is omitted, uses the current time (active shift).
export const formatDuration = (startUtc, endUtc) => {
  if (!startUtc) return '—';

  const addZ = (s) => {
    if (!s) return s;
    if (s.endsWith('Z') || s.includes('+')) return s;
    return s + 'Z';
  };

  const start = new Date(addZ(startUtc));
  const end   = endUtc ? new Date(addZ(endUtc)) : new Date();

  if (isNaN(start.getTime())) return '—';
  if (isNaN(end.getTime())) return '—';

  const diffMs = end - start;
  if (diffMs < 0) return '0m';

  const hours   = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

// Returns "Today", "Yesterday", or formatted date
export const formatDayLabel = (dateString) => {
  if (!dateString) return '—';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};
