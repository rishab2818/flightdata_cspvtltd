// src/api/usersApi.js
import { axiosClient } from '../lib/axiosClient';

export const usersApi = {
  list: async () => {
    const { data } = await axiosClient.get('/api/users');
    return data;
  },
  create: async (payload) => {
    const { data } = await axiosClient.post('/api/users', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },
  update: async (email, body) => {
    // e.g. { password: 'NewPass123' } or any partial fields you support
    const { data } = await axiosClient.patch(`/api/users/${encodeURIComponent(email)}`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },
  remove: async (email) => {
    const { data } = await axiosClient.delete(`/api/users/${encodeURIComponent(email)}`);
    return data;
  },
};
