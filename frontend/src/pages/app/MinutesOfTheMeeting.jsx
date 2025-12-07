import React, { useEffect, useState, useCallback } from "react";
import {
  FiFileText,
  FiCalendar,
  FiEdit2,
  FiClock,
  FiPlus,
  FiX,
  FiTrash2,
} from "react-icons/fi";
import UploadMinutesModal from "../../components/app/UploadMinutesModal";
import { documentsApi } from "../../api/documentsApi";
import { meetingsApi } from "../../api/meetingsApi";
import { projectApi } from "../../api/projectapi";
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

function convertDocToRow(doc) {
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
  const [editingDoc, setEditingDoc] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const loadData = useCallback(
    async (subsection, projectId) => {
      try {
        setLoading(true);
        setError("");
        const data = await documentsApi.listMinutes(subsection, projectId);
        // data is an array of UserDocumentOut from backend
        const mapped = data.map(convertDocToRow);
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
    async (subsection, projectId) => {
      try {
        setMeetingLoading(true);
        setMeetingError("");
        const meeting = await meetingsApi.getNextMeeting(subsection, projectId);
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

  const loadProjects = useCallback(async () => {
    try {
      setProjectLoading(true);
      setProjectError("");
      const list = await projectApi.list();
      setProjects(list || []);
      setSelectedProjectId((prev) => {
        if (prev) return prev;
        if (Array.isArray(list) && list.length > 0) {
          return list[0]?._id || list[0]?.id || "";
        }
        return "";
      });
    } catch (err) {
      console.error("Failed to load projects", err);
      setProjectError("Unable to load your projects.");
      setProjects([]);
      setSelectedProjectId("");
    } finally {
      setProjectLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubsection === "pmrc") {
      loadProjects();
    }
    if (activeSubsection !== "pmrc") {
      setProjectError("");
      setProjectLoading(false);
      setSelectedProjectId("");
    }
  }, [activeSubsection, loadProjects]);

  useEffect(() => {
    const projectId = activeSubsection === "pmrc" ? selectedProjectId : undefined;
    if (activeSubsection === "pmrc" && !projectId && !projectLoading) {
      setRows([]);
      setError("Select a project to view PMRC minutes.");
      setMeetingError("");
      setNextMeeting(null);
      return;
    }
    setError("");
    loadData(activeSubsection, projectId);
    loadMeeting(activeSubsection, projectId);
  }, [
    activeSubsection,
    selectedProjectId,
    projectLoading,
    loadData,
    loadMeeting,
  ]);

  const handleUploadSuccess = () => {
    const projectId = activeSubsection === "pmrc" ? selectedProjectId : undefined;
    loadData(activeSubsection, projectId);
  };

  const handleMeetingSave = async (values) => {
    const payload = {
      subsection: activeSubsection,
      title: values.title,
      meeting_date: values.meeting_date,
      meeting_time: values.meeting_time,
      project_id: activeSubsection === "pmrc" ? selectedProjectId : undefined,
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

  const handleEditDocument = (row) => {
    setEditingDoc(row);
    setEditError("");
  };

  const handleSaveEdit = async (payload) => {
    if (!editingDoc) return;
    try {
      setSavingEdit(true);
      setEditError("");
      const updated = await documentsApi.update(editingDoc.id, payload);
      const mapped = convertDocToRow(updated);
      setRows((prev) => prev.map((r) => (r.id === mapped.id ? mapped : r)));
      setEditingDoc(mapped);
      return { ok: true };
    } catch (err) {
      console.error("Failed to update document:", err);
      const detail = err?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d) => d?.msg || d).join(", ")
        : detail || "Unable to update the document.";
      setEditError(message);
      return { ok: false, error: message };
    } finally {
      setSavingEdit(false);
    }
  };

  const activeTab =
    MOM_TABS.find((t) => t.key === activeSubsection) || MOM_TABS[0];
  const isPmrc = activeSubsection === "pmrc";
  const selectedProject = isPmrc
    ? projects.find((p) => (p?._id || p?.id) === selectedProjectId)
    : null;

  return (
    <div className="Container">

      {/* main card */}
      <div className="Cardcontainer">

        <TabsRow
          activeKey={activeSubsection}
          onChange={(key) => setActiveSubsection(key)}
        />

        {isPmrc && (
          <ProjectSelector
            projects={projects}
            loading={projectLoading}
            error={projectError}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />
        )}

        <NextMeetingBanner
          sectionLabel={activeTab.label}
          meeting={nextMeeting}
          loading={meetingLoading}
          error={meetingError}
          projectName={selectedProject?.project_name}
          missingProject={isPmrc && !selectedProjectId}
          projectLoading={projectLoading}
          onEdit={() => setShowMeetingModal(true)}
        />

        <UploadHeader onUploadClick={() => setShowUploadModal(true)} />

        <MinutesTable
          rows={rows}
          loading={loading}
          error={error}
          onViewAction={handleViewActions}
          onEdit={handleEditDocument}
          setRows={setRows}
        />
      </div>

      {/* upload modal */}
      <UploadMinutesModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        subsection={activeSubsection} // "tcm" | "pmrc" | "ebm" | "gdm"
        onUploaded={handleUploadSuccess}
        projectOptions={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        requireProject={isPmrc}
      />

      <NextMeetingModal
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        initialMeeting={{
          title:
            nextMeeting?.title ||
            `Next ${activeTab.label}${
              selectedProject?.project_name ? ` - ${selectedProject.project_name}` : ""
            }`,
          meeting_date: nextMeeting?.meeting_date || "",
          meeting_time: nextMeeting?.meeting_time || "",
          sectionLabel: activeTab.label,
        }}
        onSave={handleMeetingSave}
        saving={meetingLoading}
      />

      <ActionDetailsModal
        open={Boolean(editingDoc)}
        doc={editingDoc}
        onClose={() => setEditingDoc(null)}
        onSave={handleSaveEdit}
        saving={savingEdit}
        error={editError}
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

function ProjectSelector({
  projects,
  loading,
  error,
  selectedProjectId,
  onChange,
}) {
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  return (
    <div className="ProjectSelector">
      <label className="label">Select Project</label>
      <div className="ProjectRow">
        <select
          className="textInput"
          value={selectedProjectId}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={!hasProjects || loading}
        >
          <option value="">{loading ? "Loading..." : "Choose a project"}</option>
          {projects.map((project) => (
            <option key={project?._id || project?.id} value={project?._id || project?.id}>
              {project?.project_name || "Untitled Project"}
            </option>
          ))}
        </select>
        {loading && <span className="helperText">Loading projects...</span>}
      </div>
      {error && <p className="errorText">{error}</p>}
      {!loading && !error && !hasProjects && (
        <p className="helperText">You need a project membership to upload PMRC minutes.</p>
      )}
    </div>
  );
}

function NextMeetingBanner({
  sectionLabel,
  meeting,
  loading,
  error,
  onEdit,
  projectName,
  missingProject,
  projectLoading,
}) {
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
  const title =
    meeting?.title ||
    `Next ${sectionLabel}${projectName ? ` - ${projectName}` : ""}`;

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
          <div className="BannerTitle">
            {title}
          </div>
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
        <button
          type="button"
          className="BannerEdit"
          onClick={onEdit}
          disabled={loading}
        >
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

function MinutesTable({ rows, loading, error, onViewAction, onEdit, setRows }) {
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
                onEdit={onEdit}
              />

            ))}
        </tbody>
      </table>
    </div>
  );
}


function MinutesRow({ row, onViewAction, onEdit, setRows }) {
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
          onEdit={() => onEdit(row)}
        />
      </td>
    </tr>
  );
}

function ActionDetailsModal({ open, doc, onClose, onSave, saving, error }) {
  const [activeTab, setActiveTab] = useState("view");
  const [tag, setTag] = useState(doc?.tag || "");
  const [meetingDate, setMeetingDate] = useState(
    normalizeDate(doc?.meetingDateRaw)
  );
  const [actionOnInput, setActionOnInput] = useState("");
  const [actionOnList, setActionOnList] = useState(doc?.rawActionOn || []);
  const [apDescription, setApDescription] = useState("");
  const [apAssignee, setApAssignee] = useState("");
  const [actionPoints, setActionPoints] = useState(doc?.actionPoints || []);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (doc) {
      setActiveTab("view");
      setTag(doc.tag || "");
      setMeetingDate(normalizeDate(doc.meetingDateRaw));
      setActionOnList(doc.rawActionOn || []);
      setActionOnInput("");
      setApDescription("");
      setApAssignee("");
      setActionPoints(doc.actionPoints || []);
      setLocalError("");
    }
  }, [doc, open]);

  if (!open || !doc) return null;

  const handleAddActionOn = () => {
    if (!actionOnInput.trim()) return;
    setActionOnList((prev) => [...prev, actionOnInput.trim()]);
    setActionOnInput("");
  };

  const handleRemoveActionOn = (idx) => {
    setActionOnList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddActionPoint = () => {
    if (!apDescription.trim()) return;
    setActionPoints((prev) => [
      ...prev,
      { description: apDescription.trim(), assigned_to: apAssignee.trim(), completed: false },
    ]);
    setApDescription("");
    setApAssignee("");
  };

  const handleRemoveActionPoint = (idx) => {
    setActionPoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateActionPoint = (idx, field, value) => {
    setActionPoints((prev) =>
      prev.map((ap, i) => (i === idx ? { ...ap, [field]: value } : ap))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (!meetingDate || !tag.trim()) {
      setLocalError("Tag and meeting date are required.");
      return;
    }

    const payload = {
      tag: tag.trim(),
      doc_date: meetingDate,
      action_on: actionOnList,
      action_points: actionPoints,
    };

    const result = await onSave(payload);
    if (result?.ok) {
      setActiveTab("view");
      onClose();
    } else if (result?.error) {
      setLocalError(result.error);
    }
  };

  return (
    <div className="LightModalOverlay">
      <div className="ActionModalCard">
        <div className="ModalHeader">
          <h3>My Action</h3>
          <button type="button" className="CloseButton" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ActionTabs">
          <button
            type="button"
            className={`tabBtn ${activeTab === "view" ? "active" : ""}`}
            onClick={() => setActiveTab("view")}
          >
            View Action
          </button>
          <button
            type="button"
            className={`tabBtn ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
          >
            Edit Action
          </button>
        </div>

        {activeTab === "view" && (
          <div className="ActionView">
            <div className="detailRow">
              <span className="detailLabel">Tag</span>
              <span className="detailValue">{doc.tag || "—"}</span>
            </div>
            <div className="detailRow">
              <span className="detailLabel">Meeting Date</span>
              <span className="detailValue">{doc.meetingDate}</span>
            </div>
            <div className="detailRow">
              <span className="detailLabel">Action On</span>
              <span className="detailValue">
                {(doc.rawActionOn || []).length > 0
                  ? doc.rawActionOn.join(", ")
                  : "—"}
              </span>
            </div>

            <div className="ActionList">
              {(actionPoints || []).map((pt, idx) => (
                <div key={`${pt.description}-${idx}`} className="ActionListItem">
                  <div className="actionContent">
                    <div className="ActionDescription">{pt.description}</div>
                    {pt.assigned_to && (
                      <span className="assigneeTag">Assigned: {pt.assigned_to}</span>
                    )}
                  </div>
                  <label className="toggleWrap">
                    <input
                      type="checkbox"
                      checked={Boolean(pt.completed)}
                      readOnly
                    />
                    <span>Marked done</span>
                  </label>
                </div>
              ))}
              {(actionPoints || []).length === 0 && (
                <p className="EmptyText">No action points recorded for this file.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "edit" && (
          <form className="ActionEditForm" onSubmit={handleSubmit}>
            <div className="row gap16">
              <div className="flex1">
                <label className="label">Tag Name</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="textInput"
                  required
                />
              </div>
              <div className="flex1">
                <label className="label">Meeting Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="textInput"
                  required
                />
              </div>
            </div>

            <div className="row gap16">
              <div className="flex1">
                <label className="label">Action on (Person / Role / Team)</label>
                <div className="row">
                  <input
                    type="text"
                    value={actionOnInput}
                    onChange={(e) => setActionOnInput(e.target.value)}
                    className="textInput"
                    placeholder="Add new action owner"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={handleAddActionOn}
                  >
                    <FiPlus size={16} />
                  </button>
                </div>
                {actionOnList.length > 0 && (
                  <div className="chipContainer">
                    {actionOnList.map((ao, idx) => (
                      <span key={`${ao}-${idx}`} className="chip">
                        {ao}
                        <FiX
                          size={12}
                          onClick={() => handleRemoveActionOn(idx)}
                          className="chipRemove"
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="ActionEditList">
              <div className="ActionEditHeader">Action Points</div>

              {(actionPoints || []).map((pt, idx) => (
                <div key={`${pt.description}-${idx}`} className="ActionEditItem">
                  <div className="flex1">
                    <label className="label">Description</label>
                    <input
                      type="text"
                      value={pt.description}
                      onChange={(e) =>
                        handleUpdateActionPoint(idx, "description", e.target.value)
                      }
                      className="textInput"
                    />
                  </div>
                  <div className="flex1">
                    <label className="label">Assign to</label>
                    <input
                      type="text"
                      value={pt.assigned_to}
                      onChange={(e) =>
                        handleUpdateActionPoint(idx, "assigned_to", e.target.value)
                      }
                      className="textInput"
                    />
                  </div>
                  <label className="toggleWrap">
                    <input
                      type="checkbox"
                      checked={Boolean(pt.completed)}
                      onChange={(e) =>
                        handleUpdateActionPoint(idx, "completed", e.target.checked)
                      }
                    />
                    <span>Marked done</span>
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleRemoveActionPoint(idx)}
                    aria-label="Remove action point"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}

              <div className="ActionAddRow">
                <input
                  type="text"
                  value={apDescription}
                  onChange={(e) => setApDescription(e.target.value)}
                  placeholder="New action point"
                  className="textInput"
                />
                <input
                  type="text"
                  value={apAssignee}
                  onChange={(e) => setApAssignee(e.target.value)}
                  placeholder="Assign to"
                  className="textInput"
                />
                <button type="button" className="icon-btn" onClick={handleAddActionPoint}>
                  <FiPlus size={16} />
                </button>
              </div>
            </div>

            {(localError || error) && (
              <p className="errorText">{localError || error}</p>
            )}

            <div className="ModalActions">
              <button type="button" className="cancelBtn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="submitBtn" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
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
