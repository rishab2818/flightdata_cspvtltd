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

  list: async (approvalStatus, projectId) => {
    const params = {};
    if (approvalStatus) {
      params.approval_status = approvalStatus;
    }
    if (projectId) {
      params.project_id = projectId;
    }
    const { data } = await axiosClient.get("/api/student-engagements", {
      params,
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

  update: async (recordId, payload) => {
    const { data } = await axiosClient.put(
      `/api/student-engagements/${recordId}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  },

  remove: async (recordId) => {
    await axiosClient.delete(`/api/student-engagements/${recordId}`);
  },

  downloadUrl: async (recordId) => {
    const { data } = await axiosClient.get(
      `/api/student-engagements/${recordId}/download-url`
    );
    return data;
  },
};
