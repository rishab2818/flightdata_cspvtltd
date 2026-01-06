export function formatDistanceToNow(dateInput) {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  const diff = Date.now() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (Number.isNaN(seconds)) return ''
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
