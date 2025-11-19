// src/components/app/UploadMinutesModal.jsx
import React, { useState } from "react";
import { FiUploadCloud, FiPlus, FiCalendar, FiX } from "react-icons/fi";
import { documentsApi } from "../../api/documentsApi";

const BORDER = "#E5E7EB";
const PRIMARY = "#1976D2";

// Compute SHA-256 content hash for dedupe
async function computeSha256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - subsection: "tcm" | "pmrc" | "ebm" | "gdm"
 *  - onUploaded: () => void
 */
export default function UploadMinutesModal({
  open,
  onClose,
  subsection,
  onUploaded,
}) {
  const [meetingDate, setMeetingDate] = useState("");
  const [tag, setTag] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // For multi action points
  const [actionPointInput, setActionPointInput] = useState("");
  const [actionPoints, setActionPoints] = useState([]);

  // For multi "Action on"
  const [actionOnInput, setActionOnInput] = useState("");
  const [actionOnList, setActionOnList] = useState([]);

  if (!open) return null;

  const resetForm = () => {
    setMeetingDate("");
    setTag("");
    setFile(null);
    setError("");
    setActionPointInput("");
    setActionPoints([]);
    setActionOnInput("");
    setActionOnList([]);
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleAddActionPoint = () => {
    const v = actionPointInput.trim();
    if (!v) return;
    setActionPoints((prev) => [...prev, v]);
    setActionPointInput("");
  };

  const handleRemoveActionPoint = (index) => {
    setActionPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddActionOn = () => {
    const v = actionOnInput.trim();
    if (!v) return;
    setActionOnList((prev) => [...prev, v]);
    setActionOnInput("");
  };

  const handleRemoveActionOn = (index) => {
    setActionOnList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (!meetingDate) {
      setError("Please select a meeting date.");
      return;
    }
    if (!tag.trim()) {
      setError("Please enter a tag name.");
      return;
    }
    if (!subsection) {
      setError("No subsection selected.");
      return;
    }
    if (actionPoints.length === 0) {
      setError("Please add at least one action point.");
      return;
    }
    if (actionOnList.length === 0) {
      setError("Please add at least one 'Action on' entry.");
      return;
    }

    try {
      setIsSubmitting(true);

      // 1) Compute hash of file for dedupe
      const content_hash = await computeSha256(file);

      // 2) Ask backend for upload URL
      const initPayload = {
        section: "minutes_of_meeting",
        subsection, // 'tcm' | 'pmrc' | 'ebm' | 'gdm'
        tag,
        doc_date: meetingDate, // 'YYYY-MM-DD'
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content_hash,

        // NEW: Multi action fields
        action_points: actionPoints,
        action_on: actionOnList,
      };

      const { upload_url, storage_key } = await documentsApi.initUpload(
        initPayload
      );

      // 3) Upload file directly to MinIO
      const putRes = await fetch(upload_url, {
        method: "PUT",
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("File upload to storage failed");
      }

      // 4) Confirm upload with backend
      const confirmPayload = {
        section: "minutes_of_meeting",
        subsection,
        tag,
        doc_date: meetingDate,
        storage_key,
        original_name: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content_hash,

        // NEW: same fields on confirm
        action_points: actionPoints,
        action_on: actionOnList,
      };

      await documentsApi.confirmUpload(confirmPayload);

      // 5) Done
      if (onUploaded) onUploaded();
      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 409) {
        setError("This document already exists (duplicate detected).");
      } else if (err?.response?.data?.detail) {
        // surface backend validation
        const detail = err.response.data.detail;
        setError(
          Array.isArray(detail)
            ? detail.map((d) => d.msg || String(d)).join(", ")
            : String(detail)
        );
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  };

  const handleActionPointKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddActionPoint();
    }
  };

  const handleActionOnKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddActionOn();
    }
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
          {/* Action Points (multiple) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#4b5563",
                marginBottom: 6,
              }}
            >
              Action Points
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="CFD analysis to be conducted for Airbus 320"
                value={actionPointInput}
                onChange={(e) => setActionPointInput(e.target.value)}
                onKeyDown={handleActionPointKeyDown}
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
                onClick={handleAddActionPoint}
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
            {actionPoints.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {actionPoints.map((pt, idx) => (
                  <span
                    key={`${pt}-${idx}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      borderRadius: 999,
                      border: `1px solid ${BORDER}`,
                      background: "#F1F5F9",
                      padding: "4px 8px",
                      fontSize: 11,
                      color: "#111827",
                    }}
                  >
                    {pt}
                    <FiX
                      size={12}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleRemoveActionPoint(idx)}
                    />
                  </span>
                ))}
              </div>
            )}
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
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  flex: 1,
                  fontSize: 14,
                  color: "#4b5563",
                  background: "transparent",
                }}
              />
            </div>
          </div>

          {/* Tag + Action on (multiple) */}
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
                value={tag}
                onChange={(e) => setTag(e.target.value)}
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
                Action on (Person / Role / Team)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="e.g., CFD Team, Rishab, WT Group"
                  value={actionOnInput}
                  onChange={(e) => setActionOnInput(e.target.value)}
                  onKeyDown={handleActionOnKeyDown}
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
                  onClick={handleAddActionOn}
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
              {actionOnList.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {actionOnList.map((ao, idx) => (
                    <span
                      key={`${ao}-${idx}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        borderRadius: 999,
                        border: `1px solid ${BORDER}`,
                        background: "#F1F5F9",
                        padding: "4px 8px",
                        fontSize: 11,
                        color: "#111827",
                      }}
                    >
                      {ao}
                      <FiX
                        size={12}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleRemoveActionOn(idx)}
                      />
                    </span>
                  ))}
                </div>
              )}
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

              <label
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
                <span>{file ? file.name : "Browse File"}</span>
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </label>

              <p
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  fontSize: 11,
                  color: "#9ca3af",
                }}
              >
                Supported formats: PDF/Word/any (up to backend limits)
              </p>
            </div>
          </div>

          {error && (
            <p style={{ color: "red", fontSize: 12, marginTop: -4 }}>
              {error}
            </p>
          )}

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
              onClick={handleCancel}
              disabled={isSubmitting}
              style={{
                padding: "8px 24px",
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                background: "#ffffff",
                color: "#111827",
                fontSize: 14,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 24px",
                borderRadius: 6,
                border: "none",
                background: PRIMARY,
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 500,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <FiUploadCloud size={16} />
              <span>{isSubmitting ? "Uploading..." : "Upload MOM"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
