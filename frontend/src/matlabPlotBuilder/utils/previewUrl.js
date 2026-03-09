export const getMatPreviewUrl = ({ projectId, datasetType, tagName, jobId }) => {
  const safeJobId = String(jobId || '').trim()
  if (safeJobId) {
    // Existing MAT preview page used from Tag Details actions.
    return `/raw-preview/${encodeURIComponent(safeJobId)}`
  }

  const safeProjectId = String(projectId || '').trim()
  const safeDataset = String(datasetType || '').trim()
  const safeTag = String(tagName || '').trim()
  if (safeProjectId && safeDataset && safeTag) {
    return `/projects/${encodeURIComponent(safeProjectId)}/data/${encodeURIComponent(safeDataset)}/${encodeURIComponent(safeTag)}`
  }

  return ''
}

export const openMatPreviewInNewTab = (params) => {
  const url = getMatPreviewUrl(params)
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}
