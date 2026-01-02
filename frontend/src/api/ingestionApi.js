

// import { axiosClient } from '../lib/axiosClient'

// export const ingestionApi = {
//   start: async (projectId, file, options = {}) => {
//     const form = new FormData()
//     form.append('file', file)
//     if (options.datasetType) form.append('dataset_type', options.datasetType)
//     if (options.headerMode) form.append('header_mode', options.headerMode)
//     if (options.customHeaders?.length) {
//       form.append('custom_headers', JSON.stringify(options.customHeaders))
//     }
//     const { data } = await axiosClient.post(`/api/ingestion/${projectId}`, form, {
//       headers: { 'Content-Type': 'multipart/form-data' },
//       onUploadProgress: options.onUploadProgress,
//       maxContentLength: Infinity,
//       maxBodyLength: Infinity,
//     })
//     return data
//   },

//   // ✅ NEW: batch upload
//   startBatch: async (projectId, files = [], options = {}) => {
//     const form = new FormData()

//     files.forEach((f) => form.append('files', f))

//     if (options.datasetType) form.append('dataset_type', options.datasetType)
//     if (options.tagName) form.append('tag_name', options.tagName)

//     if (options.headerMode) form.append('header_mode', options.headerMode)
//     if (options.customHeaders?.length) form.append('custom_headers', JSON.stringify(options.customHeaders))

//     // manifest = array aligned with files order: [{ visualize: true/false }]
//     form.append('manifest', JSON.stringify(options.manifest || files.map(() => ({ visualize: false }))))

//     const { data } = await axiosClient.post(`/api/ingestion/${projectId}/batch`, form, {
//       headers: { 'Content-Type': 'multipart/form-data' },
//       onUploadProgress: options.onUploadProgress,
//       maxContentLength: Infinity,
//       maxBodyLength: Infinity,
//     })
//     return data
//   },

//   list: async (projectId) => {
//     const { data } = await axiosClient.get(`/api/ingestion/project/${projectId}`)
//     return data
//   },
//   status: async (jobId) => {
//     const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/status`)
//     return data
//   },
//   detail: async (jobId) => {
//     const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}`)
//     return data
//   },
//   download: async (jobId) => {
//     const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/download`)
//     return data
//   },
//   remove: async (jobId) => {
//     const { data } = await axiosClient.delete(`/api/ingestion/jobs/${jobId}`)
//     return data
//   },
//   // for the fetching the data 
//   listTags: async (projectId, datasetType) => {
//     const { data } = await axiosClient.get(`/api/ingestion/project/${projectId}/tags`, {
//       params: { dataset_type: datasetType }
//     })
//     return data
//   },

//   listFilesInTag: async (projectId, datasetType, tagName) => {
//     const { data } = await axiosClient.get(`/api/ingestion/project/${projectId}/tag/${encodeURIComponent(tagName)}`, {
//       params: { dataset_type: datasetType }
//     })
//     return data
//   },

//   listFilesInTag: async (projectId, datasetType, tagName) => {
//     const { data } = await axiosClient.get(
//       `/api/ingestion/project/${projectId}/tag/${encodeURIComponent(tagName)}`,
//       { params: { dataset_type: datasetType } }
//     )
//     return data
//   },

//   // For the rename 
//   renameTag: async (projectId, datasetType, oldTag, newTag) => {
//     const { data } = await axiosClient.put(`/api/ingestion/project/${projectId}/tag/rename`, {
//       dataset_type: datasetType,
//       old_tag: oldTag,
//       new_tag: newTag,
//     })
//     return data
//   },
//   // Api for the preview and save processed columns 
//   getProcessedPreview: async (jobId, limit = 20) => {
//     const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/processed/preview`, {
//       params: { limit }
//     })
//     return data
//   },

//   saveProcessedColumns: async (jobId, renameMap) => {
//     const { data } = await axiosClient.put(`/api/ingestion/jobs/${jobId}/processed/columns`, {
//       rename_map: renameMap
//     })
//     return data
//   },



// }
import { axiosClient } from '../lib/axiosClient'

export const ingestionApi = {
  start: async (projectId, file, options = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (options.datasetType) form.append('dataset_type', options.datasetType)
    if (options.headerMode) form.append('header_mode', options.headerMode)
    if (options.customHeaders?.length) {
      form.append('custom_headers', JSON.stringify(options.customHeaders))
    }
    const { data } = await axiosClient.post(`/api/ingestion/${projectId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: options.onUploadProgress,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })
    return data
  },

  // ✅ NEW: batch upload
  startBatch: async (projectId, files = [], options = {}) => {
    const form = new FormData()

    files.forEach((f) => form.append('files', f))

    if (options.datasetType) form.append('dataset_type', options.datasetType)
    if (options.tagName) form.append('tag_name', options.tagName)

    if (options.headerMode) form.append('header_mode', options.headerMode)
    if (options.customHeaders?.length) form.append('custom_headers', JSON.stringify(options.customHeaders))

    // manifest = array aligned with files order: [{ visualize: true/false }]
    form.append('manifest', JSON.stringify(options.manifest || files.map(() => ({ visualize: false }))))

    const { data } = await axiosClient.post(`/api/ingestion/${projectId}/batch`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: options.onUploadProgress,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })
    return data
  },

  list: async (projectId) => {
    const { data } = await axiosClient.get(`/api/ingestion/project/${projectId}`)
    return data
  },
  status: async (jobId) => {
    const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/status`)
    return data
  },
  detail: async (jobId) => {
    const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}`)
    return data
  },
  download: async (jobId) => {
    const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/download`)
    return data
  },
  remove: async (jobId) => {
    const { data } = await axiosClient.delete(`/api/ingestion/jobs/${jobId}`)
    return data
  },
  // for the fetching the data 
  listTags: async (projectId, datasetType) => {
    const { data } = await axiosClient.get(`/api/ingestion/project/${projectId}/tags`, {
      params: { dataset_type: datasetType }
    })
    return data
  },

  listFilesInTag: async (projectId, datasetType, tagName) => {
    const { data } = await axiosClient.get(`/api/ingestion/project/${projectId}/tag/${encodeURIComponent(tagName)}`, {
      params: { dataset_type: datasetType }
    })
    return data
  },

  listFilesInTag: async (projectId, datasetType, tagName) => {
    const { data } = await axiosClient.get(
      `/api/ingestion/project/${projectId}/tag/${encodeURIComponent(tagName)}`,
      { params: { dataset_type: datasetType } }
    )
    return data
  },

  // For the rename 
  renameTag: async (projectId, datasetType, oldTag, newTag) => {
    const { data } = await axiosClient.put(`/api/ingestion/project/${projectId}/tag/rename`, {
      dataset_type: datasetType,
      old_tag: oldTag,
      new_tag: newTag,
    })
    return data
  },
  // Api for the preview and save processed columns 
  getProcessedPreview: async (jobId, limit = 20) => {
    const { data } = await axiosClient.get(`/api/ingestion/jobs/${jobId}/processed/preview`, {
      params: { limit }
    })
    return data
  },

  saveProcessedColumns: async (jobId, renameMap) => {
    const { data } = await axiosClient.put(`/api/ingestion/jobs/${jobId}/processed/columns`, {
      rename_map: renameMap
    })
    return data
  },



}