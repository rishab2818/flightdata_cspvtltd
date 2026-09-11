import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../../../context/AuthContext'
import { ingestionApi } from '../../../api/ingestionApi'
import { projectApi } from '../../../api/projectapi'
import { rawPreviewApi } from '../../../api/rawPreviewApi'
import { visualizationApi } from '../../../api/visualizationApi'
import ArrowLeft from '../../../assets/ArrowLeft.svg'
import Folder1 from '../../../assets/Folder1.svg'
import CalendarBlank from '../../../assets/CalendarBlank.svg'
import DownloadSimple from '../../../assets/DownloadSimple.svg'
import Delete from '../../../assets/Delete.svg'
import ViewIcon from '../../../assets/ViewIcon.svg'
import { PROJECT_TABULAR_EXTENSIONS } from '../../../uploadPreview/fileTypes'
import { useLoader } from '../../../context/LoaderContext'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { formatDateTimeShort } from '../../../lib/time'

import './ProjectVisualisation.css'
import ConfirmationModal from "../../../components/common/ConfirmationModal"

const TABULAR_EXTENSIONS = PROJECT_TABULAR_EXTENSIONS

const INLINE_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.txt',
  '.csv',
])

const OTHERS_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg'
])

const getExtension = (name = '') => {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

const isTabularFile = (file) => TABULAR_EXTENSIONS.has(getExtension(file?.filename || ''))
const isRawFile = (file) => isTabularFile(file)
const isProcessedFile = (file) => Boolean(file?.processed_key)

const isOtherFile = (file) => {
  const ext = getExtension(file?.filename || '')
  return !isTabularFile(file) && !file?.processed_key && !file?.visualize_enabled && OTHERS_EXTENSIONS.has(ext)
}

const canInlinePreview = (file) => {
  const type = (file?.content_type || '').toLowerCase()
  if (type.startsWith('image/') || type.startsWith('text/') || type === 'application/pdf') {
    return true
  }
  return INLINE_EXTENSIONS.has(getExtension(file?.filename || ''))
}

const triggerDownload = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const forceDownloadFromUrl = async (url, filename) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Download failed')

  const blob = await res.blob()
  const objectUrl = window.URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.URL.revokeObjectURL(objectUrl)
  }
}

const openPlotFullScreen = (viz) => {
  if (!viz) return

  const raw = viz.html_url || viz.htmlUrl || viz.url
  if (raw) {
    const full = raw.startsWith('http')
      ? raw
      : `${window.__FD_API_BASE__ || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${raw}`
    window.open(full, '_blank', 'noopener,noreferrer')
    return
  }

  const fallback = `${window.__FD_API_BASE__ || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/visualizations/${viz.viz_id}/html`
  window.open(fallback, '_blank', 'noopener,noreferrer')
}

const matchesTagAndDataset = (viz, tagName, datasetType) =>
  viz?.tag_name?.trim().toLowerCase() === tagName?.trim().toLowerCase() &&
  viz?.dataset_type?.trim().toLowerCase() === datasetType?.trim().toLowerCase()

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatDateTime = (value) => formatDateTimeShort(value)

const buildRawExportDom = async (file) => {
  const wrapper = document.createElement('div')
  wrapper.style.background = '#ffffff'
  wrapper.style.padding = '24px'
  wrapper.style.width = '1000px'
  wrapper.style.fontFamily = 'Arial, sans-serif'
  wrapper.style.color = '#0f172a'

  const title = document.createElement('h2')
  title.textContent = 'Raw File'
  title.style.margin = '0 0 12px'
  wrapper.appendChild(title)

  const meta = document.createElement('div')
  meta.style.fontSize = '13px'
  meta.style.marginBottom = '12px'
  meta.innerHTML = `<strong>Name:</strong> ${file.sheet_name ? `${file.filename} - ${file.sheet_name}` : file.filename}`
  wrapper.appendChild(meta)

  const detail = await rawPreviewApi.detail(file.job_id)

  if (detail.kind === 'text') {
    const chunk = await rawPreviewApi.textChunk(file.job_id, { offset: 0, chunkSize: 131072 })
    const pre = document.createElement('pre')
    pre.textContent = (chunk.lines || []).join('\n') || 'No preview available.'
    pre.style.whiteSpace = 'pre-wrap'
    pre.style.wordBreak = 'break-word'
    pre.style.fontSize = '12px'
    pre.style.lineHeight = '1.5'
    pre.style.background = '#f8fafc'
    pre.style.border = '1px solid #e2e8f0'
    pre.style.borderRadius = '8px'
    pre.style.padding = '14px'
    wrapper.appendChild(pre)
    return wrapper
  }

  if (detail.kind === 'excel') {
    const workbook = await rawPreviewApi.excelPreview(file.job_id, { rowLimit: 25 })
    const rows = workbook.rows || []
    const headers = rows.length ? Object.keys(rows[0] || {}) : []

    const tableWrap = document.createElement('div')
    tableWrap.style.border = '1px solid #e2e8f0'
    tableWrap.style.borderRadius = '8px'
    tableWrap.style.overflow = 'hidden'

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontSize = '12px'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    headers.forEach((h) => {
      const th = document.createElement('th')
      th.textContent = h
      th.style.border = '1px solid #e2e8f0'
      th.style.padding = '8px 10px'
      th.style.textAlign = 'left'
      th.style.background = '#eff6ff'
      headRow.appendChild(th)
    })
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    rows.forEach((row) => {
      const tr = document.createElement('tr')
      headers.forEach((h) => {
        const td = document.createElement('td')
        td.textContent = row?.[h] ?? ''
        td.style.border = '1px solid #e2e8f0'
        td.style.padding = '8px 10px'
        td.style.textAlign = 'left'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    tableWrap.appendChild(table)
    wrapper.appendChild(tableWrap)
    return wrapper
  }

  if (detail.kind === 'image' && detail.download_url) {
    const img = document.createElement('img')
    img.src = detail.download_url
    img.style.maxWidth = '100%'
    img.style.border = '1px solid #e2e8f0'
    img.style.borderRadius = '8px'
    wrapper.appendChild(img)

    await new Promise((resolve) => {
      img.onload = resolve
      img.onerror = resolve
    })

    return wrapper
  }

  if (detail.kind === 'pdf' && detail.download_url) {
    const note = document.createElement('div')
    note.textContent = 'PDF raw preview is not embedded in export. The related plots will still be included below.'
    note.style.padding = '12px 14px'
    note.style.background = '#f8fafc'
    note.style.border = '1px solid #e2e8f0'
    note.style.borderRadius = '8px'
    note.style.fontSize = '13px'
    wrapper.appendChild(note)
    return wrapper
  }

  const note = document.createElement('div')
  note.textContent = 'Inline export preview is not available for this file type.'
  note.style.padding = '12px 14px'
  note.style.background = '#f8fafc'
  note.style.border = '1px solid #e2e8f0'
  note.style.borderRadius = '8px'
  note.style.fontSize = '13px'
  wrapper.appendChild(note)

  return wrapper
}

const renderDomToCanvas = async (node) => {
  return html2canvas(node, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })
}

const addCanvasAsPage = (pdf, canvas, { addNewPage = false } = {}) => {
  if (addNewPage) {
    pdf.addPage()
  }

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const pageMargin = 10
  const targetWidth = pdfWidth - pageMargin * 2
  const targetHeight = pdfHeight - pageMargin * 2

  const widthRatio = targetWidth / canvas.width
  const heightRatio = targetHeight / canvas.height
  const scale = Math.min(widthRatio, heightRatio)

  const renderWidth = canvas.width * scale
  const renderHeight = canvas.height * scale
  const x = (pdfWidth - renderWidth) / 2
  const y = pageMargin

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, renderWidth, renderHeight)
}

const addCanvasPaginated = (pdf, canvas, { addNewPage = false } = {}) => {
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const pageMargin = 10
  const usableWidth = pdfWidth - pageMargin * 2
  const usableHeight = pdfHeight - pageMargin * 2

  const scale = usableWidth / canvas.width
  const sliceHeightPx = Math.floor(usableHeight / scale)

  let offsetY = 0
  let firstPage = true

  while (offsetY < canvas.height) {
    if (!firstPage || addNewPage) {
      pdf.addPage()
    }

    const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = currentSliceHeight

    const ctx = pageCanvas.getContext('2d')
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      canvas.width,
      currentSliceHeight
    )

    const renderHeight = currentSliceHeight * scale
    pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', pageMargin, pageMargin, usableWidth, renderHeight)

    offsetY += currentSliceHeight
    firstPage = false
    addNewPage = false
  }
}

const renderPlotHtmlToImage = async (html) => {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '1280px'
  iframe.style.height = '900px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.srcdoc = html
  document.body.appendChild(iframe)

  try {
    return await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Plot render timed out')), 20000)

      iframe.onload = async () => {
        try {
          const frameWindow = iframe.contentWindow
          const frameDocument = iframe.contentDocument || frameWindow?.document

          if (!frameWindow || !frameDocument) {
            throw new Error('Unable to access plot frame')
          }

          const waitForPlotly = async () => {
            const started = Date.now()

            while (Date.now() - started < 15000) {
              const plotlyLib = frameWindow.Plotly
              const plotNode = frameDocument.querySelector('.js-plotly-plot')

              if (plotlyLib && plotNode) {
                return { plotlyLib, plotNode }
              }

              await new Promise((r) => window.setTimeout(r, 200))
            }

            throw new Error('Plotly graph not ready')
          }

          const { plotlyLib, plotNode } = await waitForPlotly()

          await new Promise((r) => window.setTimeout(r, 1200))
          await plotlyLib.Plots.resize(plotNode)

          const imageUrl = await plotlyLib.toImage(plotNode, {
            format: 'png',
            width: 1180,
            height: 680,
            scale: 2,
          })

          window.clearTimeout(timeout)
          resolve(imageUrl)
        } catch (error) {
          window.clearTimeout(timeout)
          reject(error)
        }
      }
    })
  } finally {
    iframe.remove()
  }
}

const buildPlotsExportDom = async (plotItems = []) => {
  const wrapper = document.createElement('div')
  wrapper.style.background = '#ffffff'
  wrapper.style.padding = '24px'
  wrapper.style.width = '1000px'
  wrapper.style.fontFamily = 'Arial, sans-serif'
  wrapper.style.color = '#0f172a'

  if (!plotItems.length) {
    const note = document.createElement('div')
    note.textContent = 'No saved plots were found for this raw file.'
    note.style.padding = '12px 14px'
    note.style.background = '#f8fafc'
    note.style.border = '1px solid #e2e8f0'
    note.style.borderRadius = '8px'
    note.style.fontSize = '13px'
    wrapper.appendChild(note)
    return wrapper
  }

  for (const plot of plotItems) {
    const section = document.createElement('div')
    section.style.marginBottom = '24px'
    section.style.pageBreakInside = 'avoid'

    const title = document.createElement('h2')
    title.textContent = plot.name || plot.filename || 'Plot'
    title.style.margin = '0 0 8px'
    title.style.fontSize = '18px'
    title.style.color = '#0f172a'
    section.appendChild(title)

    const meta = document.createElement('div')
    meta.textContent = `${plot.chart_type || '-'} | ${formatDateTime(plot.created_at)}`
    meta.style.fontSize = '13px'
    meta.style.color = '#475569'
    meta.style.marginBottom = '12px'
    section.appendChild(meta)

    try {
      const html = await visualizationApi.html(plot.viz_id)
      const imageUrl = await renderPlotHtmlToImage(html)

      const img = document.createElement('img')
      img.src = imageUrl
      img.style.width = '100%'
      img.style.display = 'block'
      img.style.border = '1px solid #e2e8f0'
      img.style.borderRadius = '8px'
      img.style.background = '#ffffff'
      section.appendChild(img)

      await new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
      })
    } catch (err) {
      console.error('Failed to render plot in PDF export:', plot?.viz_id, err)

      const note = document.createElement('div')
      note.textContent = `Plot preview could not be generated for viz ${plot?.viz_id}`
      note.style.padding = '12px 14px'
      note.style.background = '#f8fafc'
      note.style.border = '1px solid #e2e8f0'
      note.style.borderRadius = '8px'
      note.style.fontSize = '13px'
      section.appendChild(note)
    }

    wrapper.appendChild(section)
  }

  return wrapper
}

export default function TagDetails({ projectId, datasetType, tagName, onBack }) {
  const { user } = useContext(AuthContext)
  const role = user?.role?.toUpperCase?.()
  const canDelete = role === 'GD' || role === 'DH'

  const [files, setFiles] = useState([])
  const [tab, setTab] = useState('raw')
  const [plots, setPlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    file: null,
  })

  const { showLoader, hideLoader } = useLoader()

  useEffect(() => {
    setLoading(true)
    setError('')

    ingestionApi
      .listFilesInTag(projectId, datasetType, tagName)
      .then((data) => setFiles(data || []))
      .catch((err) => {
        console.error(err)
        setFiles([])
        setError('Failed to load files.')
      })
      .finally(() => setLoading(false))
  }, [projectId, datasetType, tagName])

  useEffect(() => {
    if (tab !== 'plot') return

    setLoading(true)
    setError('')

    visualizationApi
      .listForProject(projectId)
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data || []

        const filtered = list.filter(
          (v) =>
            v.tag_name?.trim().toLowerCase() === tagName?.trim().toLowerCase() &&
            v.dataset_type?.trim().toLowerCase() === datasetType?.trim().toLowerCase()
        )

        setPlots(filtered)
      })
      .catch((err) => {
        console.error(err)
        setPlots([])
        setError('Failed to load plots.')
      })
      .finally(() => setLoading(false))
  }, [tab, projectId, datasetType, tagName])

  const rows =
    tab === 'plot'
      ? plots
      : tab === 'raw'
        ? files.filter(isRawFile)
        : tab === 'processed'
          ? files.filter(isProcessedFile)
          : tab === 'others'
            ? files.filter(isOtherFile)
            : []

  const rawFiles = files.filter(isRawFile)
  const exportTargetFile = rawFiles[0] || null

  const handleView = (file, tabName) => {
    if (tabName === 'plot') {
      openPlotFullScreen(file)
      return
    }

    if (tabName === 'processed' && file.processed_key) {
      window.open(`/processed-preview/${file.job_id}?edit=1`, '_blank', 'noopener,noreferrer')
      return
    }

    if (tabName === 'raw') {
      window.open(`/raw-preview/${file.job_id}`, '_blank', 'noopener,noreferrer')
      return
    }

    ingestionApi.download(file.job_id).then(({ url }) => triggerDownload(url, file.filename))
  }

  const handleDownload = async (file) => {
    try {
      if (tab === 'plot') {
        const { url } = await visualizationApi.download(file.viz_id)
        await forceDownloadFromUrl(url, file.filename || 'visualization.html')
      } else {
        const { url } = await ingestionApi.download(file.job_id)
        await forceDownloadFromUrl(url, file.filename)
      }
    } catch (err) {
      console.error(err)
      window.alert('Download failed')
    }
  }

  const handleExportPdf = async (file) => {
    let mountNode = null

    try {
      showLoader('Preparing PDF export...')

      const savedVisualizations = await visualizationApi.listForProject(projectId)
      const allVisualizations = Array.isArray(savedVisualizations)
        ? savedVisualizations
        : savedVisualizations?.data || []

      const matchingPlots = allVisualizations
        .filter((viz) => matchesTagAndDataset(viz, tagName, datasetType))
        .filter((viz) => Array.isArray(viz.series) && viz.series.some((series) => series.job_id === file.job_id))

      const rawContainer = document.createElement('div')
      rawContainer.style.background = '#ffffff'
      rawContainer.style.width = '1000px'
      rawContainer.style.padding = '0'
      rawContainer.style.position = 'absolute'
      rawContainer.style.left = '-99999px'
      rawContainer.style.top = '0'

      const header = document.createElement('div')
      header.style.padding = '24px'
      header.style.fontFamily = 'Arial, sans-serif'
      header.innerHTML = `
        <h1 style="margin:0 0 6px;font-size:22px;color:#0f172a;">
          ${escapeHtml(tagName)} - ${escapeHtml(file.filename)} Export
        </h1>
        <p style="margin:0;font-size:13px;color:#475569;">
          Project: ${escapeHtml(projectId)} | Dataset: ${escapeHtml(datasetType)} | Tag: ${escapeHtml(tagName)}
        </p>
      `
      rawContainer.appendChild(header)

      const rawDom = await buildRawExportDom(file)
      rawContainer.appendChild(rawDom)

      const plotsDom = await buildPlotsExportDom(matchingPlots)

      mountNode = document.createElement('div')
      mountNode.style.position = 'absolute'
      mountNode.style.left = '-99999px'
      mountNode.style.top = '0'
      mountNode.appendChild(rawContainer)
      mountNode.appendChild(plotsDom)
      document.body.appendChild(mountNode)

      const rawCanvas = await renderDomToCanvas(rawContainer)
      const pdf = new jsPDF('p', 'mm', 'a4')
      addCanvasPaginated(pdf, rawCanvas)

      const plotSections = Array.from(plotsDom.children || [])
      for (const plotSection of plotSections) {
        const plotCanvas = await renderDomToCanvas(plotSection)
        addCanvasAsPage(pdf, plotCanvas, { addNewPage: true })
      }

      await pdf.save(`${tagName}-${file.filename}-export.pdf`, { returnPromise: true })

      const normalizedDatasetType = String(datasetType || '').trim().toLowerCase()
      if (['cfd', 'wind', 'flight'].includes(normalizedDatasetType)) {
        try {
          await projectApi.trackReportExport({
            project_id: projectId,
            dataset_type: normalizedDatasetType,
            tag_name: tagName,
          })
        } catch (trackErr) {
          console.error('Failed to track report export', trackErr)
        }
      }
    } catch (err) {
      console.error(err)
      window.alert(err?.message || 'Failed to export PDF')
    } finally {
      if (mountNode && mountNode.parentNode) {
        mountNode.parentNode.removeChild(mountNode)
      }
      hideLoader()
    }
  }

  const handleDeleteFile = async () => {
    if (!confirmDelete.file) return

    const fileToDelete = confirmDelete.file
    const isPlotTab = tab === 'plot'

    setConfirmDelete({ open: false, file: null })

    try {
      showLoader(isPlotTab ? 'Deleting plot...' : 'Deleting file...')

      if (isPlotTab) {
        await visualizationApi.remove(fileToDelete.viz_id)
        setPlots((prev) => prev.filter((p) => p.viz_id !== fileToDelete.viz_id))
      } else {
        await ingestionApi.remove(fileToDelete.job_id)
        setFiles((prev) => prev.filter((f) => f.job_id !== fileToDelete.job_id))
      }
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || 'Delete failed')
    } finally {
      hideLoader()
    }
  }

  const showEmptyState = !loading && !error && rows.length === 0

  return (
    <div style={{ background: '#ffffff', gap: '10px', padding: '20px', width: '100%', height: '100%', border: '1px solid #00000026', borderRadius: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: '#ffffff', border: 'none' }} type="button">
            <img style={{ width: '24px', height: '24px' }} src={ArrowLeft} alt="arrow" />
          </button>
          <label style={{ color: '#000000', fontFamily: '"Inter-Regular",Helvetica', fontSize: '16px', fontWeight: '600' }}>{tagName}</label>
        </div>

        {tab === 'raw' && exportTargetFile && (
          <button
            onClick={() => handleExportPdf(exportTargetFile)}
            type="button"
            style={{
              minWidth: '50px',
              height: '38px',
              border: 'none',
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '600',
              color: '#0f172a',
            }}
          >
            <img style={{ width: '30px', height: '30px' }} src={DownloadSimple} alt="download" />
          </button>
        )}
      </div>

      <div className="tablist">
        <button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>Raw</button>
        <button className={tab === 'processed' ? 'active' : ''} onClick={() => setTab('processed')}>Processed</button>
        <button className={tab === 'plot' ? 'active' : ''} onClick={() => setTab('plot')}>Plot</button>
        <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>Others</button>
      </div>

      <table className="DataTable">
        <thead>
          <tr>
            <th className="tablehead">
              <span className="th-content">
                <img style={{ width: '20px', height: '20px' }} src={Folder1} alt="folder" />
                {tab === 'plot' ? 'Plot Name' : 'File Name'}
              </span>
            </th>
            <th className="tablehead">
              <span className="th-content">
                <img style={{ width: '20px', height: '20px' }} src={CalendarBlank} alt="calendar" />
                Created Date
              </span>
            </th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {loading && rows.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 16, textAlign: 'center' }}>
                Loading {tab === 'plot' ? 'plots' : 'files'}...
              </td>
            </tr>
          )}

          {!loading && error && (
            <tr>
              <td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#b42318' }}>
                {error}
              </td>
            </tr>
          )}

          {showEmptyState && (
            <tr>
              <td colSpan={3} style={{ padding: 16, textAlign: 'center' }}>
                No {tab === 'plot' ? 'plots' : 'files'} found.
              </td>
            </tr>
          )}

          {rows.map((f) => (
            <tr key={tab === 'plot' ? f.viz_id : f.job_id}>
              <td style={{ color: '#000000', fontFamily: 'inter-regular,Helvetica', fontSize: '14px', fontWeight: '400' }}>
                <div style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                  <img style={{ width: '20px', height: '20px' }} src={Folder1} alt="folder" />

                  {tab === 'plot' ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <p className="data-card__name" style={{ margin: 0 }}>
                        {f.name || f.filename || 'Plot'}
                      </p>
                      <p className="summarylabel2" style={{ margin: 0 }}>
                        {f.chart_type} · {f.status}
                      </p>
                    </div>
                  ) : (
                    f.sheet_name ? `${f.filename} — ${f.sheet_name}` : f.filename
                  )}
                </div>
              </td>

              <td style={{ color: '#000000', fontFamily: 'inter-regular,Helvetica', fontSize: '14px', fontWeight: '400' }}>
                <div style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                  <img style={{ width: '20px', height: '20px' }} src={CalendarBlank} alt="calendar" />
                  {formatDateTimeShort(f.created_at)}
                </div>
              </td>

              <td style={{ verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'left', justifyContent: 'left' }}>
                  <button
                    onClick={() => handleView(f, tab)}
                    title="View"
                    style={{
                      background: '#ffffff',
                      border: '0.67px solid #0000001A',
                      width: '40px',
                      height: '35px',
                      borderRadius: '8px',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    type="button"
                  >
                    <img style={{ width: '20px', height: '20px' }} src={ViewIcon} alt="view" />
                  </button>

                  {tab !== 'plot' && tab !== 'processed' && (
                    <button
                      onClick={() => handleDownload(f)}
                      title="Download"
                      style={{
                        background: '#ffffff',
                        border: '0.67px solid #0000001A',
                        width: '40px',
                        height: '35px',
                        borderRadius: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      type="button"
                    >
                      <img style={{ width: '20px', height: '20px' }} src={DownloadSimple} alt="download" />
                    </button>
                  )}

                  <button
                    onClick={() => canDelete && setConfirmDelete({ open: true, file: f })}
                    title={canDelete ? 'Delete' : 'Only GD/DH can delete'}
                    style={{
                      background: '#ffffff',
                      border: '0.67px solid #0000001A',
                      width: '40px',
                      height: '35px',
                      borderRadius: '8px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: canDelete ? 1 : 0.4,
                      cursor: canDelete ? 'pointer' : 'not-allowed',
                    }}
                    type="button"
                    disabled={!canDelete}
                  >
                    <img style={{ width: '20px', height: '20px' }} src={Delete} alt="delete" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmDelete.open && (
        <ConfirmationModal
          title={`Delete "${tab === 'plot'
            ? (confirmDelete.file?.name || confirmDelete.file?.filename || 'Visualization')
            : confirmDelete.file?.filename}"?`}
          description="This action cannot be undone."
          onCancel={() => setConfirmDelete({ open: false, file: null })}
          onConfirm={handleDeleteFile}
        />
      )}
    </div>
  )
}
