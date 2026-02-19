// src/api/recordsApi.js
import { axiosClient } from "../lib/axiosClient";

export const recordsApi = {
  initUpload: async (section, payload) => {
    const { data } = await axiosClient.post(
      `/api/records/${section}/init-upload`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },

  // Inventory Records
  listInventory: async () => {
    const { data } = await axiosClient.get("/api/records/inventory-records");
    return data;
  },
  createInventory: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/records/inventory-records",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  updateInventory: async (recordId, payload) => {
    const { data } = await axiosClient.put(
      `/api/records/inventory-records/${recordId}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  removeInventory: async (recordId) => {
    await axiosClient.delete(`/api/records/inventory-records/${recordId}`);
  },
  downloadInventory: async (recordId) => {
    const { data } = await axiosClient.get(
      `/api/records/inventory-records/${recordId}/download-url`
    );
    return data;
  },

  // Divisional Records
  listDivisional: async (projectId) => {
    const { data } = await axiosClient.get("/api/records/divisional-records", {
      params: projectId ? { project_id: projectId } : undefined,
    });
    return data;
  },
  createDivisional: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/records/divisional-records",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  updateDivisional: async (recordId, payload) => {
    const { data } = await axiosClient.put(
      `/api/records/divisional-records/${recordId}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  removeDivisional: async (recordId) => {
    await axiosClient.delete(`/api/records/divisional-records/${recordId}`);
  },
  downloadDivisional: async (recordId) => {
    const { data } = await axiosClient.get(
      `/api/records/divisional-records/${recordId}/download-url`
    );
    return data;
  },

  // Customer Feedbacks
  listFeedbacks: async (projectId) => {
    const { data } = await axiosClient.get("/api/records/customer-feedbacks", {
      params: projectId ? { project_id: projectId } : undefined,
    });
    return data;
  },
  createFeedback: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/records/customer-feedbacks",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  updateFeedback: async (recordId, payload) => {
    const { data } = await axiosClient.put(
      `/api/records/customer-feedbacks/${recordId}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  removeFeedback: async (recordId) => {
    await axiosClient.delete(`/api/records/customer-feedbacks/${recordId}`);
  },
  downloadFeedback: async (recordId) => {
    const { data } = await axiosClient.get(
      `/api/records/customer-feedbacks/${recordId}/download-url`
    );
    return data;
  },

  // Technical Reports
  listTechnical: async (projectId) => {
    const { data } = await axiosClient.get("/api/records/technical-reports", {
      params: projectId ? { project_id: projectId } : undefined,
    });
    return data;
  },
  createTechnical: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/records/technical-reports",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  updateTechnical: async (recordId, payload) => {
    const { data } = await axiosClient.put(
      `/api/records/technical-reports/${recordId}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  removeTechnical: async (recordId) => {
    await axiosClient.delete(`/api/records/technical-reports/${recordId}`);
  },
  downloadTechnical: async (recordId) => {
    const { data } = await axiosClient.get(
      `/api/records/technical-reports/${recordId}/download-url`
    );
    return data;
  },

  // Training Records
  listTraining: async (projectId) => {
    const { data } = await axiosClient.get("/api/records/training-records", {
      params: projectId ? { project_id: projectId } : undefined,
    });
    return data;
  },
  createTraining: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/records/training-records",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  updateTraining: async (recordId, payload) => {
    const { data } = await axiosClient.put(
      `/api/records/training-records/${recordId}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  removeTraining: async (recordId) => {
    await axiosClient.delete(`/api/records/training-records/${recordId}`);
  },
  downloadTraining: async (recordId) => {
    const { data } = await axiosClient.get(
      `/api/records/training-records/${recordId}/download-url`
    );
    return data;
  },
};
