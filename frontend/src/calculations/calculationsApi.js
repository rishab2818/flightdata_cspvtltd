import { axiosClient } from '../lib/axiosClient'

export const calculationsApi = {
  catalog: async () => {
    const { data } = await axiosClient.get('/api/calculations/catalog')
    return data
  },

  preview: async (jobId, payload) => {
    const { data } = await axiosClient.post(`/api/calculations/jobs/${jobId}/preview`, payload)
    return data
  },

  materialize: async (jobId, payload) => {
    const { data } = await axiosClient.post(`/api/calculations/jobs/${jobId}/materialize`, payload)
    return data
  },
}

