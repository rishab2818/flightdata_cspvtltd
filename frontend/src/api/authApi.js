import { axiosClient } from '../lib/axiosClient'
export const authApi = {
  login: async (email, password) => {
    const { data } = await axiosClient.post('/api/auth/login', { email, password })
    return data
  },
}
