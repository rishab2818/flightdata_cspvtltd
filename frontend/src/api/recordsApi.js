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

  // Divisional Records
  listDivisional: async () => {
    const { data } = await axiosClient.get("/api/records/divisional-records");
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

  // Customer Feedbacks
  listFeedbacks: async () => {
    const { data } = await axiosClient.get("/api/records/customer-feedbacks");
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

  // Technical Reports
  listTechnical: async () => {
    const { data } = await axiosClient.get("/api/records/technical-reports");
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

  // Training Records
  listTraining: async () => {
    const { data } = await axiosClient.get("/api/records/training-records");
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
};
