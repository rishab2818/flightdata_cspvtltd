import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ingestionApi } from '../../../api/ingestionApi'
import * as XLSX from 'xlsx'
import '../../../styles/project.css'

export default function RawPreviewPage() {
  const { jobId } = useParams()

  const [file, setFile] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [activeSheet, setActiveSheet] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rowLimit, setRowLimit] = useState(20)
  const workbookRef = useRef(null)

  useEffect(() => {
    if (!jobId) {
      setError('Invalid job id')
      setLoading(false)
      return
    }

    let objectUrl = null

    async function fetchFile() {
      try {
        setLoading(true)
        setError(null)

        const res = await ingestionApi.download(jobId)
        const data = res?.data ?? res

        const url = data?.url
        const filename =
          data?.filename || data?.file_name || data?.name || 'download'

        if (!url) throw new Error('Download URL not returned by API')

        setFile({ filename })

        // Determine file extension
        let ext = ''
        if (filename.includes('.')) {
          ext = filename.split('.').pop().toLowerCase()
        } else if (url.includes('.')) {
          ext = url.split('?')[0].split('.').pop().toLowerCase()
        }

        const fileRes = await fetch(url)
        const blob = await fileRes.blob()

        // TEXT
        if (['csv', 'txt', 'dat', 'c'].includes(ext)) {
          const text = await blob.text()
          setPreviewData({ type: 'text', data: text })
        }

        // EXCEL
        else if (['xls', 'xlsx'].includes(ext)) {
          const buffer = await blob.arrayBuffer()
          const workbook = XLSX.read(buffer)
          const sheetNames = workbook.SheetNames || []
          workbookRef.current = workbook
          const initialSheet = sheetNames[0] || ''
          const sheet = initialSheet ? workbook.Sheets[initialSheet] : null
          const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1 }) : []
          setActiveSheet(initialSheet)
          setPreviewData({ type: 'excel', sheetNames, data: rows })
        }

        // PDF
        else if (ext === 'pdf') {
          objectUrl = URL.createObjectURL(blob)
          setPreviewData({ type: 'pdf', data: objectUrl })
        }

        // IMAGE
        else if (ext.match(/(png|jpg|jpeg|gif|svg)$/)) {
          objectUrl = URL.createObjectURL(blob)
          setPreviewData({ type: 'image', data: objectUrl })
        }

        // FALLBACK
        else {
          objectUrl = URL.createObjectURL(blob)
          setPreviewData({ type: 'download', data: objectUrl })
        }
      } catch (err) {
        console.error(err)
        setError(err.message || 'Failed to load raw preview')
      } finally {
        setLoading(false)
      }
    }

    fetchFile()
    return () => objectUrl && URL.revokeObjectURL(objectUrl)
  }, [jobId])

  return (
    <div
      className="project-card"
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
              onChange={(e) => setRowLimit(Number(e.target.value))}
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
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 600,
                overflow: 'auto',
                background: '#f7f7f7',
                padding: 12,
                borderRadius: 4,
              }}
            >
              {previewData.data}
            </pre>
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
                      const workbook = workbookRef.current
                      const next = workbook?.Sheets?.[nextSheet]
                      const rows = next ? XLSX.utils.sheet_to_json(next, { header: 1 }) : []
                      setPreviewData((prev) => (prev ? { ...prev, data: rows } : prev))
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
  )
}
