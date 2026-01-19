// export function formatDistanceToNow(dateInput) {
//   if (!dateInput) return ''
//   const date = new Date(dateInput)
//   const diff = Date.now() - date.getTime()
//   const seconds = Math.floor(diff / 1000)
//   if (Number.isNaN(seconds)) return ''
//   if (seconds < 60) return `${seconds}s ago`
//   const minutes = Math.floor(seconds / 60)
//   if (minutes < 60) return `${minutes}m ago`
//   const hours = Math.floor(minutes / 60)
//   if (hours < 24) return `${hours}h ago`
//   const days = Math.floor(hours / 24)
//   return `${days}d ago`
// }

export function formatDistanceToNowWithExactTime(dateString) {
  if (!dateString) return '';

  // Parse as UTC first
  const date = new Date(dateString + 'Z'); // Z ensures it's treated as UTC
  if (isNaN(date.getTime())) return '';

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
  const exactTime = date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return `${relative} (${exactTime})`;
}
