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

const BORDER = "#0000001A";
const PRIMARY = "#1976D2";

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
  const [activeSubsection, setActiveSubsection] = useState("tcm"); // "tcm" | "pmrc" | "ebm" | "gdm"
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
        const mapped = data.map((doc) => ({
          id: doc.doc_id,
          fileName: doc.original_name,
          tag: doc.tag,
          actionOn: "Me",
          meetingDate: formatDate(doc.doc_date),
        }));
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
    <div style={{ width: 1026 }}>
      {/* page title */}
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 700,
          color: PRIMARY,
        }}
      >
        Minutes of the Meeting
      </h1>
      <p
        style={{
          marginTop: 6,
          marginBottom: 18,
          fontSize: 13,
          color: "#475569",
        }}
      >
        Upload, manage, and track meeting minutes with task assignments
      </p>

      {/* main card */}
      <div
        style={{
          width: "100%",
          background: "#FFFFFF",
          borderRadius: 4,
          border: `1px solid ${BORDER}`,
          padding: "35px 25px",
        }}
      >
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
    <div
      style={{
        display: "flex",
        gap: 24,
        marginBottom: 18,
        borderBottom: `1px solid ${BORDER}`,
        paddingBottom: 4,
      }}
    >
      {MOM_TABS.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              paddingBottom: 8,
              fontSize: 14,
              cursor: "pointer",
              color: active ? PRIMARY : "#475569",
              fontWeight: active ? 600 : 500,
              borderBottom: active
                ? `2px solid ${PRIMARY}`
                : "2px solid transparent",
            }}
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
    <div
      style={{
        width: 979,
        maxWidth: "100%",
        height: 44,
        borderRadius: 2,
        padding: 10,
        background: "#EAF5FF",
        border: `1px solid ${PRIMARY}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>
        Next {sectionLabel} Meeting
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontSize: 14,
          color: "#0f172a",
        }}
      >
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
    <div
      style={{
        marginTop: 24,
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: 977,
        maxWidth: "100%",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          Uploaded Meeting Minutes
        </h3>
      </div>
      <button
        type="button"
        onClick={onUploadClick}
        style={{
          width: 157,
          height: 36,
          borderRadius: 2,
          background: PRIMARY,
          border: "none",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <FiFileText size={16} />
        <span>Upload Minutes</span>
      </button>
    </div>
  );
}

function MinutesTable({ rows, loading, error, onDownload, onDelete }) {
  return (
    <div style={{ marginTop: 8, overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr
            style={{
              textAlign: "left",
              color: "#6b7280",
              fontWeight: 500,
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <th style={{ padding: "10px 4px" }}>File Name</th>
            <th style={{ padding: "10px 4px" }}>File Name</th>
            <th style={{ padding: "10px 4px" }}>Tag</th>
            <th style={{ padding: "10px 4px" }}>Action On</th>
            <th style={{ padding: "10px 4px" }}>Meeting Date</th>
            <th style={{ padding: "10px 4px" }}>My Action</th>
            <th style={{ padding: "10px 4px", textAlign: "center" }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={7}
                style={{
                  padding: "18px 4px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#6b7280",
                }}
              >
                Loading documents...
              </td>
            </tr>
          )}

          {!loading && error && (
            <tr>
              <td
                colSpan={7}
                style={{
                  padding: "18px 4px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#b91c1c",
                }}
              >
                {error}
              </td>
            </tr>
          )}

          {!loading && !error && rows.length === 0 && (
            <tr>
              <td
                colSpan={7}
                style={{
                  padding: "18px 4px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#6b7280",
                }}
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
                onDownload={onDownload}
                onDelete={onDelete}
              />
            ))}
        </tbody>
      </table>
    </div>
  );
}

function MinutesRow({ row, onDownload, onDelete }) {
  return (
    <tr
      style={{
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {/* icon + file name */}
      <td style={{ padding: "10px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconBadge>
            <FiFileText size={16} />
          </IconBadge>
          <span style={{ fontSize: 13, color: "#0f172a" }}>
            {row.fileName}
          </span>
        </div>
      </td>

      <td style={{ padding: "10px 4px", fontSize: 13, color: "#0f172a" }}>
        {row.fileName}
      </td>

      {/* tag pill */}
      <td style={{ padding: "10px 4px" }}>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            background: "#F1F5F9",
            border: `1px solid ${BORDER}`,
            fontSize: 11,
            color: "#4b5563",
          }}
        >
          {row.tag}
        </span>
      </td>

      {/* action on */}
      <td style={{ padding: "10px 4px", fontSize: 13, color: "#0f172a" }}>
        {row.actionOn}
      </td>

      {/* meeting date */}
      <td style={{ padding: "10px 4px", fontSize: 13, color: "#0f172a" }}>
        {row.meetingDate}
      </td>

      {/* my action (calendar icon) */}
      <td style={{ padding: "10px 4px" }}>
        <IconBadge>
          <FiCalendar size={16} />
        </IconBadge>
      </td>

      {/* actions icons */}
      <td style={{ padding: "10px 4px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <IconBadge clickable onClick={() => onDownload(row)}>
            <FiEye size={16} />
          </IconBadge>
          <IconBadge clickable onClick={() => onDownload(row)}>
            <FiDownload size={16} />
          </IconBadge>
          <IconBadge clickable onClick={() => onDelete(row)}>
            <FiTrash2 size={16} />
          </IconBadge>
        </div>
      </td>
    </tr>
  );
}

function IconBadge({ children, clickable, onClick }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        width: 37.33,
        height: 32,
        borderRadius: 8,
        borderWidth: 0.67,
        borderStyle: "solid",
        borderColor: BORDER,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F9FAFB",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {children}
    </div>
  );
}
