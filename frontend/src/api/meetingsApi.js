import { axiosClient } from "../lib/axiosClient";

const section = "minutes_of_meeting";

export const meetingsApi = {
  getNextMeeting: async (subsection) => {
    const params = { section, subsection };
    const { data } = await axiosClient.get("/api/meetings/next", { params });
    return data;
  },
  saveNextMeeting: async ({ subsection, title, meeting_date, meeting_time }) => {
    const payload = { section, subsection, title, meeting_date, meeting_time };
    const { data } = await axiosClient.put("/api/meetings/next", payload);
    return data;
  },
};
