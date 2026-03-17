import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { rawPreviewApi } from '../../../api/rawPreviewApi'
import { matApi } from '../../../mat/matApi'
import MatlabPreviewPanel from '../../../mat/MatlabPreviewPanel'
import '../../../styles/project.css'

const TEXT_CHUNK_SIZE = 256 * 1024

export default function RawPreviewPage() {
  const { jobId } = useParams()

  const [file, setFile] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [activeSheet, setActiveSheet] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [rowLimit, setRowLimit] = useState(20)
  const previewKindRef = useRef('')

  const refreshMatVariables = useCallback(async () => {
    if (!jobId) return
    const matInfo = await matApi.variables(jobId)
    setPreviewData({ type: 'mat', variables: matInfo?.variables || [] })
  }, [jobId])

  const loadTextChunk = useCallback(async (offset = 0, { replace = false } = {}) => {
    if (!jobId) return

    if (replace) setLoading(true)
    else setLoadingMore(true)

    try {
      setError(null)
      const payload = await rawPreviewApi.textChunk(jobId, {
        offset,
        chunkSize: TEXT_CHUNK_SIZE,
      })

      setPreviewData((prev) => {
        const nextLines = replace
          ? payload.lines || []
          : [...(prev?.lines || []), ...(payload.lines || [])]

        return {
          type: 'text',
          lines: nextLines,
          nextOffset: payload.next_offset ?? 0,
          hasMore: Boolean(payload.has_more),
          chunkSize: payload.chunk_size,
        }
      })
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.detail || err.message || 'Failed to load raw text preview')
    } finally {
      if (replace) setLoading(false)
      else setLoadingMore(false)
    }
  }, [jobId])

  const loadExcelPreview = useCallback(async (sheetName, nextRowLimit) => {
    if (!jobId) return

    setLoading(true)
    try {
      setError(null)
      const payload = await rawPreviewApi.excelPreview(jobId, {
        sheetName,
        rowLimit: nextRowLimit || 20,
      })
      setActiveSheet(payload.active_sheet || '')
      setPreviewData({
        type: 'excel',
        sheetNames: payload.sheet_names || [],
        data: payload.rows || [],
      })
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.detail || err.message || 'Failed to load Excel preview')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId) {
      setError('Invalid job id')
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchFile() {
      try {
        setLoading(true)
        setError(null)
        setPreviewData(null)
        setActiveSheet('')
        previewKindRef.current = ''

        const detail = await rawPreviewApi.detail(jobId)
        if (cancelled) return

        previewKindRef.current = detail.kind || ''
        setFile({
          filename: detail.filename,
          contentType: detail.content_type,
          sizeBytes: detail.size_bytes,
        })

        if (detail.kind === 'text') {
          await loadTextChunk(0, { replace: true })
          return
        }

        if (detail.kind === 'excel') {
          await loadExcelPreview(undefined, rowLimit)
          return
        }

        if (detail.kind === 'mat') {
          await refreshMatVariables()
          setLoading(false)
          return
        }

        if (detail.kind === 'pdf') {
          setPreviewData({ type: 'pdf', data: detail.download_url })
        } else if (detail.kind === 'image') {
          setPreviewData({ type: 'image', data: detail.download_url })
        } else {
          setPreviewData({ type: 'download', data: detail.download_url })
        }
      } catch (err) {
        console.error(err)
        setError(err.message || 'Failed to load raw preview')
        if (!cancelled) setLoading(false)
      } finally {
        if (!cancelled && previewKindRef.current !== 'text' && previewKindRef.current !== 'excel' && previewKindRef.current !== 'mat') {
          setLoading(false)
        }
      }
    }

    void fetchFile()
    return () => {
      cancelled = true
    }
  }, [jobId, loadExcelPreview, loadTextChunk, refreshMatVariables])

  return (
    <div className="project-page"> 
    <div
      className="Project-card"
      style={{ width: '100%', margin: '0 auto', background: '#fff', padding: 24 }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Raw Preview</h2>
          <p className="summary-label" style={{ marginTop: 6 }}>Job: {jobId}</p>
          {file?.filename && <p className="summary-label">File: {file.filename}</p>}
        </div>

        {/* Row limit dropdown only for Excel */}
        {previewData?.type === 'excel' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label className="summary-label" style={{ margin: 0 }}>Rows</label>
            <select
              style={{
                width: '100px',
                height: '37px',
                padding: '8px 32px 8px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                cursor: 'pointer',
              }}
              value={rowLimit}
              onChange={(e) => {
                const nextLimit = Number(e.target.value)
                setRowLimit(nextLimit)
                void loadExcelPreview(activeSheet || undefined, nextLimit)
              }}
            >
              {[10, 20, 50, 100, 200].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* STATES */}
      {error && <div className="project-shell__error" style={{ marginTop: 12 }}>{error}</div>}
      {loading && <div className="empty-state" style={{ marginTop: 12 }}>Loading preview...</div>}

      {/* CONTENT */}
      {!loading && !error && (
        <div className="excel-preview" style={{ marginTop: 12, overflow: 'auto' }}>
          {/* TEXT */}
          {previewData?.type === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 600,
                  overflow: 'auto',
                  background: '#f7f7f7',
                  padding: 12,
                  borderRadius: 4,
                  margin: 0,
                }}
              >
                {(previewData.lines || []).join('\n')}
              </pre>

              {previewData.hasMore && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span className="summary-label">
                    Showing file content incrementally for large raw preview.
                  </span>
                  <button
                    type="button"
                    className="project-shell__nav-link"
                    onClick={() => void loadTextChunk(previewData.nextOffset || 0)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TABLE */}
          {previewData?.type === 'excel' && (
            <>
              {previewData.sheetNames.length > 1 && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                  <label className="summary-label" style={{ margin: 0 }}>Sheet</label>
                  <select
                    style={{
                      width: '220px',
                      height: '37px',
                      padding: '8px 32px 8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      backgroundColor: '#fff',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      cursor: 'pointer',
                    }}
                    value={activeSheet}
                    onChange={(e) => {
                      const nextSheet = e.target.value
                      setActiveSheet(nextSheet)
                      void loadExcelPreview(nextSheet, rowLimit)
                    }}
                  >
                    {previewData.sheetNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
              <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {previewData.data.slice(0, rowLimit).map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        backgroundColor: i === 0 ? '#f0f4f8' : 'transparent',
                        fontWeight: i === 0 ? 'bold' : 'normal',
                      }}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          style={{
                            border: '1px solid #ddd',
                            padding: '8px',
                            textAlign: 'left',
                          }}
                        >
                          {String(cell ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* MAT */}
          {previewData?.type === 'mat' && (
            <MatlabPreviewPanel
              jobId={jobId}
              variables={previewData.variables || []}
              onRefreshVariables={refreshMatVariables}
            />
          )}

          {/* PDF */}
          {previewData?.type === 'pdf' && (
            <iframe
              src={previewData.data}
              width="100%"
              height="600"
              style={{ border: '1px solid #ddd' }}
              title="PDF Preview"
            />
          )}

          {/* IMAGE */}
          {previewData?.type === 'image' && (
            <img
              src={previewData.data}
              style={{ maxWidth: '100%', maxHeight: 600 }}
              alt="Raw preview"
            />
          )}

          {/* DOWNLOAD */}
          {previewData?.type === 'download' && (
            <a
              href={previewData.data}
              download={file?.filename}
              style={{ color: '#007bff', textDecoration: 'underline' }}
            >
              Download file
            </a>
          )}
        </div>
      )}
    </div>
    </div>
  )
}
