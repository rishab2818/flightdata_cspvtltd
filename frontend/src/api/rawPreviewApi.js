import { axiosClient } from '../lib/axiosClient'

export const rawPreviewApi = {
  detail: async (jobId) => {
    const { data } = await axiosClient.get(`/api/raw-preview/jobs/${jobId}`)
    return data
  },
  textChunk: async (jobId, params = {}) => {
    const { offset = 0, chunkSize = 262144 } = params
    const { data } = await axiosClient.get(`/api/raw-preview/jobs/${jobId}/text`, {
      params: {
        offset,
        chunk_size: chunkSize,
      },
    })
    return data
  },
  excelPreview: async (jobId, params = {}) => {
    const { sheetName, rowLimit = 50 } = params
    const { data } = await axiosClient.get(`/api/raw-preview/jobs/${jobId}/excel`, {
      params: {
        sheet_name: sheetName || undefined,
        row_limit: rowLimit,
      },
    })
    return data
  },
}
