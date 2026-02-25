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
    <div
  style={{
    width: "100%",
    maxHeight: "70vh",
    overflowX: "auto",   // horizontal scroll
    overflowY: "auto",   // vertical scroll
    border: "1px solid #e5e7eb",
    borderRadius: "6px"
  }}
>
  <table
    className="data-table"
    style={{
      borderCollapse: "collapse",
      width: "max-content",   // 🔥 important
      minWidth: "100%"        // keeps full width minimum
    }}
  >
    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
      <tr>
        <th style={{ textAlign: "left", width: 56, background: "#EFF7FF" }}></th>
        {headers.map((h) => (
          <th
            key={`head-${h}`}
            style={{
              textAlign: "left",
              background: "#EFF7FF",
              whiteSpace: "nowrap"   // prevent wrapping
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {rows.map((row, rowIdx) => (
        <tr key={`row-${rowIdx}`}>
          <th style={{ textAlign: "left", fontWeight: 600 }}>
            {rowIdx + 1}
          </th>

          {(row || []).map((cell, colIdx) => (
            <td
              key={`cell-${rowIdx}-${colIdx}`}
              style={{ whiteSpace: "nowrap" }}  // prevent wrapping
            >
              {String(cell ?? "")}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
  )
}

export default function MatlabPreviewPanel({ jobId, variables = [] }) {
  const numericVars = useMemo(
    () => (variables || []).filter((item) => item?.kind === 'numeric_array'),
    [variables]
  )

  const [selectedVar, setSelectedVar] = useState('')
  const [sliceExpr, setSliceExpr] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
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

  if (!numericVars.length) {
    return <div className="empty-state">No numeric arrays found in this MAT file.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, padding:"16px"}}>
      <div style={{ border: '1px solid #00000026', borderRadius: 4,  overflow: 'auto', padding: 8 }}>
        {numericVars.map((item) => {
          const active = item.name === selectedVar
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => handleVariableSelect(item.name)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                fontSize:'14px',
                fontWeight:600,
                fontFamily:"Inter-Regular,Helvetica",
                borderRadius: 4,
                border: active ? '1px solid #1d4ed8' : '1px solid #00000026',
                background: active ? '#eff6ff' : '#f3f3f5',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div className="summary-label">{toShapeText(item.shape)} {item.dtype ? `| ${item.dtype}` : ''}</div>
            </button>
          )
        })}
      </div>

      <div style={{ border: '1px solid #00000026', borderRadius: 4, padding: 12, minWidth: 0 }}>
        <div style={{ fontFamily: "Inter-Regular,Helvetica", marginBottom: 10,fontSize:"14px",color:"#000000",fontWeight:500 }}>
          <div>{preview?.display_shape || toShapeText(selectedMeta?.shape)}</div>
          <div>{preview?.dtype || selectedMeta?.dtype || '-'}</div>
          <div>{preview?.slice_expr || `(${sliceExpr || ''})`}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 12 }}>
          <label  style={{ margin: 0, fontSize:"14px",color:"#000000", fontWeight:600, fontFamily:"Inter-Regular,Helvetica"}}>Slice</label>
          <input
            value={sliceExpr}
            onChange={(e) => setSliceExpr(e.target.value)}
            placeholder=":, :, 1"
            style={{
              width: 260,
              height: 34,
              padding: '6px 10px',
              border: '1px solid #00000026',
              borderRadius: 4,
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
                <PreviewTable headers={page.headers} rows={page.rows} style={{background:"#f3f3f5",}}/>
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
