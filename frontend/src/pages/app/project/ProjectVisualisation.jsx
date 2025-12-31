import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'
import { LazyTileCard } from '../../../components/viz/LazyTileCard'

const DATASET_TYPES = [
  { key: 'cfd', label: 'CFD' },
  { key: 'wind', label: 'Wind Tunnel' },
  { key: 'flight', label: 'Flight Data' },
  { key: 'others', label: 'Others' },
]

const CHART_TYPES = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
]

const datasetLabel = (key) => DATASET_TYPES.find((d) => d.key === key)?.label || key

const newSeries = (n = 1) => ({
  id: `s-${Date.now()}-${n}`,
  enabled: true,

  datasetType: 'wind',
  tag: '',
  jobId: '',
  xAxis: '',
  yAxis: '',
  label: '',
})

export default function ProjectVisualisation() {
  const { projectId } = useParams()
  const { project } = useOutletContext()

  /* ================= series manager ================= */
  const [seriesList, setSeriesList] = useState([newSeries(1)])
  const [activeSeriesId, setActiveSeriesId] = useState(seriesList[0]?.id)

  /* ================= global plot config ================= */
  const [chartType, setChartType] = useState('scatter')

  /* ================= data caches ================= */
  const [tagsByDataset, setTagsByDataset] = useState({}) // { datasetType: [tags...] }
  const [filesByDatasetTag, setFilesByDatasetTag] = useState({}) // { `${ds}::${tag}`: [files...] }

  /* ================= visualization state ================= */
  const [visualizations, setVisualizations] = useState([])
  const [activeViz, setActiveViz] = useState(null)
  const [plotHtml, setPlotHtml] = useState('')
  const [tilePreview, setTilePreview] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Select data to begin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const pollTimer = useRef(null)

  /* ================= helpers ================= */
  const activeSeries = useMemo(
    () => seriesList.find((s) => s.id === activeSeriesId) || seriesList[0],
    [seriesList, activeSeriesId]
  )

  // ensure activeSeriesId always valid
  useEffect(() => {
    if (!seriesList.length) {
      const s = newSeries(1)
      setSeriesList([s])
      setActiveSeriesId(s.id)
      return
    }
    if (!activeSeriesId || !seriesList.some((s) => s.id === activeSeriesId)) {
      setActiveSeriesId(seriesList[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesList])

  const updateActiveSeries = (patch) => {
    setSeriesList((prev) =>
      prev.map((s) => (s.id === activeSeriesId ? { ...s, ...patch } : s))
    )
  }

  const setSeriesEnabled = (id, enabled) => {
    setSeriesList((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)))
  }

  const addSeriesSlot = () => {
    setSeriesList((prev) => {
      const s = newSeries(prev.length + 1)
      // default dataset same as currently selected series (nice UX)
      s.datasetType = activeSeries?.datasetType || 'wind'
      return [...prev, s]
    })
    // select the new one
    setTimeout(() => {
      setSeriesList((prev) => {
        const last = prev[prev.length - 1]
        if (last?.id) setActiveSeriesId(last.id)
        return prev
      })
    }, 0)
  }

  const removeSeriesSlot = (id) => {
    if (seriesList.length === 1) return
    setSeriesList((prev) => prev.filter((s) => s.id !== id))
    if (activeSeriesId === id) {
      const remaining = seriesList.filter((s) => s.id !== id)
      setActiveSeriesId(remaining[0]?.id)
    }
  }

  const seriesSummary = (s) => {
    const ds = datasetLabel(s.datasetType)
    const x = s.xAxis || '-'
    const y = s.yAxis || '-'
    const file = s.jobId ? 'file✅' : 'file❌'
    return `${ds} • ${file} • ${x} → ${y}`
  }

  const getTags = (datasetType) => tagsByDataset[datasetType] || []
  const getFiles = (datasetType, tag) => filesByDatasetTag[`${datasetType}::${tag}`] || []

  /* ================= load tags for datasetType (per active series) ================= */
  useEffect(() => {
    const ds = activeSeries?.datasetType
    if (!ds) return

    // if cached, skip
    if (tagsByDataset[ds]) return

    ingestionApi
      .listTags(projectId, ds)
      .then((rows) => {
        setTagsByDataset((prev) => ({ ...prev, [ds]: rows || [] }))
      })
      .catch((e) => {
        console.error(e)
        setError(e?.response?.data?.detail || e.message || 'Failed to load tags')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activeSeries?.datasetType])

  /* ================= load files for (datasetType, tag) (per active series) ================= */
  useEffect(() => {
    const ds = activeSeries?.datasetType
    const tag = activeSeries?.tag
    if (!ds || !tag) return
    const key = `${ds}::${tag}`
    if (filesByDatasetTag[key]) return

    ingestionApi
      .listFilesInTag(projectId, ds, tag)
      .then((list) => {
        // processed only (since visualization needs columns)
        const processed = (list || []).filter((f) => f.processed_key && f.columns?.length)
        setFilesByDatasetTag((prev) => ({ ...prev, [key]: processed }))
      })
      .catch((e) => {
        console.error(e)
        setError(e?.response?.data?.detail || e.message || 'Failed to load files')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activeSeries?.datasetType, activeSeries?.tag])

  /* ================= load saved visualizations ================= */
  const fetchVisualizations = async () => {
    try {
      const list = await visualizationApi.listForProject(projectId)
      setVisualizations(list || [])
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load visualizations')
    }
  }

  useEffect(() => {
    fetchVisualizations()
    return () => pollTimer.current && clearTimeout(pollTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  /* ================= columns for active series ================= */
  const activeFiles = useMemo(() => {
    if (!activeSeries?.datasetType || !activeSeries?.tag) return []
    return getFiles(activeSeries.datasetType, activeSeries.tag)
  }, [activeSeries?.datasetType, activeSeries?.tag, filesByDatasetTag])

  const activeJob = useMemo(
    () => activeFiles.find((f) => f.job_id === activeSeries?.jobId),
    [activeFiles, activeSeries?.jobId]
  )

  const activeColumns = useMemo(() => activeJob?.columns || [], [activeJob])

  /* ================= submit ================= */
  const enabledSeries = useMemo(
    () => seriesList.filter((s) => s.enabled),
    [seriesList]
  )

  const buildAutoLabel = (s) => {
    const ds = datasetLabel(s.datasetType)
    const x = s.xAxis || ''
    const y = s.yAxis || ''
    if (!x || !y) return ds
    return `${ds} | ${x} → ${y}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const payloadSeries = enabledSeries
      .filter((s) => s.jobId && s.xAxis && s.yAxis)
      .map((s) => ({
        job_id: s.jobId,
        x_axis: s.xAxis,
        y_axis: s.yAxis,
        label: (s.label || '').trim() || buildAutoLabel(s),
      }))

    if (payloadSeries.length === 0) {
      setError('Please configure at least one enabled series with File, X and Y selected.')
      return
    }

    setLoading(true)
    setError(null)
    setPlotHtml('')
    setTilePreview(null)
    setStatusMessage('Starting visualization…')
    if (pollTimer.current) clearTimeout(pollTimer.current)

    try {
      const res = await visualizationApi.create({
        project_id: projectId,
        chart_type: chartType,
        series: payloadSeries,
      })
      pollVisualization(res.viz_id)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to create visualization')
    } finally {
      setLoading(false)
    }
  }

  /* ================= poll ================= */
  const pollVisualization = async (vizId) => {
    try {
      const detail = await visualizationApi.detail(vizId)
      setActiveViz(detail)
      setPlotHtml(detail.html || '')
      setStatusMessage(detail.message || detail.status)

      if (!['SUCCESS', 'FAILURE'].includes(detail.status)) {
        pollTimer.current = setTimeout(() => pollVisualization(vizId), 1500)
      } else {
        fetchVisualizations()
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to poll visualization')
    }
  }

  /* ================= load saved viz ================= */
  const loadVisualization = async (vizId) => {
    try {
      const detail = await visualizationApi.detail(vizId)
      setActiveViz(detail)
      setPlotHtml(detail.html || '')
      setStatusMessage(detail.message || detail.status)
      setTilePreview(null)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load visualization')
    }
  }

  const deleteVisualization = async (vizId) => {
    if (!window.confirm('Delete this visualization?')) return
    try {
      await visualizationApi.remove(vizId)
      setVisualizations((prev) => prev.filter((v) => v.viz_id !== vizId))
      if (activeViz?.viz_id === vizId) {
        setActiveViz(null)
        setPlotHtml('')
        setTilePreview(null)
        setStatusMessage('Select data to begin')
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to delete visualization')
    }
  }

  /* ================= tiles ================= */
  const loadTileData = useCallback(
    async (seriesIndex, level) => {
      if (!activeViz?.viz_id) return
      const data = await visualizationApi.tileData(activeViz.viz_id, {
        series: seriesIndex,
        level,
      })
      setTilePreview(data)
    },
    [activeViz?.viz_id]
  )

  /* ================= plot meta summary ================= */
  const plotMeta = useMemo(() => {
    const on = enabledSeries.filter((s) => s.jobId && s.xAxis && s.yAxis)
    if (!on.length) return null
    return {
      chartType,
      count: on.length,
      items: on.map((s) => ({
        label: (s.label || '').trim() || buildAutoLabel(s),
        x: s.xAxis,
        y: s.yAxis,
      })),
    }
  }, [enabledSeries, chartType])

  /* ========================================================= */

  return (
    <div className="project-card" style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16 }}>
      {/* ================= LEFT PANEL ================= */}
      <div className="project-card" style={{ padding: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <p className="summary-label" style={{ margin: 0 }}>Data Visualisation</p>
          <h2 style={{ margin: '4px 0 0 0' }}>{project?.project_name || 'Project'} – Plot Builder</h2>
        </div>

        {error && (
          <div className="project-shell__error" style={{ marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* 2-column inside left: series manager + editor */}
        <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12 }}>
          {/* ===== Series Manager ===== */}
          <div className="project-card" style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>Series</div>
                <div className="summary-label" style={{ marginTop: 2 }}>
                  {seriesList.length} total
                </div>
              </div>

              <button
                type="button"
                className="project-shell__nav-link"
                style={{ padding: '6px 10px' }}
                onClick={addSeriesSlot}
                title="Add a new series slot"
              >
                + Add
              </button>
            </div>

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seriesList.map((s, idx) => {
                const isActive = s.id === activeSeriesId
                return (
                  <div
                    key={s.id}
                    className="project-card"
                    style={{
                      padding: 8,
                      border: isActive ? '2px solid #1d4ed8' : '1px solid #e5e7eb',
                      background: isActive ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                    }}
                    onClick={() => setActiveSeriesId(s.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Series {idx + 1}</div>

                      {/* Toggle ON/OFF */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!s.enabled}
                          onChange={(e) => setSeriesEnabled(s.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="summary-label" style={{ margin: 0 }}>
                          {s.enabled ? 'ON' : 'OFF'}
                        </span>
                      </label>
                    </div>

                    <div className="summary-label" style={{ marginTop: 6, lineHeight: 1.2 }}>
                      {seriesSummary(s)}
                    </div>

                    {/* Remove (optional) */}
                    {seriesList.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm('Remove this series slot?')) removeSeriesSlot(s.id)
                        }}
                        style={{
                          marginTop: 8,
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: '1px solid #fecdd3',
                          background: '#fff1f2',
                          color: '#b91c1c',
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="summary-label" style={{ marginTop: 10 }}>
              Tip: You can also toggle traces in the Plotly legend.
            </div>
          </div>

          {/* ===== Single Editor ===== */}
          <form onSubmit={handleSubmit} className="viz-form" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800 }}>Edit selected series</div>
                <div className="summary-label" style={{ marginTop: 2 }}>
                  Dataset → Tag → File → X → Y
                </div>
              </div>
              <div className="summary-label" style={{ margin: 0 }}>
                {activeSeries?.enabled ? 'Enabled ✅' : 'Disabled ⛔'}
              </div>
            </div>

            <div className="viz-grid" style={{ marginTop: 10 }}>
              <div>
                <label className="summary-label">Dataset Type</label>
                <select
                  className="input-control"
                  value={activeSeries?.datasetType || 'wind'}
                  onChange={(e) => {
                    // keep values, but dataset change invalidates dependent fields
                    updateActiveSeries({
                      datasetType: e.target.value,
                      tag: '',
                      jobId: '',
                      xAxis: '',
                      yAxis: '',
                    })
                  }}
                >
                  {DATASET_TYPES.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="summary-label">Tag</label>
                <select
                  className="input-control"
                  value={activeSeries?.tag || ''}
                  onChange={(e) => {
                    updateActiveSeries({
                      tag: e.target.value,
                      jobId: '',
                      xAxis: '',
                      yAxis: '',
                    })
                  }}
                >
                  <option value="">Select tag</option>
                  {getTags(activeSeries?.datasetType).map((t) => (
                    <option key={t.tag_name} value={t.tag_name}>
                      {t.tag_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="summary-label">File (processed)</label>
                <select
                  className="input-control"
                  value={activeSeries?.jobId || ''}
                  onChange={(e) => {
                    updateActiveSeries({
                      jobId: e.target.value,
                      xAxis: '',
                      yAxis: '',
                    })
                  }}
                  disabled={!activeSeries?.tag}
                >
                  <option value="">{activeSeries?.tag ? 'Select file' : 'Select tag first'}</option>
                  {activeFiles.map((f) => (
                    <option key={f.job_id} value={f.job_id}>
                      {f.filename}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="summary-label">X Column</label>
                <select
                  className="input-control"
                  value={activeSeries?.xAxis || ''}
                  onChange={(e) => updateActiveSeries({ xAxis: e.target.value })}
                  disabled={!activeSeries?.jobId}
                >
                  <option value="">{activeSeries?.jobId ? 'Select X' : 'Select file first'}</option>
                  {activeColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="summary-label">Y Column</label>
                <select
                  className="input-control"
                  value={activeSeries?.yAxis || ''}
                  onChange={(e) => updateActiveSeries({ yAxis: e.target.value })}
                  disabled={!activeSeries?.jobId}
                >
                  <option value="">{activeSeries?.jobId ? 'Select Y' : 'Select file first'}</option>
                  {activeColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="summary-label">Legend label (optional)</label>
              <input
                className="input-control"
                placeholder="Defaults to Dataset | X → Y"
                value={activeSeries?.label || ''}
                onChange={(e) => updateActiveSeries({ label: e.target.value })}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="summary-label">Chart type</label>
              <div className="tablist">
                {CHART_TYPES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={chartType === c.value ? 'active' : ''}
                    onClick={() => setChartType(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="project-shell__nav-link" style={{ width: '100%', marginTop: 12 }} disabled={loading}>
              {loading ? 'Generating…' : `Generate Plot (${enabledSeries.filter(s => s.enabled).length} series enabled)`}
            </button>
          </form>
        </div>
      </div>

      {/* ================= RIGHT PANEL ================= */}
      <div className="project-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="actions-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="summary-label" style={{ margin: 0 }}>Render preview</p>
            <h3 style={{ margin: '2px 0 0 0' }}>{activeViz?.filename || 'dataset'}</h3>
            <p className="summary-label" style={{ margin: 0 }}>{statusMessage}</p>

            {/* Plot meta */}
            {plotMeta && (
              <div className="summary-label" style={{ marginTop: 6 }}>
                <div><b>Chart:</b> {plotMeta.chartType}</div>
                <div><b>Series:</b> {plotMeta.count}</div>
                <div style={{ marginTop: 4 }}>
                  {plotMeta.items.map((it, i) => (
                    <div key={`${it.label}-${i}`}>
                      • {it.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {activeViz?.status && (
            <span className="badge" style={{ textTransform: 'capitalize' }}>
              {activeViz.status.toLowerCase()}
            </span>
          )}
        </div>

        <div className="viz-preview" style={{ height: 440 }}>
          {plotHtml ? (
            <iframe title="plot" srcDoc={plotHtml} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <div className="empty-state">Generate or open a visualization to preview it here.</div>
          )}
        </div>

        {/* ===== Tiles ===== */}
        {activeViz?.tiles?.length > 0 && (
          <div className="project-card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Materialized tiles</div>
            {activeViz.tiles.map((item, idx) => (
              <div key={idx} style={{ marginTop: 10 }}>
                <p className="summary-label" style={{ margin: 0 }}>
                  Series {idx + 1}: {item?.series?.label || item?.series?.y_axis}
                </p>
                <div className="viz-scroll">
                  {item.tiles.map((tile) => (
                    <LazyTileCard
                      key={tile.level}
                      tile={tile}
                      seriesIndex={idx}
                      onLoadTile={loadTileData}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* ===== Tile preview ===== */}
            {tilePreview && (
              <div style={{ marginTop: 12 }}>
                <p className="summary-label" style={{ margin: 0 }}>
                  Tile level {tilePreview.level} ({tilePreview.rows} rows)
                </p>
                <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 6 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {Object.keys(tilePreview.data?.[0] || {}).map((k) => (
                          <th key={k}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(tilePreview.data || []).slice(0, 12).map((row, i) => (
                        <tr key={i}>
                          {Object.keys(tilePreview.data?.[0] || {}).map((k) => (
                            <td key={`${i}-${k}`}>{row[k]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Saved visualizations ===== */}
        <div className="project-card" style={{ padding: 12 }}>
          <div className="actions-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800 }}>Saved plots</div>
              <div className="summary-label">Latest visualizations ({visualizations.length})</div>
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
                  <p className="data-card__name" style={{ margin: 0 }}>{viz.filename || 'dataset'}</p>
                  <p className="summary-label" style={{ margin: '2px 0 0 0' }}>
                    {viz.chart_type} · {viz.status}
                  </p>
                </div>
                <div className="viz-actions">
                  <button className="project-shell__nav-link" type="button" onClick={() => loadVisualization(viz.viz_id)}>
                    View
                  </button>
                  {viz.html_url && (
                    <button className="project-shell__nav-link" type="button" onClick={() => window.open(viz.html_url, '_blank')}>
                      Download
                    </button>
                  )}
                  <button
                    className="project-shell__nav-link"
                    type="button"
                    onClick={() => deleteVisualization(viz.viz_id)}
                    style={{ background: '#fff1f2', color: '#b91c1c', borderColor: '#fecdd3' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
