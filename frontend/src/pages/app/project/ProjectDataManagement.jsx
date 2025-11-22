import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'cfd', label: 'CFD' },
  { key: 'wind', label: 'Wind Data' },
  { key: 'aero', label: 'Aero Data' },
]

export default function ProjectDataManagement() {
  const { projectId } = useParams()
  const { project } = useOutletContext()
  const [jobs, setJobs] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [visualizations, setVisualizations] = useState([])

  const refresh = async () => {
    try {
      setLoading(true)
      const list = await ingestionApi.list(projectId)
      setJobs(list)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  useEffect(() => {
    ;(async () => {
      try {
        const list = await visualizationApi.list(projectId)
        setVisualizations(list)
      } catch (err) {
        // non-blocking
      }
    })()
  }, [projectId])

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const matchesTab = activeTab === 'all' || (job.dataset_type || '').toLowerCase() === activeTab
      const matchesSearch = !search || job.filename.toLowerCase().includes(search.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [jobs, activeTab, search])

  const handleDownload = async (job) => {
    try {
      const { url } = await ingestionApi.download(job.job_id)
      window.open(url, '_blank')
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const handleDelete = async (job) => {
    if (!window.confirm('Delete this file from the repository?')) return
    try {
      await ingestionApi.remove(job.job_id)
      await refresh()
      if (selected?.job_id === job.job_id) setSelected(null)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  return (
    <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="summary-label" style={{ margin: 0 }}>Data Management</p>
          <h2 style={{ margin: '4px 0 0 0' }}>{project?.project_name || 'Project'} Repository</h2>
        </div>
        <div className="search-row">
          <input
            type="search"
            placeholder="Search by filename"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="tablist">
        {filterTabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="project-shell__error">{error}</div>}
      {loading && <div className="summary-label">Loading files…</div>}

      {!loading && filtered.length === 0 && <div className="empty-state">No data available for this filter.</div>}

      <div className="data-grid">
        {filtered.map((job) => (
          <div className="data-card" key={job.job_id}>
            <p className="data-card__name">{job.filename}</p>
            <div className="data-card__meta">Status: {job.status}</div>
            <div className="data-card__meta">Dataset: {job.dataset_type || 'Unspecified'}</div>
            <div className="data-card__meta">Columns: {job.columns?.length || 0}</div>
            <div className="data-card__actions">
              <button className="project-shell__nav-link" onClick={() => setSelected(job)} style={{ flex: 1 }}>
                View
              </button>
              <button className="project-shell__nav-link" onClick={() => handleDownload(job)} style={{ flex: 1 }}>
                Download
              </button>
              <button
                className="project-shell__nav-link"
                onClick={() => handleDelete(job)}
                style={{ flex: 1, background: '#fff1f2', color: '#b91c1c', borderColor: '#fecdd3' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="actions-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0' }}>{selected.filename}</h3>
              <p className="summary-label" style={{ margin: 0 }}>
                {selected.columns?.length || 0} columns · {selected.rows_seen || 0} rows inspected
              </p>
            </div>
            <span className="badge">{selected.dataset_type || 'Dataset'}</span>
          </div>
          {selected.columns && (
            <div>
              <strong>Headers</strong>
              <p className="summary-label">{selected.columns.join(', ')}</p>
            </div>
          )}
          {selected.sample_rows && (
            <div>
              <strong>Sample rows</strong>
              <pre className="input-control" style={{ maxHeight: 240, overflow: 'auto' }}>
                {JSON.stringify(selected.sample_rows, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {visualizations.length > 0 && (
        <div className="project-card" style={{ marginTop: 16 }}>
          <div className="actions-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0 }}>Saved visualizations</h3>
              <p className="summary-label" style={{ margin: 0 }}>
                Stored in backend; open the Visualization module to stream them.
              </p>
            </div>
          </div>
          <div className="data-grid">
            {visualizations.map((viz) => (
              <div className="data-card" key={viz.viz_id}>
                <p className="data-card__name">{viz.name}</p>
                <div className="data-card__meta">{viz.description || 'No description'}</div>
                <div className="data-card__meta">{viz.chunk_count || 0} chunks · {viz.rows_total || 0} rows</div>
                <span className="badge">{viz.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
