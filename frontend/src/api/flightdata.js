// src/api/flightdata.js
//
// API helper functions for the flight data endpoints.  This module
// uses the shared axiosClient to automatically include the base URL
// and bearer token on each request. Functions return the response
// data directly.

import { axiosClient } from '../lib/axiosClient';

export const flightdataApi = {
  /**
   * List all files for a project. Optionally filter by section.
   *
   * @param {string} projectId
   * @param {string} [section]
   */
  list: async (projectId, section) => {
    const params = { project_id: projectId };
    if (section) params.section = section;
    const { data } = await axiosClient.get('/api/flightdata', { params });
    return data;
  },

  /**
   * Initialise an upload. Returns a presigned URL and metadata.
   * @param {object} payload
   */
  initUpload: async (payload) => {
    const { data } = await axiosClient.post('/api/flightdata/init-upload', payload);
    return data;
  },

  /**
   * Confirm an uploaded file so it is persisted and processed.
   * @param {object} payload
   */
  confirmUpload: async (payload) => {
    const { data } = await axiosClient.post('/api/flightdata/confirm', payload);
    return data;
  },

  /**
   * Delete a file by id.
   * @param {string} fileId
   */
  delete: async (fileId) => {
    const { data } = await axiosClient.delete(`/api/flightdata/${fileId}`);
    return data;
  },

  /**
   * Share a file with another user by email. Only owners can share.
   * @param {string} fileId
   * @param {string} userEmail
   */
  share: async (fileId, userEmail) => {
    const { data } = await axiosClient.post(`/api/flightdata/${fileId}/share`, { user_email: userEmail });
    return data;
  },

  /**
   * Generate a download URL for a file.
   * @param {string} fileId
   */
  downloadUrl: async (fileId) => {
    const { data } = await axiosClient.get(`/api/flightdata/${fileId}/download-url`);
    return data;
  },
};

/**
 * Compute a hex encoded SHA‑256 hash for an ArrayBuffer.
 *
 * Used to deduplicate uploads on the server side. Large files
 * will be read fully into memory; if this becomes a bottleneck
 * consider streaming or chunked hashing.
 * @param {File} file
 */
export async function computeSha256(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}