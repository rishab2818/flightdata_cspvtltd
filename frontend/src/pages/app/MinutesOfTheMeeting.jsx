// src/pages/app/MinutesOfTheMeeting.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  FiFileText,
  FiEye,
  FiDownload,
  FiTrash2,
  FiCalendar,
  FiEdit2,
} from "react-icons/fi";
import UploadMinutesModal from "../../components/app/UploadMinutesModal";
import { documentsApi } from "../../api/documentsApi";
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

export default function MinutesOfTheMeeting() {
  const [activeSubsection, setActiveSubsection] = useState("tcm"); // "tcm" | "pmrc" | "ebm" | "gdm" (TCM is default Tab)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

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
          return {
            id: doc.doc_id,
            fileName: doc.original_name,
            tag: doc.tag,
            actionOn:
              Array.isArray(actionOnList) && actionOnList.length > 0
                ? actionOnList.join(", ")
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

  useEffect(() => {
    loadData(activeSubsection);
  }, [activeSubsection, loadData]);

  const handleUploadSuccess = () => {
    loadData(activeSubsection);
  };

  const handleDownload = async (row) => {
    try {
      const id = row.id;
      if (!id) return;
      const res = await documentsApi.getDownloadUrl(id);
      const url = res?.download_url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        console.error("Download url missing:", res);
        alert("Download link is missing.");
      }
    } catch (e) {
      console.error("Download failed:", e);
      alert("Failed to download document.");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Are you sure you want to delete this document?")) {
      return;
    }
    try {
      const id = row.id;
      if (!id) return;
      await documentsApi.remove(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to delete document.");
    }
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

        <NextMeetingBanner sectionLabel={activeTab.label} />

        <UploadHeader onUploadClick={() => setShowUploadModal(true)} />

        <MinutesTable
          rows={rows}
          loading={loading}
          error={error}
          onDownload={handleDownload}
          onDelete={handleDelete}
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
            key={tab.key}
            type="button"
            className={`TabButton ${active ? "activeTab" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function NextMeetingBanner({ sectionLabel }) {
  return (
    <div className="Banner">
      <div className="BannerText">
        <span >
          Next {sectionLabel}
        </span>
        <span>Aug 11, 2025</span>
        <span>Monday</span>
        <span>9:00pm</span>
        <FiEdit2 size={16} />
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

function MinutesTable({ rows, loading, error, onDownload, onDelete, setRows }) {
  return (
    <div className="TableGrid">
      <table className="Table">
        <thead>
        
            <th >Title</th>
            <th >Tag Name</th>
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
                onDownload={onDownload}
                onDelete={onDelete}
              />

            ))}
        </tbody>
      </table>
    </div>
  );
}


function MinutesRow({ row, onDownload, onDelete, setRows }) {
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
        <IconBadge clickable>
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
