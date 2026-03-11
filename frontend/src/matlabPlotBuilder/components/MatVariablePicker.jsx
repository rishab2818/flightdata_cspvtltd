import React from 'react'

import MatSliceInput from './MatSliceInput'
import { shapeText } from '../utils/matlabCompat'
import { formatVariableSliceText } from '../utils/sliceHelpers'

export default function MatVariablePicker({
  label,
  variables = [],
  valueVar = '',
  valueSlice = '',
  onVarChange,
  onSliceChange,
  preview,
  required = false,
  disabled = false,
}) {
  return (
    <div className="mat-plot-builder__picker">
      <div className="mat-plot-builder__picker-head">
        <label>
          {label}
          {/* {required ? ' *' : ''} */}
        </label>
        <span className="summary-label">
          {valueVar ? formatVariableSliceText(valueVar, valueSlice) : 'No variable selected'}
        </span>
      </div>

      <div className="mat-plot-builder__picker-stack">
        <select
          value={valueVar || ''}
          onChange={(event) => onVarChange?.(event.target.value)}
          disabled={disabled}
        >
          <option value="">Select variable</option>
          {variables.map((item) => (
            <option key={item?.name} value={item?.name}>
              {item?.name} ({shapeText(item?.shape)})
            </option>
          ))}
        </select>

        <MatSliceInput
          value={valueSlice}
          onChange={onSliceChange}
          disabled={disabled || !valueVar}
          placeholder="Slice (optional): :, or :, :, 1"
        />
      </div>

      <div className="summary-label">
        {preview?.loading ? 'Checking slice...' : ''}
        {!preview?.loading && preview?.error ? preview.error : ''}
        {!preview?.loading && !preview?.error && preview?.shape?.length
          ? `Result shape: ${shapeText(preview.shape)}`
          : ''}
      </div>
    </div>
  )
}