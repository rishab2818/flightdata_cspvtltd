import React, { useEffect, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
<<<<<<< HEAD:frontend/src/pages/app/project/ProjectUpload.jsx


import UploadModal from './ProjectUploadModal.jsx'
import { ingestionApi } from '../../../api/ingestionApi'
import './ProjectUpload.css'
import TagDetails from './TagDetails'
import Plus from '../../../assets/Plus.svg'
import Folder1 from '../../../assets/Folder1.svg'
import CalendarBlank from '../../../assets/CalendarBlank.svg'
import Delete from '../../../assets/Delete.svg'
import PencilSimple from '../../../assets/PencilSimple.svg'
import ArrowRight from '../../../assets/ArrowRight.svg'

=======
import UploadModal from '../ProjectUploadModal.jsx'
import { ingestionApi } from '../../../../api/ingestionApi.js'
import './ProjectOverview.css'
import TagDetails from '../TagDetails.jsx'
>>>>>>> origin/Suraj_v:frontend/src/pages/app/project/project overview/ProjectOverview.jsx

const DATASET_TABS = [
  { key: 'cfd', label: 'CFD data' },
  { key: 'wind', label: 'Wind Tunnel Data' },
  { key: 'flight', label: 'Flight Data' },
  { key: 'others', label: 'Others' },
]

export default function ProjectOverview() {
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

      ; (async () => {
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
<<<<<<< HEAD:frontend/src/pages/app/project/ProjectUpload.jsx
   
    <div className="UploadWapper">
      {/* Header */}
      
        <div className='statscard'>
          <label className='projectTitle'>{project?.project_name}</label>
             <span className='projectActive' >
                      Active
                    </span>
          
        </div>
        
=======
    <div className="project-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>

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
>>>>>>> origin/Suraj_v:frontend/src/pages/app/project/project overview/ProjectOverview.jsx

      {/* Dataset tabs */}
      {!selectedTag && (
      <div className="UploadCard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

<<<<<<< HEAD:frontend/src/pages/app/project/ProjectUpload.jsx
         <button
          className="projectUploadLink"
          type="button"
          onClick={() => setModal({ open: true, mode: 'create', tag: '' })}
        >
          <img className="actionBtn" src={Plus} alt="plus"/>
          Upload File
        </button>
      </div>

=======
>>>>>>> origin/Suraj_v:frontend/src/pages/app/project/project overview/ProjectOverview.jsx
      {/* ================= TAG LIST ================= */}
      
        <table className="DataTable">
          <thead>
            <tr>
              <th className="tablehead">
                <span className="th-content">
                 <img style={{width:'20px', height:'20px'}} src={Folder1} alt="folder"/>Tag/Folder Name
                 </span>
                 </th>
              <th className="tablehead">
                <span className="th-content">
                <img style={{width:'20px', height:'20px'}} src={CalendarBlank} alt="calendar" />Created Date
                </span>
                </th>
                
              <th >Action</th>
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
                    <div style={{color:'#000000',fontFamily:'inter-regular,Helvetica',fontSize:'14px',fontWeight:'400'}}>
                      <div style={{gap:'6px', display:'flex',alignItems:'center'}}>
                                                      <img style={{width:'20px', height:'20px'}} src={Folder1} alt="folder"/>
                      {tag.tag_name}
                      </div>
                      </div>

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

                  <td style={{color:'#000000',fontFamily:'inter-regular,Helvetica',fontSize:'14px',fontWeight:'400'}}>
                    <div style={{gap:'6px', display:'flex',alignItems:'center'}}>
                    <img style={{width:'20px', height:'20px'}} src={CalendarBlank} alt="calendar" />
                    {tag.latest_created_at
                      ? new Date(tag.latest_created_at).toLocaleDateString()
                      : '-'}
                    </div>
                  </td>
                 
                  <td >
                    <button
                    style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px', alignItems:'center'}}
                      type="button"
                      onClick={() => setModal({ open: true, mode: 'edit', tag: tag.tag_name })}
                    >
                      <img style={{width:'20px', height:'20px'}} src={PencilSimple} alt="pencil"/>
                    </button>
                    <button
                      style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px', alignItems:'center',marginLeft: 8}}
                      type="button"
                      onClick={() => handleDeleteTag(tag.tag_name)}
                      disabled={deletingTag === tag.tag_name}
                    >
                      {deletingTag === tag.tag_name ? '...' : ''}
                      <img style={{width:'20px', height:'20px'}} src={Delete} alt="delete"/>
                      
                    </button>
                  </td>
                 
                  <td>
                    <button
                      className="projectlink"
                      type="button"
                      onClick={() => setSelectedTag(tag.tag_name)}
                    >
                      <img className="actionBtn" src={ArrowRight} alt="arrow"/>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
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
<<<<<<< HEAD:frontend/src/pages/app/project/ProjectUpload.jsx
    
   
=======
>>>>>>> origin/Suraj_v:frontend/src/pages/app/project/project overview/ProjectOverview.jsx
  )
}
