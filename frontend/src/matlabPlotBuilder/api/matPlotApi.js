import { matApi } from '../../mat/matApi'

export const matPlotApi = {
  listVariables: async (jobId) => {
    const data = await matApi.variables(jobId)
    return data
  },

  variablePreview: async (jobId, varName) => {
    const data = await matApi.preview(jobId, varName)
    return data
  },

  variableDataPreview: async (jobId, varName, sliceExpr = '') => {
    const data = await matApi.variableData(jobId, varName, {
      sliceExpr: String(sliceExpr || '').trim() || undefined,
    })
    return data
  },
}
