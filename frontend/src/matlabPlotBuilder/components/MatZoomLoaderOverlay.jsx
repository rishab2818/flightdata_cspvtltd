import React from 'react'

export default function MatZoomLoaderOverlay({ active }) {
  if (!active) return null
  return (
    <div className="mat-zoom-loader__overlay" aria-live="polite" aria-busy="true">
      <div className="mat-zoom-loader__spinner" />
      <span className="mat-zoom-loader__label">Updating MAT plot...</span>
    </div>
  )
}
