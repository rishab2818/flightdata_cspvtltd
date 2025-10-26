import React from 'react'

export default function Icon({ name, className = 'h-5 w-5' }) {
  if (name === 'db') {
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <circle cx="8" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M2 20c.8-3 4-5 6-5s5.2 2 6 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }
  if (name === 'gear') {
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm8.5 3.5-.9-.5.2-1-1.5-2.6-1 .3-.7-.7.3-1-2.6-1.5-1 .2-.5-.9h-3l-.5.9-1-.2L4.7 6.5l.3 1-.7.7-1-.3L1.8 10.5l.2 1-.9.5v3l.9.5-.2 1 1.5 2.6 1-.3.7.7-.3 1 2.6 1.5 1-.2.5.9h3l.5-.9 1 .2 2.6-1.5-.3-1 .7-.7 1 .3 1.5-2.6-.2-1 .9-.5v-3Z" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    )
  }
  return null
}
