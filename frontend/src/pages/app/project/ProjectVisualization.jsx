import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'

import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'

export default function ProjectVisualization() {
  const { projectId } = useParams()
  const { project } = useOutletContext()

  const [jobs, setJobs] = useState([])
  const [visualizations, setVisualizations] = useState([])
  const [seriesList, setSeriesList] = useState([])
  const [seriesForm, setSeriesForm] = useState({
    jobId: '',
    xAxes: [],
    yAxes: [],
    zAxes: [],
    label: '',
  })
  const [vizForm, setVizForm] = useState({ name: '', description: '', chunkSize: 50000 })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedViz, setSelectedViz] = useState(null)
  const [loadingChunk, setLoadingChunk] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const activeVizRef = useRef(null)

  const selectedJob = useMemo(
    () => jobs.find((j) => j.job_id === seriesForm.jobId),
    [jobs, seriesForm.jobId]
  )

  const refresh = async () => {
    try {
      setLoading(true)
      const [jobsRes, vizRes] = await Promise.all([
        ingestionApi.list(projectId),
        visualizationApi.list(projectId),
      ])
      setJobs(jobsRes)
      setVisualizations(vizRes)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  const handleAddSeries = () => {
    if (!seriesForm.jobId || seriesForm.xAxes.length === 0 || seriesForm.yAxes.length === 0) {
      setError('Pick a data file and at least one header for X and Y axes')
      return
    }
    setSeriesList((prev) => [
      ...prev,
      {
        job_id: seriesForm.jobId,
        x_axes: seriesForm.xAxes,
        y_axes: seriesForm.yAxes,
        z_axes: seriesForm.zAxes?.length ? seriesForm.zAxes : null,
        label: seriesForm.label || selectedJob?.filename,
        filename: selectedJob?.filename,
      },
    ])
    setSeriesForm({ jobId: '', xAxes: [], yAxes: [], zAxes: [], label: '' })
    setError(null)
  }

  const handleRemoveSeries = (idx) => {
    setSeriesList((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleCreate = async () => {
    if (!vizForm.name.trim()) {
      setError('Give this visualization a name')
      return
    }
    if (seriesList.length === 0) {
      setError('Add at least one series (file + columns) before generating a plot')
      return
    }
    try {
      setCreating(true)
      const payload = {
        name: vizForm.name,
        description: vizForm.description,
        chunk_size: vizForm.chunkSize,
        series: seriesList.map((s) => ({
          job_id: s.job_id,
          x_axes: s.x_axes,
          y_axes: s.y_axes,
          z_axes: s.z_axes,
          label: s.label,
        })),
      }
      await visualizationApi.create(projectId, payload)
      await refresh()
      setVizForm({ name: '', description: '', chunkSize: vizForm.chunkSize })
      setSeriesList([])
      setStatusMessage('Visualization request queued. It will process in the background.')
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setCreating(false)
    }
  }

  const fetchImageChunk = async (vizId, chunkIndex = 0) => {
    if (!vizId && !selectedViz?.viz_id) return
    setLoadingChunk(true)
    try {
      const data = await visualizationApi.image(vizId || selectedViz.viz_id, chunkIndex)
      if (activeVizRef.current !== (vizId || selectedViz.viz_id)) return
      setImageUrl(data.url)
      setCurrentChunk(chunkIndex)
      setStatusMessage(
        `Rendered chunk ${chunkIndex + 1} / ${selectedViz?.chunk_count || ''} in backend; streaming as image.`
      )
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoadingChunk(false)
    }
  }

  const loadVisualization = async (viz) => {
    if (!viz) return
    activeVizRef.current = viz.viz_id
    setSelectedViz(viz)
    setImageUrl('')
    setCurrentChunk(null)
    setStatusMessage('Preparing visualization…')
    try {
      const detail = await visualizationApi.detail(viz.viz_id)
      const merged = { ...viz, ...detail }
      setSelectedViz(merged)
      if (detail.status !== 'SUCCESS') {
        setStatusMessage('Still processing. Refresh status to see progress.')
        return
      }
      if (detail.chunk_count > 0) {
        setStatusMessage('Backend rendered chunk 1 as an image; loading…')
        await fetchImageChunk(detail.viz_id, 0)
      } else {
        setStatusMessage('No data rows available to render yet.')
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  return (
    <div className="project-card visualization-grid">
      <div className="viz-builder">
        <div className="viz-header">
          <div>
            <p className="summary-label">Visualization</p>
            <h2 style={{ margin: '4px 0 0 0' }}>Generate multi-axis graphs</h2>
            <p className="summary-label">Pick any uploaded files and map headers to X, Y, Z axes for {project?.project_name || 'this project'}.</p>
          </div>
          <div className="badge">RAM-safe chunking</div>
        </div>

        {error && <div className="project-shell__error">{error}</div>}
        {statusMessage && !error && <div className="hint">{statusMessage}</div>}
        {loading && <div className="summary-label">Loading data sources…</div>}

        <div className="form-grid">
          <label className="input-group">
            <span>Visualization name</span>
            <input
              type="text"
              value={vizForm.name}
              onChange={(e) => setVizForm({ ...vizForm, name: e.target.value })}
              placeholder="Engine health plot"
            />
          </label>
          <label className="input-group">
            <span>Chunk size per stream (rows)</span>
            <input
              type="number"
              min={1000}
              max={500000}
              value={vizForm.chunkSize}
              onChange={(e) => setVizForm({ ...vizForm, chunkSize: Number(e.target.value) })}
            />
            <p className="summary-label">Keeps memory steady; data is streamed chunk by chunk.</p>
          </label>
          <label className="input-group">
            <span>Description (optional)</span>
            <textarea
              rows={2}
              value={vizForm.description}
              onChange={(e) => setVizForm({ ...vizForm, description: e.target.value })}
              placeholder="Plotting pitch vs altitude vs yaw from all runs"
            />
          </label>
        </div>

        <div className="series-row">
          <div className="series-column">
            <label className="input-group">
              <span>Pick data file</span>
              <select
                value={seriesForm.jobId}
                onChange={(e) => setSeriesForm({ ...seriesForm, jobId: e.target.value })}
              >
                <option value="">Select uploaded file</option>
                {jobs.map((job) => (
                  <option key={job.job_id} value={job.job_id}>
                    {job.filename} ({job.columns?.length || 0} columns)
                  </option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <span>Label (optional)</span>
              <input
                type="text"
                value={seriesForm.label}
                onChange={(e) => setSeriesForm({ ...seriesForm, label: e.target.value })}
                placeholder="Defaults to filename"
              />
            </label>
          </div>

          <div className="series-column">
            <label className="input-group">
              <span>X axis headers</span>
              <select
                multiple
                value={seriesForm.xAxes}
                onChange={(e) =>
                  setSeriesForm({
                    ...seriesForm,
                    xAxes: Array.from(e.target.selectedOptions).map((o) => o.value),
                  })
                }
              >
                {(selectedJob?.columns || []).map((col) => (
                  <option key={`x-${col}`} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <p className="summary-label">Supports multiple headers; each combination is a trace.</p>
            </label>
          </div>

          <div className="series-column">
            <label className="input-group">
              <span>Y axis headers</span>
              <select
                multiple
                value={seriesForm.yAxes}
                onChange={(e) =>
                  setSeriesForm({
                    ...seriesForm,
                    yAxes: Array.from(e.target.selectedOptions).map((o) => o.value),
                  })
                }
              >
                {(selectedJob?.columns || []).map((col) => (
                  <option key={`y-${col}`} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="series-column">
            <label className="input-group">
              <span>Z axis headers (optional)</span>
              <select
                multiple
                value={seriesForm.zAxes}
                onChange={(e) =>
                  setSeriesForm({
                    ...seriesForm,
                    zAxes: Array.from(e.target.selectedOptions).map((o) => o.value),
                  })
                }
              >
                {(selectedJob?.columns || []).map((col) => (
                  <option key={`z-${col}`} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <p className="summary-label">Leave empty for 2D ScatterGL; add to unlock 3D traces.</p>
            </label>
          </div>
        </div>

        <div className="actions-row" style={{ marginTop: 8 }}>
          <button className="project-shell__nav-link" onClick={handleAddSeries}>
            Add series
          </button>
          <button
            className="project-shell__nav-link"
            style={{ background: '#0f172a', color: 'white' }}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Queuing…' : 'Generate visualization'}
          </button>
        </div>

        {seriesList.length > 0 && (
          <div className="series-list">
            {seriesList.map((s, idx) => (
              <div key={`${s.job_id}-${idx}`} className="series-chip">
                <div>
                  <strong>{s.label || s.filename || 'Series'}</strong>
                  <p className="summary-label">
                    X: {s.x_axes.join(', ')} | Y: {s.y_axes.join(', ')}
                    {s.z_axes ? ` | Z: ${s.z_axes.join(', ')}` : ''}
                  </p>
                </div>
                <button className="link danger" onClick={() => handleRemoveSeries(idx)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="viz-viewer">
          <div className="viz-header">
            <div>
              <p className="summary-label">Saved graphs</p>
              <h3 style={{ margin: 0 }}>Data Management / Visualizations</h3>
              <p className="summary-label">Pick a graph to view backend-rendered chunk images without downsampling.</p>
            </div>
            <button className="project-shell__nav-link" onClick={refresh}>
              Refresh list
            </button>
        </div>

        <div className="data-grid">
          {visualizations.map((viz) => (
            <div className="data-card" key={viz.viz_id}>
              <div className="data-card__meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p className="data-card__name">{viz.name}</p>
                  <p className="summary-label">{viz.description || 'No description'}</p>
                </div>
                <span className="badge">{viz.status || 'QUEUED'}</span>
              </div>
              <div className="data-card__meta">
                {viz.chunk_count || 0} chunks · {viz.rows_total || 0} rows · chunk size {viz.chunk_size}
              </div>
              <div className="data-card__actions">
                <button className="project-shell__nav-link" onClick={() => loadVisualization(viz)}>
                  Load
                </button>
                <button
                  className="project-shell__nav-link"
                  onClick={() =>
                    visualizationApi
                      .downloadChunk(viz.viz_id, 0)
                      .then(({ url }) => window.open(url, '_blank'))
                      .catch((err) => setError(err?.response?.data?.detail || err.message))
                  }
                >
                  Download chunk 0
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedViz && (
          <div className="project-card" style={{ marginTop: 16 }}>
            <div className="actions-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0' }}>{selectedViz.name}</h3>
                <p className="summary-label" style={{ margin: 0 }}>
                  {selectedViz.rows_total || 0} rows · {selectedViz.chunk_count || 0} chunks · {selectedViz.trace_labels?.length || 0} traces
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="project-shell__nav-link" onClick={() => loadVisualization(selectedViz)}>
                  Refresh status
                </button>
              </div>
            </div>
            {selectedViz.status !== 'SUCCESS' && (
              <div className="summary-label">
                Status: {selectedViz.status} · Progress {selectedViz.progress || 0}% · {selectedViz.message || 'processing'}
              </div>
            )}
            {selectedViz.status === 'SUCCESS' && selectedViz.chunk_count === 0 && (
              <div className="summary-label">No chunks available to render yet.</div>
            )}
            {selectedViz.status === 'SUCCESS' && selectedViz.chunk_count > 0 && (
              <div>
                <div className="actions-row" style={{ justifyContent: 'flex-start', gap: 8 }}>
                  <button
                    className="project-shell__nav-link"
                    disabled={currentChunk === null || currentChunk === 0}
                    onClick={() => fetchImageChunk(selectedViz.viz_id, Math.max((currentChunk || 0) - 1, 0))}
                  >
                    Previous chunk image
                  </button>
                  <button
                    className="project-shell__nav-link"
                    disabled={
                      currentChunk === null || currentChunk + 1 >= (selectedViz.chunk_count || 0)
                    }
                    onClick={() =>
                      fetchImageChunk(
                        selectedViz.viz_id,
                        Math.min((currentChunk || 0) + 1, (selectedViz.chunk_count || 1) - 1)
                      )
                    }
                  >
                    Next chunk image
                  </button>
                </div>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Visualization chunk ${currentChunk !== null ? currentChunk + 1 : ''}`}
                    style={{ width: '100%', maxHeight: 540, objectFit: 'contain', borderRadius: 8 }}
                  />
                ) : (
                  <div className="summary-label">Select a visualization to load rendered chunks.</div>
                )}
              </div>
            )}
            {loadingChunk && <div className="summary-label">Loading rendered chunk…</div>}
          </div>
        )}
      </div>
    </div>
  )
}
