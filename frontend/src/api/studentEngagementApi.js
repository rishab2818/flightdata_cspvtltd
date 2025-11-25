import { axiosClient } from "../lib/axiosClient";

export const studentEngagementApi = {
  initUpload: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/student-engagements/init-upload",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },

  list: async (approvalStatus) => {
    const { data } = await axiosClient.get("/api/student-engagements", {
      params: approvalStatus ? { approval_status: approvalStatus } : {},
    });
    return data;
  },

  create: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/student-engagements",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },
};
