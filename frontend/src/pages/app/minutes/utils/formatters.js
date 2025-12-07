export const MOM_TABS = [
  { key: "tcm", label: "Technology Council(TCM)" },
  { key: "pmrc", label: "PMRC" },
  { key: "ebm", label: "Executive Board meeting" },
  { key: "gdm", label: "Group Director Meeting" },
];

export function formatDate(isoDateString) {
  if (!isoDateString) return "";
  const d = new Date(isoDateString);
  if (Number.isNaN(d.getTime())) return isoDateString;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeLabel(timeString) {
  if (!timeString) return "";
  const [hourStr, minuteStr] = timeString.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr ?? 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return timeString;
  }

  const d = new Date();
  d.setHours(hour, minute, 0, 0);

  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function normalizeDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

export function convertDocToRow(doc) {
  const actionOnList = doc.action_on || [];
  const actionPointsList = (doc.action_points || []).map((ap) => ({
    description: ap?.description || "",
    assigned_to: ap?.assigned_to || "",
    completed: Boolean(ap?.completed),
  }));
  const assigneesFromPoints = actionPointsList
    .map((ap) => ap?.assigned_to)
    .filter((name) => Boolean(name));
  const combinedActionOn = [
    ...new Set([...(actionOnList || []), ...assigneesFromPoints]),
  ];

  return {
    id: doc.doc_id,
    fileName: doc.original_name,
    tag: doc.tag,
    actionOn:
      Array.isArray(combinedActionOn) && combinedActionOn.length > 0
        ? combinedActionOn.join(", ")
        : "—",
    rawActionOn: actionOnList,
    meetingDate: formatDate(doc.doc_date),
    meetingDateRaw: doc.doc_date,
    actionPoints: actionPointsList,
  };
}
