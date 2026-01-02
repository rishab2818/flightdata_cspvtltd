import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'
import { LazyTileCard } from '../../../components/viz/LazyTileCard'
import './ProjectVisualisation.css'

import ChartLine1 from '../../../assets/ChartLine1.svg'
import DownloadSimple from '../../../assets/DownloadSimple.svg'
import Delete from '../../../assets/Delete.svg'
import ViewIcon from '../../../assets/ViewIcon.svg'

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
  const [tagsByDataset, setTagsByDataset] = useState({})
  const [filesByDatasetTag, setFilesByDatasetTag] = useState({})

  /* ================= visualization state ================= */
  const [visualizations, setVisualizations] = useState([])
  const [activeViz, setActiveViz] = useState(null)
  const [plotHtml, setPlotHtml] = useState('')
  const [tilePreview, setTilePreview] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Select data to begin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const pollTimer = useRef(null)
  const [isExpanded, setIsExpanded] = useState(true)

  /* ================= helpers ================= */
  const activeSeries = useMemo(
    () => seriesList.find((s) => s.id === activeSeriesId) || seriesList[0],
    [seriesList, activeSeriesId]
  )

  // keep activeSeriesId always valid
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
      s.datasetType = activeSeries?.datasetType || 'wind'
      return [...prev, s]
    })

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
    const remaining = seriesList.filter((s) => s.id !== id)
    setSeriesList(remaining)
    if (activeSeriesId === id) {
      setActiveSeriesId(remaining[0]?.id)
    }
  }

  const seriesSummary = (s) => {
    const ds = datasetLabel(s.datasetType)
    const x = s.xAxis || '-'
    const y = s.yAxis || '-'
    const f = s.jobId ? 'file✅' : 'file❌'
    return `${ds} • ${f} • ${x} → ${y}`
  }

  const getTags = (datasetType) => tagsByDataset[datasetType] || []
  const getFiles = (datasetType, tag) => filesByDatasetTag[`${datasetType}::${tag}`] || []

  /* ================= load tags for datasetType (per active series) ================= */
  useEffect(() => {
    const ds = activeSeries?.datasetType
    if (!ds) return
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
        const processed = (list || []).filter((f) => f.processed_key && f.columns?.length)
        setFilesByDatasetTag((prev) => ({ ...prev, [key]: processed }))
      })
      .catch((e) => {
        console.error(e)
        setError(e?.response?.data?.detail || e.message || 'Failed to load files')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activeSeries?.datasetType, activeSeries?.tag])

  /* ================= saved visualizations ================= */
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
  const enabledSeries = useMemo(() => seriesList.filter((s) => s.enabled), [seriesList])

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
      const data = await visualizationApi.tileData(activeViz.viz_id, { series: seriesIndex, level })
      setTilePreview(data)
    },
    [activeViz?.viz_id]
  )

  /* ================= plot meta ================= */
  const plotMeta = useMemo(() => {
    const on = enabledSeries.filter((s) => s.jobId && s.xAxis && s.yAxis)
    if (!on.length) return null
    return {
      chartType,
      count: on.length,
      items: on.map((s) => ({
        label: (s.label || '').trim() || buildAutoLabel(s),
      })),
    }
  }, [enabledSeries, chartType])

  /* ================= UI ================= */
  return (
    <div className="CardWapper">
      {/* ================= TOP: SETTINGS (old UI classes) ================= */}
      <form onSubmit={handleSubmit} className="plot-settings">
        <div className="tableHeader">Plot Setting</div>

        {error && (
          <div className="project-shell__error" style={{ marginBottom: 10 }}>
            {error}
          </div>
        )}

        
        {/* ===== Editor (aligned with old UI grid) ===== */}
        <div className="ps-row">
          <div className="ps-field">
            <label>Dataset</label>
            <select
              value={activeSeries?.datasetType || 'wind'}
              onChange={(e) =>
                updateActiveSeries({
                  datasetType: e.target.value,
                  tag: '',
                  jobId: '',
                  xAxis: '',
                  yAxis: '',
                })
              }
            >
              {DATASET_TYPES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ps-field">
            <label>Tag</label>
            <select
              value={activeSeries?.tag || ''}
              onChange={(e) =>
                updateActiveSeries({
                  tag: e.target.value,
                  jobId: '',
                  xAxis: '',
                  yAxis: '',
                })
              }
            >
              <option value="">Select</option>
              {getTags(activeSeries?.datasetType).map((t) => (
                <option key={t.tag_name} value={t.tag_name}>
                  {t.tag_name}
                </option>
              ))}
            </select>
          </div>

          <div className="ps-field">
            <label>File</label>
            <select
              value={activeSeries?.jobId || ''}
              onChange={(e) =>
                updateActiveSeries({
                  jobId: e.target.value,
                  xAxis: '',
                  yAxis: '',
                })
              }
              disabled={!activeSeries?.tag}
            >
              <option style={{background:'#f3f3f5'}} value="">{activeSeries?.tag ? 'Select' : 'Select tag first'}</option>
              {activeFiles.map((f) => (
                <option key={f.job_id} value={f.job_id}>
                  {f.filename}
                </option>
              ))}
            </select>
          </div>

          <div className="ps-field">
            <label>Chart Type</label>
            <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
              {CHART_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ps-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <div className="ps-field">
            <label>X Axis</label>
            <select
              value={activeSeries?.xAxis || ''}
              onChange={(e) => updateActiveSeries({ xAxis: e.target.value })}
              disabled={!activeSeries?.jobId}
            >
              <option value="">{activeSeries?.jobId ? 'Select' : 'Select file first'}</option>
              {activeColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>


        {/* ===== Y Axis (old CSS row style) ===== */}
          <div className="ps-field">
          <label className="viz-label">Y Axis</label>

         
            <select
              className="viz-select"
              value={activeSeries?.yAxis || ''}
              onChange={(e) => updateActiveSeries({ yAxis: e.target.value })}
              disabled={!activeSeries?.jobId}
              style={{ flex: 1 }}
            >
              <option value="">{activeSeries?.jobId ? 'Select' : 'Select file first'}</option>
              {activeColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
            </div>

            
          <div className="ps-field" >
            <label className="viz-label">Plot Name(Optional)</label>
            <input
              placeholder="Defaults to Dataset | X → Y"
              value={activeSeries?.label || ''}
              onChange={(e) => updateActiveSeries({ label: e.target.value })}
            />
          </div>
      
          <div className="ps-field" >
            {/* Generate button (old UI position) */}
            <button type="submit" className="plot-btn" disabled={loading}>
              <img src={ChartLine1} alt="chart" />
              {loading ? 'Generating…' : `Generate Plot`}
            </button>
            </div>
         
          </div>

          {/* ===== Series Manager (KEPT) ===== */}
        <div className="ps-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <div className="ps-field" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <label style={{ marginBottom: 0 }}>Series ({seriesList.length})</label>

              <button
                type="button"
                className="project-shell__nav-link"
                onClick={addSeriesSlot}
                style={{ height: 36, padding: '0 12px' }}
              >
                + Add series
              </button>
            </div>

            {/* series chips list */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
              {seriesList.map((s, idx) => {
                const active = s.id === activeSeriesId
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveSeriesId(s.id)}
                    style={{
                      border: active ? '2px solid #1976D2' : '1px solid #d1d5db',
                      background: active ? '#eef6ff' : '#fff',
                      borderRadius: 6,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      minWidth: 220,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>Series {idx + 1}</div>

                      <label className="toggle" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={!!s.enabled}
                          onChange={(e) => setSeriesEnabled(s.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="slider" />
                        <span className="toggle-text">{s.enabled ? 'ON' : 'OFF'}</span>
                      </label>
                    </div>

                    <div className="summarylabel2" style={{ marginTop: 8, alignItems: 'flex-start' }}>
                      {seriesSummary(s)}
                    </div>

                    {seriesList.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm('Remove this series?')) removeSeriesSlot(s.id)
                        }}
                        style={{
                          marginTop: 8,
                          height: 32,
                          width: '100%',
                          borderRadius: 4,
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
          </div>
        </div>

       
      </form>

      {/* ================= RIGHT: PREVIEW (old UI classes) ================= */}
      <div className="project-card">
        <div className="actions-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="summarylabel">{statusMessage}</p>

            {/* meta (kept) */}
            {plotMeta && (
              <div className="summarylabel2" style={{ alignItems: 'flex-start', marginTop: 10 }}>
                <div><b>Chart:</b> {plotMeta.chartType}</div>
                <div><b>Series:</b> {plotMeta.count}</div>
                <div style={{ marginTop: 6 }}>
                  {plotMeta.items.map((it, i) => (
                    <div key={i}>• {it.label}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {activeViz?.status && (
            <span className="badge">{activeViz.status.toLowerCase()}</span>
          )}
        </div>

        <div className="Plot-preview" style={{ height: 520 }}>
          {plotHtml ? (
            <iframe
              title="plot"
              srcDoc={plotHtml}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="emptystate">No plot generated</div>
          )}
        </div>

        {/* ===== Tiles (KEPT) ===== */}


        {/* {activeViz?.tiles?.length > 0 && (
          
            {activeViz.tiles.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 16 }}>
                <p className="summarylabel1">
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
            ))} */}
            <div className="projectcard1">
            {tilePreview && (
              <div style={{ marginTop: 12 }}>
                <p className="summarylabel1">
                  Tile level {tilePreview.level} ({tilePreview.rows} rows)
                </p>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  <table className="datatable">
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
        

        {/* ===== Saved Visualizations (old UI + icons + expand) ===== */}
        <div className="projectcard1">
          <div className="actionsrow actionsrow--header">
            <label className="text">Saved visualizations ({visualizations.length})</label>

            <div className="actionsrow__right">
              <button
                type="button"
                className="expand-btn"
                onClick={() => setIsExpanded((p) => !p)}
                aria-expanded={isExpanded}
              >
                <span className={`chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                {isExpanded ? 'Collapse' : 'Expand'}
              </button>

              <button type="button" className="project-shell__nav-link" onClick={fetchVisualizations}>
                Refresh
              </button>
            </div>
          </div>

          <div className={`expand-container ${isExpanded ? 'open' : ''}`}>
            <div className="expand-inner">
              {visualizations.length === 0 && <div className="emptystate">No visualizations yet</div>}

              <div className="viz-list">
                {visualizations.map((viz) => (
                  <div key={viz.viz_id} className="viz-item">
                    <div>
                      <p className="data-card__name">{viz.filename || 'dataset'}</p>
                      <p className="summarylabel2">{viz.chart_type} · {viz.status}</p>
                    </div>

                    <div className="viz-actions">
                      <button type="button" onClick={() => loadVisualization(viz.viz_id)}>
                        <img className="actionBtn" src={ViewIcon} alt="view" />
                      </button>

                      {viz.html_url && (
                        <button type="button" onClick={() => window.open(viz.html_url, '_blank')}>
                          <img className="actionBtn" src={DownloadSimple} alt="download" />
                        </button>
                      )}

                      <button type="button" className="danger" onClick={() => deleteVisualization(viz.viz_id)}>
                        <img className="actionBtn" src={Delete} alt="delete" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
