import { axiosClient } from "../lib/axiosClient";

export const budgetsApi = {
  initUpload: async (payload) => {
    const { data } = await axiosClient.post("/api/budget-forecasts/init-upload", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  },
  list: async () => {
    const { data } = await axiosClient.get("/api/budget-forecasts");
    return data;
  },
  create: async (payload) => {
    const { data } = await axiosClient.post("/api/budget-forecasts", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  },
  update: async (recordId, payload) => {
    const { data } = await axiosClient.put(
      `/api/budget-forecasts/${recordId}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
  remove: async (recordId) => {
    await axiosClient.delete(`/api/budget-forecasts/${recordId}`);
  },
  download: async (recordId) => {
    const { data } = await axiosClient.get(`/api/budget-forecasts/${recordId}/download-url`);
    return data;
  },
};
