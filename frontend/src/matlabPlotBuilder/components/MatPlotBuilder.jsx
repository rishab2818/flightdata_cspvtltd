import React, { useEffect, useMemo, useState } from 'react'

import ViewIcon from '../../assets/ViewIcon.svg'
import ChartLine1 from '../../assets/ChartLine1.svg'
import { matPlotApi } from '../api/matPlotApi'
import { useMatVariables } from '../hooks/useMatVariables'
import { validateMatlabLikeRequest, extractResultShape, shapeText } from '../utils/matlabCompat'
import { displaySliceExpr, formatVariableSliceText } from '../utils/sliceHelpers'
import { openMatPreviewInNewTab } from '../utils/previewUrl'
import MatVariablePicker from './MatVariablePicker'

import '../styles/matPlotBuilder.css'

const CHART_OPTIONS = [
  { value: 'line', label: 'Line' },
  { value: 'scatter', label: 'Scatter' },
  { value: 'line3d', label: 'Line3D' },
  { value: 'scatter3d', label: 'Scatter3D' },
]

const parseError = (err, fallback) => err?.response?.data?.detail || err?.message || fallback

const normalizeMode = (chartType, currentMode) => {
  const chart = String(chartType || '').toLowerCase().trim()
  if (chart === 'line3d' || chart === 'scatter3d') return 'plot3'
  return currentMode === 'plot_xy' ? 'plot_xy' : 'plot_y'
}

const dimLabel = (index) => {
  const dim = Number(index)
  if (!Number.isInteger(dim) || dim < 0) return 'Dim ?'
  const matlabDim = dim + 1
  if (dim === 0) return `Dim ${matlabDim} (Rows)`
  if (dim === 1) return `Dim ${matlabDim} (Cols)`
  if (dim === 2) return `Dim ${matlabDim} (Pages)`
  return `Dim ${matlabDim}`
}

const extractDims = (shape) =>
  (Array.isArray(shape) ? shape : []).map((size, idx) => ({
    index: idx,
    label: dimLabel(idx),
    size: Number(size) || 0,
  }))

export default function MatPlotBuilder({
  projectId,
  datasetType,
  tagName,
  jobId,
  chartType,
  onChartTypeChange,
  series,
  onSeriesChange,
  loading,
  showViewAction = true,
}) {
  const { variables, numericVariables, loading: varsLoading, error: varsError } = useMatVariables(jobId)
  const [focusedVar, setFocusedVar] = useState('')
  const [focusedDetail, setFocusedDetail] = useState(null)
  const [focusedDetailLoading, setFocusedDetailLoading] = useState(false)
  const [focusedDetailError, setFocusedDetailError] = useState('')
  const [previewByAxis, setPreviewByAxis] = useState({
    x: { loading: false, error: '', shape: [] },
    y: { loading: false, error: '', shape: [] },
    z: { loading: false, error: '', shape: [] },
  })

  const mode = normalizeMode(chartType, series?.matMode)
  const isThreeD = mode === 'plot3'
  const signatureOptions = useMemo(
    () => [
      { value: 'plot_y', label: 'Plot(Y)' },
      { value: 'plot_xy', label: 'Plot(X, Y)' },
    ],
    []
  )

  const xVar = String(series?.matXVar || '').trim()
  const yVar = String(series?.matYVar || series?.matVar || '').trim()
  const zVar = String(series?.matZVar || '').trim()
  const xSlice = String(series?.matXSlice || '').trim()
  const ySlice = String(series?.matYSlice || series?.matSliceExpr || '').trim()
  const zSlice = String(series?.matZSlice || '').trim()

  useEffect(() => {
    const nextMode = normalizeMode(chartType, series?.matMode)
    if (nextMode !== series?.matMode) {
      onSeriesChange({ matMode: nextMode })
    }
  }, [chartType, onSeriesChange, series?.matMode])

  useEffect(() => {
    const preferred = yVar || numericVariables[0]?.name || variables[0]?.name || ''
    if (preferred && preferred !== focusedVar) {
      setFocusedVar(preferred)
    }
  }, [focusedVar, numericVariables, variables, yVar])

  useEffect(() => {
    let cancelled = false
    const safeVar = String(focusedVar || '').trim()
    const safeJob = String(jobId || '').trim()
    if (!safeJob || !safeVar) {
      setFocusedDetail(null)
      setFocusedDetailError('')
      return () => {
        cancelled = true
      }
    }

    const loadPreview = async () => {
      setFocusedDetailLoading(true)
      setFocusedDetailError('')
      try {
        const data = await matPlotApi.variablePreview(safeJob, safeVar)
        if (!cancelled) setFocusedDetail(data)
      } catch (err) {
        if (!cancelled) {
          setFocusedDetail(null)
          setFocusedDetailError(parseError(err, 'Failed to load variable detail'))
        }
      } finally {
        if (!cancelled) setFocusedDetailLoading(false)
      }
    }

    loadPreview()
    return () => {
      cancelled = true
    }
  }, [focusedVar, jobId])

  useEffect(() => {
    let cancelled = false

    const refreshAxisPreview = async (axisKey, variableName, sliceExpr) => {
      const safeVar = String(variableName || '').trim()
      const safeSlice = String(sliceExpr || '').trim()
      const safeJob = String(jobId || '').trim()

      if (!safeJob || !safeVar) {
        setPreviewByAxis((prev) => ({
          ...prev,
          [axisKey]: { loading: false, error: '', shape: [] },
        }))
        return
      }

      setPreviewByAxis((prev) => ({
        ...prev,
        [axisKey]: { ...prev[axisKey], loading: true, error: '' },
      }))

      try {
        const data = await matPlotApi.variableDataPreview(safeJob, safeVar, safeSlice)
        if (cancelled) return
        setPreviewByAxis((prev) => ({
          ...prev,
          [axisKey]: {
            loading: false,
            error: '',
            shape: extractResultShape(data),
          },
        }))
      } catch (err) {
        if (cancelled) return
        setPreviewByAxis((prev) => ({
          ...prev,
          [axisKey]: {
            loading: false,
            error: parseError(err, 'Invalid MATLAB slice'),
            shape: [],
          },
        }))
      }
    }

    refreshAxisPreview('y', yVar, ySlice)
    if (mode !== 'plot_y') refreshAxisPreview('x', xVar, xSlice)
    if (mode === 'plot3') refreshAxisPreview('z', zVar, zSlice)
    return () => {
      cancelled = true
    }
  }, [jobId, mode, xSlice, xVar, ySlice, yVar, zSlice, zVar])

  const compatibilityError = useMemo(
    () =>
      validateMatlabLikeRequest({
        mode,
        chartType,
        xPreview: previewByAxis.x,
        yPreview: previewByAxis.y,
        zPreview: previewByAxis.z,
      }),
    [chartType, mode, previewByAxis.x, previewByAxis.y, previewByAxis.z]
  )

  const signatureText = useMemo(() => {
    if (mode === 'plot3') {
      return [
        formatVariableSliceText(xVar, xSlice),
        formatVariableSliceText(yVar, ySlice),
        formatVariableSliceText(zVar, zSlice),
      ]
        .filter(Boolean)
        .join(', ')
    }
    if (mode === 'plot_xy') {
      return [
        formatVariableSliceText(xVar, xSlice),
        formatVariableSliceText(yVar, ySlice),
      ]
        .filter(Boolean)
        .join(', ')
    }
    return formatVariableSliceText(yVar, ySlice)
  }, [mode, xSlice, xVar, ySlice, yVar, zSlice, zVar])

  const canPlot = !loading && !compatibilityError

  return (
    <div className="mat-plot-builder">
      <div className="mat-plot-builder__header">
        <div className="mat-plot-builder__field">
          <label>MAT Chart Type</label>
          <select
            value={chartType}
            onChange={(event) => onChartTypeChange?.(event.target.value)}
          >
            {CHART_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {!isThreeD && (
          <div className="mat-plot-builder__field">
            <label>Signature</label>
            <div className="mat-plot-builder__signature">
              {signatureOptions.map((item) => (
                <label key={item.value}>
                  <input
                    type="radio"
                    name="mat-signature"
                    value={item.value}
                    checked={mode === item.value}
                    onChange={(event) => onSeriesChange({ matMode: event.target.value })}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {showViewAction && (
          <div className="mat-plot-builder__field mat-plot-builder__field--view">
            <label>MAT Preview</label>
            <button
              type="button"
              className="project-shell__nav-link"
              disabled={!jobId}
              onClick={() =>
                openMatPreviewInNewTab({
                  projectId,
                  datasetType,
                  tagName,
                  jobId,
                })
              }
            >
              <img src={ViewIcon} alt="view" style={{ width: 16, height: 16 }} />
              View
            </button>
          </div>
        )}
      </div>

      <div className="mat-plot-builder__panel">
        <div className="mat-plot-builder__panel-title"> Plot Builder</div>

        {(mode === 'plot_xy' || mode === 'plot3') && (
          <MatVariablePicker
            label="X Variable"
            variables={numericVariables}
            valueVar={xVar}
            valueSlice={xSlice}
            onVarChange={(value) => onSeriesChange({ matXVar: value })}
            onSliceChange={(value) => onSeriesChange({ matXSlice: value })}
            preview={previewByAxis.x}
            required
            disabled={!jobId}
          />
        )}

        <MatVariablePicker
          label="Y Variable"
          variables={numericVariables}
          valueVar={yVar}
          valueSlice={ySlice}
          onVarChange={(value) => onSeriesChange({ matYVar: value, matVar: value })}
          onSliceChange={(value) => onSeriesChange({ matYSlice: value, matSliceExpr: value })}
          preview={previewByAxis.y}
          required
          disabled={!jobId}
        />

        {mode === 'plot3' && (
          <MatVariablePicker
            label="Z Variable"
            variables={numericVariables}
            valueVar={zVar}
            valueSlice={zSlice}
            onVarChange={(value) => onSeriesChange({ matZVar: value })}
            onSliceChange={(value) => onSeriesChange({ matZSlice: value })}
            preview={previewByAxis.z}
            required
            disabled={!jobId}
          />
        )}

        <div className="mat-plot-builder__preview-text">
          Slice Preview: {signatureText || 'Select variable(s)'} | Empty slice means full variable (`:`).
        </div>
      </div>

      <div className="mat-plot-builder__footer">
        <div className="ps-field">
          <label>Plot Name (Optional)</label>
          <input
            placeholder="Defaults to MATLAB signature"
            value={series?.label || ''}
            onChange={(event) => onSeriesChange({ label: event.target.value })}
          />
        </div>
        <div className="ps-field">
          <button type="submit" className="plot-btn" disabled={!canPlot}>
            <img src={ChartLine1} alt="chart" />
            {loading ? 'Generating…' : 'Generate Plot'}
          </button>
        </div>
      </div>

      <div className="summary-label mat-plot-builder__hint">
        MATLAB slices are 1-based and sent as-is: Y({displaySliceExpr(ySlice)})
      </div>
      {!!compatibilityError && (
        <div className="project-shell__error">{compatibilityError}</div>
      )}
    </div>
  )
}
