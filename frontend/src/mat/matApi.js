import { axiosClient } from '../lib/axiosClient'

export const matApi = {
  variables: async (jobId) => {
    const { data } = await axiosClient.get(`/api/mat/${jobId}/variables`)
    return data
  },

  preview: async (jobId, varName) => {
    const { data } = await axiosClient.get(
      `/api/mat/${jobId}/variable/${encodeURIComponent(varName)}/preview`
    )
    return data
  },

  variableData: async (jobId, varName, options = {}) => {
    const { data } = await axiosClient.get(
      `/api/mat/${jobId}/variable/${encodeURIComponent(varName)}/data`,
      {
        params: {
          slice_expr: options.sliceExpr || undefined,
          max_rows: options.maxRows || undefined,
          max_cols: options.maxCols || undefined,
          max_pages: options.maxPages || undefined,
        },
      }
    )
    return data
  },

  deleteDerived: async (jobId, varName) => {
    const { data } = await axiosClient.delete(
      `/api/mat/${jobId}/derived/${encodeURIComponent(varName)}`
    )
    return data
  },
}
