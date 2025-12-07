import React from "react";
import { FiClock, FiEdit2 } from "react-icons/fi";
import { formatTimeLabel } from "../utils/formatters";

export default function NextMeetingBanner({
  sectionLabel,
  meeting,
  loading,
  error,
  onEdit,
  projectName,
  missingProject,
  projectLoading,
}) {
  const meetingDate = meeting?.meeting_date ? new Date(meeting.meeting_date) : null;

  const dateLabel = meetingDate
    ? meetingDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Meeting date not set";

  const dayLabel = meetingDate
    ? meetingDate.toLocaleDateString("en-US", { weekday: "long" })
    : "";

  const timeLabel = formatTimeLabel(meeting?.meeting_time);
  const title = meeting?.title || `Next ${sectionLabel}${projectName ? ` - ${projectName}` : ""}`;

  if (missingProject) {
    return (
      <div className="Banner">
        <div className="BannerContent">
          <div className="BannerInfo">
            <div className="BannerTitle">Next {sectionLabel}</div>
            <div className="BannerMeta">
              {projectLoading
                ? "Loading projects..."
                : "Select a project to view and update the next PMRC meeting."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="Banner">
      <div className="BannerContent">
        <div className="BannerInfo">
          <div className="BannerTitle">{title}</div>
          <div className="BannerMeta">
            {projectName && <span className="metaItem">{projectName}</span>}
            <span className="metaItem">{dateLabel}</span>
            {dayLabel && <span className="metaItem">{dayLabel}</span>}
            {timeLabel && (
              <span className="metaItem timeMeta">
                <FiClock size={14} />
                <span>{timeLabel}</span>
              </span>
            )}
            {loading && <span className="metaItem">Loading...</span>}
            {error && <span className="metaError">{error}</span>}
          </div>
        </div>
        <button type="button" className="BannerEdit" onClick={onEdit} disabled={loading}>
          <FiEdit2 size={16} />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
}
