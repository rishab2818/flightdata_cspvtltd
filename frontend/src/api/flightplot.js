// src/api/flightplot.js
//
// API helper functions for the flight plot endpoints. This module uses
// the shared axiosClient to automatically include the base URL and
// bearer token on each request. Functions return the response data
// directly.

import { axiosClient } from '../lib/axiosClient';

export const flightplotApi = {
  /**
   * Create a new plot. Returns metadata including plot_id.
   * @param {object} payload
   */
  init: async (payload) => {
    const { data } = await axiosClient.post('/api/flightplots/init', payload);
    return data;
  },

  /**
   * Get status and progress of a plot.
   * @param {string} plotId
   */
  status: async (plotId) => {
    const { data } = await axiosClient.get(`/api/flightplots/${plotId}/status`);
    return data;
  },

  /**
   * List all plots for a project visible to the current user.
   * @param {string} projectId
   */
  list: async (projectId) => {
    const { data } = await axiosClient.get('/api/flightplots', { params: { project_id: projectId } });
    return data;
  },

  /**
   * Delete a plot by id.
   * @param {string} plotId
   */
  delete: async (plotId) => {
    const { data } = await axiosClient.delete(`/api/flightplots/${plotId}`);
    return data;
  },

  /**
   * Share a plot with another user by email.
   * @param {string} plotId
   * @param {string} userEmail
   */
  share: async (plotId, userEmail) => {
    const { data } = await axiosClient.post(`/api/flightplots/${plotId}/share`, { user_email: userEmail });
    return data;
  },

  /**
   * Generate a presigned download URL for the rendered plot.
   * @param {string} plotId
   */
  downloadUrl: async (plotId) => {
    const { data } = await axiosClient.get(`/api/flightplots/${plotId}/download-url`);
    return data;
  },
};