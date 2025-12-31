
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams, useLocation } from 'react-router-dom'
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

export default function ProjectVisualisation() {
  const { projectId } = useParams()
  const { project } = useOutletContext()
  const location = useLocation()

  /* ================= selection ================= */
  const [datasetType, setDatasetType] = useState('flight')
  const [tags, setTags] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [files, setFiles] = useState([])

  /* ================= plot config ================= */
  const [xJobId, setXJobId] = useState('')
  const [xAxis, setXAxis] = useState('')
  // const [series, setSeries] = useState([{ jobId: '', yAxis: '', label: ''}])
  const [chartType, setChartType] = useState('scatter')

  /* ================= visualization state ================= */
  const [visualizations, setVisualizations] = useState([])
  const [activeViz, setActiveViz] = useState(null)
  const [plotHtml, setPlotHtml] = useState('')
  const [tilePreview, setTilePreview] = useState(null)
  const [statusMessage, setStatusMessage] = useState('Select data to begin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const pollTimer = useRef(null)
  const [isExpanded, setIsExpanded] = useState(true);


  /*   =======================================================*/
  const emptyRow = { jobId: "", yAxis: "", label: "", overplot: false };

const [series, setSeries] = useState([emptyRow]);

// If series comes from API/old state, normalize once
useEffect(() => {
  setSeries(prev => prev.map(r => ({ ...emptyRow, ...r, overplot: !!r.overplot })));
}, []);


  /* ================= URL prefill (from TagDetails → Plot) ================= */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const ds = params.get('dataset')
    const tag = params.get('tag')
    const job = params.get('job')

    if (ds) setDatasetType(ds)
    if (tag) setSelectedTag(tag)
    if (job) setXJobId(job)
  }, [])

  /* ================= load tags ================= */
  useEffect(() => {
    ingestionApi
      .listTags(projectId, datasetType)
      .then(setTags)
      .catch(console.error)

    setSelectedTag('')
    setFiles([])
    setXJobId('')
    setXAxis('')
    setSeries([{ jobId: '', yAxis: '', label: '' }])
  }, [projectId, datasetType])

  /* ================= load files in tag ================= */
  useEffect(() => {
    if (!selectedTag) return

    ingestionApi
      .listFilesInTag(projectId, datasetType, selectedTag)
      .then(list => {
        const processed = list.filter(f => f.processed_key)
        setFiles(processed)
        if (processed.length === 1) {
          setXJobId(processed[0].job_id)
        }
      })
      .catch(console.error)
  }, [projectId, datasetType, selectedTag])

  /* ================= load saved visualizations ================= */
  const fetchVisualizations = async () => {
    const list = await visualizationApi.listForProject(projectId)
    setVisualizations(list)
  }

  useEffect(() => {
    fetchVisualizations()
    return () => pollTimer.current && clearTimeout(pollTimer.current)
  }, [projectId])

  /* ================= helpers ================= */
  const xJob = useMemo(() => files.find(f => f.job_id === xJobId), [files, xJobId])

  const validSeries = useMemo(
    () => series.filter(s => s.jobId && s.yAxis),
    [series]
  )

  const getColumnsForJob = (jobId) =>
    files.find(f => f.job_id === jobId)?.columns || []

  // const updateSeries = (idx, key, value) => {
  //   setSeries(prev => {
  //     const next = [...prev]
  //     next[idx] = { ...next[idx], [key]: value }
  //     return next
  //   })
  // }

  /* ================= submit ================= */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!xJobId || !xAxis || validSeries.length === 0) {
      setError('Select file, X axis and at least one Y series')
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
        x_axis: xAxis,
        chart_type: chartType,
        series: validSeries.map(s => ({
          job_id: s.jobId,
          y_axis: s.yAxis,
          label: s.label || undefined,
        })),
      })
      pollVisualization(res.viz_id)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  /* ================= poll ================= */
  const pollVisualization = async (vizId) => {
    const detail = await visualizationApi.detail(vizId)
    setActiveViz(detail)
    setPlotHtml(detail.html || '')
    setStatusMessage(detail.message || detail.status)

    if (!['SUCCESS', 'FAILURE'].includes(detail.status)) {
      pollTimer.current = setTimeout(() => pollVisualization(vizId), 1500)
    } else {
      fetchVisualizations()
    }
  }

  /* ================= load saved viz ================= */
  const loadVisualization = async (vizId) => {
    const detail = await visualizationApi.detail(vizId)
    setActiveViz(detail)
    setPlotHtml(detail.html || '')
    setStatusMessage(detail.message || detail.status)
    setTilePreview(null)
  }

  const deleteVisualization = async (vizId) => {
    if (!window.confirm('Delete this visualization?')) return
    await visualizationApi.remove(vizId)
    setVisualizations(prev => prev.filter(v => v.viz_id !== vizId))
    if (activeViz?.viz_id === vizId) {
      setActiveViz(null)
      setPlotHtml('')
    }
  }

  /* ================= tiles ================= */
  const loadTileData = useCallback(async (seriesIndex, level) => {
    const data = await visualizationApi.tileData(activeViz.viz_id, {
      series: seriesIndex,
      level,
    })
    setTilePreview(data)
  }, [activeViz])

  /* ========================================================= */

  const updateSeries = (index, key, value) => {
  setSeries(prev => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
};

const handleToggle = (index) => {
  setSeries(prev => {
    const updated = [...prev];
    const isOn = !!updated[index].overplot;

    if (!isOn) {
      // ON → add new row right after
      updated[index] = { ...updated[index], overplot: true };
      updated.splice(index + 1, 0, { ...emptyRow });
      return updated;
    }

    // OFF → keep only up to this row, and switch it off
    updated[index] = { ...updated[index], overplot: false };
    return updated.slice(0, index + 1);
  });
};


  return (
    <div className="CardWapper" >
     
      {/* ================= LEFT PANEL =================
      <form onSubmit={handleSubmit} className="viz-form">
        <h2>{project?.project_name} – Visualization</h2>
        {error && <div className="project-shell__error">{error}</div>}

        <label className="summary-label">Dataset Type</label>
        <select className="input-control" value={datasetType} onChange={e => setDatasetType(e.target.value)}>
          {DATASET_TYPES.map(d => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>

        <label className="summary-label">Tag</label>
        <select className="input-control" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
          <option value="">Select tag</option>
          {tags.map(t => (
            <option key={t.tag_name} value={t.tag_name}>{t.tag_name}</option>
          ))}
        </select>

        <label className="summary-label">File (processed)</label>
        <select className="input-control" value={xJobId} onChange={e => setXJobId(e.target.value)}>
          <option value="">Select file</option>
          {files.map(f => (
            <option key={f.job_id} value={f.job_id}>{f.filename}</option>
          ))}
        </select>

        <label className="summary-label">X Axis</label>
        <select className="input-control" value={xAxis} onChange={e => setXAxis(e.target.value)}>
          <option value="">Select column</option>
          {(xJob?.columns || []).map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>

        <h4>Y Series</h4>
        {series.map((s, i) => (
          <div key={i} className="viz-grid">
            <select
              className="input-control"
              value={s.jobId}
              onChange={e => updateSeries(i, 'jobId', e.target.value)}
            >
              <option value="">File</option>
              {files.map(f => (
                <option key={f.job_id} value={f.job_id}>{f.filename}</option>
              ))}
            </select>

            <select
              className="input-control"
              value={s.yAxis}
              onChange={e => updateSeries(i, 'yAxis', e.target.value)}
            >
              <option value="">Y column</option>
              {getColumnsForJob(s.jobId).map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>

            <input
              className="input-control"
              placeholder="Legend (optional)"
              value={s.label}
              onChange={e => updateSeries(i, 'label', e.target.value)}
            />
          </div>
        ))}

        <button type="button" onClick={() => setSeries([...series, { jobId: '', yAxis: '', label: '' }])}>
          + Overplot
        </button>

        <div className="tablist">
          {CHART_TYPES.map(c => (
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

        <button type="submit" disabled={loading}>
          {loading ? 'Generating…' : 'Generate Plot'}
        </button>
      </form> */}
      <form onSubmit={handleSubmit} className="plot-settings">
         <div className="tableHeader">
                <label>Plot Setting</label>
      </div>

       <div className="ps-row">
      <div className="ps-field">
      <label>Data Type</label>
      <select value={datasetType} onChange={e => setDatasetType(e.target.value)}>
        {DATASET_TYPES.map(d => (
          <option key={d.key} value={d.key}>{d.label}</option>
        ))}
      </select>
    </div>


      {/* <label>Select File</label>
      <select value={xJobId} onChange={e => setXJobId(e.target.value)}>
        <option value="">Select</option>
        {files.map(f => (
          <option key={f.job_id} value={f.job_id}>{f.filename}</option>
        ))}
      </select> */}

       <div className="ps-field">
            <label >Tag</label>
        <select  value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
          <option value="">Select tag</option>
          {tags.map(t => (
            <option key={t.tag_name} value={t.tag_name}>{t.tag_name}</option>
          ))}
        </select>
        </div>
 

    <div className="ps-field">
    <label>File (processed)</label>
        <select value={xJobId} onChange={e => setXJobId(e.target.value)}>
          <option value="">Select file</option>
          {files.map(f => (
            <option key={f.job_id} value={f.job_id}>{f.filename}</option>
          ))}
        </select>
           </div>

    {/* <div className="ps-field">
      <label>Chart Type</label>
      <select value={chartType} onChange={e => setChartType(e.target.value)}>
        {CHART_TYPES.map(c => (
          <option key={c.value} value={c.value}>{c.label} Chart</option>
        ))}
      </select>
    </div> */}

    {/* <div className="ps-field">
      <label>Plot Type</label>
      <select >
        <option>2D</option>
        <option>3D</option>
      </select>
    </div> */}

    <div className="ps-field">
      <label>Chart Type</label>
      <select value={chartType} onChange={e => setChartType(e.target.value)}>
        {CHART_TYPES.map(c => (
          <option key={c.value} value={c.value}>{c.label} Chart</option>
        ))}
      </select>
    </div>
  </div>

  

      {/* <div className="ps-field">

     <h4>Y Series</h4>
        {series.map((s, i) => (
          <div key={i} className="viz-grid">
            <select
              // className="input-control"
              value={s.jobId}
              onChange={e => updateSeries(i, 'jobId', e.target.value)}
            >
              <option value="">File</option>
              {files.map(f => (
                <option key={f.job_id} value={f.job_id}>{f.filename}</option>
              ))}
            </select>

            <select
              // className="input-control"
              value={s.yAxis}
              onChange={e => updateSeries(i, 'yAxis', e.target.value)}
            >
              <option value="">Y column</option>
              {getColumnsForJob(s.jobId).map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            </div> */}

{/* //     <div className="ps-field">
//   <label>Y Axis</label>
//   <select */}
{/* //     value={series[0]?.yAxis || ''}
//     onChange={e => updateSeries(0, 'yAxis', e.target.value)}
//   >
//     <option value="">Select</option>
//     {getColumnsForJob(series[0]?.jobId || xJobId).map(col => ( */}
{/* //       <option key={col} value={col}>{col}</option>
//     ))}
//   </select>
// </div> */}

{/* 
    <div className="ps-field">
      <label>Y Axis</label>
      <select
        value={series[0]?.yAxis || ''}
        onChange={e => updateSeries(0, 'yAxis', e.target.value)}
      >
        <option value="">Select</option>
        {getColumnsForJob(series[0]?.jobId || xJobId).map(col => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>
    </div> */}

    {/* <div className="ps-field">
      <label>Z Axis</label>
      <select>
        <option>Not applicable</option>
      </select>
    </div> */}
    <div className="ps-row">

       <div className="ps-field">
      <label>X Axis</label>
      <select value={xAxis} onChange={e => setXAxis(e.target.value)}>
        <option value="">Select</option>
        {(xJob?.columns || []).map(col => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>
    </div>

    {/* <div className="yseries-wrapper">
      <label className="viz-label">Y Series</label>
{series.map((s, i) => (
  <div key={i} className="yseries-row">
    <select
      className="viz-select"
      value={s.jobId}
      onChange={e => updateSeries(i, "jobId", e.target.value)}
    >
      <option value="">File</option>
      {files.map(f => (
        <option key={f.job_id} value={f.job_id}>{f.filename}</option>
      ))}
    </select>

    <select
      className="viz-select"
      value={s.yAxis}
      onChange={e => updateSeries(i, "yAxis", e.target.value)}
    >
      <option value="">Y column</option>
      {getColumnsForJob(s.jobId).map(col => (
        <option key={col} value={col}>{col}</option>
      ))}
    </select>

    <label className="toggle">
      <input
      className="viz-select"
        type="checkbox"
        checked={!!s.overplot}
        onChange={() => handleToggle(i)}
      />
      <span className="slider" />
      <span className="toggle-text">Over Plot</span>
    </label>
  </div>
))}
</div> */}

<div className="yseries-wrapper">
  <label className="viz-label">Y Axis</label>

  {series.map((s, i) => (
    <div key={i} className="yseries-row">
      <select
        className="viz-select"
        value={s.jobId}
        onChange={e => updateSeries(i, "jobId", e.target.value)}
      >
        <option value="">File</option>
        {files.map(f => (
          <option key={f.job_id} value={f.job_id}>
            {f.filename}
          </option>
        ))}
      </select>

      <select
        className="viz-select"
        value={s.yAxis}
        onChange={e => updateSeries(i, "yAxis", e.target.value)}
      >
        <option value="">Y column</option>
        {getColumnsForJob(s.jobId).map(col => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>

       {/* ✅ Generate Plot button in same row */}
      {i === 0 && (
        <button
          type="submit"
          className="plot-btn"
          disabled={loading}
        >
          <img src={ChartLine1} alt="chart"/>
          {loading ? 'Generating…' : 'Generate Plot'}
        </button>
      )}

      <label className="toggle">
        <input
          type="checkbox"
          checked={!!s.overplot}
          onChange={() => handleToggle(i)}
        />
        <span className="slider" />
        <span className="toggle-text">Over Plot</span>
      </label>

     
    </div>
  ))}
</div>


{/* <div className="yseries-wrapper">
  <label className="viz-label">Y Axis</label>

  {series.map((s, i) => (
    <div key={i} className="yseries-row">
      <select
        className="viz-select"
        value={s.jobId}
        onChange={e => updateSeries(i, "jobId", e.target.value)}
      >
        <option value="">File</option>
        {files.map(f => (
          <option key={f.job_id} value={f.job_id}>
            {f.filename}
          </option>
        ))}
      </select>

      <select
        className="viz-select"
        value={s.yAxis}
        onChange={e => updateSeries(i, "yAxis", e.target.value)}
      >
        <option value="">Y column</option>
        {getColumnsForJob(s.jobId).map(col => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>

      <label className="toggle">
        <input
          type="checkbox"
          checked={!!s.overplot}
          onChange={() => handleToggle(i)}
        />
        <span className="slider" />
        <span className="toggle-text">Over Plot</span>
      </label>
    </div>
  ))}


<div className='PlotButton'>
<button type="submit" disabled={loading}>
          {loading ? 'Generating…' : 'Generate Plot'}
        </button>
        </div>
        </div> */}

    {/* <label className="viz-label">Y Series</label>
    {series.map((s, i) => (
  <div key={i} className="viz-grid">
    <select
      value={s.jobId}
      onChange={e => updateSeries(i, 'jobId', e.target.value)}
    >
      <option value="">File</option>
      {files.map(f => (
        <option key={f.job_id} value={f.job_id}>{f.filename}</option>
      ))}
    </select>

    <select
      value={s.yAxis}
      onChange={e => updateSeries(i, 'yAxis', e.target.value)}
    >
      <option value="">Y column</option>
      {getColumnsForJob(s.jobId).map(col => (
        <option key={col} value={col}>{col}</option>
      ))}
    </select> */}

    {/* <input
  className="inputcontrol"
  placeholder="Legend (optional)"
  value={series[0]?.label || ''}
  onChange={e => updateSeries(0, 'label', e.target.value)}
/>   */}



  {/* <button
  type="button"
  className="overplot-btn"
  onClick={() => setSeries([...series, { jobId: '', yAxis: '', label: '' }])}
>
  + Overplot
</button> */}



        {/* <div className="tablist">
          {CHART_TYPES.map(c => (
            <button
              key={c.value}
              type="button"
              className={chartType === c.value ? 'active' : ''}
              onClick={() => setChartType(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div> */}

        


    {/* <div className="ps-actions">
      <button type="submit" className="btn-primary">
        📈 Plot
      </button>

      <label className="toggle">
        <input
          type="checkbox"
          checked={series.length > 1}
          onChange={(e) =>
            e.target.checked
              ? setSeries([...series, { jobId: xJobId, yAxis: '', label: '' }])
              : setSeries(series.slice(0, 1))
          }
        />
        <span className="slider" />
        <span>Over Plot</span> */}
       {/* </label>
    </div> */}
  </div>
</form>


      
      <div className="project-card">
        <div className="actions-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <p className="summarylabel">{statusMessage}</p>
          </div>
          {activeViz?.status && (
            <span className="badge">{activeViz.status.toLowerCase()}</span>
          )}
        </div>

        <div className="Plot-preview" style={{ height: 520 }}>
          {plotHtml ? (
            <iframe title="plot" srcDoc={plotHtml} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <div className="emptystate">No plot generated</div>
          )}
        </div>

        {/* ===== Tiles ===== */}
        {/* {activeViz?.tiles?.length > 0 && (
          <div className="project-card" style={{ marginTop: 12 }}>
            {activeViz.tiles.map((item, idx) => (
              <div key={idx}>
                <p className="summarylabel">
                  Series {idx + 1}: {item.series.label || item.series.y_axis}
                </p>
                <div className="viz-scroll">
                  {item.tiles.map(tile => (
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
          </div>
        )} */}

        {/* ===== Tile preview ===== */}
        {tilePreview && (
          <div style={{ marginTop: 12 }}>
            <p className="summarylabel1">
              Tile level {tilePreview.level} ({tilePreview.rows} rows)
            </p>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              <table className="datatable">
                <thead>
                  <tr>
                    {Object.keys(tilePreview.data[0] || {}).map(k => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tilePreview.data.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Saved visualizations ===== */}
        {/* <div className="project-card" >
          <div className="actionsrow" style={{ justifyContent: 'space-between' }}>
            <label className="text">Saved visualizations ({visualizations.length})</label>
            <button className="project-shell__nav-link" onClick={fetchVisualizations}>
              Refresh
            </button>
          </div> */}

<div className="project-card">
  <div className="actionsrow actionsrow--header">
    <label className="text">
      Saved visualizations ({visualizations.length})
    </label>

    <div className="actionsrow__right">
      <button
        className="expand-btn"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
      >
        <span className={`chevron ${isExpanded ? 'open' : ''}`}>▾</span>
        {isExpanded ? 'Collapse' : 'Expand'}
      </button>

      <button
        className="project-shell__nav-link"
        onClick={fetchVisualizations}
      >
        Refresh
      </button>
    </div>
  </div>

  {/* Expandable content */}
  <div className={`expand-container ${isExpanded ? 'open' : ''}`}>
    <div className="expand-inner">
      {visualizations.length === 0 && (
        <div className="emptystate">No visualizations yet</div>
      )}

      <div className="viz-list">
        {visualizations.map(viz => (
          <div key={viz.viz_id} className="viz-item">
            <div>
              <p className="data-card__name">
                {viz.filename || 'dataset'}
              </p>
              <p className="summarylabel2">
                {viz.chart_type} · {viz.x_axis}
              </p>
            </div>

            <div className="viz-actions">
              <button onClick={() => loadVisualization(viz.viz_id)}>
             <img className="actionBtn" src={ViewIcon} alt="view"/>
              </button>

              {viz.html_url && (
                <button onClick={() => window.open(viz.html_url, '_blank')}>
                 <img className="actionBtn" src={DownloadSimple} alt="download"/>
                </button>
              )}

              <button
                onClick={() => deleteVisualization(viz.viz_id)}
                className="danger"
              >
                <img className="actionBtn" src={Delete} alt="delete"/>
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
