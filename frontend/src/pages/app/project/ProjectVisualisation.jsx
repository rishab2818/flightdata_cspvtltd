import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'

const chartTypes = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
]

export default function ProjectVisualisation() {
  const { projectId } = useParams()
  const { project } = useOutletContext()
  const [jobs, setJobs] = useState([])
  const [visualizations, setVisualizations] = useState([])
  const [xJobId, setXJobId] = useState('')
  const [xAxis, setXAxis] = useState('')
  const [series, setSeries] = useState([{ jobId: '', yAxis: '', label: '' }])
  const [chartType, setChartType] = useState('scatter')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [plotHtml, setPlotHtml] = useState('')
  const [activeViz, setActiveViz] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Select a dataset to begin')
  const pollTimer = useRef(null)

  const xJob = useMemo(() => jobs.find((job) => job.job_id === xJobId), [jobs, xJobId])

  const validSeries = useMemo(
    () => series.filter((item) => item.jobId && item.yAxis),
    [series]
  )

  const fetchJobs = async () => {
    try {
      const list = await ingestionApi.list(projectId)
      setJobs(list)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const fetchVisualizations = async () => {
    try {
      const list = await visualizationApi.listForProject(projectId)
      setVisualizations(list)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  useEffect(() => {
    fetchJobs()
    fetchVisualizations()
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [projectId])

  const resetForm = () => {
    setXJobId('')
    setXAxis('')
    setSeries([{ jobId: '', yAxis: '', label: '' }])
    setChartType('scatter')
  }

  const loadVisualization = async (vizId) => {
    try {
      const detail = await visualizationApi.detail(vizId)
      setActiveViz(detail)
      setPlotHtml(detail.html || '')
      setStatusMessage(detail.message || detail.status)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const pollVisualization = async (vizId) => {
    try {
      const detail = await visualizationApi.detail(vizId)
      setActiveViz(detail)
      setPlotHtml(detail.html || '')
      setStatusMessage(detail.message || detail.status)
      if (detail.status !== 'SUCCESS' && detail.status !== 'FAILURE') {
        pollTimer.current = setTimeout(() => pollVisualization(vizId), 1500)
      } else {
        pollTimer.current = null
        fetchVisualizations()
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!xJobId || !xAxis || validSeries.length === 0) {
      setError('Please choose an X axis dataset, X axis column, and at least one Y series')
      return
    }
    setError(null)
    setLoading(true)
    setPlotHtml('')
    setStatusMessage('Starting visualization job…')
    if (pollTimer.current) clearTimeout(pollTimer.current)
    try {
      const res = await visualizationApi.create({
        project_id: projectId,
        x_axis: xAxis,
        series: validSeries.map((item) => ({
          job_id: item.jobId,
          y_axis: item.yAxis,
          label: item.label?.trim() || undefined,
        })),
        chart_type: chartType,
      })
      setActiveViz(res)
      pollVisualization(res.viz_id)
      resetForm()
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  const xColumns = xJob?.columns || []

  const getColumnsForJob = (jobId) => jobs.find((job) => job.job_id === jobId)?.columns || []

  const updateSeriesItem = (index, field, value) => {
    setSeries((prev) => {
      const clone = [...prev]
      clone[index] = { ...clone[index], [field]: value }
      return clone
    })
  }

  const addSeriesRow = () => setSeries((prev) => [...prev, { jobId: '', yAxis: '', label: '' }])

  const removeSeriesRow = (index) => {
    setSeries((prev) => prev.filter((_, idx) => idx !== index))
  }

  const summarizeSeries = (viz) => {
    const items = viz?.series?.length
      ? viz.series
      : viz?.y_axis
        ? [{ y_axis: viz.y_axis, label: viz.y_axis, filename: viz.filename }]
        : []
    if (!items.length) return 'No series'
    return items.map((item) => item.label || item.y_axis).join(', ')
  }

  const primaryFilename = (viz) => viz?.filename || viz?.series?.[0]?.filename || 'dataset'

  return (
    <div className="project-card" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <p className="summary-label" style={{ margin: 0 }}>
            Data Visualisation
          </p>
          <h2 style={{ margin: '4px 0 8px 0' }}>{project?.project_name || 'Project'} Charts</h2>
          <p className="summary-label" style={{ margin: 0 }}>
            Pick a dataset from your repository, choose X/Y axes and generate a Plotly visual in the
            background.
          </p>
        </div>

        {error && <div className="project-shell__error">{error}</div>}

        <form onSubmit={handleSubmit} className="viz-form">
          <label className="summary-label">X Axis Dataset</label>
          <select
            className="input-control"
            value={xJobId}
            onChange={(e) => {
              setXJobId(e.target.value)
              setXAxis('')
            }}
          >
            <option value="">Select a file to plot</option>
            {jobs.map((job) => (
              <option key={job.job_id} value={job.job_id}>
                {job.filename} ({job.columns?.length || 0} columns)
              </option>
            ))}
          </select>

          <div className="viz-grid">
            <div>
              <label className="summary-label">X Axis</label>
              <select className="input-control" value={xAxis} onChange={(e) => setXAxis(e.target.value)}>
                <option value="">Select column</option>
                {xColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="project-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="actions-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="summary-label" style={{ margin: 0 }}>
                  Y Axis Series ({series.length})
                </p>
                <h4 style={{ margin: 0 }}>Add one or more columns to plot</h4>
              </div>
              <button type="button" className="project-shell__nav-link" onClick={addSeriesRow}>
                Add series
              </button>
            </div>

            {series.map((item, index) => {
              const columns = getColumnsForJob(item.jobId)
              return (
                <div key={`series-${index}`} className="viz-grid" style={{ alignItems: 'flex-end' }}>
                  <div>
                    <label className="summary-label">Dataset</label>
                    <select
                      className="input-control"
                      value={item.jobId}
                      onChange={(e) => {
                        updateSeriesItem(index, 'jobId', e.target.value)
                        updateSeriesItem(index, 'yAxis', '')
                      }}
                    >
                      <option value="">Select a file</option>
                      {jobs.map((job) => (
                        <option key={job.job_id} value={job.job_id}>
                          {job.filename} ({job.columns?.length || 0} columns)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="summary-label">Y Axis</label>
                    <select
                      className="input-control"
                      value={item.yAxis}
                      onChange={(e) => updateSeriesItem(index, 'yAxis', e.target.value)}
                    >
                      <option value="">Select column</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="summary-label">Legend label (optional)</label>
                    <input
                      type="text"
                      className="input-control"
                      value={item.label}
                      onChange={(e) => updateSeriesItem(index, 'label', e.target.value)}
                      placeholder="Defaults to column name"
                    />
                  </div>

                  {series.length > 1 && (
                    <button
                      type="button"
                      className="project-shell__nav-link"
                      onClick={() => removeSeriesRow(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div>
            <label className="summary-label">Chart type</label>
            <div className="tablist">
              {chartTypes.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={chartType === opt.value ? 'active' : ''}
                  onClick={() => setChartType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="project-shell__nav-link" disabled={loading}>
            {loading ? 'Starting…' : 'Generate Plot'}
          </button>
        </form>

        <div className="project-card" style={{ padding: 14 }}>
          <div className="actions-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <p className="summary-label" style={{ margin: 0 }}>
                Latest visualizations ({visualizations.length})
              </p>
              <h4 style={{ margin: 0 }}>Saved plots</h4>
            </div>
            <button className="project-shell__nav-link" type="button" onClick={fetchVisualizations}>
              Refresh
            </button>
          </div>
          {visualizations.length === 0 && <div className="empty-state">No visualizations yet.</div>}
          <div className="viz-list">
            {visualizations.map((viz) => (
              <div key={viz.viz_id} className="viz-item">
                <div>
                  <p className="data-card__name" style={{ margin: 0 }}>{primaryFilename(viz)}</p>
                  <p className="summary-label" style={{ margin: '2px 0 0 0' }}>
                    {viz.chart_type} · {viz.x_axis} vs {summarizeSeries(viz)}
                  </p>
                  <p className="summary-label" style={{ margin: '2px 0 0 0' }}>
                    Status: {viz.status}
                  </p>
                </div>
                <div className="viz-actions">
                  <button className="project-shell__nav-link" type="button" onClick={() => loadVisualization(viz.viz_id)}>
                    View
                  </button>
                  {viz.html_url && (
                    <button
                      className="project-shell__nav-link"
                      type="button"
                      onClick={() => window.open(viz.html_url, '_blank')}
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="project-card" style={{ minHeight: 520, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="actions-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="summary-label" style={{ margin: 0 }}>Render preview</p>
            <h3 style={{ margin: '2px 0 0 0' }}>{primaryFilename(activeViz) || 'Awaiting selection'}</h3>
            <p className="summary-label" style={{ margin: 0 }}>{statusMessage}</p>
          </div>
          {activeViz?.status && (
            <span className="badge" style={{ textTransform: 'capitalize' }}>
              {activeViz.status.toLowerCase()}
            </span>
          )}
        </div>
        <div className="viz-preview">
          {plotHtml ? (
            <iframe title="plot" srcDoc={plotHtml} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <div className="empty-state">Generate or open a visualization to preview it here.</div>
          )}
        </div>
      </div>
    </div>
  )
}
