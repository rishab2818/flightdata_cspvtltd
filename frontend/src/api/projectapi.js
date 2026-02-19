// src/api/projectapi.js
import { axiosClient } from '../lib/axiosClient';

export const projectApi = {
  // GET http://127.0.0.1:8000/api/projects/count
  // axiosClient already handles baseURL + token header
  getCounts: async () => {
    const { data } = await axiosClient.get('/api/projects/count');
    return data; // expected shape: see comment in StatsCards
  },
  list: async () => {
    const { data } = await axiosClient.get('/api/projects');
    return data;
  },
  create: async (payload) => {
    const { data } = await axiosClient.post('/api/projects', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },
  memberSearch: async (q) => {
    if (!q) return [];
    const { data } = await axiosClient.get('/api/projects/member-search', {
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
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },
  patchMembers: async (projectId, payload) => {
    const { data } = await axiosClient.patch(`/api/projects/${projectId}/members`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },
};
