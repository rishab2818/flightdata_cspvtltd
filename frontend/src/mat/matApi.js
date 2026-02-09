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
}
