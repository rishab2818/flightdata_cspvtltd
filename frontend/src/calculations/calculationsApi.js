import { axiosClient } from '../lib/axiosClient'

export const calculationsApi = {
  functions: async (query = '') => {
    const params = query ? { query } : undefined
    const { data } = await axiosClient.get('/api/calculations/functions', { params })
    return data
  },

  validateFormula: async (formulaExpression) => {
    const { data } = await axiosClient.post('/api/calculations/validate', {
      formula_expression: formulaExpression,
    })
    return data
  },

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
