import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { ingestionApi } from '../../../api/ingestionApi'
import { storage } from '../../../lib/storage'



const datasetOptions = [
  { key: 'cfd', label: 'CFD' },
  { key: 'wind', label: 'Wind Data' },
  { key: 'aero', label: 'Aero Data' },
]

export default function ProjectUpload() {
  const { projectId } = useParams()
  const { project } = useOutletContext()
  const [datasetType, setDatasetType] = useState('wind')
  const [headerMode, setHeaderMode] = useState('file')
  const [customHeadersText, setCustomHeadersText] = useState('')
  const [activeJob, setActiveJob] = useState(null)
  const [progress, setProgress] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [uploadingFilename, setUploadingFilename] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!activeJob) return undefined
    const token = storage.getToken()
    const es = new EventSource(
      `${import.meta.env.VITE_API_BASE_URL}/api/ingestion/jobs/${activeJob.job_id}/stream?token=${token}`
    );

    const handler = (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        setProgress(payload)
      } catch (err) {
        // ignore parse
      }
    }
    es.addEventListener('progress', handler)
    es.onmessage = handler
    es.onerror = () => {
      es.close()
    }
    return () => {
      es.removeEventListener('progress', handler)
      es.close()
    }
  }, [activeJob])

  const selectedDatasetLabel = useMemo(
    () => datasetOptions.find((d) => d.key === datasetType)?.label || 'Dataset',
    [datasetType]
  )

  const submitFile = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadingFilename(file.name)
    setUploadProgress(0)
    setError(null)
    try {
      const headersList =
        headerMode === 'custom'
          ? customHeadersText
            .split(',')
            .map((h) => h.trim())
            .filter(Boolean)
          : null
      const job = await ingestionApi.start(projectId, file, {
        datasetType,
        headerMode,
        customHeaders: headersList,
        onUploadProgress: (evt) => {
          if (!evt.total) {
            setUploadProgress(null)
            return
          }
          const pct = Math.round((evt.loaded / evt.total) * 100)
          setUploadProgress(pct)
        },
      })
      setActiveJob(job)
      setProgress({ status: 'queued', progress: 0 })
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setUploading(false)
      setUploadProgress(null)
      setUploadingFilename('')
    }
  }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    submitFile(file)
  }

  return (
    <div className="project-card" style={{  }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="summary-label" style={{ marginBottom: 4 }}>
            Upload data files
          </p>
          <h2 style={{ margin: '0 0 6px 0' }}>{project?.project_name}</h2>
          <p style={{ margin: 0, color: '#475569' }}>
            Choose the dataset type, header preference and upload CSV, XLSX, MAT or DAT files.
          </p>
        </div>
        <div className="badge">{selectedDatasetLabel}</div>
      </div>

      <div className="tablist">
        {datasetOptions.map((option) => (
          <button
            key={option.key}
            className={option.key === datasetType ? 'active' : ''}
            onClick={() => setDatasetType(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="header-options">
          <strong>Header handling</strong>
          <div className="actions-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="header-mode"
                checked={headerMode === 'file'}
                onChange={() => setHeaderMode('file')}
              />
              Use headers from file
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="header-mode"
                checked={headerMode === 'none'}
                onChange={() => setHeaderMode('none')}
              />
              File has no headers
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="header-mode"
                checked={headerMode === 'custom'}
                onChange={() => setHeaderMode('custom')}
              />
              Provide headers
            </label>
          </div>
          {headerMode === 'custom' && (
            <div className="header-options__inputs">
              <label className="summary-label">Comma separated headers</label>
              <input
                className="input-control"
                placeholder="e.g. time, angle, speed"
                value={customHeadersText}
                onChange={(e) => setCustomHeadersText(e.target.value)}
              />
            </div>
          )}
        </div>
        <label className="upload-tile" htmlFor="project-upload-input">
          <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>Drag & drop or browse file</p>
          <p style={{ margin: 0, color: '#475569' }}>
            Supported: .csv, .xlsx, .xls, .dat, .txt, .mat. Up to 100 GB handled in streamed chunks.
          </p>
          <div style={{ marginTop: 14 }}>
            <button className="project-shell__nav-link" type="button" style={{ display: 'inline-block' }}>
              Browse File
            </button>
          </div>
        </label>
        <input
          id="project-upload-input"
          type="file"
          accept=".csv,.xlsx,.xls,.dat,.txt,.mat"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        {uploading && (
          <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="actions-row">
              <strong>{uploadingFilename || 'Uploading file'}</strong>
              <span className="badge">Uploading</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar__value"
                style={{ width: `${uploadProgress ?? 5}%` }}
              />
            </div>
            <div className="summary-label">
              {uploadProgress != null
                ? `${uploadProgress}% streamed to server`
                : 'Streaming file in chunks…'}
            </div>
          </div>
        )}
        {error && <div className="project-shell__error">{error}</div>}
        {activeJob && (
          <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="actions-row">
              <strong>{activeJob.filename}</strong>
              <span className="badge">{progress?.status || activeJob.status}</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar__value"
                style={{ width: `${progress?.progress ?? activeJob.progress ?? 0}%` }}
              />
            </div>
            {progress?.message && <div className="summary-label">{progress.message}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
