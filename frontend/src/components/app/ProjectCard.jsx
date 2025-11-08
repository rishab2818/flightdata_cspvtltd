// src/components/app/ProjectCard.jsx
import React from "react";
import { FiCalendar, FiUser, FiEye } from "react-icons/fi";

const BORDER = "#0000001A";

export default function ProjectCard({ name, type, date, members, desc }) {
  return (
    <div
      style={{
        width: 573,
        height: 215,
        gap: 10,
        borderRadius: 8,
        background: "#fff",
        border: `1px solid ${BORDER}`,
        padding: "35px 25px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* title + chips */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#0f172a",
              margin: 0,
            }}
          >
            {name}
          </h3>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "#F1F5F9",
              color: "#334155",
              fontSize: 12,
              border: `1px solid ${BORDER}`,
            }}
          >
            {type}
          </span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "#E7F4E8",
              color: "#1E8E3E",
              fontSize: 12,
              border: `1px solid ${BORDER}`,
            }}
          >
            Active
          </span>
        </div>
      </div>

      {/* description */}
      <p
        style={{
          fontSize: 13,
          color: "#334155",
          marginTop: 8,
          marginRight: 24,
          lineHeight: 1.5,
          flexGrow: 1,
        }}
      >
        {desc}
      </p>

      {/* bottom row: created + members + button all in one line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          fontSize: 14,
          color: "#475569",
        }}
      >
        {/* created + members group */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiCalendar size={16} />
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Created</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#0f172a",
                  marginTop: 2,
                }}
              >
                {date}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FiUser size={16} />
            <div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Members</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#0f172a",
                  marginTop: 2,
                }}
              >
                {String(members).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {/* view project button */}
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: `1px solid #0f172a`,
            background: "#ffffff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            color: "#0f172a",
          }}
        >
          <FiEye size={16} />
          <span>View Project</span>
        </button>
      </div>
    </div>
  );
}
