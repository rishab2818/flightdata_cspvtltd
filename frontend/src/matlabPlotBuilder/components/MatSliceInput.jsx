import React from 'react'

export default function MatSliceInput({
  value,
  onChange,
  placeholder = '(:, :, 1)',
  disabled = false,
}) {
  return (
    <input
      className="mat-plot-builder__slice-input"
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}
