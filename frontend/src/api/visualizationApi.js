import { axiosClient } from '../lib/axiosClient'

export const visualizationApi = {
  create: async (projectId, payload) => {
    const { data } = await axiosClient.post(`/api/visualizations/${projectId}`, payload)
    return data
  },
  list: async (projectId) => {
    const { data } = await axiosClient.get(`/api/visualizations/project/${projectId}`)
    return data
  },
  detail: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/jobs/${vizId}`)
    return data
  },
  status: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/jobs/${vizId}/status`)
    return data
  },
  data: async (vizId, { chunkIndex = 0, limit } = {}) => {
    const params = new URLSearchParams()
    params.set('chunk_index', chunkIndex)
    if (limit) params.set('limit', limit)
    const { data } = await axiosClient.get(`/api/visualizations/jobs/${vizId}/data?${params.toString()}`)
    return data
  },
  downloadChunk: async (vizId, chunkIndex = 0) => {
    const { data } = await axiosClient.get(
      `/api/visualizations/jobs/${vizId}/download?chunk_index=${chunkIndex}`
    )
    return data
  },
  image: async (vizId, chunkIndex = 0) => {
    const params = new URLSearchParams()
    params.set('chunk_index', chunkIndex)
    const { data } = await axiosClient.get(
      `/api/visualizations/jobs/${vizId}/image?${params.toString()}`
    )
    return data
  },
}
