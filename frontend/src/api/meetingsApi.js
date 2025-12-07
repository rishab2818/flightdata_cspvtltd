import { axiosClient } from "../lib/axiosClient";

const section = "minutes_of_meeting";

export const meetingsApi = {
  getNextMeeting: async (subsection, projectId) => {
    const params = { section, subsection };
    if (projectId) {
      params.project_id = projectId;
    }
    const { data } = await axiosClient.get("/api/meetings/next", { params });
    return data;
  },
  saveNextMeeting: async ({ subsection, title, meeting_date, meeting_time, project_id }) => {
    const payload = { section, subsection, title, meeting_date, meeting_time };
    if (project_id) {
      payload.project_id = project_id;
    }
    const { data } = await axiosClient.put("/api/meetings/next", payload);
    return data;
  },
};
