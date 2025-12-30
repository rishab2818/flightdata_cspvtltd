import React, { useEffect, useState } from 'react'
import { ingestionApi } from '../../../api/ingestionApi'

const TABULAR_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls', '.txt'])
const INLINE_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.txt',
  '.csv',
])

const getExtension = (name = '') => {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

const isTabularFile = (file) => TABULAR_EXTENSIONS.has(getExtension(file?.filename || ''))

const canInlinePreview = (file) => {
  const type = (file?.content_type || '').toLowerCase()
  if (type.startsWith('image/') || type.startsWith('text/') || type === 'application/pdf') {
    return true
  }
  return INLINE_EXTENSIONS.has(getExtension(file?.filename || ''))
}

const triggerDownload = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const forceDownloadFromUrl = async (url, filename) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.URL.revokeObjectURL(objectUrl)
  }
}

export default function TagDetails({ projectId, datasetType, tagName, onBack }) {
  const [files, setFiles] = useState([])
  const [tab, setTab] = useState('raw')

  useEffect(() => {
    ingestionApi
      .listFilesInTag(projectId, datasetType, tagName)
      .then(setFiles)
  }, [projectId, datasetType, tagName])

  const rows =
    tab === 'raw'
      ? files
      : tab === 'processed'
        ? files.filter(f => f.processed_key)
        : tab === 'others'
          ? files.filter(f => !f.processed_key && !f.visualize_enabled)
          : []

  const handleView = async (file, canEdit) => {
    if (isTabularFile(file) && file.processed_key) {
      const editFlag = canEdit ? '1' : '0'
      window.open(`/processed-preview/${file.job_id}?edit=${editFlag}`, '_blank', 'noopener,noreferrer')
      return
    }

    try {
      const { url } = await ingestionApi.download(file.job_id)
      if (canInlinePreview(file)) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        triggerDownload(url, file.filename)
      }
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || 'View failed')
    }
  }

  const handleDownload = async (file) => {
    try {
      const { url } = await ingestionApi.download(file.job_id)
      await forceDownloadFromUrl(url, file.filename)
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || 'Download failed')
    }
  }

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.filename}"? This cannot be undone.`)) return
    try {
      await ingestionApi.remove(file.job_id)
      setFiles((prev) => prev.filter((item) => item.job_id !== file.job_id))
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || 'Delete failed')
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}>←</button>
        <h3>{tagName}</h3>
      </div>

      <div className="tablist">
        <button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>Raw</button>
        <button className={tab === 'processed' ? 'active' : ''} onClick={() => setTab('processed')}>Processed</button>
        <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>Others</button>
        <button disabled>Plot</button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Created Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(f => (
            <tr key={f._id}>
              <td>{f.filename}</td>
              <td>{new Date(f.created_at).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleView(f, tab === 'processed')} title="View">👁</button>
                <button onClick={() => handleDownload(f)} title="Download">⬇</button>
                <button onClick={() => handleDelete(f)} title="Delete">🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
