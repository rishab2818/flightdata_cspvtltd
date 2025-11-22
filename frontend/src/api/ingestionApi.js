import { axiosClient } from '../lib/axiosClient'

export const ingestionApi = {
  start: async (projectId, file) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axiosClient.post(`/api/ingestion/${projectId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
}
