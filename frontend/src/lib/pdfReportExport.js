import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const PDF_RENDER_SCALE = 2

export const isPdfPreviewDetail = (detail) => detail?.kind === 'pdf' && detail?.download_url

export const renderPdfPagesToCanvases = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Unable to load raw PDF')
  }

  const data = await response.arrayBuffer()
  const documentTask = pdfjsLib.getDocument({ data })
  const pdfDocument = await documentTask.promise
  const canvases = []

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    await page.render({
      canvasContext: context,
      viewport,
    }).promise

    canvases.push(canvas)
  }

  await pdfDocument.destroy()
  return canvases
}

export const addCanvasToPdfPage = (pdf, canvas, { addNewPage = false } = {}) => {
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
  const y = (pdfHeight - renderHeight) / 2

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, renderWidth, renderHeight)
}

export const sanitizeReportFilenamePart = (value, fallback) => {
  const normalized = String(value || '')
    .trim()
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

export const buildReportExportFilename = ({ tagName, datasetType }) => {
  const tag = sanitizeReportFilenamePart(tagName, 'tag')
  const dataset = sanitizeReportFilenamePart(datasetType, 'dataset')
  return `${tag}-${dataset}-report-export.pdf`
}
