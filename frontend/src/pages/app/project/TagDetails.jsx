import React, { useEffect, useState } from 'react'
import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'
import ArrowLeft from '../../../assets/ArrowLeft.svg'
import Folder1 from '../../../assets/Folder1.svg'
import CalendarBlank from '../../../assets/CalendarBlank.svg'
import DownloadSimple from '../../../assets/DownloadSimple.svg'
import Delete from '../../../assets/Delete.svg'
import ViewIcon from '../../../assets/ViewIcon.svg'
import { PROJECT_TABULAR_EXTENSIONS } from '../../../uploadPreview/fileTypes'

import './ProjectVisualisation.css'
import ConfirmationModal from "../../../components/common/ConfirmationModal";


const TABULAR_EXTENSIONS = PROJECT_TABULAR_EXTENSIONS
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

const OTHERS_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg'
])

const getExtension = (name = '') => {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

const isTabularFile = (file) => TABULAR_EXTENSIONS.has(getExtension(file?.filename || ''))

const isRawFile = (file) => isTabularFile(file)

const isProcessedFile = (file) => Boolean(file?.processed_key)

const isOtherFile = (file) => {
  const ext = getExtension(file?.filename || '')
  return !isTabularFile(file) && !file?.processed_key && !file?.visualize_enabled && OTHERS_EXTENSIONS.has(ext)
}

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

const openPlotFullScreen = (viz) => {
  if (!viz) return

  const raw = viz.html_url || viz.htmlUrl || viz.url
  if (raw) {
    const full = raw.startsWith('http')
      ? raw
      : `${window.__FD_API_BASE__ || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${raw}`
    window.open(full, '_blank', 'noopener,noreferrer')
    return
  }

  const fallback = `${window.__FD_API_BASE__ || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/visualizations/${viz.viz_id}/html`
  window.open(fallback, '_blank', 'noopener,noreferrer')
}

const matchesTagAndDataset = (viz, tagName, datasetType) =>
  viz?.tag_name?.trim().toLowerCase() === tagName?.trim().toLowerCase() &&
  viz?.dataset_type?.trim().toLowerCase() === datasetType?.trim().toLowerCase()

export default function TagDetails({ projectId, datasetType, tagName, onBack }) {
  const [files, setFiles] = useState([])
  const [tab, setTab] = useState('raw')
  const [plots, setPlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    file: null,
  })

  useEffect(() => {
    setLoading(true)
    setError('')
    ingestionApi
      .listFilesInTag(projectId, datasetType, tagName)
      .then((data) => setFiles(data || []))
      .catch((err) => {
        console.error(err)
        setFiles([])
        setError('Failed to load files.')
      })
      .finally(() => setLoading(false))
  }, [projectId, datasetType, tagName])

  useEffect(() => {
    if (tab !== 'plot') return

    setLoading(true)
    setError('')
    visualizationApi
      .listForProject(projectId)
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data || []

        const filtered = list.filter(
          (v) =>
            v.tag_name?.trim().toLowerCase() === tagName?.trim().toLowerCase() &&
            v.dataset_type?.trim().toLowerCase() === datasetType?.trim().toLowerCase()
        )

        setPlots(filtered)
      })
      .catch((err) => {
        console.error(err)
        setPlots([])
        setError('Failed to load plots.')
      })
      .finally(() => setLoading(false))
  }, [tab, projectId, datasetType, tagName])

  const rows =
    tab === 'plot'
      ? plots
      : tab === 'raw'
        ? files.filter(isRawFile)
        : tab === 'processed'
          ? files.filter(isProcessedFile)
          : tab === 'others'
            ? files.filter(isOtherFile)
            : []
  const handleView = (file, tabName) => {
    if (tabName === 'plot') {
      openPlotFullScreen(file)
      return
    }

    if (tabName === 'processed' && file.processed_key) {
      window.open(`/processed-preview/${file.job_id}?edit=1`, '_blank', 'noopener,noreferrer')
      return
    }

    if (tabName === 'raw') {
      window.open(`/raw-preview/${file.job_id}`, '_blank', 'noopener,noreferrer')
      return
    }

    ingestionApi.download(file.job_id).then(({ url }) => triggerDownload(url, file.filename))
  }

  const handleDownload = async (file) => {
    try {
      if (tab === 'plot') {
        const { url } = await visualizationApi.download(file.viz_id)
        await forceDownloadFromUrl(url, file.filename || 'visualization.html')
      } else {
        const { url } = await ingestionApi.download(file.job_id)
        await forceDownloadFromUrl(url, file.filename)
      }
    } catch (err) {
      console.error(err)
      window.alert('Download failed')
    }
  }

  const handleDeleteFile = async () => {
    if (!confirmDelete.file) return

    try {
      if (tab === 'plot') {
        await visualizationApi.remove(confirmDelete.file.viz_id)
        setPlots((prev) =>
          prev.filter((p) => p.viz_id !== confirmDelete.file.viz_id)
        )
      } else {
        await ingestionApi.remove(confirmDelete.file.job_id)
        setFiles((prev) => prev.filter((f) => f.job_id !== confirmDelete.file.job_id))
      }
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || 'Delete failed')
    } finally {
      setConfirmDelete({ open: false, file: null })
    }
  }

  const showEmptyState = !loading && !error && rows.length === 0

  return (
  <div style={{ background: '#ffffff', gap: '10px', padding: '20px', width: '100%', height: '100%', border: '1px solid #00000026', borderRadius: '4px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={onBack} style={{ background: '#ffffff', border: 'none' }} type="button">
        <img style={{ width: '24px', height: '24px' }} src={ArrowLeft} alt="arrow" />
      </button>
      <label style={{ color: '#000000', fontFamily: '"Inter-Regular",Helvetica', fontSize: '16px', fontWeight: '600' }}>{tagName}</label>
    </div>

    <div className="tablist">
      <button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>Raw</button>
      <button className={tab === 'processed' ? 'active' : ''} onClick={() => setTab('processed')}>Processed</button>
      <button className={tab === 'plot' ? 'active' : ''} onClick={() => setTab('plot')}>Plot</button>
      <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>Others</button>
    </div>

    <table className="DataTable">
      <thead>
        <tr>
          <th className="tablehead">
            <span className="th-content">
              <img style={{ width: '20px', height: '20px' }} src={Folder1} alt="folder" />
              {tab === 'plot' ? 'Plot Name' : 'File Name'}
            </span>
          </th>
          <th className="tablehead">
            <span className="th-content">
              <img style={{ width: '20px', height: '20px' }} src={CalendarBlank} alt="calendar" />
              Created Date
            </span>
          </th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {loading && rows.length === 0 && (
          <tr>
            <td colSpan={3} style={{ padding: 16, textAlign: 'center' }}>
              Loading {tab === 'plot' ? 'plots' : 'files'}...
            </td>
          </tr>
        )}

        {!loading && error && (
          <tr>
            <td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#b42318' }}>
              {error}
            </td>
          </tr>
        )}

        {showEmptyState && (
          <tr>
            <td colSpan={3} style={{ padding: 16, textAlign: 'center' }}>
              No {tab === 'plot' ? 'plots' : 'files'} found.
            </td>
          </tr>
        )}

        {rows.map((f) => (
          <tr key={tab === 'plot' ? f.viz_id : f.job_id}>
            <td style={{ color: '#000000', fontFamily: 'inter-regular,Helvetica', fontSize: '14px', fontWeight: '400' }}>
              <div style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                <img style={{ width: '20px', height: '20px' }} src={Folder1} alt="folder" />

                {tab === 'plot' ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <p className="data-card__name" style={{ margin: 0 }}>
                      {f.name || f.filename || 'Plot'}
                    </p>
                    <p className="summarylabel2" style={{ margin: 0 }}>
                      {f.chart_type} · {f.status}
                    </p>
                  </div>
                ) : (
                  f.sheet_name ? `${f.filename} — ${f.sheet_name}` : f.filename
                )}
              </div>
            </td>
            <td style={{ color: '#000000', fontFamily: 'inter-regular,Helvetica', fontSize: '14px', fontWeight: '400' }}>
              <div style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                <img style={{ width: '20px', height: '20px' }} src={CalendarBlank} alt="calendar" />
                {new Date(f.created_at).toLocaleDateString()}
              </div>
            </td>
            <td style={{ verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'left', justifyContent: 'left' }}>
                <button
                  onClick={() => handleView(f, tab)}
                  title="View"
                  style={{
                    background: '#ffffff',
                    border: '0.67px solid #0000001A',
                    width: '40px',
                    height: '35px',
                    borderRadius: '8px',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  type="button"
                >
                  <img style={{ width: '20px', height: '20px' }} src={ViewIcon} alt="view" />
                </button>

                {tab !== 'plot' && tab !== 'processed' &&(
                  <button
                    onClick={() => handleDownload(f)}
                    title="Download"
                    style={{
                      background: '#ffffff',
                      border: '0.67px solid #0000001A',
                      width: '40px',
                      height: '35px',
                      borderRadius: '8px',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    type="button"
                  >
                    <img style={{ width: '20px', height: '20px' }} src={DownloadSimple} alt="download" />
                  </button>
                )}

                <button
                  onClick={() => setConfirmDelete({ open: true, file: f })}
                  title="Delete"
                  style={{
                    background: '#ffffff',
                    border: '0.67px solid #0000001A',
                    width: '40px',
                    height: '35px',
                    borderRadius: '8px',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  type="button"
                >
                  <img style={{ width: '20px', height: '20px' }} src={Delete} alt="delete" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {confirmDelete.open && (
      <ConfirmationModal
        title={`Delete "${tab === 'plot'
  ? (confirmDelete.file?.name || confirmDelete.file?.filename || 'Visualization')
  : confirmDelete.file?.filename}"?`}
        description="This action cannot be undone."
        onCancel={() => setConfirmDelete({ open: false, file: null })}
        onConfirm={handleDeleteFile}
      />
    )}
  </div>
)
}
