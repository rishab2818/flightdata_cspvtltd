import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ingestionApi } from '../../api/ingestionApi'
import { projectApi } from '../../api/projectapi'
import { storage } from '../../lib/storage'
import { COLORS, SPACING } from '../../styles/constants'
import Button from '../../components/common/Button'

export default function ProjectDetail(){
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [jobs, setJobs] = useState([])
  const [activeJob, setActiveJob] = useState(null)
  const [progress, setProgress] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(()=>{(async()=>{
    try{
      const data = await projectApi.getById(projectId)
      setProject(data)
      const jobsList = await ingestionApi.list(projectId)
      setJobs(jobsList)
    }catch(err){
      setError(err?.response?.data?.detail || err.message)
    }
  })()},[projectId])

  useEffect(()=>{
    if(!activeJob) return
    const token = storage.getToken()
    const es = new EventSource(`http://127.0.0.1:8000/api/ingestion/jobs/${activeJob.job_id}/stream?token=${token}`)
    const handler = (ev)=>{
      try{
        const payload = JSON.parse(ev.data)
        setProgress(payload)
      }catch(_){
        // ignore
      }
    }
    es.addEventListener('progress', handler)
    es.onmessage = handler
    es.onerror = ()=>{
      es.close()
    }
    return ()=> { es.removeEventListener('progress', handler); es.close() }
  },[activeJob])

  const handleFile = async (e)=>{
    const file = e.target.files?.[0]
    if(!file) return
    setUploading(true)
    setError(null)
    try{
      const job = await ingestionApi.start(projectId, file)
      setActiveJob(job)
      const refreshed = await ingestionApi.list(projectId)
      setJobs(refreshed)
    }catch(err){
      setError(err?.response?.data?.detail || err.message)
    }finally{
      setUploading(false)
    }
  }

  const selectedJob = useMemo(()=>{
    if(!activeJob) return null
    const found = jobs.find(j=>j.job_id===activeJob.job_id)
    return found || activeJob
  },[activeJob, jobs])

  return (
    <div style={{ padding: SPACING.lg, color: COLORS.textPrimary }}>
      <Button variant="secondary" onClick={()=>navigate(-1)} style={{ marginBottom: SPACING.md }}>
        Back
      </Button>
      {error && <div style={{ color: COLORS.dangerText, marginBottom: SPACING.md }}>{error}</div>}
      {project && (
        <div style={{ marginBottom: SPACING.lg }}>
          <h2 style={{ margin: 0 }}>{project.project_name}</h2>
          <p style={{ color: COLORS.textSecondary }}>{project.project_description}</p>
        </div>
      )}

      <div style={{ border: `1px solid ${COLORS.border}`, padding: SPACING.lg, borderRadius: 8, marginBottom: SPACING.lg }}>
        <h3 style={{ marginTop: 0 }}>Upload data (.csv, .xlsx, .mat, .dat)</h3>
        <input type="file" accept=".csv,.xlsx,.xls,.mat,.dat,.txt" onChange={handleFile} disabled={uploading} />
        {uploading && <p style={{ color: COLORS.textSecondary }}>Uploading...</p>}
      </div>

      {selectedJob && (
        <div style={{ border: `1px solid ${COLORS.border}`, padding: SPACING.lg, borderRadius: 8, marginBottom: SPACING.lg }}>
          <h3 style={{ marginTop: 0 }}>Live progress</h3>
          <div>Job: {selectedJob.filename}</div>
          <div>Status: {progress?.status || selectedJob.status}</div>
          <div>Progress: {progress?.progress ?? selectedJob.progress}%</div>
          {progress?.message && <div style={{ color: COLORS.textSecondary }}>{progress.message}</div>}
        </div>
      )}

      <div style={{ border: `1px solid ${COLORS.border}`, padding: SPACING.lg, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Recent ingestions</h3>
        <div style={{ display: 'grid', gap: SPACING.md }}>
          {jobs.map(job=>(
            <div key={job.job_id} style={{ padding: SPACING.md, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{job.filename}</div>
                  <div style={{ color: COLORS.textSecondary, fontSize: 12 }}>Status: {job.status}</div>
                </div>
                <Button variant="ghost" onClick={()=>setActiveJob(job)}>View</Button>
              </div>
              {job.sample_rows && (
                <div style={{ marginTop: SPACING.sm }}>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Columns: {job.columns?.join(', ')}</div>
                  <pre style={{ background: COLORS.mutedBackground, padding: SPACING.sm, borderRadius: 4, overflowX: 'auto' }}>
                    {JSON.stringify(job.sample_rows, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
