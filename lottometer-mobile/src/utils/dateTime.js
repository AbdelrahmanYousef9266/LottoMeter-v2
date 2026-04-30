// Format a UTC timestamp to local time — e.g. "09:14 AM"
export const formatLocalTime = (utcString) => {
  if (!utcString) return '—';
  return new Date(utcString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// Format a UTC timestamp to local date — e.g. "Wednesday, April 30 2026"
export const formatLocalDate = (utcString) => {
  if (!utcString) return '—';
  return new Date(utcString).toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Format a UTC timestamp to local date + time — e.g. "Apr 30, 09:14 AM"
export const formatLocalDateTime = (utcString) => {
  if (!utcString) return '—';
  return new Date(utcString).toLocaleString([], {
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
