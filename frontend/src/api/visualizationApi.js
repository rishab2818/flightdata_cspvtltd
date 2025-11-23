import { axiosClient } from '../lib/axiosClient'

export const visualizationApi = {
  create: async (payload) => {
    const { data } = await axiosClient.post('/api/visualizations', payload)
    return data
  },
  listForProject: async (projectId) => {
    const { data } = await axiosClient.get(`/api/visualizations/project/${projectId}`)
    return data
  },
  detail: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}`)
    return data
  },
  status: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}/status`)
    return data
  },
  download: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}/download`)
    return data
  },
  tileData: async (vizId, params = {}) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}/tiles`, { params })
    return data
  },
  windowData: async (vizId, params = {}) => {
    const response = await axiosClient.get(`/api/visualizations/${vizId}/window`, { params })
    return { data: response.data, headers: response.headers }
  },
}
