import { axiosClient } from "../lib/axiosClient";

export const PERFORMANCE_FREQUENCY_MONTHS = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

function addMonths(date, months) {
  const next = new Date(date);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

export function calculateCycleEndDatePreview(startDate, frequency) {
  if (!startDate || !frequency || !PERFORMANCE_FREQUENCY_MONTHS[frequency]) {
    return "";
  }
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  const end = addMonths(start, PERFORMANCE_FREQUENCY_MONTHS[frequency]);
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
}

export const performanceSettingsService = {
  get: async () => {
    const { data } = await axiosClient.get("/api/performance-settings");
    return data;
  },

  save: async (payload) => {
    const { data } = await axiosClient.put("/api/performance-settings", payload, {
      headers: { "Content-Type": "application/json" },
    });
    return data;
  },
};
