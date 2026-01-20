import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'
import { LazyTileCard } from '../../../components/viz/LazyTileCard'

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
  const [loadingViz, setLoadingViz] = useState(false)
  const [activeViz, setActiveViz] = useState(null)
  const [tilePreview, setTilePreview] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Select a visualization to preview')

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
    loadVisualizations()
  }, [projectId])

  const summarizeSeries = (viz) => {
    const items = viz?.series?.length ? viz.series : viz?.y_axis ? [{ y_axis: viz.y_axis }] : []
    if (!items.length) return 'No series'
    return items.map((item) => item.label || item.y_axis).join(', ')
  }

  const formatRangeValue = (val) => {
    if (val === undefined || val === null) return '-'
    if (Number.isFinite(Number(val))) return Number(val).toFixed(2)
    return val
  }

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const matchesTab = activeTab === 'all' || (job.dataset_type || '').toLowerCase() === activeTab
      const searchText = [job.filename, job.sheet_name].filter(Boolean).join(' ')
      const matchesSearch = !search || searchText.toLowerCase().includes(search.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [jobs, activeTab, search])

  const selectedPreview = useMemo(() => {
    if (!selected?.sample_rows?.length) return null
    const headers =
      selected.columns?.length > 0
        ? selected.columns
        : Object.keys(selected.sample_rows[0] || {})
    return {
      headers,
      rows: selected.sample_rows,
    }
  }, [selected])

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

  const loadVisualizations = async () => {
    try {
      setLoadingViz(true)
      const list = await visualizationApi.listForProject(projectId)
      setVisualizations(list)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoadingViz(false)
    }
  }

  const openVisualization = async (vizId) => {
    try {
      const detail = await visualizationApi.detail(vizId)
      setActiveViz(detail)
      setTilePreview(null)
      setStatusMessage(detail.message || detail.status || 'Visualization loaded')
      if (detail.html_url) {
        window.open(detail.html_url, '_blank')
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const deleteVisualization = async (vizId) => {
    if (!window.confirm('Delete this visualization?')) return
    try {
      await visualizationApi.remove(vizId)
      setVisualizations((prev) => prev.filter((viz) => viz.viz_id !== vizId))
      if (activeViz?.viz_id === vizId) {
        setActiveViz(null)
        setTilePreview(null)
        setStatusMessage('Select a visualization to preview')
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const loadTileData = useCallback(
    async (seriesIndex = 0, level, options = {}) => {
      if (!activeViz?.viz_id) return
      const { silent = false } = options
      if (!silent) setStatusMessage('Fetching tile data…')
      try {
        const data = await visualizationApi.tileData(activeViz.viz_id, {
          series: seriesIndex,
          level,
        })
        setTilePreview({ ...data, fetchedAt: new Date().toISOString(), seriesIndex })
        setStatusMessage(
          silent
            ? `Auto-loaded level ${data.level} tile while scrolling series ${seriesIndex + 1}`
            : `Loaded level ${data.level} tile for series ${seriesIndex + 1}`
        )
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }
    },
    [activeViz?.viz_id]
  )

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
            <p className="data-card__name">
              {job.sheet_name ? `${job.filename} — ${job.sheet_name}` : job.filename}
            </p>
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
              <h3 style={{ margin: '0 0 4px 0' }}>
                {selected.sheet_name ? `${selected.filename} — ${selected.sheet_name}` : selected.filename}
              </h3>
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
          {selectedPreview && (
            <div>
              <strong>Data preview</strong>
              <div className="excel-preview">
                <table className="data-table data-table--sheet">
                  <thead>
                    <tr>
                      {selectedPreview.headers.map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPreview.rows.map((row, idx) => (
                      <tr key={`preview-row-${idx}`}>
                        {selectedPreview.headers.map((header) => {
                          const value = row?.[header]
                          let cell = value
                          if (value === null || value === undefined) cell = ''
                          else if (typeof value === 'object') cell = JSON.stringify(value)
                          return <td key={`${idx}-${header}`}>{cell}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="summary-label" style={{ marginTop: 6 }}>
                Showing {selectedPreview.rows.length} rows from the ingested file.
              </p>
            </div>
          )}
          {!selectedPreview && (
            <div className="empty-state" style={{ textAlign: 'left' }}>
              No preview rows available for this file yet.
            </div>
          )}
        </div>
      )}

      <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="actions-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0' }}>Visualizations</h3>
            <p className="summary-label" style={{ margin: 0 }}>
              Download or open plots generated in the Data Visualisation workspace.
            </p>
          </div>
          <button className="project-shell__nav-link" type="button" onClick={loadVisualizations}>
            {loadingViz ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {visualizations.length === 0 && !loadingViz && (
          <div className="empty-state">No visualizations generated yet.</div>
        )}
        <div className="data-grid">
          {visualizations.map((viz) => (
            <div className="data-card" key={viz.viz_id}>
              <p className="data-card__name">{viz.filename}</p>
              <div className="data-card__meta">{viz.chart_type} · {viz.x_axis} vs {viz.y_axis || summarizeSeries(viz)}</div>
              <div className="data-card__meta">Status: {viz.status}</div>
              <div className="data-card__actions">
                <button className="project-shell__nav-link" onClick={() => openVisualization(viz.viz_id)}>
                  View
                </button>
                {viz.html_url && (
                  <button
                    className="project-shell__nav-link"
                    onClick={() => window.open(viz.html_url, '_blank')}
                  >
                    Download
                  </button>
                )}
                <button
                  className="project-shell__nav-link"
                  onClick={() => deleteVisualization(viz.viz_id)}
                  style={{ background: '#fff1f2', color: '#b91c1c', borderColor: '#fecdd3' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        {activeViz && (
          <div className="project-card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="actions-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="summary-label" style={{ margin: 0 }}>Preview</p>
                <h4 style={{ margin: '4px 0 0 0' }}>{activeViz.filename || 'Visualization'}</h4>
                <p className="summary-label" style={{ margin: 0 }}>{statusMessage}</p>
              </div>
              {activeViz?.status && <span className="badge">{activeViz.status}</span>}
            </div>
            <div className="viz-preview" style={{ height: 320 }}>
              {activeViz?.html ? (
                <iframe
                  title="visualization-preview"
                  srcDoc={activeViz.html}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div className="empty-state">Open a visualization to see its plot preview.</div>
              )}
            </div>
            {activeViz?.tiles?.length > 0 && (
              <div className="project-card" style={{ marginTop: 8 }}>
                <div className="actions-row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <p className="summary-label" style={{ margin: 0 }}>Materialized tiles</p>
                    <h4 style={{ margin: '4px 0 0 0' }}>Scroll to progressively load X-axis ranges</h4>
                  </div>
                  <button
                    type="button"
                    className="project-shell__nav-link"
                    onClick={() => loadTileData(0)}
                    disabled={!activeViz?.viz_id}
                  >
                    Load overview tile
                  </button>
                </div>
                {activeViz.tiles.map((item, idx) => (
                  <div key={`dm-series-tiles-${idx}`} style={{ marginTop: 8 }}>
                    <p className="summary-label" style={{ margin: 0 }}>
                      Series {idx + 1}: {item?.series?.label || item?.series?.y_axis}
                    </p>
                    <div className="viz-scroll" role="list">
                      {item.tiles.map((tile) => (
                        <LazyTileCard
                          key={`dm-tile-${tile.level}`}
                          tile={tile}
                          seriesIndex={idx}
                          onLoadTile={loadTileData}
                        >
                          <div>
                            <p className="data-card__name" style={{ margin: 0 }}>
                              Level {tile.level} · {tile.rows} rows
                            </p>
                            <p className="summary-label" style={{ margin: '2px 0 0 0' }}>
                              Range {formatRangeValue(tile.x_min)} – {formatRangeValue(tile.x_max)}
                            </p>
                            <p className="summary-label" style={{ margin: '2px 0 0 0' }}>
                              Scroll to auto-preview tile data in order of the X axis.
                            </p>
                          </div>
                          <div className="viz-actions">
                            {tile.url && (
                              <button
                                className="project-shell__nav-link"
                                type="button"
                                onClick={() => window.open(tile.url, '_blank')}
                              >
                                Download tile
                              </button>
                            )}
                            <button
                              className="project-shell__nav-link"
                              type="button"
                              onClick={() => loadTileData(idx, tile.level)}
                            >
                              Load
                            </button>
                          </div>
                        </LazyTileCard>
                      ))}
                    </div>
                  </div>
                ))}
                {tilePreview && (
                  <div style={{ marginTop: 12 }}>
                    <p className="summary-label" style={{ margin: 0 }}>
                      Loaded tile level {tilePreview.level} ({tilePreview.rows} rows)
                    </p>
                    <div className="viz-preview" style={{ minHeight: 120, padding: 8, overflow: 'auto' }}>
                      {tilePreview.data?.length ? (
                        <table className="data-table">
                          <thead>
                            <tr>
                              {Object.keys(tilePreview.data[0] || {}).map((key) => (
                                <th key={key}>{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tilePreview.data.slice(0, 10).map((row, idx) => (
                              <tr key={`dm-tile-row-${idx}`}>
                                {Object.keys(tilePreview.data[0] || {}).map((key) => (
                                  <td key={`${idx}-${key}`}>{row[key]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="empty-state">No tile rows returned.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
