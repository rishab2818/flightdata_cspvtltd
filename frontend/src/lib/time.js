const IST_TIME_ZONE = 'Asia/Kolkata'

const parseDateInput = (dateInput) => {
  if (!dateInput) return null

  if (dateInput instanceof Date) {
    return Number.isNaN(dateInput.getTime()) ? null : dateInput
  }

  const raw = String(dateInput).trim()
  if (!raw) return null

  // Many backend values are stored as UTC but serialized without a timezone.
  // Treat timezone-less ISO-like values as UTC so the UI does not shift them
  // twice when rendering in IST.
  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw)
  const candidate = hasTimezone ? raw : `${raw}Z`
  const date = new Date(candidate)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDistanceToNowWithExactTime(dateString) {
  const date = parseDateInput(dateString)
  if (!date) return ''

  // Relative time
  const now = new Date();
  const diffMs = now - date;

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = '';
  if (diffSeconds < 60) relative = 'just now';
  else if (diffMinutes < 60) relative = `${diffMinutes} min ago`;
  else if (diffHours < 24) relative = `${diffHours} h ago`;
  else relative = `${diffDays} d ago`;

  // Convert UTC to local time for display
  const exactTime = date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: IST_TIME_ZONE,
  });

  return `${relative} (${exactTime})`;
}

export function formatDateTimeShort(dateInput) {
  const date = parseDateInput(dateInput)
  if (!date) return '-'

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)

  const pick = (type) => parts.find((part) => part.type === type)?.value || ''
  const day = pick('day')
  const month = pick('month')
  const year = pick('year')
  const hour = pick('hour')
  const minute = pick('minute')
  const dayPeriod = pick('dayPeriod').toUpperCase()

  return `${day}/${month}/${year} : ${hour}:${minute} ${dayPeriod}`.trim()
}
