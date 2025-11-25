import { axiosClient } from '../lib/axiosClient'

export const notificationsApi = {
  async list(limit = 25) {
    const { data } = await axiosClient.get('/api/notifications', { params: { limit } })
    return data
  },
  async create(payload) {
    const { data } = await axiosClient.post('/api/notifications', payload)
    return data
  },
  async markAsRead(notificationId) {
    await axiosClient.patch(`/api/notifications/${notificationId}/read`)
  },
  async markAllAsRead() {
    await axiosClient.post('/api/notifications/read-all')
  },
}
