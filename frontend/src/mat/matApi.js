import { axiosClient } from '../lib/axiosClient'

export const matApi = {
  inspect: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axiosClient.post('/api/mat/inspect', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}
