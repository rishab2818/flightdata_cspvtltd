import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { matApi } from './matApi'

const toShapeText = (shape) => {
  if (!Array.isArray(shape) || !shape.length) return ''
  return shape.join('x')
}

const defaultSliceExpr = (ndim) => {
  if (!ndim || ndim <= 0) return ''
  if (ndim === 1) return ':'
  if (ndim === 2) return ':, :'
  return [':', ':', ...Array(Math.max(0, ndim - 2)).fill('1')].join(', ')
}

function PreviewTable({ headers = [], rows = [] }) {
  return (
    <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', width: 56 }}></th>
          {headers.map((h) => (
            <th key={`head-${h}`} style={{ textAlign: 'left' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={`row-${rowIdx}`}>
            <th style={{ textAlign: 'left', fontWeight: 600 }}>{rowIdx + 1}</th>
            {(row || []).map((cell, colIdx) => (
              <td key={`cell-${rowIdx}-${colIdx}`}>{String(cell ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function MatlabPreviewPanel({ jobId, variables = [], onRefreshVariables }) {
  const numericVars = useMemo(
    () => (variables || []).filter((item) => item?.kind === 'numeric_array'),
    [variables]
  )

  const [selectedVar, setSelectedVar] = useState('')
  const [sliceExpr, setSliceExpr] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deletingVar, setDeletingVar] = useState('')
  const firstVarName = numericVars[0]?.name || ''

  const selectedMeta = useMemo(
    () => numericVars.find((item) => item.name === selectedVar) || null,
    [numericVars, selectedVar]
  )

  const loadVariableData = useCallback(async (varName, expr) => {
    if (!jobId || !varName) return
    setLoading(true)
    setError(null)
    try {
      const data = await matApi.variableData(jobId, varName, { sliceExpr: expr })
      setPreview(data)
    } catch (err) {
      setPreview(null)
      setError(err?.response?.data?.detail || err.message || 'Failed to load variable data')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    const first = numericVars[0]
    if (!first) {
      setSelectedVar('')
      setSliceExpr('')
      setPreview(null)
      return
    }
    const initialExpr = defaultSliceExpr(first.ndim)
    setSelectedVar(first.name)
    setSliceExpr(initialExpr)
    loadVariableData(first.name, initialExpr)
  }, [jobId, firstVarName, loadVariableData, numericVars])

  const handleVariableSelect = (nextName) => {
    const nextMeta = numericVars.find((item) => item.name === nextName)
    const nextExpr = defaultSliceExpr(nextMeta?.ndim || 1)
    setSelectedVar(nextName)
    setSliceExpr(nextExpr)
    loadVariableData(nextName, nextExpr)
  }

  const handleApplySlice = () => {
    if (!selectedVar) return
    loadVariableData(selectedVar, sliceExpr)
  }

  const handleDeleteDerived = async (varName) => {
    if (!jobId || !varName) return
    if (!window.confirm(`Delete derived variable '${varName}'?`)) return
    setError(null)
    setDeletingVar(varName)
    try {
      await matApi.deleteDerived(jobId, varName)
      if (typeof onRefreshVariables === 'function') {
        await onRefreshVariables()
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to delete derived variable')
    } finally {
      setDeletingVar('')
    }
  }

  if (!numericVars.length) {
    return <div className="empty-state">No numeric arrays found in this MAT file.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 600, overflow: 'auto', padding: 8 }}>
        {numericVars.map((item) => {
          const active = item.name === selectedVar
          return (
            <div
              key={item.name}
              onClick={() => handleVariableSelect(item.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleVariableSelect(item.name)
                }
              }}
              role="button"
              tabIndex={0}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 6,
                border: active ? '1px solid #1d4ed8' : '1px solid #e5e7eb',
                background: active ? '#eff6ff' : '#fff',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div className="summary-label">{toShapeText(item.shape)} {item.dtype ? `| ${item.dtype}` : ''}</div>
              {item?.is_derived && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="project-shell__nav-link"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDeleteDerived(item.name)
                    }}
                    disabled={deletingVar === item.name}
                    style={{ padding: '4px 8px', height: 28, background: '#fff1f2', color: '#b91c1c', borderColor: '#fecdd3' }}
                  >
                    {deletingVar === item.name ? 'Deleting…' : 'Delete Derived'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
        <div style={{ fontFamily: 'monospace', marginBottom: 10 }}>
          <div>{preview?.display_shape || toShapeText(selectedMeta?.shape)}</div>
          <div>{preview?.dtype || selectedMeta?.dtype || '-'}</div>
          <div>{preview?.slice_expr || `(${sliceExpr || ''})`}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <label className="summary-label" style={{ margin: 0 }}>Slice</label>
          <input
            value={sliceExpr}
            onChange={(e) => setSliceExpr(e.target.value)}
            placeholder=":, :, 1"
            style={{
              width: 260,
              height: 34,
              padding: '6px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
            }}
          />
          <button type="button" className="project-shell__nav-link" onClick={handleApplySlice}>
            Apply
          </button>
        </div>

        {loading && <div className="empty-state">Loading MAT variable preview...</div>}
        {error && <div className="project-shell__error">{error}</div>}

        {!loading && !error && preview?.format === 'scalar' && (
          <div style={{ fontFamily: 'monospace' }}>{String(preview.scalar ?? '')}</div>
        )}

        {!loading && !error && preview?.format === 'table' && preview?.table && (
          <>
            <PreviewTable headers={preview.table.headers} rows={preview.table.rows} />
            {preview.table.truncated && (
              <div className="summary-label" style={{ marginTop: 8 }}>
                Showing truncated matrix preview.
              </div>
            )}
          </>
        )}

        {!loading && !error && preview?.format === 'pages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(preview.pages || []).map((page) => (
              <div key={`page-${page.page}`}>
                <div className="summary-label" style={{ marginBottom: 6 }}>
                  (:, :, {page.page})
                </div>
                <PreviewTable headers={page.headers} rows={page.rows} />
                {page.truncated && (
                  <div className="summary-label" style={{ marginTop: 6 }}>
                    Page preview truncated.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && preview?.message && (
          <div className="summary-label" style={{ marginTop: 8 }}>
            {preview.message}
          </div>
        )}
      </div>
    </div>
  )
}
