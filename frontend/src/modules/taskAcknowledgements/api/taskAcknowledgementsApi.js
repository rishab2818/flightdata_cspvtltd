import { axiosClient } from "../../../lib/axiosClient";

const pendingRequests = new Map();

export async function getPendingAcknowledgements(limit = 10) {
  const requestKey = String(limit);
  const existingRequest = pendingRequests.get(requestKey);

  if (existingRequest) {
    return existingRequest;
  }

  const request = axiosClient
    .get("/api/task-acknowledgements/pending", {
      params: { limit },
    })
    .then(({ data }) => data)
    .finally(() => {
      pendingRequests.delete(requestKey);
    });

  pendingRequests.set(requestKey, request);
  return request;
}

export const taskAcknowledgementsApi = {
  listPending: getPendingAcknowledgements,

  async acknowledge(acknowledgementId) {
    const { data } = await axiosClient.post(
      `/api/task-acknowledgements/${acknowledgementId}/acknowledge`
    );
    return data;
  },
};
