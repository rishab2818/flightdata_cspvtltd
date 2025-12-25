import React, { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import UploadModal from './uploadModal.jsx'
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

  const [open, setOpen] = useState(false)
  const [activeDataset, setActiveDataset] = useState('cfd')
  const [tags, setTags] = useState([])
  const [selectedTag, setSelectedTag] = useState(null)
  const [editTag, setEditTag] = useState(null)
  const [modal, setModal] = useState({ open: false, mode: "create", tag: "" })
  const [deletingTag, setDeletingTag] = useState(null)


  // Load tags when dataset changes
  useEffect(() => {
    // if (activeDataset === 'others') return
    ingestionApi
      .listTags(projectId, activeDataset)
      .then(setTags)
  }, [projectId, activeDataset])

  const handleDeleteTag = async (tagName) => {
    if (!window.confirm(`Delete "${tagName}" and all files inside it? This cannot be undone.`)) return

    setDeletingTag(tagName)
    try {
      const files = await ingestionApi.listFilesInTag(projectId, activeDataset, tagName)
      await Promise.all(
        (files || []).map((file) => {
          const jobId = file.job_id || file._id || file.id
          if (!jobId) return Promise.resolve()
          return ingestionApi.remove(jobId)
        })
      )
      setTags((prev) => prev.filter((t) => t.tag_name !== tagName))
      if (selectedTag === tagName) setSelectedTag(null)
    } catch (err) {
      console.error(err)
      window.alert(err?.response?.data?.detail || err.message || 'Delete failed')
    } finally {
      setDeletingTag(null)
    }
  }

  return (
    <div className="project-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <p className="summary-label">Upload data files</p>
          <h2>{project?.project_name}</h2>
        </div>

        {/* <button className="project-shell__nav-link" onClick={() => setOpen(true)}>
          + Upload
        </button> */}
        <button
          className="project-shell__nav-link"
          type="button"
          onClick={() => setModal({ open: true, mode: "create", tag: "" })}
        >
          Upload File
        </button>

      </div>

      {/* Tabs */}
      <div className="tablist">
        {DATASET_TABS.map(tab => (
          <button
            key={tab.key}
            className={activeDataset === tab.key ? 'active' : ''}
            onClick={() => {
              setActiveDataset(tab.key)
              setSelectedTag(null)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAG LIST VIEW ===== */}
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
            {tags.map(tag => (
              <tr key={tag.tag_name}>
                <td>{tag.tag_name}</td>
                <td>{new Date(tag.latest_created_at).toLocaleDateString()}</td>
                <td>
                  <button
                    onClick={() => setModal({ open: true, mode: "edit", tag: tag.tag_name })}
                  >
                    ✏
                  </button>

                  {/* <button>⬇</button> */}
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag.tag_name)}
                    disabled={deletingTag === tag.tag_name}
                    title={deletingTag === tag.tag_name ? 'Deleting...' : 'Delete tag'}
                  >
                    {deletingTag === tag.tag_name ? '...' : '🗑'}
                  </button>
                </td>
                <td>
                  <button
                    className="project-shell__nav-link"
                    onClick={() => setSelectedTag(tag.tag_name)}
                  >
                    →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ===== TAG DETAILS VIEW ===== */}
      {selectedTag && (
        <TagDetails
          projectId={projectId}
          datasetType={activeDataset}
          tagName={selectedTag}
          onBack={() => setSelectedTag(null)}
        />
      )}

      {/* Upload modal */}
      {/* {open && (
        <UploadModal
          projectId={projectId}
          projectName={project?.project_name || 'Project'}
          onClose={() => { setOpen(false); setEditTag(null) }}

          mode={editTag ? "edit" : "create"}
          initialTag={editTag || ""}
          datasetTypeFixed={activeDataset}
        />
      )} */}
      {modal.open && (
        <UploadModal
          projectId={projectId}
          projectName={project?.project_name || "Project"}
          onClose={() => setModal({ open: false, mode: "create", tag: "" })}
          mode={modal.mode}
          initialTag={modal.tag}
          initialDatasetType={activeDataset}
        />
      )}


    </div>
  )
}
