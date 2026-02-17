// import { axiosClient } from '../lib/axiosClient'

// export const visualizationApi = {
//   // create: async (payload) => {
//   //   const { data } = await axiosClient.post('/api/visualizations', payload)
//   //   return data
//   // },
//   create: async (payload) => {
//     return axiosClient.post('/api/visualizations', payload)
//   },

//   listForProject: async (projectId) => {
//     const { data } = await axiosClient.get(`/api/visualizations/project/${projectId}`)
//     return data
//   },
//   detail: async (vizId) => {
//     const { data } = await axiosClient.get(`/api/visualizations/${vizId}`)
//     return data
//   },
//   status: async (vizId) => {
//     const { data } = await axiosClient.get(`/api/visualizations/${vizId}/status`)
//     return data
//   },
//   download: async (vizId) => {
//     const { data } = await axiosClient.get(`/api/visualizations/${vizId}/download`)
//     return data
//   },
//   tileData: async (vizId, params = {}) => {
//     const { data } = await axiosClient.get(`/api/visualizations/${vizId}/tiles`, { params })
//     return data
//   },
//   remove: async (vizId) => {
//     await axiosClient.delete(`/api/visualizations/${vizId}`)
//   },
// }
import { axiosClient } from '../lib/axiosClient'

export const visualizationApi = {
  // ✅ add trailing slash
  create: async (payload) => {
    const { data } = await axiosClient.post('/api/visualizations/', payload)
    return data
  },

  listForProject: async (projectId) => {
    const { data } = await axiosClient.get(`/api/visualizations/project/${projectId}`)
    return data
  },

  detail: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}`)
    return data
  },

  status: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}/status`)
    return data
  },

  download: async (vizId) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}/download`)
    return data
  },

  tileData: async (vizId, params = {}) => {
    const { data } = await axiosClient.get(`/api/visualizations/${vizId}/tiles`, { params })
    return data
  },

  remove: async (vizId) => {
    await axiosClient.delete(`/api/visualizations/${vizId}`)
  },

}
