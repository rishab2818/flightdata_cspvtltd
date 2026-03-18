import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ingestionApi } from '../../../api/ingestionApi'

import './DataBrowserModal.css'

const PAGE_SIZE = 20
const MAX_CHECKED_Y = 10
const DOM_ROW_CAP = 200
const SCROLL_DEBOUNCE_MS = 60

const toInitialRows = (rows) => (Array.isArray(rows) ? rows.slice(0, PAGE_SIZE) : [])

const formatCell = (value) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—'
    return Number(value.toPrecision(6)).toString()
  }
  if (typeof value === 'string') {
    return value.length > 40 ? `${value.slice(0, 37)}...` : value
  }
  return String(value)
}

export default function DataBrowserModal({
  isOpen,
  onClose,
  jobId,
  columns,
  initialRows,
  totalRows,
  onSelectX,
  onSelectY,
  onSelectZ,
  onSelectRowX,
  onSelectRowY,
  showZ,
  showRowSelect,
  currentX,
  currentY,
  currentZ,
  targetAxis,
}) {
  const tableRef = useRef(null)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  const [rows, setRows] = useState(() => toInitialRows(initialRows))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkedColumns, setCheckedColumns] = useState(() => new Set())
  const [warning, setWarning] = useState('')
  const [resolvedTotal, setResolvedTotal] = useState(Number(totalRows) || 0)
  const [resolvedColumns, setResolvedColumns] = useState(
    Array.isArray(columns) ? columns : []
  )

  const resetState = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setRows(toInitialRows(initialRows))
    setLoading(false)
    setError('')
    setWarning('')
    setCheckedColumns(new Set())
    setResolvedTotal(Number(totalRows) || 0)
    setResolvedColumns(Array.isArray(columns) ? columns : [])
    if (tableRef.current) {
      tableRef.current.scrollTop = 0
    }
  }, [columns, initialRows, totalRows])

  useEffect(() => {
    if (isOpen) {
      resetState()
      return undefined
    }
    resetState()
    return undefined
  }, [isOpen, resetState])

  const displayColumns = useMemo(() => {
    if (resolvedColumns.length) return resolvedColumns
    if (Array.isArray(columns) && columns.length) return columns
    const first = rows[0]
    return first ? Object.keys(first) : []
  }, [columns, resolvedColumns, rows])

  const hasMore = useMemo(() => {
    if (resolvedTotal > 0) return rows.length < resolvedTotal
    return true
  }, [resolvedTotal, rows.length])

  const fetchNextPage = useCallback(async () => {
    if (!isOpen || !jobId || loading || !hasMore) return

    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError('')
    try {
      const payload = await ingestionApi.previewRows(jobId, {
        limit: PAGE_SIZE,
        offset: rows.length,
        signal: controller.signal,
      })
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : []
      const nextTotal = Number(payload?.total)
      const nextColumns = Array.isArray(payload?.columns) ? payload.columns : []

      setRows((prev) => [...prev, ...nextRows])
      if (Number.isFinite(nextTotal) && nextTotal >= 0) {
        setResolvedTotal(nextTotal)
      }
      if (nextColumns.length) {
        setResolvedColumns(nextColumns)
      }
    } catch (err) {
      if (controller.signal.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        return
      }
      setError(err?.response?.data?.detail || err?.message || 'Failed to load preview rows.')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      setLoading(false)
    }
  }, [hasMore, isOpen, jobId, loading, rows.length])

  useEffect(() => {
    if (!isOpen) return undefined
    const el = tableRef.current
    if (!el) return undefined

    const onScroll = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
        if (nearBottom) fetchNextPage()
      }, SCROLL_DEBOUNCE_MS)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [fetchNextPage, isOpen])

  const handleClose = useCallback(() => {
    resetState()
    onClose?.()
  }, [onClose, resetState])

  const toggleCheckedColumn = useCallback((columnName) => {
    setWarning('')
    setCheckedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(columnName)) {
        next.delete(columnName)
        return next
      }
      if (next.size >= MAX_CHECKED_Y) {
        setWarning(`You can select at most ${MAX_CHECKED_Y} columns at once.`)
        return prev
      }
      next.add(columnName)
      return next
    })
  }, [])

  const handleAddCheckedAsY = useCallback(() => {
    const picked = Array.from(checkedColumns)
    if (!picked.length) return
    onSelectY?.(picked)
    handleClose()
  }, [checkedColumns, handleClose, onSelectY])

  const renderedRows = rows.length > DOM_ROW_CAP ? rows.slice(-DOM_ROW_CAP) : rows
  const renderedStart = Math.max(0, rows.length - renderedRows.length)

  if (!isOpen) return null

  return (
    <div className="db-modal__overlay" role="presentation" onMouseDown={handleClose}>
      <div
        className="db-modal__container"
        role="dialog"
        aria-modal="true"
        aria-label="Data browser"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="db-modal__header">
          <strong>Data Browser</strong>
          <button type="button" className="db-modal__close" onClick={handleClose}>X</button>
        </div>

        {/* <div className="db-modal__hint">
          Select columns for axes{targetAxis ? ` (current target: ${String(targetAxis).toUpperCase()})` : ''}
        </div> */}

        <div className="db-modal__table-wrap" ref={tableRef}>
           <div className="db-modal__table-inner">
          <table className="db-modal__table">
            <thead>
              <tr>
                <th className="db-modal__row-index-head"># Row</th>
                {displayColumns.map((col) => {
                  const isX = currentX === col
                  const isY = currentY === col
                  const isZ = currentZ === col
                  const checked = checkedColumns.has(col)
                  return (
                    <th
                      key={`db-col-${col}`}
                      className={[
                        'db-modal__head-cell',
                        isX ? 'is-x' : '',
                        isY ? 'is-y' : '',
                        isZ ? 'is-z' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="db-modal__head-main">
                        <span className="db-modal__head-label" title={col}>{col}</span>
                        <label className="db-modal__check-wrap" title="Check for multi-Y selection">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheckedColumn(col)}
                          />
                        </label>
                      </div>
                      <div className="db-modal__axis-actions">
                        <button type="button" onClick={() => { onSelectX?.(col); handleClose() }}>[X]</button>
                        <button type="button" onClick={() => { onSelectY?.(col); handleClose() }}>[Y]</button>
                        {showZ && (
                          <button type="button" onClick={() => { onSelectZ?.(col); handleClose() }}>[Z]</button>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {renderedRows.map((row, index) => (
                <tr key={`db-row-${index}`}>
                  <td className="db-modal__row-index-cell">
                    <span>{renderedStart + index + 1}</span>
                    {showRowSelect && (
                      <span className="row-axis-btns">
                        <button
                          type="button"
                          className="axis-tag-btn"
                          onClick={() => onSelectRowX?.(renderedStart + index + 1, row)}
                          title="Use as X axis"
                        >
                          →X
                        </button>
                        <button
                          type="button"
                          className="axis-tag-btn"
                          onClick={() => onSelectRowY?.(renderedStart + index + 1, row)}
                          title="Use as Y axis"
                        >
                          →Y
                        </button>
                      </span>
                    )}
                  </td>
                  {displayColumns.map((col) => (
                    <td key={`db-cell-${index}-${col}`} title={row?.[col] == null ? '' : String(row[col])}>
                      {formatCell(row?.[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {loading && (
                <tr>
                  <td className="db-modal__loading" colSpan={Math.max(displayColumns.length + 1, 1)}>
                    Loading more rows...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="db-modal__meta">
          {rows.length > DOM_ROW_CAP && <span>Showing most recent {DOM_ROW_CAP} rows</span>}
          <span>Loaded {rows.length}{resolvedTotal > 0 ? ` / ${resolvedTotal}` : ''} rows</span>
        </div>

        {error && <div className="db-modal__error">{error}</div>}
        {warning && <div className="db-modal__warning">{warning}</div>}

        {checkedColumns.size > 0 && (
          <div className="db-modal__footer">
            <button type="button" className="project-shell__nav-save" onClick={handleAddCheckedAsY}>
              Add {checkedColumns.size} column{checkedColumns.size > 1 ? 's' : ''} as Y
            </button>
            <button
              type="button"
              className="project-shell__nav-link"
              onClick={() => setCheckedColumns(new Set())}
            >
              Deselect all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
