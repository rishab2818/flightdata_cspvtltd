// src/pages/app/MinutesOfTheMeeting.jsx
import React, { useState } from "react";
import {
  FiFileText,
  FiEye,
  FiDownload,
  FiTrash2,
  FiCalendar,
  FiEdit2,
} from "react-icons/fi";
import UploadMinutesModal from "../../components/app/UploadMinutesModal";

const BORDER = "#0000001A";
const PRIMARY = "#1976D2";

const dummyRows = [
  { id: 1, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
  { id: 2, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
  { id: 3, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
  { id: 4, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
  { id: 5, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
  { id: 6, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
  { id: 7, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
  { id: 8, fileName: "TCM_MOM_01", tag: "TCM_2Jul", actionOn: "John Doe", meetingDate: "Jul 2, 2025" },
];

export default function MinutesOfTheMeeting() {
  const [showUploadModal, setShowUploadModal] = useState(false);

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
        <TabsRow />

        <NextMeetingBanner />

        <UploadHeader onUploadClick={() => setShowUploadModal(true)} />

        <MinutesTable rows={dummyRows} />
      </div>

      {/* upload modal */}
      <UploadMinutesModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}

/* ---------- small components ---------- */

function TabsRow() {
  const tabs = [
    "Technology Council(TCM)",
    "PMRC",
    "Executive Board meeting",
    "Group Director Meeting",
  ];

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
      {tabs.map((tab, idx) => {
        const active = idx === 0;
        return (
          <button
            key={tab}
            type="button"
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              paddingBottom: 8,
              fontSize: 14,
              cursor: "pointer",
              color: active ? PRIMARY : "#475569",
              fontWeight: active ? 600 : 500,
              borderBottom: active ? `2px solid ${PRIMARY}` : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function NextMeetingBanner() {
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
        Next TMC Meeting
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

function MinutesTable({ rows }) {
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
            <th style={{ padding: "10px 4px", textAlign: "center" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <MinutesRow key={row.id || idx} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MinutesRow({ row }) {
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
          <span style={{ fontSize: 13, color: "#0f172a" }}>{row.fileName}</span>
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
          <IconBadge>
            <FiEye size={16} />
          </IconBadge>
          <IconBadge>
            <FiDownload size={16} />
          </IconBadge>
          <IconBadge>
            <FiTrash2 size={16} />
          </IconBadge>
        </div>
      </td>
    </tr>
  );
}

function IconBadge({ children }) {
  return (
    <div
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
      }}
    >
      {children}
    </div>
  );
}
