import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  FiFileText,
  FiCalendar,
  FiEdit2,
  FiClock,
  FiPlus,
  FiX,
  FiTrash2,
  FiSearch,
} from "react-icons/fi";

import UploadMinutesModal from "../../components/app/UploadMinutesModal";
import DocumentActions from "../../components/common/DocumentActions";
import EmptySection from "../../components/common/EmptyProject";

import { documentsApi } from "../../api/documentsApi";
import { meetingsApi } from "../../api/meetingsApi";
import { projectApi } from "../../api/projectapi";
import { useDownload } from "../../components/common/useDownload";

import "./MinutesOfTheMeeting.css";

/* ---------------- constants ---------------- */

const MOM_TABS = [
  { key: "tcm", label: "Technology Council (TCM)" },
  { key: "pmrc", label: "PMRC" },
  { key: "ebm", label: "Executive Board Meeting" },
  { key: "gdm", label: "Group Director Meeting" },
];

const PROJECT_REQUIRED_TABS = ["pmrc", "ebm"];

/* ---------------- helpers ---------------- */

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-US", {
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
  const actionPoints = (doc.action_points || []).map((ap) => ({
    description: ap?.description || "",
    assigned_to: ap?.assigned_to || "",
    completed: Boolean(ap?.completed),
  }));

  const combinedActionOn = [
    ...new Set([
      ...(doc.action_on || []),
      ...actionPoints.map((a) => a.assigned_to).filter(Boolean),
    ]),
  ];

  return {
    id: doc.doc_id,
    record_id: doc.doc_id, // <-- add this
    fileName: doc.original_name,
    tag: doc.tag,
    meetingDate: formatDate(doc.doc_date),
    meetingDateRaw: doc.doc_date,
    rawActionOn: doc.action_on || [],
    actionPoints,
    actionOn: combinedActionOn.length ? combinedActionOn.join(", ") : "—",
  };
}


// function convertDocToRow(doc) {
//   const actionPoints = (doc.action_points || []).map((ap) => ({
//     description: ap?.description || "",
//     assigned_to: ap?.assigned_to || "",
//     completed: Boolean(ap?.completed),
//   }));

//   const combinedActionOn = [
//     ...new Set([
//       ...(doc.action_on || []),
//       ...actionPoints.map((a) => a.assigned_to).filter(Boolean),
//     ]),
//   ];

//   return {
//     id: doc.doc_id,
//     fileName: doc.original_name,
//     tag: doc.tag,
//     meetingDate: formatDate(doc.doc_date),
//     meetingDateRaw: doc.doc_date,
//     rawActionOn: doc.action_on || [],
//     actionPoints,
//     actionOn: combinedActionOn.length ? combinedActionOn.join(", ") : "—",
//   };
// }

/* =================== MAIN COMPONENT =================== */

export default function MinutesOfTheMeeting() {
  const [activeSubsection, setActiveSubsection] = useState("tcm");
  const requiresProject = PROJECT_REQUIRED_TABS.includes(activeSubsection);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");

  const [nextMeeting, setNextMeeting] = useState(null);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [meetingError, setMeetingError] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

  const [editingDoc, setEditingDoc] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [selectedActions, setSelectedActions] = useState([]);
  const [showActionsModal, setShowActionsModal] = useState(false);

 const {
  download,
  view,
  loadingFiles,
  errorFiles,
} = useDownload(documentsApi.getDownloadUrl);


  const handleDeleteDocument = async (doc) => {
  try {
    await documentsApi.remove(doc.id);
    setRows((prev) => prev.filter((r) => r.id !== doc.id));
  } catch {
    alert("Unable to delete document.");
  }
};

  /* ---------------- data loaders ---------------- */

  const loadProjects = useCallback(async () => {
    try {
      setProjectLoading(true);
      setProjectError("");
      const list = await projectApi.list();
      setProjects(list || []);
      if (!selectedProjectId && list?.length) {
        setSelectedProjectId(list[0]?._id || list[0]?.id || "");
      }
    } catch {
      setProjectError("Unable to load projects.");
      setProjects([]);
    } finally {
      setProjectLoading(false);
    }
  }, [selectedProjectId]);

  const loadData = useCallback(async (subsection, projectId) => {
    try {
      setLoading(true);
      const data = await documentsApi.listMinutes(subsection, projectId);
      setRows(data.map(convertDocToRow));
    } catch {
      setError("Failed to load minutes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMeeting = useCallback(async (subsection, projectId) => {
    try {
      setMeetingLoading(true);
      const m = await meetingsApi.getNextMeeting(subsection, projectId);
      setNextMeeting(m);
    } catch (e) {
      if (e?.response?.status !== 404) {
        setMeetingError("Unable to load next meeting.");
      }
      setNextMeeting(null);
    } finally {
      setMeetingLoading(false);
    }
  }, []);

  /* ---------------- effects ---------------- */

  useEffect(() => {
    if (requiresProject) {
      loadProjects();
    } else {
      setProjects([]);
      setSelectedProjectId("");
      setProjectError("");
    }
  }, [requiresProject, loadProjects]);

  useEffect(() => {
    const projectId = requiresProject ? selectedProjectId : undefined;

    if (requiresProject && !projectId && !projectLoading) {
      setRows([]);
      setError("Select a project to view meeting minutes.");
      setNextMeeting(null);
      return;
    }

    setError("");
    loadData(activeSubsection, projectId);
    loadMeeting(activeSubsection, projectId);
  }, [
    activeSubsection,
    selectedProjectId,
    requiresProject,
    projectLoading,
    loadData,
    loadMeeting,
  ]);

  /* ---------------- derived ---------------- */

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.fileName?.toLowerCase().includes(q) ||
        r.tag?.toLowerCase().includes(q) ||
        r.actionOn?.toLowerCase().includes(q) ||
        r.meetingDate?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const activeTab =
    MOM_TABS.find((t) => t.key === activeSubsection) || MOM_TABS[0];

  const selectedProject = requiresProject
    ? projects.find((p) => (p?._id || p?.id) === selectedProjectId)
    : null;

  /* ---------------- handlers ---------------- */

  const handleUploadSuccess = () => {
    loadData(activeSubsection, requiresProject ? selectedProjectId : undefined);
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
  
    // const handleViewActions = (actionPoints = []) => {
    //   setSelectedActions(actionPoints || []);
    //   setShowActionsModal(true);
    // };

    const handleView = (row) => {
  if (!row?.record_id) return;
  view(row.record_id);
};

const handleDownload = (row) => {
  if (!row?.record_id) return;
  download(row.record_id);
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

  /* ---------------- render ---------------- */

  return (
    <div className="Container">
      <div className="Cardcontainer">
        <TabsRow
          activeKey={activeSubsection}
          onChange={setActiveSubsection}
        />

        {requiresProject && (
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
          missingProject={requiresProject && !selectedProjectId}
          projectLoading={projectLoading}
          onEdit={() => setShowMeetingModal(true)}
        />

        <UploadHeader
          search={search}
          onSearchChange={setSearch}
          onUploadClick={() => setShowUploadModal(true)}
        />

        <MinutesTable
          rows={filteredRows}
          loading={loading}
          error={error}
          onViewAction={(a) => {
            setSelectedActions(a);
            setShowActionsModal(true);
          }}
          onEdit={setEditingDoc}
          onDelete={handleDeleteDocument} 
          setRows={setRows}
          download={download}
          view={view}
          loadingFiles={loadingFiles}
          errorFiles={errorFiles}
        />
      </div>

      <UploadMinutesModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        subsection={activeSubsection}
        onUploaded={handleUploadSuccess}
        projectOptions={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        requireProject={requiresProject}
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
          <button 
            className={`TabButton ${active ? "activeTab" : ""}`}
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
      <div className="BannerTitle">Next {sectionLabel}</div>

      <span className="metaItem">{dateLabel}</span>
      <span className="metaItem">{dayLabel}</span>

      <span className="metaItem timeMeta">
        <FiClock size={14} />
        {timeLabel}
      </span>
    </div>

    <button className="BannerEdit" onClick={onEdit}>
      <FiEdit2 size={16} />
    </button>
  </div>
</div>

   
  );
}

    function UploadHeader({ onUploadClick, search, onSearchChange }) {
  return (
    <div className="Header">
      <h3>Uploaded Meeting Minutes</h3>

    <div style={{display:"flex", alignItems:"center",gap:"20px"}}>
    <div style={{flex:1, maxWidth:"550px", height:"42px", display:"flex",gap: 8,background: "#f8fafc",border: "1px solid #e2e8f0",borderradius: "0px",padding: "12px 24px"}}>
        <FiSearch size={16} color="#64748b" />
            <input
             style={{
                  border: "none",
                  outline: "none",
                  minwidth: "350px",
                  background: "transparent",
                  flex: 1,
                  gap:20,
                  fontsize: "14px",
                  color: "#0f172a",
    
                    }}
                  type="text"
                  placeholder="Search reports, tags, projects..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
              />
      </div>

        {/* ⬆ Upload */}
        <button
          type="button"
          onClick={onUploadClick}
          className="UploadButton"
        >
          <FiFileText size={16} />
          <span>Upload Minutes</span>
        </button>
        </div>
      
    </div>
  );
}

function MinutesTable({ rows, loading, error, onViewAction, onEdit,  onDelete, setRows, download, view, loadingFiles, errorFiles, }) {
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
  <tr className="TableEmpty">
    <td colSpan={6} style={{ padding: 0 }}>
      <EmptySection />
    </td>
  </tr>
)}

          {!loading &&
            !error &&
            rows.map((row) => (

              // <MinutesRow
              //   key={row.id}
              //   row={row}
              //   setRows={setRows}
              //   onViewAction={onViewAction}
              //   onEdit={onEdit}
              //   onDelete={onDelete}
              // />
              <MinutesRow
  key={row.id}
  row={row}
  onViewAction={onViewAction}
  onEdit={onEdit}
  onDelete={onDelete}
  download={download}
  view={view}
  loadingFiles={loadingFiles}
  errorFiles={errorFiles}
/>


            ))}
        </tbody>
      </table>
    </div>
  );
}
function MinutesRow({
  row,
  onViewAction,
  onEdit,
  onDelete,
  download,
  view,
  loadingFiles,
  errorFiles,
}) {
  const isLoading = loadingFiles[row.record_id] || false;
  const error = errorFiles[row.record_id] || "";

  return (
    <tr className="minutes-row">
      <td className="cell-text">{row.fileName}</td>
      <td className="cell">
        <span className="tag-pill">{row.tag}</span>
      </td>
      <td className="cell-text">{row.meetingDate}</td>
      <td className="cell-text">{row.actionOn}</td>
      <td className="cell cell-center">
        <IconBadge clickable onClick={() => onViewAction(row.actionPoints)}>
          <FiCalendar size={16} />
        </IconBadge>
      </td>
      <td className="cell cell-center cell-actions">
        <DocumentActions
          doc={{ id: row.id, fileName: row.fileName }}
          onView={() => view(row.record_id)}
          onDownload={() => download(row.record_id)}
          onEdit={() => onEdit(row)}
          onDelete={() => onDelete(row)}
          loading={isLoading}
        />
        {error && <p className="errorText">{error}</p>}
      </td>
    </tr>
  );
}


// function MinutesRow({ row, onViewAction, onEdit, setRows, onDelete, download, view, loadingFiles, errorFiles, }) {
//   return (
//     <tr className="minutes-row">

//       {/* 1️⃣ File Name (no icon now) */}
//       <td className="cell-text">{row.fileName}</td>

//       {/* 2️⃣ Tag */}
//       <td className="cell">
//         <span className="tag-pill">{row.tag}</span>
//       </td>

//       {/* 3️⃣ Meeting Date */}
//       <td className="cell-text">{row.meetingDate}</td>

//       {/* 4️⃣ Action On */}
//       <td className="cell-text">{row.actionOn}</td>

//       {/* 5️⃣ View Action */}
//       <td className="cell cell-center">
//         <IconBadge clickable onClick={() => onViewAction(row.actionPoints)}>
//           <FiCalendar size={16} />
//         </IconBadge>
//       </td>

//       {/* 6️⃣ Actions */}
//       <td className="cell cell-center cell-actions">
// <DocumentActions
//   doc={{ id: row.id, fileName: row.fileName }}
//   onView={() => view(row.record_id)}
//   onDownload={() => download(row.record_id)}
//   onEdit={() => onEdit(row)}
//   onDelete={() => onDelete(row)}
//   loading={loadingFiles[row.record_id]}
// />


// {errorFiles[row.id] && (
//   <p className="errorText">{errorFiles[row.id]}</p>
// )}

//         {/* <DocumentActions
//   doc={{ id: row.id, fileName: row.fileName }}
//   onEdit={() => onEdit(row)}
//   onDelete={onDelete}
// /> */}

//       </td>
//     </tr>
//   );
// }

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
        <div className="ModalHeader1">
          <h3>My Action</h3>
           <button type="button" className="CloseButton" onClick={onClose}>
            X
          </button>

        </div>

        <div className="ActionTabs1">
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
                  className="TextInput"
                  required
                />
              </div>
              <div className="flex1">
                <label className="label">Meeting Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="TextIn"
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
                    className="TextInput"
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
                      className="TextInput"
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
                      className="TextInput"
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
                  className="TextInput"
                />
                <input
                  type="text"
                  value={apAssignee}
                  onChange={(e) => setApAssignee(e.target.value)}
                  placeholder="Assign to"
                  className="TextInput"
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
            X
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
          <h3>Edit Next Meeting</h3>
          <button type="button" className="CloseButton" onClick={onClose}>
           X
          </button>
        </div>

        <form className="ModalForm" onSubmit={handleSubmit}>
          <label className="Meetinglabel" style={{marginBottom:"-10px", marginTop:"10px"}}>Meeting title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="textInput1"
            placeholder={`Next ${initialMeeting?.sectionLabel || "Meeting"}`}
          />

          <div className="row gap16">
            <div className="flex1">
              <label className="Meetinglabel">Meeting date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="textInput2"
              />
            </div>
            <div className="flex1">
              <label className="Meetinglabel">Time</label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="textInput2"
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
