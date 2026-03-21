// src/api/projectapi.js
import { axiosClient } from "../lib/axiosClient";

export const projectApi = {
  getCounts: async () => {
    const { data } = await axiosClient.get("/api/projects/count");
    return data;
  },
  list: async (pagination = {}) => {
    const { page = 1, limit = 30 } = pagination;
    const { data } = await axiosClient.get('/api/projects', { params: { page, limit } });
    return data;
  },
  create: async (payload) => {
    const { data } = await axiosClient.post("/api/projects", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  },
  memberSearch: async (q) => {
    if (!q) return [];
    const { data } = await axiosClient.get("/api/projects/member-search", {
      params: { q },
    });
    return data;
  },
  getById: async (projectId) => {
    const { data } = await axiosClient.get(`/api/projects/${projectId}`);
    return data;
  },
  update: async (projectId, payload) => {
    const { data } = await axiosClient.patch(`/api/projects/${projectId}`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  },
  patchMembers: async (projectId, payload) => {
    const { data } = await axiosClient.patch(`/api/projects/${projectId}/members`, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  },

//   // Project-only file search
//   searchFiles: async (projectId, query) => {
//     if (!query) return [];
//     const { data } = await axiosClient.get(`/api/projects/${projectId}/search`, {
//       params: { q: query },
//     });
//     return data;
//   },

//   // ✅ Global search across all files in the app
//   searchAllFiles: async (query) => {
//   if (!query) return [];
//   const { data } = await axiosClient.get("/api/files/search", { params: { q: query } });
//   return data;
// },
};
