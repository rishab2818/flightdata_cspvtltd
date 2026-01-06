// src/components/app/UploadSectionDocumentModal.jsx
import React, { useState } from "react";
import { FiUploadCloud, FiCalendar } from "react-icons/fi";
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
 *  - section: string   // "inventory_records", "divisional_records", ...
 *  - onUploaded: () => void
 */
export default function UploadSectionDocumentModal({
  open,
  onClose,
  section,
  onUploaded,
}) {
  const [docDate, setDocDate] = useState("");
  const [tag, setTag] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (!docDate) {
      setError("Please select a date.");
      return;
    }
    if (!tag.trim()) {
      setError("Please enter a tag name.");
      return;
    }
    if (!section) {
      setError("No section specified.");
      return;
    }

    try {
      setIsSubmitting(true);

      // 1) Compute hash of file for dedupe
      const content_hash = await computeSha256(file);

      // 2) Ask backend for upload URL
      const initPayload = {
        section, // e.g. "inventory_records"
        subsection: null,
        tag,
        doc_date: docDate, // 'YYYY-MM-DD'
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content_hash,
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
        section,
        subsection: null,
        tag,
        doc_date: docDate,
        storage_key,
        original_name: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content_hash,
      };

      await documentsApi.confirmUpload(confirmPayload);

      // 5) Done
      if (onUploaded) onUploaded();
      onClose();
      // Reset form
      setFile(null);
      setTag("");
      setDocDate("");
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 409) {
        setError("This document already exists (duplicate detected).");
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
          Upload Document
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          {/* Date */}
          <div style={{ maxWidth: 260 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                color: "#4b5563",
                marginBottom: 6,
              }}
            >
              Date
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
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
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

          {/* Tag */}
          <div>
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
              placeholder="e.g., Q1 Inventory, Division A, etc."
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
                Upload files
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#6b7280",
                }}
              >
                Drag and drop your files here, or click to browse
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
                Supported formats: any (PDF, Word, Excel, etc.)
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
              onClick={onClose}
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
              <span>{isSubmitting ? "Uploading..." : "Upload"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
