import { axiosClient } from '../lib/axiosClient'

export const ingestionApi = {
  start: async (projectId, file, options = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (options.datasetType) form.append('dataset_type', options.datasetType)
    if (options.headerMode) form.append('header_mode', options.headerMode)
    if (options.customHeaders?.length) {
      form.append('custom_headers', JSON.stringify(options.customHeaders))
    }
    const { data } = await axiosClient.post(`/api/ingestion/${projectId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: options.onUploadProgress,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })
    return data
  },
  list: async (projectId) => {
    const { data } = await axiosClient.get(`/api/ingestion/project/${projectId}`)
    return data
  },
  status: async (jobId) => {
    const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/status`)
    return data
  },
  detail: async (jobId) => {
    const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}`)
    return data
  },
  download: async (jobId) => {
    const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/download`)
    return data
  },
  remove: async (jobId) => {
    const { data } = await axiosClient.delete(`/api/ingestion/jobs/${jobId}`)
    return data
  },
}
