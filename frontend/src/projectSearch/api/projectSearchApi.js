import { axiosClient } from '../../lib/axiosClient'

export const projectSearchApi = {
  search: async (projectId, query, limit = 25) => {
    const safeProjectId = String(projectId || '').trim()
    const safeQuery = String(query || '').trim()
    if (!safeProjectId || !safeQuery) return []

    const { data } = await axiosClient.get(
      `/api/projects/${encodeURIComponent(safeProjectId)}/search`,
      {
        params: {
          q: safeQuery,
          limit,
        },
      }
    )
    return Array.isArray(data?.items) ? data.items : []
  },
}
