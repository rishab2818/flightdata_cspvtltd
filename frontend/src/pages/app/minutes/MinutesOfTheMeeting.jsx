import React, { useCallback, useEffect, useState } from "react";
import UploadMinutesModal from "../../../components/app/UploadMinutesModal";
import { documentsApi } from "../../../api/documentsApi";
import { meetingsApi } from "../../../api/meetingsApi";
import { projectApi } from "../../../api/projectapi";
import "./MinutesOfTheMeeting.css";
import TabsRow from "./components/TabsRow";
import ProjectSelector from "./components/ProjectSelector";
import NextMeetingBanner from "./components/NextMeetingBanner";
import UploadHeader from "./components/UploadHeader";
import MinutesTable from "./components/MinutesTable";
import ActionDetailsModal from "./components/ActionDetailsModal";
import ActionPointsModal from "./components/ActionPointsModal";
import NextMeetingModal from "./components/NextMeetingModal";
import { MOM_TABS, convertDocToRow } from "./utils/formatters";

export default function MinutesOfTheMeeting() {
  const [activeSubsection, setActiveSubsection] = useState("tcm");
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
  }, [activeSubsection, selectedProjectId, projectLoading, loadData, loadMeeting]);

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

  const activeTab = MOM_TABS.find((t) => t.key === activeSubsection) || MOM_TABS[0];
  const isPmrc = activeSubsection === "pmrc";
  const selectedProject = isPmrc ? projects.find((p) => (p?._id || p?.id) === selectedProjectId) : null;

  return (
    <div className="Container">
      <div className="Cardcontainer">
        <TabsRow activeKey={activeSubsection} onChange={(key) => setActiveSubsection(key)} />

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

      <UploadMinutesModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        subsection={activeSubsection}
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
            `Next ${activeTab.label}${selectedProject?.project_name ? ` - ${selectedProject.project_name}` : ""}`,
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

      <ActionDetailsModal
        open={Boolean(editingDoc)}
        doc={editingDoc}
        onClose={() => setEditingDoc(null)}
        onSave={handleSaveEdit}
        saving={savingEdit}
        error={editError}
      />
    </div>
  );
}
