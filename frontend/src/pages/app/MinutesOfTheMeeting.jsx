import React, { useEffect, useState, useCallback } from "react";
import {
  FiFileText,
  FiCalendar,
  FiEdit2,
  FiClock,
} from "react-icons/fi";
import UploadMinutesModal from "../../components/app/UploadMinutesModal";
import { documentsApi } from "../../api/documentsApi";
import { meetingsApi } from "../../api/meetingsApi";
import "./MinutesOfTheMeeting.css";
import DocumentActions from "../../components/common/DocumentActions";


// Back-end subsection codes:
const MOM_TABS = [
  { key: "tcm", label: "Technology Council(TCM)" },
  { key: "pmrc", label: "PMRC" },
  { key: "ebm", label: "Executive Board meeting" },
  { key: "gdm", label: "Group Director Meeting" },
];

function formatDate(isoDateString) {
  if (!isoDateString) return "";
  const d = new Date(isoDateString);
  if (Number.isNaN(d.getTime())) return isoDateString;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(timeString) {
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

export default function MinutesOfTheMeeting() {
  const [activeSubsection, setActiveSubsection] = useState("tcm"); // "tcm" | "pmrc" | "ebm" | "gdm" (TCM is default Tab)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [nextMeeting, setNextMeeting] = useState(null);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingError, setMeetingError] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedActions, setSelectedActions] = useState([]);
  const [showActionsModal, setShowActionsModal] = useState(false);

  const loadData = useCallback(
    async (subsection) => {
      try {
        setLoading(true);
        setError("");
        const data = await documentsApi.listMinutes(subsection);
        // data is an array of UserDocumentOut from backend
        const mapped = data.map((doc) => {
          const actionOnList = doc.action_on || [];
          const actionPointsList = doc.action_points || [];
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
            meetingDate: formatDate(doc.doc_date),
            actionPoints: actionPointsList,
          };
        });
        setRows(mapped);
      } catch (e) {
        console.error("Failed to load minutes:", e);
        setError("Failed to load minutes. Please try again.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMeeting = useCallback(
    async (subsection) => {
      try {
        setMeetingLoading(true);
        setMeetingError("");
        const meeting = await meetingsApi.getNextMeeting(subsection);
        setNextMeeting(meeting);
      } catch (err) {
        if (err?.response?.status === 404) {
          setNextMeeting(null);
        } else {
          console.error("Failed to load meeting:", err);
          setMeetingError("Unable to load next meeting details.");
        }
      } finally {
        setMeetingLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData(activeSubsection);
    loadMeeting(activeSubsection);
  }, [activeSubsection, loadData, loadMeeting]);

  const handleUploadSuccess = () => {
    loadData(activeSubsection);
  };

  const handleMeetingSave = async (values) => {
    const payload = {
      subsection: activeSubsection,
      title: values.title,
      meeting_date: values.meeting_date,
      meeting_time: values.meeting_time,
    };

    try {
      setMeetingError("");
      setMeetingLoading(true);
      const saved = await meetingsApi.saveNextMeeting(payload);
      setNextMeeting(saved);
      setShowMeetingModal(false);
      return { ok: true };
    } catch (err) {
      console.error("Failed to save meeting details:", err);
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d) => d?.msg || d).join(", ")
        : detail || "Failed to save meeting details.";
      setMeetingError(message);
      return { ok: false, error: message };
    } finally {
      setMeetingLoading(false);
    }
  };

  const handleViewActions = (actionPoints = []) => {
    setSelectedActions(actionPoints || []);
    setShowActionsModal(true);
  };

  const activeTab =
    MOM_TABS.find((t) => t.key === activeSubsection) || MOM_TABS[0];

  return (
    <div className="Container">

      {/* main card */}
      <div className="Cardcontainer">

        <TabsRow
          activeKey={activeSubsection}
          onChange={(key) => setActiveSubsection(key)}
        />

        <NextMeetingBanner
          sectionLabel={activeTab.label}
          meeting={nextMeeting}
          loading={meetingLoading}
          error={meetingError}
          onEdit={() => setShowMeetingModal(true)}
        />

        <UploadHeader onUploadClick={() => setShowUploadModal(true)} />

        <MinutesTable
          rows={rows}
          loading={loading}
          error={error}
          onViewAction={handleViewActions}
          setRows={setRows}
        />
      </div>

      {/* upload modal */}
      <UploadMinutesModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        subsection={activeSubsection} // "tcm" | "pmrc" | "ebm" | "gdm"
        onUploaded={handleUploadSuccess}
      />

      <NextMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        initialMeeting={{
          title: nextMeeting?.title || `Next ${activeTab.label}`,
          meeting_date: nextMeeting?.meeting_date || "",
          meeting_time: nextMeeting?.meeting_time || "",
          sectionLabel: activeTab.label,
        }}
        onSave={handleMeetingSave}
        saving={meetingLoading}
      />

      <ActionPointsModal
        open={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        actionPoints={selectedActions}
      />
    </div>
  );
}

/* ---------- small components ---------- */

function TabsRow({ activeKey, onChange }) {
  return (
    <div className="TabsRow">
      {MOM_TABS.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button className="TabButton"
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function NextMeetingBanner({ sectionLabel, meeting, loading, error, onEdit }) {
  const meetingDate = meeting?.meeting_date
    ? new Date(meeting.meeting_date)
    : null;

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

  return (
    <div className="Banner">
      <div className="BannerContent">
        <div className="BannerInfo">
          <div className="BannerTitle">
            {meeting?.title || `Next ${sectionLabel}`}
          </div>
          <div className="BannerMeta">
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
        <button type="button" className="BannerEdit" onClick={onEdit}>
          <FiEdit2 size={16} />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
}

function UploadHeader({ onUploadClick }) {
  return (
    <div className="Header">
      <div>
        <h3>
          Uploaded Meeting Minutes
        </h3>
      </div>
      <button
        type="button"
        onClick={onUploadClick}
        className="UploadButton"
      >
        <FiFileText size={16} />
        <span>Upload Minutes</span>
      </button>
    </div>
  );
}

function MinutesTable({ rows, loading, error, onViewAction, setRows }) {
  return (
    <div className="TableGrid">
      <table className="Table">
        <thead>

          <th >File Name</th>
          <th >Tag</th>
          <th >Meeting Date</th>
          <th >Action On</th>
          <th >View Action</th>
          <th >Actions</th>

        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={6}
                className="tableLoad"
              >
                Loading documents...
              </td>
            </tr>
          )}

          {!loading && error && (
            <tr>
              <td
                colSpan={6}
                className="tableError"
              >
                {error}
              </td>
            </tr>
          )}

          {!loading && !error && rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="TableEmpty"
              >
                No minutes uploaded yet.
              </td>
            </tr>
          )}

          {!loading &&
            !error &&
            rows.map((row) => (

              <MinutesRow
                key={row.id}
                row={row}
                setRows={setRows}
                onViewAction={onViewAction}
              />

            ))}
        </tbody>
      </table>
    </div>
  );
}


function MinutesRow({ row, onViewAction, setRows }) {
  return (
    <tr className="minutes-row">

      {/* 1️⃣ File Name (no icon now) */}
      <td className="cell-text">{row.fileName}</td>

      {/* 2️⃣ Tag */}
      <td className="cell">
        <span className="tag-pill">{row.tag}</span>
      </td>

      {/* 3️⃣ Meeting Date */}
      <td className="cell-text">{row.meetingDate}</td>

      {/* 4️⃣ Action On */}
      <td className="cell-text">{row.actionOn}</td>

      {/* 5️⃣ View Action */}
      <td className="cell cell-center">
        <IconBadge clickable onClick={() => onViewAction(row.actionPoints)}>
          <FiCalendar size={16} />
        </IconBadge>
      </td>

      {/* 6️⃣ Actions */}
      <td className="cell cell-center cell-actions">
        <DocumentActions
          doc={{
            id: row.id,
            fileName: row.fileName,
            onDeleted: (id) =>
              setRows((prev) => prev.filter((r) => r.id !== id)),
          }}
        />
      </td>
    </tr>
  );
}

function ActionPointsModal({ open, onClose, actionPoints }) {
  const items = actionPoints || [];
  if (!open) return null;

  return (
    <div className="LightModalOverlay">
      <div className="LightModalCard">
        <div className="ModalHeader">
          <h3>Action Points</h3>
          <button type="button" className="CloseButton" onClick={onClose}>
            Close
          </button>
        </div>

        {items.length === 0 ? (
          <p className="EmptyText">No action points recorded for this file.</p>
        ) : (
          <ul className="ActionList">
            {items.map((pt, idx) => (
              <li key={`${pt.description}-${idx}`} className="ActionListItem">
                <div className="ActionDescription">{pt.description}</div>
                {pt.assigned_to && (
                  <span className="assigneeTag">Assigned: {pt.assigned_to}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NextMeetingModal({ open, onClose, initialMeeting, onSave, saving }) {
  const [title, setTitle] = useState(initialMeeting?.title || "");
  const [meetingDate, setMeetingDate] = useState(initialMeeting?.meeting_date || "");
  const [meetingTime, setMeetingTime] = useState(initialMeeting?.meeting_time || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(initialMeeting?.title || "");
    setMeetingDate(normalizeDate(initialMeeting?.meeting_date));
    setMeetingTime(initialMeeting?.meeting_time || "");
    setError("");
  }, [initialMeeting, open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !meetingDate || !meetingTime) {
      setError("Please provide a title, date, and time for the next meeting.");
      return;
    }

    const result = await onSave({
      title: title.trim(),
      meeting_date: meetingDate,
      meeting_time: meetingTime,
    });

    if (!result?.ok && result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="LightModalOverlay">
      <div className="LightModalCard">
        <div className="ModalHeader">
          <h3>Edit next meeting</h3>
          <button type="button" className="CloseButton" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="ModalForm" onSubmit={handleSubmit}>
          <label className="label">Meeting title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="textInput"
            placeholder={`Next ${initialMeeting?.sectionLabel || "Meeting"}`}
          />

          <div className="row gap16">
            <div className="flex1">
              <label className="label">Meeting date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="textInput"
              />
            </div>
            <div className="flex1">
              <label className="label">Time</label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="textInput"
              />
            </div>
          </div>

          {error && <p className="errorText">{error}</p>}

          <div className="ModalActions">
            <button type="button" className="cancelBtn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submitBtn" disabled={saving}>
              {saving ? "Saving..." : "Save meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function normalizeDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}





function IconBadge({ children, clickable, onClick }) {
  return (
    <div
      className={`icon-badge ${clickable ? "clickable" : ""}`}
      onClick={clickable ? onClick : undefined}
    >
      {children}
    </div>
  );
}
