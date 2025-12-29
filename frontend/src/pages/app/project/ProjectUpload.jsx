import React, { useEffect, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'


import UploadModal from './ProjectUploadModal.jsx'
import { ingestionApi } from '../../../api/ingestionApi'
import './ProjectUpload.css'
import TagDetails from './TagDetails'

const DATASET_TABS = [
  { key: 'cfd', label: 'CFD data' },
  { key: 'wind', label: 'Wind Tunnel Data' },
  { key: 'flight', label: 'Flight Data' },
  { key: 'others', label: 'Others' },
]

export default function ProjectUpload() {
  const { projectId } = useParams()
  const { project } = useOutletContext()

  const [activeDataset, setActiveDataset] = useState('cfd')
  const [tags, setTags] = useState([])
  const [selectedTag, setSelectedTag] = useState(null)

  const [modal, setModal] = useState({ open: false, mode: 'create', tag: '' })
  const [deletingTag, setDeletingTag] = useState(null)

  /* ================= Progress tracking ================= */
  const [jobProgress, setJobProgress] = useState({}) // jobId -> {status, progress, message}
  const [tagJobMap, setTagJobMap] = useState({})     // tagName -> latest jobId

  /* ================= Polling helpers ================= */
  const pollingRef = useRef(new Map()) // jobId -> intervalId

  const stopPolling = (jobId) => {
    const t = pollingRef.current.get(jobId)
    if (t) clearInterval(t)
    pollingRef.current.delete(jobId)
  }

  const stopAllPolling = () => {
    for (const [, t] of pollingRef.current.entries()) {
      clearInterval(t)
    }
    pollingRef.current.clear()
  }

  const pollJob = (jobId) => {
    if (!jobId) return
    if (pollingRef.current.has(jobId)) return

    const timer = setInterval(async () => {
      try {
        const status = await ingestionApi.status(jobId)

        setJobProgress((prev) => ({
          ...prev,
          [jobId]: status,
        }))

        const s = (status?.status || '').toLowerCase()
        if (s === 'success' || s === 'failure') {
          stopPolling(jobId)
        }
      } catch {
        stopPolling(jobId)
      }
    }, 1500)

    pollingRef.current.set(jobId, timer)
  }

  /* ================= Refresh tags + attach polling ================= */
  const refreshTagsAndAttachProgress = async () => {
    const tagRows = await ingestionApi.listTags(projectId, activeDataset)
    setTags(tagRows || [])

    const map = {}
    for (const t of tagRows || []) {
      try {
        const files = await ingestionApi.listFilesInTag(projectId, activeDataset, t.tag_name)
        if (files?.length) {
          const latestJobId = files[0]?.job_id
          if (latestJobId) {
            map[t.tag_name] = latestJobId
            pollJob(latestJobId)
          }
        }
      } catch {
        // ignore per-tag failure
      }
    }
    setTagJobMap(map)
  }

  /* ================= Dataset / project change ================= */
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (cancelled) return
      stopAllPolling()
      setJobProgress({})
      setTagJobMap({})
      await refreshTagsAndAttachProgress()

      // second refresh handles race after upload
      setTimeout(refreshTagsAndAttachProgress, 2000)
    })()

    return () => {
      cancelled = true
      stopAllPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activeDataset])

  /* ================= Delete tag ================= */
  const handleDeleteTag = async (tagName) => {
    if (!window.confirm(`Delete "${tagName}" and all files inside it? This cannot be undone.`)) return

    setDeletingTag(tagName)
    try {
      const files = await ingestionApi.listFilesInTag(projectId, activeDataset, tagName)
      await Promise.all(
        (files || []).map((file) =>
          file.job_id ? ingestionApi.remove(file.job_id) : Promise.resolve()
        )
      )

      setTags((prev) => prev.filter((t) => t.tag_name !== tagName))
      setTagJobMap((prev) => {
        const copy = { ...prev }
        delete copy[tagName]
        return copy
      })

      if (selectedTag === tagName) setSelectedTag(null)
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || 'Delete failed')
    } finally {
      setDeletingTag(null)
    }
  }

  const onCloseModal = async () => {
    setModal({ open: false, mode: 'create', tag: '' })
    await refreshTagsAndAttachProgress()
    setTimeout(refreshTagsAndAttachProgress, 1500)
  }

  /* ================= Render ================= */
  return (
   
       

    <div className="project-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="summary-label">Upload data files</p>
          <h2>{project?.project_name}</h2>
        </div>

        <button
          className="project-shell__nav-link"
          type="button"
          onClick={() => setModal({ open: true, mode: 'create', tag: '' })}
        >
          Upload File
        </button>
      </div>

      {/* Dataset tabs */}
      <div className="tablist">
        {DATASET_TABS.map((tab) => (
          <button
            key={tab.key}
            className={activeDataset === tab.key ? 'active' : ''}
            onClick={() => {
              setActiveDataset(tab.key)
              setSelectedTag(null)
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================= TAG LIST ================= */}
      {!selectedTag && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tag Name</th>
              <th>Created Date</th>
              <th>Action</th>
              <th>Go to</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => {
              const jobId = tagJobMap[tag.tag_name]
              const jp = jobId ? jobProgress[jobId] : null
              const status = (jp?.status || '').toLowerCase()
              const showProgress = jp && !['success', 'failure'].includes(status)

              return (
                <tr key={tag.tag_name}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tag.tag_name}</div>

                    {showProgress && (
                      <div style={{ marginTop: 8, maxWidth: 360 }}>
                        <div className="progress-bar">
                          <div
                            className="progress-bar__value"
                            style={{ width: `${jp.progress ?? 5}%` }}
                          />
                        </div>
                        <div className="summary-label" style={{ marginTop: 6 }}>
                          {jp.message || jp.status} ({jp.progress ?? 0}%)
                        </div>
                      </div>
                    )}

                    {!showProgress && jp && (
                      <div className="summary-label" style={{ marginTop: 6 }}>
                        {status === 'success'
                          ? 'Processed ✅'
                          : `Failed ❌ (${jp.message || 'error'})`}
                      </div>
                    )}
                  </td>

                  <td>
                    {tag.latest_created_at
                      ? new Date(tag.latest_created_at).toLocaleDateString()
                      : '-'}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => setModal({ open: true, mode: 'edit', tag: tag.tag_name })}
                    >
                      ✏
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(tag.tag_name)}
                      disabled={deletingTag === tag.tag_name}
                      style={{ marginLeft: 8 }}
                    >
                      {deletingTag === tag.tag_name ? '...' : '🗑'}
                    </button>
                  </td>

                  <td>
                    <button
                      className="project-shell__nav-link"
                      type="button"
                      onClick={() => setSelectedTag(tag.tag_name)}
                    >
                      →
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* ================= TAG DETAILS ================= */}
      {selectedTag && (
        <TagDetails
          projectId={projectId}
          datasetType={activeDataset}
          tagName={selectedTag}
          onBack={() => setSelectedTag(null)}
        />
      )}

      {/* Upload modal */}
      {modal.open && (
        <UploadModal
          projectId={projectId}
          projectName={project?.project_name || 'Project'}
          onClose={onCloseModal}
          mode={modal.mode}
          initialTag={modal.tag}
          initialDatasetType={activeDataset}
        />
      )}
    </div>
   
  )
}
