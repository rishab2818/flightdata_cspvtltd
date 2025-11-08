// src/components/app/UploadMinutesModal.jsx
import React from "react";
import { FiUploadCloud, FiPlus, FiCalendar } from "react-icons/fi";

const BORDER = "#E5E7EB";
const PRIMARY = "#1976D2";

export default function UploadMinutesModal({ open, onClose }) {
  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // no backend yet – hook later if needed
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: 720,
          maxWidth: "95vw",
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
          padding: "28px 32px 24px",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 24,
            fontSize: 20,
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          Upload Meeting Minutes
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          {/* Action Point */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#4b5563",
                marginBottom: 6,
              }}
            >
              Action Point
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="CFD analysis to be conducted for airbus 320"
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: "#F9FAFB",
                  padding: "0 12px",
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <FiPlus size={18} />
              </button>
            </div>
          </div>

          {/* Meeting Date */}
          <div style={{ maxWidth: 260 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#4b5563",
                marginBottom: 6,
              }}
            >
              Meeting Date
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 40,
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                background: "#ffffff",
                padding: "0 10px",
              }}
            >
              <FiCalendar size={16} style={{ color: "#6b7280" }} />
              <span style={{ fontSize: 14, color: "#9ca3af" }}>Select date</span>
            </div>
          </div>

          {/* Tag + Action on */}
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "#4b5563",
                  marginBottom: 6,
                }}
              >
                Tag Name
              </label>
              <input
                type="text"
                placeholder="e.g., Strategy Planning, Team Sync"
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: "#F9FAFB",
                  padding: "0 12px",
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "#4b5563",
                  marginBottom: 6,
                }}
              >
                Action on
              </label>
              <input
                type="text"
                value="John Doe"
                readOnly
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: "#F9FAFB",
                  padding: "0 12px",
                  fontSize: 14,
                  color: "#4b5563",
                }}
              />
            </div>
          </div>

          {/* Upload box */}
          <div
            style={{
              marginTop: 4,
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: "#ffffff",
              padding: "28px 20px 24px",
            }}
          >
            <div
              style={{
                borderRadius: 8,
                border: `1px dashed ${BORDER}`,
                padding: "32px 16px 28px",
                textAlign: "center",
              }}
            >
              <FiUploadCloud size={32} style={{ color: "#6b7280" }} />
              <h3
                style={{
                  margin: "16px 0 6px",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Upload Data files
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#6b7280",
                }}
              >
                Drag and drop your PDF/Word files here, or click to browse
              </p>

              <button
                type="button"
                style={{
                  marginTop: 18,
                  padding: "10px 26px",
                  borderRadius: 6,
                  background: PRIMARY,
                  border: "none",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                <span>Browse File</span>
              </button>

              <p
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  fontSize: 11,
                  color: "#9ca3af",
                }}
              >
                Supported formats: PDF/Word (Max 10MB per file)
              </p>
            </div>
          </div>

          {/* footer buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 18,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 24px",
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                background: "#ffffff",
                color: "#111827",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 24px",
                borderRadius: 6,
                border: "none",
                background: PRIMARY,
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiUploadCloud size={16} />
              <span>Upload MOM</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
