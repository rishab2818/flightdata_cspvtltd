import { axiosClient } from "../../../lib/axiosClient";

export const taskAcknowledgementsApi = {
  async listPending(limit = 10) {
    const { data } = await axiosClient.get("/api/task-acknowledgements/pending", {
      params: { limit },
    });
    return data;
  },

  async acknowledge(acknowledgementId) {
    const { data } = await axiosClient.post(
      `/api/task-acknowledgements/${acknowledgementId}/acknowledge`
    );
    return data;
  },
};
