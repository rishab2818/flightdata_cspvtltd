import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'

import { ingestionApi } from '../../../api/ingestionApi'
import { visualizationApi } from '../../../api/visualizationApi'
import { matApi } from '../../../mat/matApi'
import { calculationsApi } from '../../../calculations/calculationsApi'
import {
  applyFunctionSuggestion,
  getFormulaTokenPrefix,
  tokenizeFormula,
} from '../../../calculations/formulaHelpers'
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import { useInfiniteScrollTrigger } from "../../../hooks/useInfiniteScrollTrigger";

import './ProjectVisualisation.css'

import ChartLine1 from '../../../assets/ChartLine1.svg'

import Delete from '../../../assets/Delete.svg'
import ViewIcon from '../../../assets/ViewIcon.svg'
import linechart from "../../../assets/LineChart.svg";
import EmptySection from "../../../components/common/EmptyProject";
// import linechart25 from "../../assets/linechart25.svg";


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
  // Add plaor 
  { value: 'polar', label: 'Polar' },
  { value: 'histogram', label: 'Histogram' },
  { value: 'box', label: 'Box' },
  { value: 'violin', label: 'Violin' },
  { value: 'heatmap', label: 'Heatmap (X vs Y)' },
  { value: 'contour', label: 'Contour' },
  { value: 'scatterline', label: 'Scatter Line' },
  { value: 'scatter3d', label: '3D Scatter' },
  { value: 'line3d', label: '3D Line' },
  { value: 'surface', label: '3D Surface' },
]

const plotTypes2D = [
   { value: 'scatter', label: 'Scatter' },
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  // Add plaor 
  { value: 'polar', label: 'Polar' },
  { value: 'histogram', label: 'Histogram' },
  { value: 'box', label: 'Box' },
  { value: 'violin', label: 'Violin' },
  { value: 'heatmap', label: 'Heatmap (X vs Y)' },
  { value: 'contour', label: 'Contour' },
  { value: 'scatterline', label: 'Scatter Line' },
]

const plotTypes3D =[
  { value: 'scatter3d', label: '3D Scatter' },
  { value: 'line3d', label: '3D Line' },
  { value: 'surface', label: '3D Surface' },

]
const OVERPLOT_CARTESIAN_TYPES = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'line', label: 'Line' },
  { value: 'bar', label: 'Bar' },
  { value: 'scatterline', label: 'Scatter Line' },
]

const datasetLabel = (key) => DATASET_TYPES.find((d) => d.key === key)?.label || key
window.__FD_API_BASE__ = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const getExt = (name = '') => {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

const isMatFileName = (name = '') => getExt(name) === '.mat'

const toMatShapeText = (shape) => {
  if (!Array.isArray(shape) || !shape.length) return ''
  return shape.join('x')
}

const defaultMatSliceExpr = (ndim) => {
  if (!ndim || ndim <= 0) return ''
  if (ndim === 1) return ':'
  if (ndim === 2) return ':, :'
  return [':', ':', ...Array(Math.max(0, ndim - 2)).fill('1')].join(', ')
}

const newSeries = (n = 1) => ({
  id: `s-${Date.now()}-${n}`,
  enabled: true,

  datasetType: 'wind',
  tag: '',
  jobId: '',
  xAxis: '',
  yAxis: '',
  zAxis: '',
  seriesChartType: '',
  label: '',
  matVar: '',
  matXDim: 0,
  matYDim: 1,
  matFilters: {},
  derivedColumns: [],
})

export default function ProjectVisualisation() {
  useEffect(() => {
    window.__FD_API_BASE__ = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
  }, [])

  const { projectId } = useParams()
  const { project } = useOutletContext()

  const [confirmDelete, setConfirmDelete] = useState({
  open: false,
  vizId: null,
})

const [confirmRemoveSeries, setConfirmRemoveSeries] = useState({
  open: false,
  seriesId: null,
});

  const [deletingViz, setDeletingViz] = useState(null)

  /* ================= series manager ================= */
  const [seriesList, setSeriesList] = useState([newSeries(1)])
  const [activeSeriesId, setActiveSeriesId] = useState(seriesList[0]?.id)

  /* ================= global plot config ================= */
  const [chartType, setChartType] = useState('scatter')
  const [xScale, setXScale] = useState('linear')
  const [yScale, setYScale] = useState('linear')
  const [visualSectionTab, setVisualSectionTab] = useState('visualize')

  // whether the selected chart type requires a Z axis (used in render and submit)
  const requiresZ = ['contour', 'scatter3d', 'line3d', 'surface'].includes(chartType)

  /* ================= data caches ================= */
  const [tagsByDataset, setTagsByDataset] = useState({})
  const [filesByDatasetTag, setFilesByDatasetTag] = useState({})
  const [matMetaByJob, setMatMetaByJob] = useState({})
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState("success");
//   const [showLeaveWarn, setShowLeaveWarn] = useState(false);
// const [hasUnsavedCalc, setHasUnsavedCalc] = useState(false);

  /* ================= calculation tab state ================= */
  const calcFormulaInputRef = useRef(null)
  const [calcFunctions, setCalcFunctions] = useState([])
  const [calcDatasetType, setCalcDatasetType] = useState('wind')
  const [calcTag, setCalcTag] = useState('')
  const [calcJobId, setCalcJobId] = useState('')
  const [calcFormulaExpression, setCalcFormulaExpression] = useState('')
  const [calcNormalizedExpression, setCalcNormalizedExpression] = useState('')
  const [calcVariableNames, setCalcVariableNames] = useState([])
  const [calcVariableMap, setCalcVariableMap] = useState({})
  const [calcFormulaError, setCalcFormulaError] = useState('')
  const [calcFormulaCursor, setCalcFormulaCursor] = useState(0)
  const [calcOutputColumn, setCalcOutputColumn] = useState('')
  const [calcPreviewRows, setCalcPreviewRows] = useState([])
  const [calcMatVariableMap, setCalcMatVariableMap] = useState({})
  const [calcMatPreview, setCalcMatPreview] = useState(null)
  const [calcMatPreviewContext, setCalcMatPreviewContext] = useState(null)
  const [calcMatSourcePreviewLoading, setCalcMatSourcePreviewLoading] = useState(false)
  const [calcFilePreviewRows, setCalcFilePreviewRows] = useState([])
  const [calcFilePreviewLoading, setCalcFilePreviewLoading] = useState(false)
  const [calcFilePreviewError, setCalcFilePreviewError] = useState('')
  const [calcProcessing, setCalcProcessing] = useState(false)
  const [calcError, setCalcError] = useState(null)
  const [tempVizId, setTempVizId] = useState(null)


  /* ================= visualization state ================= */
  const [visualizations, setVisualizations] = useState([])
  const PAGE_SIZE = 30;

const [vizPage, setVizPage] = useState(1);
const [hasMoreViz, setHasMoreViz] = useState(true);
const [loadingViz, setLoadingViz] = useState(false);
const [loadingSave, setLoadingSave] = useState(false);

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

  const showPopup = (message, type = "success") => {
  setPopupMessage(message)
  setPopupType(type)

  // Keep popup visible for 7 seconds (change to 5000–10000 if needed)
  setTimeout(() => {
    setPopupMessage("")
  }, 7000)
}


  const [dimension, setDimension] = useState('2d')
// const [plotType, setPlotType] = useState('')

const plotOptions =
  dimension === '2d' ? plotTypes2D : plotTypes3D


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

  // const seriesSummary = (s) => {
  //   const ds = datasetLabel(s.datasetType)
  //   const x = s.xAxis || '-'
  //   const y = s.yAxis || '-'
  //   const z = s.zAxis || '-'
  //   const f = s.jobId ? 'file✅' : 'file❌'
  //   if (chartType === 'contour') return `${ds} • ${f} • ${x} → ${y} → ${z}`
  //   return `${ds} • ${f} • ${x} → ${y}`
  // }

  const seriesSummary = (s) => {
    const ds = datasetLabel(s.datasetType)
    const job = jobsById[s.jobId]
    const mat = isMatFileName(job?.filename || '')
    if (mat) {
      const varName = s.matVar || '-'
      const xDim = Number.isInteger(Number(s.matXDim)) ? `dim${s.matXDim}` : '-'
      const yDim = Number.isInteger(Number(s.matYDim)) ? `, dim${s.matYDim}` : ''
      return `${ds} • MAT • ${varName} • ${xDim}${yDim}`
    }
    const x = s.xAxis || '-'
    const y = s.yAxis || '-'
    const z = s.zAxis || '-'
    const f = s.jobId ? 'file✅' : 'file❌'
    const seriesType = (s.seriesChartType || chartType || 'scatter').toLowerCase()
    if (chartType === 'contour') return `${ds} • ${f} • ${x} → ${y} → ${z}`
    return `${ds} • ${f} • ${x} → ${y} • ${seriesType}`
  }

  const getTags = (datasetType) => tagsByDataset[datasetType] || []
  const getFiles = (datasetType, tag) => filesByDatasetTag[`${datasetType}::${tag}`] || []
  const jobsById = useMemo(() => {
    const map = {}
    Object.values(filesByDatasetTag).forEach((list) => {
      ;(list || []).forEach((job) => {
        if (job?.job_id) map[job.job_id] = job
      })
    })
    return map
  }, [filesByDatasetTag])

  const calcFunctionNames = useMemo(() => {
    const names = []
    for (const fn of calcFunctions) {
      if (fn?.name) names.push(fn.name)
      if (fn?.engine_name && fn.engine_name !== fn.name) names.push(fn.engine_name)
    }
    return names
  }, [calcFunctions])

  const calcTokenPrefix = useMemo(
    () => getFormulaTokenPrefix(calcFormulaExpression, calcFormulaCursor),
    [calcFormulaExpression, calcFormulaCursor]
  )
  const calcFormulaSuggestions = useMemo(() => {
    const token = (calcTokenPrefix?.token || '').trim().toLowerCase()
    if (!token) return []
    return calcFunctions
      .filter((fn) => fn?.name?.toLowerCase().startsWith(token))
      .slice(0, 8)
  }, [calcFunctions, calcTokenPrefix])
  const calcFormulaTokens = useMemo(
    () => tokenizeFormula(calcFormulaExpression, calcFunctionNames, calcVariableNames),
    [calcFormulaExpression, calcFunctionNames, calcVariableNames]
  )

  const calcFiles = useMemo(() => {
    if (!calcDatasetType || !calcTag) return []
    return getFiles(calcDatasetType, calcTag)
  }, [calcDatasetType, calcTag, filesByDatasetTag])
  const calcJob = useMemo(
    () => calcFiles.find((f) => f.job_id === calcJobId) || null,
    [calcFiles, calcJobId]
  )
  const calcIsMat = useMemo(
    () => isMatFileName(calcJob?.filename || ''),
    [calcJob?.filename]
  )
  const calcColumns = useMemo(() => calcJob?.columns || [], [calcJob])
  const calcMatMeta = useMemo(
    () => matMetaByJob[calcJobId] || null,
    [matMetaByJob, calcJobId]
  )
  const calcMatVars = useMemo(
    () => (calcMatMeta?.variables || []).filter((item) => item?.kind === 'numeric_array'),
    [calcMatMeta]
  )
  const calcFirstMappedMatSource = useMemo(() => {
    for (const variableName of calcVariableNames || []) {
      const source = calcMatVariableMap[variableName] || {}
      const sourceVar = String(source.variable || '').trim()
      if (!sourceVar) continue
      return {
        variable: sourceVar,
        sliceExpr: String(source.sliceExpr || '').trim(),
      }
    }
    return null
  }, [calcVariableNames, calcMatVariableMap])
  const calcDisplayPreviewRows = useMemo(
    () => (calcPreviewRows.length ? calcPreviewRows : calcFilePreviewRows),
    [calcPreviewRows, calcFilePreviewRows]
  )
  const showingCalculatedPreview = calcPreviewRows.length > 0
  const calcIsSourceMatPreview = calcMatPreviewContext?.type === 'source'

  const loadCalcMatSourcePreview = useCallback(
    async (sourceVar, sourceSliceExpr = '') => {
      const variable = String(sourceVar || '').trim()
      if (!calcIsMat || !calcJobId || !variable) return

      const sourceMeta = calcMatVars.find((item) => item?.name === variable)
      const ndim = Number(sourceMeta?.ndim || sourceMeta?.shape?.length || 0)
      const fallbackSliceExpr = defaultMatSliceExpr(ndim)
      const effectiveSliceExpr = String(sourceSliceExpr || '').trim() || fallbackSliceExpr

      try {
        setCalcError(null)
        setCalcMatSourcePreviewLoading(true)
        const data = await matApi.variableData(calcJobId, variable, {
          sliceExpr: effectiveSliceExpr || undefined,
          maxRows: 60,
          maxCols: 40,
          maxPages: 12,
        })
        setCalcPreviewRows([])
        setCalcMatPreview(data || null)
        setCalcMatPreviewContext({ type: 'source', variable })
      } catch (e) {
        setCalcMatPreview(null)
        setCalcMatPreviewContext(null)
        setCalcError(e?.response?.data?.detail || e.message || 'Failed to load MAT variable preview')
      } finally {
        setCalcMatSourcePreviewLoading(false)
      }
    },
    [calcIsMat, calcJobId, calcMatVars]
  )

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
        const processed = (list || []).filter((f) => {
          if (isMatFileName(f?.filename || '')) return true
          return !!(f.processed_key && f.columns?.length)
        })
        setFilesByDatasetTag((prev) => ({ ...prev, [key]: processed }))
      })
      .catch((e) => {
        console.error(e)
        setError(e?.response?.data?.detail || e.message || 'Failed to load files')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, activeSeries?.datasetType, activeSeries?.tag])

  useEffect(() => {
    calculationsApi
      .functions()
      .then((data) => {
        setCalcFunctions(data?.functions || [])
      })
      .catch((e) => {
        setCalcError(e?.response?.data?.detail || e.message || 'Failed to load formula functions')
      })
  }, [])

  useEffect(() => {
    if (!calcDatasetType) return
    if (tagsByDataset[calcDatasetType]) return
    ingestionApi
      .listTags(projectId, calcDatasetType)
      .then((rows) => {
        setTagsByDataset((prev) => ({ ...prev, [calcDatasetType]: rows || [] }))
      })
      .catch((e) => {
        setCalcError(e?.response?.data?.detail || e.message || 'Failed to load tags')
      })
  }, [projectId, calcDatasetType, tagsByDataset])

  useEffect(() => {
    if (!calcDatasetType || !calcTag) return
    const key = `${calcDatasetType}::${calcTag}`
    if (filesByDatasetTag[key]) return
    ingestionApi
      .listFilesInTag(projectId, calcDatasetType, calcTag)
      .then((list) => {
        const processed = (list || []).filter((f) => {
          if (isMatFileName(f?.filename || '')) return true
          return !!(f.processed_key && f.columns?.length)
        })
        setFilesByDatasetTag((prev) => ({ ...prev, [key]: processed }))
      })
      .catch((e) => {
        setCalcError(e?.response?.data?.detail || e.message || 'Failed to load files')
      })
  }, [projectId, calcDatasetType, calcTag, filesByDatasetTag])

  useEffect(() => {
    if (!calcJobId || !calcIsMat) return
    if (matMetaByJob[calcJobId]?.variables) return

    matApi
      .variables(calcJobId)
      .then((data) => {
        setMatMetaByJob((prev) => ({ ...prev, [calcJobId]: data }))
      })
      .catch((e) => {
        setCalcError(e?.response?.data?.detail || e.message || 'Failed to load MAT variables')
      })
  }, [calcJobId, calcIsMat, matMetaByJob])

  useEffect(() => {
    const expression = (calcFormulaExpression || '').trim()
    if (!expression) {
      setCalcFormulaError('')
      setCalcNormalizedExpression('')
      setCalcVariableNames([])
      setCalcVariableMap({})
      setCalcMatVariableMap({})
      return
    }
    const timer = setTimeout(async () => {
      try {
        const data = await calculationsApi.validateFormula(calcFormulaExpression)
        const variables = data?.variables || []
        setCalcFormulaError('')
        setCalcNormalizedExpression(data?.normalized_expression || '')
        setCalcVariableNames(variables)
        setCalcVariableMap((prev) => {
          const next = {}
          for (const variableName of variables) {
            next[variableName] = prev[variableName] || ''
          }
          return next
        })
      } catch (e) {
        setCalcNormalizedExpression('')
        setCalcVariableNames([])
        setCalcVariableMap({})
        setCalcFormulaError(e?.response?.data?.detail || e.message || 'Invalid formula')
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [calcFormulaExpression])

  useEffect(() => {
    setCalcMatVariableMap((prev) => {
      const next = {}
      for (const variableName of calcVariableNames) {
        const current = prev[variableName] || {}
        next[variableName] = {
          variable: current.variable || '',
          sliceExpr: current.sliceExpr || '',
        }
      }
      return next
    })
  }, [calcVariableNames])

  useEffect(() => {
    if (!calcIsMat || !calcMatVars.length || !calcVariableNames.length) return
    const defaultVar = calcMatVars[0]?.name || ''
    if (!defaultVar) return
    setCalcMatVariableMap((prev) => {
      let changed = false
      const next = { ...prev }
      for (const variableName of calcVariableNames) {
        const current = next[variableName] || { variable: '', sliceExpr: '' }
        if (!current.variable) {
          next[variableName] = { ...current, variable: defaultVar }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [calcIsMat, calcMatVars, calcVariableNames])

  useEffect(() => {
    if (!calcIsMat || !calcJobId || !calcFirstMappedMatSource?.variable) return
    if (calcMatPreviewContext?.type === 'formula') return
    if (
      calcMatPreviewContext?.type === 'source' &&
      calcMatPreviewContext?.variable === calcFirstMappedMatSource.variable &&
      calcMatPreview
    ) {
      return
    }
    loadCalcMatSourcePreview(calcFirstMappedMatSource.variable, calcFirstMappedMatSource.sliceExpr)
  }, [
    calcIsMat,
    calcJobId,
    calcFirstMappedMatSource,
    calcMatPreviewContext,
    calcMatPreview,
    loadCalcMatSourcePreview,
  ])

  useEffect(() => {
    let cancelled = false

    if (!calcJobId) {
      setCalcFilePreviewRows([])
      setCalcFilePreviewError('')
      setCalcFilePreviewLoading(false)
      return () => {
        cancelled = true
      }
    }

    if (isMatFileName(calcJob?.filename || '')) {
      setCalcFilePreviewRows([])
      setCalcFilePreviewError('')
      setCalcFilePreviewLoading(false)
      return () => {
        cancelled = true
      }
    }

    setCalcFilePreviewLoading(true)
    setCalcFilePreviewError('')

    ingestionApi
      .getProcessedPreview(calcJobId, 20)
      .then((data) => {
        if (cancelled) return
        setCalcFilePreviewRows(data?.rows || [])
      })
      .catch((e) => {
        if (cancelled) return
        setCalcFilePreviewRows([])
        setCalcFilePreviewError(e?.response?.data?.detail || e.message || 'Failed to load file preview')
      })
      .finally(() => {
        if (!cancelled) setCalcFilePreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [calcJobId, calcJob?.filename])

  /* ================= saved visualizations ================= */
  // const fetchVisualizations = async () => {
  //   try {
  //     const list = await visualizationApi.listForProject(projectId)
  //     setVisualizations(list || [])
  //   } catch (e) {
  //     setError(e?.response?.data?.detail || e.message || 'Failed to load visualizations')
  //   }
  // }

  // useEffect(() => {
  //   fetchVisualizations()
  //   return () => pollTimer.current && clearTimeout(pollTimer.current)
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [projectId])

// const fetchVisualizations = async (page = 1, reset = false) => {
//   if (loadingViz) return;

//   setLoadingViz(true);
//   try {
//     const res = await visualizationApi.listForProject(projectId, {
//       page,
//       limit: PAGE_SIZE,
//     });

//     const list = res || [];

//     setVisualizations((prev) =>
//       reset ? list : [...prev, ...list]
//     );

//     // ✅ ONLY update hasMore when loading next page
//     if (!reset) {
//       setHasMoreViz(list.length >= PAGE_SIZE);
//     }

//     setVizPage(page);
//   } catch (e) {
//     setError(
//       e?.response?.data?.detail ||
//       e.message ||
//       'Failed to load visualizations'
//     );
//   } finally {
//     setLoadingViz(false);
//   }
// };

// const handleSaveVisualization = async () => {
//   if (!plotHtml) return; // safety check
//   setLoadingSave(true);
//   try {
//     await visualizationApi.save({
//       project_id: projectId,
//       html: plotHtml,
//       series: seriesList,
//       chart_type: chartType,
//       name: activeSeries?.label || 'Plot',
//     });
//     setStatusMessage('Visualization saved successfully.');
//     fetchVisualizations(1, true); // refresh saved visualizations list
//   } catch (err) {
//     setStatusMessage('Failed to save visualization.');
//   } finally {
//     setLoadingSave(false);
//   }
// };

const handleSaveVisualization = async () => {
  try {
    setLoadingSave(true)

    await fetchVisualizations(1, true)

    setStatusMessage("Visualization saved successfully ✅")

  } catch (err) {
    console.error(err)
  } finally {
    setLoadingSave(false)
  }
}

const handleFullScreen = (viz) => {
  if (!viz?.html_url) return;

  const url = viz.html_url.startsWith("http")
    ? viz.html_url
    : `${window.__FD_API_BASE__}${viz.html_url}`;

  window.open(url, "_blank", "noopener,noreferrer");
};

const handleGeneratePlot = async () => {
  try {
    setLoading(true)

    const res = await visualizationApi.create(requestPayload)

    setTempVizId(res.viz_id)   // store temporary id
    pollVisualization(res.viz_id)

    setStatusMessage("Preview ready. Click Save Visualization.")

  } catch (err) {
    console.error(err)
    setStatusMessage("Failed to generate plot")
  } finally {
    setLoading(false)
  }
}

const fetchVisualizations = async (page = 1, reset = false) => {
  if (loadingViz) return

  setLoadingViz(true)

  try {
    const res = await visualizationApi.listForProject(projectId, {
      page,
      limit: PAGE_SIZE,
    })

    console.log("LIST API RESPONSE:", res)

    const list = Array.isArray(res)
      ? res
      : res?.items || res?.data || []

    setVisualizations(prev =>
      reset ? list : [...prev, ...list]
    )

    setHasMoreViz(list.length >= PAGE_SIZE)
    setVizPage(page)

  } catch (e) {
    setError(
      e?.response?.data?.detail ||
      e.message ||
      'Failed to load visualizations'
    )
  } finally {
    setLoadingViz(false)
  }
}

const savedVizLoadRef = useInfiniteScrollTrigger({
  enabled: isExpanded,
  hasMore: isExpanded && hasMoreViz,
  isLoading: loadingViz,
  onLoadMore: () => fetchVisualizations(vizPage + 1),
})

  /* ================= columns for active series ================= */
  const activeFiles = useMemo(() => {
    if (!activeSeries?.datasetType || !activeSeries?.tag) return []
    return getFiles(activeSeries.datasetType, activeSeries.tag)
  }, [activeSeries?.datasetType, activeSeries?.tag, filesByDatasetTag])

  const activeJob = useMemo(
    () => activeFiles.find((f) => f.job_id === activeSeries?.jobId),
    [activeFiles, activeSeries?.jobId]
  )
  const activeIsMat = useMemo(
    () => isMatFileName(activeJob?.filename || ''),
    [activeJob?.filename]
  )

  const activeColumns = useMemo(() => activeJob?.columns || [], [activeJob])
  const activeDerivedColumnNames = useMemo(() => {
    const names = []
    for (const item of activeSeries?.derivedColumns || []) {
      const name = (item?.name || '').trim()
      if (!name) continue
      if (!names.includes(name)) names.push(name)
    }
    return names
  }, [activeSeries?.derivedColumns])
  const activeAxisColumns = useMemo(() => {
    const merged = [...activeColumns]
    for (const name of activeDerivedColumnNames) {
      if (!merged.includes(name)) merged.push(name)
    }
    return merged
  }, [activeColumns, activeDerivedColumnNames])
  const activeMatMeta = useMemo(
    () => matMetaByJob[activeSeries?.jobId || ''] || null,
    [matMetaByJob, activeSeries?.jobId]
  )
  const activeMatVars = useMemo(
    () => (activeMatMeta?.variables || []).filter((v) => v?.kind === 'numeric_array'),
    [activeMatMeta]
  )
  const activeMatVar = useMemo(() => {
    if (!activeMatVars.length) return null
    return activeMatVars.find((v) => v.name === activeSeries?.matVar) || activeMatVars[0]
  }, [activeMatVars, activeSeries?.matVar])

  const matAllowedChartTypes = useMemo(
    () => new Set(['line', 'scatter', 'heatmap', 'contour', 'surface']),
    []
  )
  const activeChartOptions = useMemo(
    () =>
      activeIsMat
        ? CHART_TYPES.filter((item) => matAllowedChartTypes.has(item.value))
        : plotOptions,
    [activeIsMat, matAllowedChartTypes, plotOptions]
  )
  const canMixOverplot = useMemo(
    () => !activeIsMat && OVERPLOT_CARTESIAN_TYPES.some((item) => item.value === chartType),
    [activeIsMat, chartType]
  )
  const matNeeds2D = useMemo(
    () => ['heatmap', 'contour', 'surface'].includes(chartType),
    [chartType]
  )
  const matSelectedDims = useMemo(() => {
    const dims = []
    const x = Number(activeSeries?.matXDim)
    if (Number.isInteger(x) && x >= 0) dims.push(x)
    if (matNeeds2D) {
      const y = Number(activeSeries?.matYDim)
      if (Number.isInteger(y) && y >= 0 && y !== x) dims.push(y)
    }
    return dims
  }, [activeSeries?.matXDim, activeSeries?.matYDim, matNeeds2D])
  const matRemainingDims = useMemo(() => {
    if (!activeMatVar) return []
    const ndim = Number(activeMatVar.ndim || activeMatVar.shape?.length || 0)
    const allDims = Array.from({ length: ndim }, (_, i) => i)
    return allDims.filter((dim) => !matSelectedDims.includes(dim))
  }, [activeMatVar, matSelectedDims])

  const getMatCoordGuess = useCallback((matVar, dim) => {
    if (!matVar) return null
    const fromList = Array.isArray(matVar.coords_guess) ? matVar.coords_guess[dim] : null
    if (typeof fromList === 'string' && fromList) return fromList
    const candidates = matVar?.coord_candidates?.[String(dim)] || []
    return candidates[0] || null
  }, [])

  useEffect(() => {
    const jobId = activeSeries?.jobId
    if (!jobId || !activeIsMat) return
    if (matMetaByJob[jobId]?.variables) return

    matApi
      .variables(jobId)
      .then((data) => {
        setMatMetaByJob((prev) => ({ ...prev, [jobId]: data }))
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || e.message || 'Failed to load MAT variables')
      })
  }, [activeSeries?.jobId, activeIsMat, matMetaByJob])

  useEffect(() => {
    if (!activeIsMat || !activeMatVars.length || !activeSeriesId) return

    const chosenVar = activeMatVars.find((v) => v.name === activeSeries?.matVar) || activeMatVars[0]
    const ndim = Number(chosenVar?.ndim || chosenVar?.shape?.length || 0)
    if (ndim <= 0) return

    let nextX = Number(activeSeries?.matXDim)
    if (!Number.isInteger(nextX) || nextX < 0 || nextX >= ndim) nextX = 0

    let nextY = Number(activeSeries?.matYDim)
    if (matNeeds2D) {
      if (!Number.isInteger(nextY) || nextY < 0 || nextY >= ndim || nextY === nextX) {
        nextY = Array.from({ length: ndim }, (_, i) => i).find((i) => i !== nextX) ?? nextX
      }
    }

    const nextFilters = { ...(activeSeries?.matFilters || {}) }
    for (let dim = 0; dim < ndim; dim += 1) {
      if (dim === nextX || (matNeeds2D && dim === nextY)) {
        delete nextFilters[dim]
        continue
      }
      const maxIdx = Math.max(0, Number(chosenVar?.shape?.[dim] || 1) - 1)
      const cur = Number(nextFilters[dim] ?? 0)
      const clamped = Math.max(0, Math.min(maxIdx, Number.isFinite(cur) ? cur : 0))
      nextFilters[dim] = clamped
    }

    const needsUpdate =
      activeSeries?.matVar !== chosenVar.name ||
      Number(activeSeries?.matXDim) !== nextX ||
      (matNeeds2D ? Number(activeSeries?.matYDim) !== nextY : activeSeries?.matYDim !== '') ||
      JSON.stringify(activeSeries?.matFilters || {}) !== JSON.stringify(nextFilters)

    if (!needsUpdate) return

    updateActiveSeries({
      matVar: chosenVar.name,
      matXDim: nextX,
      matYDim: matNeeds2D ? nextY : '',
      matFilters: nextFilters,
      xAxis: '',
      yAxis: '',
      zAxis: '',
      derivedColumns: [],
    })
  }, [
    activeIsMat,
    activeMatVars,
    activeSeries?.matVar,
    activeSeries?.matXDim,
    activeSeries?.matYDim,
    activeSeries?.matFilters,
    activeSeriesId,
    matNeeds2D,
  ])

  useEffect(() => {
    if (!activeIsMat) return
    if (!matAllowedChartTypes.has(chartType)) {
      setChartType('line')
    }
  }, [activeIsMat, chartType, matAllowedChartTypes])

  useEffect(() => {
    if (activeIsMat && dimension !== '2d') {
      setDimension('2d')
    }
  }, [activeIsMat, dimension])

  useEffect(() => {
    if (canMixOverplot) return
    setSeriesList((prev) =>
      prev.map((s) => (s.seriesChartType ? { ...s, seriesChartType: '' } : s))
    )
  }, [canMixOverplot])

  /* ================= submit ================= */
  const enabledSeries = useMemo(() => seriesList.filter((s) => s.enabled), [seriesList])

  const buildAutoLabel = (s) => {
    const ds = datasetLabel(s.datasetType)
    const job = jobsById[s.jobId]
    if (isMatFileName(job?.filename || '')) {
      const varName = s.matVar || 'MAT variable'
      const dims = [s.matXDim]
      if (matNeeds2D) dims.push(s.matYDim)
      return `${ds} | ${varName} | ${dims.filter((d) => d !== '' && d != null).map((d) => `dim${d}`).join(' × ')}`
    }
    const x = s.xAxis || ''
    const y = s.yAxis || ''
    const z = s.zAxis || ''
    if (chartType === 'contour') {
      if (!x || !y || !z) return ds
      return `${ds} | ${x} → ${y} → ${z}`
    }
    if (!x || !y) return ds
    return `${ds} | ${x} → ${y}`
  }

  const normalizeDerivedColumns = (series) => {
    const cleaned = []
    for (const item of series?.derivedColumns || []) {
      const name = (item?.name || '').trim()
      const expression = (item?.expression || '').trim()
      if (!name && !expression) continue
      if (!name || !expression) {
        throw new Error('Each derived column requires both a name and an expression.')
      }
      if (cleaned.some((c) => c.name === name)) {
        throw new Error(`Duplicate derived column name '${name}' in one plot series.`)
      }
      cleaned.push({ name, expression })
    }
    return cleaned
  }

  const applyCalculationToVisualisation = (datasetType, tag, jobId, derivedColumn) => {
    let targetSeriesId = null
    setSeriesList((prev) => {
      if (!prev.length) {
        const s = newSeries(1)
        targetSeriesId = s.id
        s.datasetType = datasetType
        s.tag = tag
        s.jobId = jobId
        s.derivedColumns = [derivedColumn]
        return [s]
      }
      targetSeriesId = prev[0].id
      return prev.map((s, idx) => {
        if (idx === 0) {
          return {
            ...s,
            datasetType,
            tag,
            jobId,
            derivedColumns: [derivedColumn],
            xAxis: '',
            yAxis: '',
            zAxis: '',
          }
        }
        return { ...s, derivedColumns: [] }
      })
    })
    if (targetSeriesId) {
      setActiveSeriesId(targetSeriesId)
    }
  }

  const handleCalcVariableMapChange = (variableName, columnName) => {
    setCalcVariableMap((prev) => ({ ...prev, [variableName]: columnName }))
    setCalcPreviewRows([])
    setCalcMatPreview(null)
    setCalcMatPreviewContext(null)
  }

  const handleCalcMatVariableMapChange = (variableName, patch) => {
    let selectedVariable = ''
    let selectedSliceExpr = ''
    setCalcMatVariableMap((prev) => {
      const next = {
        ...prev,
        [variableName]: {
          ...(prev[variableName] || { variable: '', sliceExpr: '' }),
          ...patch,
        },
      }
      selectedVariable = String(next[variableName]?.variable || '').trim()
      selectedSliceExpr = String(next[variableName]?.sliceExpr || '').trim()
      return next
    })
    setCalcPreviewRows([])
    setCalcMatPreview(null)
    setCalcMatPreviewContext(null)
    if (Object.prototype.hasOwnProperty.call(patch, 'variable') && selectedVariable) {
      loadCalcMatSourcePreview(selectedVariable, selectedSliceExpr)
    }
  }

  const handleCalcFormulaChange = (value) => {
    setCalcFormulaExpression(value)
    setCalcPreviewRows([])
    setCalcMatPreview(null)
    setCalcMatPreviewContext(null)
  }

  const handleCalcFormulaCursorChange = (event) => {
    setCalcFormulaCursor(event.target.selectionStart || 0)
  }

  const handleInsertFormulaFunction = (functionName) => {
    const input = calcFormulaInputRef.current
    const cursor = input?.selectionStart ?? calcFormulaCursor
    const next = applyFunctionSuggestion(calcFormulaExpression, cursor, functionName)
    setCalcFormulaExpression(next.formula)
    setCalcFormulaCursor(next.cursor)
    setCalcPreviewRows([])
    setCalcMatPreview(null)
    setCalcMatPreviewContext(null)
    requestAnimationFrame(() => {
      if (!input) return
      input.focus()
      input.setSelectionRange(next.cursor, next.cursor)
    })
  }

  const handleCalcFormulaKeyDown = (event) => {
    if (event.key === 'Tab' || event.key === 'Enter') {
      if (!calcFormulaSuggestions.length) return
      event.preventDefault()
      handleInsertFormulaFunction(calcFormulaSuggestions[0].name)
    }
  }

  const buildCalcVariableMapPayload = () => {
    const payload = {}
    for (const variableName of calcVariableNames) {
      const mapped = (calcVariableMap[variableName] || '').trim()
      if (mapped) payload[variableName] = mapped
    }
    return payload
  }

  const buildCalcMatVariableMapPayload = () => {
    const payload = {}
    for (const variableName of calcVariableNames) {
      const source = calcMatVariableMap[variableName] || {}
      const variable = (source.variable || '').trim()
      const sliceExpr = (source.sliceExpr || '').trim()
      if (!variable) continue
      payload[variableName] = {
        variable,
        slice_expr: sliceExpr || undefined,
      }
    }
    return payload
  }

 const handleCalcPreview = async () => {
  setCalcError(null);

  if (!calcJobId) {
    setCalcError('Select a file first');
    return;
  }
  if (!calcFormulaExpression.trim()) {
    setCalcError('Enter a formula');
    return;
  }
  if (!calcOutputColumn.trim()) {
    setCalcError('Provide output column name');
    return;
  }
  if (calcFormulaError) {
    setCalcError(calcFormulaError);
    return;
  }

  const missingMappings = calcIsMat
    ? calcVariableNames.filter((name) => !(calcMatVariableMap[name]?.variable || '').trim())
    : calcVariableNames.filter((name) => !(calcVariableMap[name] || '').trim())
  if (missingMappings.length) {
    setCalcError(`Map all variables before processing: ${missingMappings.join(', ')}`);
    return;
  }

  try {
    setCalcProcessing(true);
    setCalcPreviewRows([]);
    setCalcMatPreview(null);
    setCalcMatPreviewContext(null);

    if (calcIsMat) {
      const data = await calculationsApi.previewMat(calcJobId, {
        formula_expression: calcFormulaExpression.trim(),
        variable_map: buildCalcMatVariableMapPayload(),
        output_variable: calcOutputColumn.trim(),
      });
      setCalcMatPreview(data || null);
      setCalcMatPreviewContext({
        type: 'formula',
        variable: calcOutputColumn.trim(),
      });
    } else {
      setSeriesList((prev) =>
        prev.map((s) => ({ ...s, derivedColumns: [] }))
      );

      const data = await calculationsApi.preview(calcJobId, {
        formula_expression: calcFormulaExpression.trim(),
        variable_map: buildCalcVariableMapPayload(),
        output_column: calcOutputColumn.trim(),
        limit: 20,
      });

      setCalcPreviewRows(data?.rows || []);

      const derived = data?.derived_column;
      if (derived?.name && derived?.expression) {
        applyCalculationToVisualisation(
          calcDatasetType,
          calcTag,
          calcJobId,
          derived
        );
      }
    }

    setPopupType("success");
    setPopupMessage(
      calcIsMat
        ? "MAT formula processed successfully. Please save the derived variable."
        : "Formula processed successfully. Please save the derived column."
    );

  } catch (e) {
    setCalcError(
      e?.response?.data?.detail || e.message || 'Formula preview failed'
    );

    setPopupType("error");
    setPopupMessage("Failed to process formula");

  } finally {
    setCalcProcessing(false);

    setTimeout(() => {
      setPopupMessage("");
    }, 4000);
  }
};



  const handleCalcSave = async () => {
  setCalcError(null);

  if (!calcJobId) {
    setCalcError('Select a file first');
    return;
  }
  if (!calcFormulaExpression.trim()) {
    setCalcError('Enter a formula');
    return;
  }
  if (!calcOutputColumn.trim()) {
    setCalcError('Provide output column name');
    return;
  }
  if (calcFormulaError) {
    setCalcError(calcFormulaError);
    return;
  }
  const missingMappings = calcIsMat
    ? calcVariableNames.filter((name) => !(calcMatVariableMap[name]?.variable || '').trim())
    : calcVariableNames.filter((name) => !(calcVariableMap[name] || '').trim())
  if (missingMappings.length) {
    setCalcError(`Map all variables before saving: ${missingMappings.join(', ')}`);
    return;
  }

  try {
    setCalcProcessing(true);

    if (calcIsMat) {
      await calculationsApi.materializeMat(calcJobId, {
        formula_expression: calcFormulaExpression.trim(),
        variable_map: buildCalcMatVariableMapPayload(),
        output_variable: calcOutputColumn.trim(),
      });
      try {
        const refreshedMatMeta = await matApi.variables(calcJobId)
        setMatMetaByJob((prev) => ({ ...prev, [calcJobId]: refreshedMatMeta || prev[calcJobId] }))
      } catch (refreshErr) {
        console.error(refreshErr)
      }
      setCalcMatPreview(null);
      setCalcMatPreviewContext(null);
      setCalcOutputColumn('');
      setPopupType("success");
      setPopupMessage("Calculated MAT variable saved successfully.");
    } else {
      await calculationsApi.materialize(calcJobId, {
        formula_expression: calcFormulaExpression.trim(),
        variable_map: buildCalcVariableMapPayload(),
        output_column: calcOutputColumn.trim(),
        limit: 20,
      });

      const key = `${calcDatasetType}::${calcTag}`;
      const list = await ingestionApi.listFilesInTag(
        projectId,
        calcDatasetType,
        calcTag
      );
      const processed = (list || []).filter((f) => {
        if (isMatFileName(f?.filename || '')) return true;
        return !!(f.processed_key && f.columns?.length);
      });
      setFilesByDatasetTag((prev) => ({ ...prev, [key]: processed }));

      setCalcPreviewRows([]);
      setCalcOutputColumn('');

      setSeriesList((prev) =>
        prev.map((s) => ({ ...s, derivedColumns: [] }))
      );

      setPopupType("success");
      setPopupMessage("Calculated column saved successfully.");
    }

  } catch (e) {
    setCalcError(e?.response?.data?.detail || e.message || 'Formula save failed');

    setPopupType("error");
    setPopupMessage(calcIsMat ? "Failed to save calculated variable." : "Failed to save calculated column.");

  } finally {
    setCalcProcessing(false);

    setTimeout(() => {
      setPopupMessage("");
    }, 3000);
  }
};


  const handleSubmit = async (e) => {
    e.preventDefault()

    const configured = enabledSeries.filter((s) => s.jobId)
    const matSeries = configured.filter((s) => isMatFileName(jobsById[s.jobId]?.filename || ''))
    const tabularSeries = configured.filter((s) => !isMatFileName(jobsById[s.jobId]?.filename || ''))

    if (matSeries.length && tabularSeries.length) {
      setError('Mixing MAT and tabular series in one visualization is not supported.')
      return
    }

    setLoading(true)
    setError(null)
    setPlotHtml('')
    setTilePreview(null)
    setStatusMessage('Starting visualization…')
    if (pollTimer.current) clearTimeout(pollTimer.current)

    try {
      let requestPayload = null

      if (matSeries.length) {
        if (matSeries.length > 1) {
          throw new Error('Only one MAT series is supported per plot.')
        }
        if (!matAllowedChartTypes.has(chartType)) {
          throw new Error('MAT supports line, scatter, heatmap, contour, and surface charts.')
        }

        const s = matSeries[0]
        const jobMeta = matMetaByJob[s.jobId]
        const vars = jobMeta?.variables || []
        const varMeta = vars.find((v) => v.name === s.matVar) || vars[0]
        if (!varMeta) {
          throw new Error('Select a MAT variable before plotting.')
        }

        const ndim = Number(varMeta.ndim || varMeta.shape?.length || 0)
        const xDim = Number(s.matXDim)
        const yDim = Number(s.matYDim)
        if (!Number.isInteger(xDim) || xDim < 0 || xDim >= ndim) {
          throw new Error('Select a valid MAT X dimension.')
        }
        if (matNeeds2D && (!Number.isInteger(yDim) || yDim < 0 || yDim >= ndim || yDim === xDim)) {
          throw new Error('Select a valid MAT Y dimension.')
        }

        const selectedDims = matNeeds2D ? [xDim, yDim] : [xDim]
        const mapping = {
          x: { dim: xDim, coord: getMatCoordGuess(varMeta, xDim) || undefined },
        }
        if (matNeeds2D) {
          mapping.y = { dim: yDim, coord: getMatCoordGuess(varMeta, yDim) || undefined }
        }

        const filters = {}
        for (let dim = 0; dim < ndim; dim += 1) {
          if (selectedDims.includes(dim)) continue
          const key = getMatCoordGuess(varMeta, dim) || `dim_${dim}`
          const maxIdx = Math.max(0, Number(varMeta?.shape?.[dim] || 1) - 1)
          const raw = Number(s?.matFilters?.[dim] ?? 0)
          const idx = Math.max(0, Math.min(maxIdx, Number.isFinite(raw) ? raw : 0))
          filters[key] = idx
        }

        requestPayload = {
          project_id: projectId,
          source_type: 'mat',
          job_id: s.jobId,
          var: varMeta.name,
          mapping,
          filters,
          chart_type: chartType,
        }
      } else {
        const payloadSeries = tabularSeries
          .filter((s) => s.xAxis && s.yAxis && (!requiresZ || s.zAxis))
          .map((s) => {
            const derivedColumns = normalizeDerivedColumns(s)
            return {
              job_id: s.jobId,
              x_axis: s.xAxis,
              y_axis: s.yAxis,
              z_axis: requiresZ ? s.zAxis : undefined,
              x_scale: xScale,
              y_scale: yScale,
              chart_type: canMixOverplot
                ? ((s.seriesChartType || '').trim() || undefined)
                : undefined,
              label: (s.label || '').trim() || buildAutoLabel(s),
              derived_columns: derivedColumns,
            }
          })

        if (payloadSeries.length === 0) {
          throw new Error(
            requiresZ
              ? 'Please configure at least one enabled series with File, X, Y and Z selected.'
              : 'Please configure at least one enabled series with File, X and Y selected.'
          )
        }

        const firstSeries = payloadSeries.length
  ? configured.find(s => s.jobId === payloadSeries[0].job_id)
  : null


requestPayload = {
  project_id: projectId,
  source_type: 'tabular',
  dataset_type: firstSeries?.datasetType || null,
  tag_name: firstSeries?.tag || null,
  chart_type: chartType,
  series: payloadSeries,
}


        // requestPayload = {
        //   project_id: projectId,
        //   source_type: 'tabular',
        //   dataset_type: activeSeries?.datasetType || null,
        //   tag_name: activeSeries?.tag || null,
        //   chart_type: chartType,
        //   series: payloadSeries,
        // }
      }

      const res = await visualizationApi.create(requestPayload)
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

    if (detail.status === 'SUCCESS') {
      setStatusMessage("Preview ready. Click Save Visualization.")  // ✅ HERE
    } else {
      setStatusMessage(detail.message || detail.status)
    }

    if (!['SUCCESS', 'FAILURE'].includes(detail.status)) {
      pollTimer.current = setTimeout(() => pollVisualization(vizId), 1500)
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

  // const deleteVisualization = async (vizId) => {
  //   if (!window.confirm('Delete this visualization?')) return
  //   try {
  //     await visualizationApi.remove(vizId)
  //     setVisualizations((prev) => prev.filter((v) => v.viz_id !== vizId))
  //     if (activeViz?.viz_id === vizId) {
  //       setActiveViz(null)
  //       setPlotHtml('')
  //       setTilePreview(null)
  //       setStatusMessage('Select data to begin')
  //     }
  //   } catch (e) {
  //     setError(e?.response?.data?.detail || e.message || 'Failed to delete visualization')
  //   }
  // }
const deleteVisualization = async (vizId) => {
  setDeletingViz(vizId)
  try {
    await visualizationApi.remove(vizId)

    setVisualizations((prev) =>
      prev.filter((v) => v.viz_id !== vizId)
    )

    if (activeViz?.viz_id === vizId) {
      setActiveViz(null)
      setPlotHtml('')
      setStatusMessage('Select data to begin')
    }
  } catch (e) {
    setError(
      e?.response?.data?.detail ||
      e.message ||
      'Failed to delete visualization'
    )
  } finally {
    setDeletingViz(null)
    setConfirmDelete({ open: false, tagName: null })
  }
}

  /* =============
  
  ==== tiles ================= */
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
    const on = enabledSeries.filter((s) => {
      if (!s.jobId) return false
      const job = jobsById[s.jobId]
      if (isMatFileName(job?.filename || '')) return !!s.matVar
      return !!(s.xAxis && s.yAxis)
    })
    if (!on.length) return null
    return {
      chartType,
      count: on.length,
      items: on.map((s) => ({
        label: (s.label || '').trim() || buildAutoLabel(s),
      })),
    }
  }, [enabledSeries, chartType, jobsById, buildAutoLabel])

  /* ================= UI ================= */
  return (
    <div className="CardWapper">
    <div className="project-cardpage">
      <div className="Tablist" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={visualSectionTab === 'visualize' ? 'active' : ''}
          onClick={() => setVisualSectionTab('visualize')}
        >
          Visualisation
        </button>
        <button
          type="button"
          className={visualSectionTab === 'calculation' ? 'active' : ''}
          onClick={() => setVisualSectionTab('calculation')}
        >
          Calculation
        </button>
      </div>

      {visualSectionTab === 'calculation' && (
        <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0' }}>Calculation</h3>
            <p className="summary-label" style={{ margin: 0 }}>
              Enter a formula, map detected variables to sources, preview, then save.
            </p>
          </div>

          {calcError && <div className="project-shell__error">{calcError}</div>}

          <div className="Row calculation-row">
            <div className="ps-field">
              <label>Dataset</label>
              <select
                value={calcDatasetType}
                onChange={(e) => {
                  setCalcDatasetType(e.target.value)
                  setCalcTag('')
                  setCalcJobId('')
                  setCalcPreviewRows([])
                  setCalcMatPreview(null)
                  setCalcMatPreviewContext(null)
                  setCalcMatVariableMap({})
                }}
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
                value={calcTag}
                onChange={(e) => {
                  setCalcTag(e.target.value)
                  setCalcJobId('')
                  setCalcPreviewRows([])
                  setCalcMatPreview(null)
                  setCalcMatPreviewContext(null)
                  setCalcMatVariableMap({})
                }}
              >
                <option value="">Select</option>
                {getTags(calcDatasetType).map((t) => (
                  <option key={t.tag_name} value={t.tag_name}>
                    {t.tag_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ps-field">
              <label style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>File <span style={{ color: "red",fontSize: "16px" }}>*</span></label>
              <select
                value={calcJobId}
                onChange={(e) => {
                  setCalcJobId(e.target.value)
                  setCalcPreviewRows([])
                  setCalcMatPreview(null)
                  setCalcMatPreviewContext(null)
                  setCalcMatVariableMap({})
                }}
                disabled={!calcTag}
              >
                <option value="">{calcTag ? 'Select' : 'Select tag first'}</option>
                {calcFiles.map((f) => (
                  <option key={f.job_id} value={f.job_id}>
                    {f.sheet_name ? `${f.filename} — ${f.sheet_name}` : f.filename}
                  </option>
                ))}
              </select>
            </div>

            <div className="ps-field">
              <label style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                {calcIsMat ? 'Derived Variable' : 'Derived Column'} <span style={{ color: "red",fontSize: "16px" }}>*</span>
              </label>
              <input
                className="input-control"
                value={calcOutputColumn}
                onChange={(e) => setCalcOutputColumn(e.target.value)}
                placeholder={calcIsMat ? 'derived_var_name' : 'derived_col_name'}
              />
            </div>
          </div>

          <div className="ps-field calc-formula-editor">
            <label style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>Formula <span style={{ color: "red",fontSize: "16px" }}>*</span></label>
            <textarea
              ref={calcFormulaInputRef}
              className="calc-formula-input"
              value={calcFormulaExpression}
              onChange={(e) => handleCalcFormulaChange(e.target.value)}
              onClick={handleCalcFormulaCursorChange}
              onKeyUp={handleCalcFormulaCursorChange}
              onKeyDown={handleCalcFormulaKeyDown}
              onSelect={handleCalcFormulaCursorChange}
              spellCheck={false}
              placeholder="Example: sqrt(a+b) * (cos(a) + sin(b))"
            />
            {calcFormulaSuggestions.length > 0 && (
              <div className="calc-suggestion-list">
                {calcFormulaSuggestions.map((fn) => (
                  <button
                    key={fn.name}
                    type="button"
                    className="calc-suggestion-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleInsertFormulaFunction(fn.name)}
                  >
                    <span className="calc-suggestion-name">{fn.name}</span>
                    <span className="calc-suggestion-meta">{fn.example || ''}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="summary-label" style={{ marginTop: 6 }}>
              Function autocomplete: type a function name, then press <code>Tab</code>/<code>Enter</code> or click suggestion.
            </div>
            {!!calcFormulaError && (
              <div className="project-shell__error" style={{ marginTop: 8 }}>
                {calcFormulaError}
              </div>
            )}
            {!calcFormulaError && !!calcNormalizedExpression && calcNormalizedExpression !== calcFormulaExpression.trim() && (
              <div className="summary-label" style={{ marginTop: 8 }}>
                Normalized: <code>{calcNormalizedExpression}</code>
              </div>
            )}
          </div>

          <div className="calc-syntax-preview">
            {calcFormulaExpression ? (
              calcFormulaTokens.map((part, idx) => (
                <span key={`calc-token-${idx}`} className={`calc-token calc-token--${part.kind}`}>
                  {part.token}
                </span>
              ))
            ) : (
              <span className="calc-token calc-token--plain">Formula syntax preview appears here.</span>
            )}
          </div>

          <div className="Row calculation-row">
            {(calcVariableNames || []).map((variableName) => (
              <div className="ps-field" key={`calc-var-${variableName}`}>
                {calcIsMat ? (
                  <>
                    <label>{`MAT source for ${variableName}`}</label>
                    <select
                      value={calcMatVariableMap[variableName]?.variable || ''}
                      onChange={(e) =>
                        handleCalcMatVariableMapChange(variableName, { variable: e.target.value })
                      }
                      disabled={!calcJobId || !calcMatVars.length}
                    >
                      <option value="">
                        {!calcJobId
                          ? 'Select file first'
                          : !calcMatVars.length
                            ? 'Loading MAT variables...'
                            : 'Select variable'}
                      </option>
                      {calcMatVars.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({toMatShapeText(v.shape)}{v.dtype ? ` | ${v.dtype}` : ''})
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-control"
                      value={calcMatVariableMap[variableName]?.sliceExpr || ''}
                      onChange={(e) =>
                        handleCalcMatVariableMapChange(variableName, { sliceExpr: e.target.value })
                      }
                      placeholder="Slice (optional): :, : or :, :, 1"
                      style={{ marginTop: 8 }}
                    />
                  </>
                ) : (
                  <>
                    <label>{`Column for ${variableName}`}</label>
                    <select
                      value={calcVariableMap[variableName] || ''}
                      onChange={(e) => handleCalcVariableMapChange(variableName, e.target.value)}
                      disabled={!calcJobId}
                    >
                      <option value="">{calcJobId ? 'Select' : 'Select file first'}</option>
                      {calcColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap: 12}}>
            <button
              type="button"
              className="project-shell__nav-link"
              onClick={handleCalcPreview}
              disabled={calcProcessing}
            >
              {calcProcessing ? 'Processing…' : 'Process Formula'}
            </button>
            <button
              type="button"
              className="project-shell__nav-save"
              onClick={handleCalcSave}
              disabled={calcProcessing}
            >
              {calcProcessing ? 'Saving…' : (calcIsMat ? 'Save Derived Variable' : 'Save Derived Column')}
            </button>
          </div>


        <div>
  <p
    className="summary-label"
    style={{
      marginBottom: 6,
      fontFamily: "inter-semi-bold, Helvetica",
      fontSize: "16px",
      fontWeight: 600,
      color: "#000000",
    }}
  >
    Preview
  </p>

  <div className="excel-preview">
    {calcFilePreviewLoading ? (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="summary-label">Loading selected file preview…</div>
      </div>
    ) : calcMatSourcePreviewLoading ? (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="summary-label">Loading MAT variable preview…</div>
      </div>
    ) : calcMatPreview ? (
      <div>
        <div className="summary-label" style={{ marginBottom: 8 }}>
          {calcIsSourceMatPreview
            ? `Showing MAT source preview for ${calcMatPreviewContext?.variable || 'selected variable'}.`
            : 'Showing calculated MAT output preview.'}
        </div>
        <div className="summary-label" style={{ marginBottom: 8 }}>
          {calcMatPreview?.display_shape || toMatShapeText(calcMatPreview?.shape)}{calcMatPreview?.dtype ? ` | ${calcMatPreview.dtype}` : ''}{calcMatPreview?.slice_expr ? ` | ${calcMatPreview.slice_expr}` : ''}
        </div>
        {calcMatPreview?.format === 'scalar' && (
          <div style={{ fontFamily: 'monospace' }}>
            {String(calcMatPreview?.scalar ?? '')}
          </div>
        )}
        {calcMatPreview?.format === 'table' && calcMatPreview?.table && (
          <table className="data-table">
            <thead>
              <tr>
                {calcMatPreview.table.headers.map((h) => (
                  <th key={`mat-calc-head-${h}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(calcMatPreview.table.rows || []).map((row, rowIdx) => (
                <tr key={`mat-calc-row-${rowIdx}`}>
                  {(row || []).map((cell, colIdx) => (
                    <td key={`mat-calc-cell-${rowIdx}-${colIdx}`}>{String(cell ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {calcMatPreview?.format === 'pages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(calcMatPreview.pages || []).map((page) => (
              <div key={`mat-calc-page-${page.page}`}>
                <div className="summary-label" style={{ marginBottom: 6 }}>
                  (:, :, {page.page})
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      {(page.headers || []).map((h) => (
                        <th key={`mat-calc-page-head-${page.page}-${h}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(page.rows || []).map((row, rowIdx) => (
                      <tr key={`mat-calc-page-row-${page.page}-${rowIdx}`}>
                        {(row || []).map((cell, colIdx) => (
                          <td key={`mat-calc-page-cell-${page.page}-${rowIdx}-${colIdx}`}>
                            {String(cell ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
        {calcMatPreview?.message && (
          <div className="summary-label" style={{ marginTop: 8 }}>
            {calcMatPreview.message}
          </div>
        )}
      </div>
    ) : calcDisplayPreviewRows.length ? (
      <>
      {calcJobId && (
        <div className="summary-label" style={{ marginBottom: 8 }}>
          {showingCalculatedPreview
            ? 'Showing calculated output preview.'
            : 'Showing selected file preview.'}
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            {Object.keys(calcDisplayPreviewRows[0] || {}).map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {calcDisplayPreviewRows.slice(0, 10).map((row, i) => (
            <tr key={`calc-row-${i}`}>
              {Object.keys(calcDisplayPreviewRows[0] || {}).map((k) => (
                <td key={`${i}-${k}`}>
                  {String(row?.[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </>
    ) : calcFilePreviewError ? (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
        }}
      >
        <div className="project-shell__error">{calcFilePreviewError}</div>
      </div>
    ) : (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <EmptySection />
      </div>
    )}
  </div>
</div>

        </div>
      )}

      {visualSectionTab === 'visualize' && (
        <>
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
                  zAxis: '',
                  matVar: '',
                  matXDim: 0,
                  matYDim: 1,
                  matFilters: {},
                  derivedColumns: [],
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
                  zAxis: '',
                  matVar: '',
                  matXDim: 0,
                  matYDim: 1,
                  matFilters: {},
                  derivedColumns: [],
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
                  zAxis: '',
                  matVar: '',
                  matXDim: 0,
                  matYDim: 1,
                  matFilters: {},
                  derivedColumns: [],
                })
              }
              disabled={!activeSeries?.tag}
            >
              <option className="FileSelect" value="">{activeSeries?.tag ? 'Select' : 'Select tag first'}</option>
              {activeFiles.map((f) => (
                <option  className="FileSelect" key={f.job_id} value={f.job_id}>
                  {f.sheet_name ? `${f.filename} — ${f.sheet_name}` : f.filename}
                </option>
              ))}
            </select>
          </div>


            <div className="ps-field">
            <label>Plot Type</label>
            <select
    value={dimension}
    onChange={(e) => {
      setDimension(e.target.value)
    }}
    disabled={activeIsMat}
  >
    <option value="2d">2D</option>
    <option value="3d">3D</option>
  </select>
          </div>

      <div className="ps-field">
  <label>Chart Type</label>
  <select
    value={chartType}
    onChange={(e) => setChartType(e.target.value)}
  >
    <option value="">Select Chart Type</option>
    {activeChartOptions.map((item) => (
      <option key={item.value} value={item.value}>
        {item.label}
      </option>
    ))}
  </select>
</div>


<div className="ps-field">
  <label>X Scale</label>
  <select value={xScale} onChange={(e) => setXScale(e.target.value)} disabled={activeIsMat}>
    <option value="linear">Linear</option>
    <option value="log">Log</option>
  </select>
</div>

<div className="ps-field">
  <label>Y Scale</label>
  <select value={yScale} onChange={(e) => setYScale(e.target.value)} disabled={activeIsMat}>
    <option value="linear">Linear</option>
    <option value="log">Log</option>
  </select>
</div>

           {/* <div className="ps-field">
            <label>Chart Type</label>
            <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
              {CHART_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>  */}
         
        </div>

         <div
  className="ps-row"
  style={{
    display: 'grid',
    gap: '14px',
    marginBottom: '14px',
    gridTemplateColumns:
      chartType === 'contour' || dimension === '3d'
        ? 'repeat(7, minmax(0, 1fr))'
        : 'repeat(7, minmax(0, 1fr))',
  }}
>
  {!activeIsMat && (
    <>
      <div className="ps-field">
        <label>X Axis</label>
        <select
          value={activeSeries?.xAxis || ''}
          onChange={(e) => updateActiveSeries({ xAxis: e.target.value })}
          disabled={!activeSeries?.jobId}
        >
          <option value="">{activeSeries?.jobId ? 'Select' : 'Select file first'}</option>
          {activeAxisColumns.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>

      <div className="ps-field">
        <label>Y Axis</label>
        <select
          value={activeSeries?.yAxis || ''}
          onChange={(e) => updateActiveSeries({ yAxis: e.target.value })}
          disabled={!activeSeries?.jobId}
        >
          <option value="">{activeSeries?.jobId ? 'Select' : 'Select file first'}</option>
          {activeAxisColumns.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>

      <div className="ps-field">
        <label>Series Chart Type</label>
        <select
          value={activeSeries?.seriesChartType || ''}
          onChange={(e) => updateActiveSeries({ seriesChartType: e.target.value })}
          disabled={!canMixOverplot}
        >
          <option value="">
            {canMixOverplot ? `Default (${chartType})` : 'Use bar/line/scatter/scatterline'}
          </option>
          {OVERPLOT_CARTESIAN_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {requiresZ && (
        <div className="ps-field">
          <label>Z Axis</label>
          <select
            value={activeSeries?.zAxis || ''}
            onChange={(e) => updateActiveSeries({ zAxis: e.target.value })}
            disabled={!activeSeries?.jobId}
          >
            <option value="">Select</option>
            {activeAxisColumns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>
      )}
    </>
  )}

  {activeIsMat && (
    <>
      <div className="ps-field">
        <label>MAT Variable</label>
        <select
          value={activeSeries?.matVar || activeMatVar?.name || ''}
          onChange={(e) =>
            updateActiveSeries({
              matVar: e.target.value,
              matFilters: {},
            })
          }
          disabled={!activeSeries?.jobId || !activeMatVars.length}
        >
          <option value="">{activeSeries?.jobId ? 'Select variable' : 'Select file first'}</option>
          {activeMatVars.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({Array.isArray(v.shape) ? v.shape.join('×') : ''})
            </option>
          ))}
        </select>
      </div>

      <div className="ps-field">
        <label>X Dimension</label>
        <select
          value={String(activeSeries?.matXDim ?? '')}
          onChange={(e) => updateActiveSeries({ matXDim: Number(e.target.value) })}
          disabled={!activeMatVar}
        >
          {Array.from({ length: Number(activeMatVar?.ndim || 0) }, (_, dim) => (
            <option key={`mat-x-${dim}`} value={dim}>
              {`Dim ${dim}${getMatCoordGuess(activeMatVar, dim) ? ` (${getMatCoordGuess(activeMatVar, dim)})` : ''}`}
            </option>
          ))}
        </select>
      </div>

      {matNeeds2D && (
        <div className="ps-field">
          <label>Y Dimension</label>
          <select
            value={String(activeSeries?.matYDim ?? '')}
            onChange={(e) => updateActiveSeries({ matYDim: Number(e.target.value) })}
            disabled={!activeMatVar}
          >
            {Array.from({ length: Number(activeMatVar?.ndim || 0) }, (_, dim) => (
              <option key={`mat-y-${dim}`} value={dim} disabled={dim === Number(activeSeries?.matXDim)}>
                {`Dim ${dim}${getMatCoordGuess(activeMatVar, dim) ? ` (${getMatCoordGuess(activeMatVar, dim)})` : ''}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {matRemainingDims.map((dim) => {
        const maxIdx = Math.max(0, Number(activeMatVar?.shape?.[dim] || 1) - 1)
        const label = getMatCoordGuess(activeMatVar, dim) || `Dim ${dim}`
        return (
          <div className="ps-field" key={`mat-filter-${dim}`}>
            <label>{`${label} filter`}</label>
            <input
              type="number"
              min={0}
              max={maxIdx}
              value={Number(activeSeries?.matFilters?.[dim] ?? 0)}
              onChange={(e) =>
                updateActiveSeries({
                  matFilters: {
                    ...(activeSeries?.matFilters || {}),
                    [dim]: Number(e.target.value || 0),
                  },
                })
              }
            />
          </div>
        )
      })}
    </>
  )}

  {/* Plot Name */}
  <div className="ps-field">
    <label>Plot Name (Optional)</label>
    <input
      placeholder="Defaults to Dataset | X → Y"
      value={activeSeries?.label || ''}
      onChange={(e) => updateActiveSeries({ label: e.target.value })}
    />
  </div>

  {/* Generate Button */}
  <div className="ps-field">
    <button type="submit"  className="plot-btn" disabled={loading}>
      <img src={ChartLine1} alt="chart" />
      {loading ? 'Generating…' : 'Generate Plot'}
    </button>
  </div>
</div>

        {/* ===== Series Manager (KEPT) ===== */}
        <div className="ps-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <div className="ps-field" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <label style={{fontSize: "16px", fontWeight: 600, fontFamily: "Inter-semiBold, Helvetica", marginBottom: 0 }}>Plot ({seriesList.length})</label>

              <button
                type="button"
                className="project-shell__nav-link"
                onClick={addSeriesSlot}
                style={{ height: 36, padding: '0 12px' }}
              >
                + Over Plot
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
                      border: active ? '2px solid #1976D2' : '1px solid #00000026',
                      // background: active ? '#eef6ff' : '#fff',
                      borderRadius: 6,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      minWidth: 220,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, fontFamily: "Inter-semiBold, Helvetica" }}>Plot {idx + 1}</div>

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

                    <div  style={{ fontSize:"12px",fontWeight:"400",fontFamily:"inter-Regular,Helvetica",marginTop: 8, alignItems: 'flex-start' }}>
                      {seriesSummary(s)}
                    </div>
                    {seriesList.length > 1 && (

                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    setConfirmRemoveSeries({ open: true, seriesId: s.id });
  }}
  style={{
    marginTop: 8,
    height: 24,
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    width: '40%',
    borderRadius: 4,
    border: '1px solid #fecdd3',
    background: '#fff1f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontSize:'12px',
    fontWeight: 400,
    fontFamily:"Inter-Regular,Helvetica",
  }}
>
  Remove
</button>
</div>
                
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
       <div className="actions-row">
  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
    <p className="summarylabel">{statusMessage}</p>

    <button
  type="button"
  className="project-shell__nav-save"
  onClick={handleSaveVisualization}
  disabled={!plotHtml || loadingSave}
>
  {loadingSave ? 'Saving…' : 'Save Visualization'}
</button>

  </div>

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

  {activeViz?.status && (
    <span className="badge">{activeViz.status.toLowerCase()}</span>
  )}
</div>


        <div className="Plot-preview" >
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
        {/* <div className="projectcard1">
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
        </div> */}


        {/* ===== Saved Visualizations (old UI + icons + expand) ===== */}
        <div className="projectcard1">
          <div className="actionsrow actionsrow--header">
            <label className="text">Saved visualizations ({visualizations.length})</label>

            <div className="actionsrow__right">
              
              <button
  type="button"
  className="expand-btn"
  // onClick={() => {
  //   setIsExpanded((prev) => {
  //     const next = !prev;
  //     if (next && visualizations.length === 0) {
  //       fetchVisualizations(1, true);
  //     }
  //     return next;
  //   });
  // }}
 onClick={() => {
  setIsExpanded((prev) => {
    const next = !prev;

    if (next && visualizations.length === 0) {
      fetchVisualizations(1, true);
    }

    return next;
  });
}}
>
                <span className={`chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                {isExpanded ? 'Collapse' : 'Expand'}
              </button>

              {/* {isExpanded && hasMoreViz && (
  <div style={{ textAlign: 'center', marginTop: 12 }}>
    <button
      type="button"
      className="project-shell__nav-link"
      disabled={loadingViz}
      onClick={() => fetchVisualizations(vizPage + 1)}
    >
      {loadingViz ? 'Loading…' : 'Load more'}
    </button>
  </div>
)} */}


              {/* <button type="button" className="project-shell__nav-link" onClick={fetchVisualizations}>
                Refresh
              </button> */}

              <button
  type="button"
  className="project-shell__nav-link"
  onClick={() => fetchVisualizations(1, true)}
>
  Refresh
</button>

            </div>
          </div>

          <div className={`expand-container ${isExpanded ? 'open' : ''}`}>
            <div className="expand-inner">
              {/* {visualizations.length === 0 && <div className="emptystate">No visualizations yet</div>} */}
              {!loadingViz && visualizations.length === 0 && (
  <div className="emptystate">No visualizations yet</div>
)}


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
                        // <button type="button" onClick={() => window.open(viz.html_url, '_blank')}>
                        //   <img className="actionBtn" src={blackPloticon} alt="download" />
                        // </button>
                        <button
  type="button"
 onClick={() => handleFullScreen(viz)}
>
  <img className="actionBtn" src={linechart} alt="fullscreen" />
</button>

                      )}

                      <button 
                      type="button" 
                      className="danger" 
                      // onClick={() => deleteVisualization(viz.viz_id)}
                       onClick={() =>
  setConfirmDelete({
    open: true,
    vizId: viz.viz_id
  })
}
disabled={deletingViz === viz.viz_id}

                      >
                        <img className="actionBtn" src={Delete} alt="delete" />
                      </button>                                        
                    </div>
                  </div>
                ))}
              </div>

              {isExpanded && hasMoreViz && <div ref={savedVizLoadRef} style={{ height: 1 }} />}
              {isExpanded && loadingViz && visualizations.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: 12, color: '#64748b' }}>
                  Loading more...
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
      </>
      )}
    {confirmDelete.open && (
  <ConfirmationModal
    title="Delete this visualization?"
    onCancel={() =>
      setConfirmDelete({ open: false, vizId: null })
    }
    onConfirm={() =>
      deleteVisualization(confirmDelete.vizId)
    }
  />
)}

{confirmRemoveSeries.open && confirmRemoveSeries.seriesId && (
  <ConfirmationModal
    title="Remove this series?"
    onCancel={() =>
      setConfirmRemoveSeries({ open: false, seriesId: null })
    }
    onConfirm={() => {
      removeSeriesSlot(confirmRemoveSeries.seriesId);
      setConfirmRemoveSeries({ open: false, seriesId: null });
    }}
  />
)}     
    </div>
    {popupMessage && (
  <div className={`toast-popup ${popupType}`}>
    {popupMessage}
  </div>
)}

    
     {/* ✅ ADD FULLSCREEN MODAL HERE — LAST */}
    {/* {fullScreenViz && (
      <div className="fullscreen-overlay">
        <div className="fullscreen-content">

          <button
            className="fullscreen-close"
            onClick={() => setFullScreenViz(null)}
          >
            ✕
          </button>

          <iframe
            src={fullScreenViz.html_url}
            title="Full Visualization"
            className="fullscreen-frame"
          />

        </div>
      </div>
    )} */}
    </div>
  )
  }
