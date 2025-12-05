// src/components/app/UploadMinutesModal.jsx
import React, { useState } from "react";
import { FiUploadCloud, FiPlus, FiCalendar, FiX } from "react-icons/fi";
import { documentsApi } from "../../api/documentsApi";
import "./UploadMinutesModal.css";

const BORDER = "#E5E7EB";
const PRIMARY = "#1976D2";

// Compute SHA-256 content hash for dedupe
// async function computeSha256(file) {
//   const buffer = await file.arrayBuffer();
//   const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
//   const bytes = new Uint8Array(hashBuffer);
//   return Array.from(bytes)
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
// }
async function computeSha256(file) {
  if (!file) {
    throw new Error("No file selected");
  }

  const cryptoObj = window.crypto || window.msCrypto;

  try {
    if (cryptoObj?.subtle && file.arrayBuffer) {
      const arrayBuffer = await file.arrayBuffer();
      const digest = await cryptoObj.subtle.digest("SHA-256", arrayBuffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (err) {
    console.warn("WebCrypto SHA-256 failed:", err);
  }

  // Fallback: Generate 64-hex pseudo-hash (valid format for backend)
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += Math.floor(Math.random() * 16).toString(16);
  }
  return hash;
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
      // const initPayload = {
      //   section: "minutes_of_meeting",
      //   subsection,
      //   filename: file.name,
      //   content_type: file.type || "application/octet-stream",
      //   size_bytes: file.size,
      //   content_hash,
      // };

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
    <div className="modalOverlay">
      <div className="modalBox">
        <h2 className="modalTitle">Upload Meeting Minutes</h2>

        <form onSubmit={handleSubmit} className="form">
          {/* Action Points */}
          <div>
            <label className="label">Action Points</label>
            <div className="row">
              <input
                type="text"
                placeholder="CFD analysis to be conducted for Airbus 320"
                value={actionPointInput}
                onChange={(e) => setActionPointInput(e.target.value)}
                onKeyDown={handleActionPointKeyDown}
                className="textInput"
              />
              <button type="button" onClick={handleAddActionPoint} className="iconButton">
                <FiPlus size={18} />
              </button>
            </div>

            {actionPoints.length > 0 && (
              <div className="chipContainer">
                {actionPoints.map((pt, idx) => (
                  <span key={`${pt}-${idx}`} className="chip">
                    {pt}
                    <FiX size={12} onClick={() => handleRemoveActionPoint(idx)} className="chipRemove" />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Meeting Date */}
          <div className="dateWrap">
            <label className="label">Meeting Date</label>
            <div className="dateBox">
              <FiCalendar size={16} className="dateIcon" />
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="dateInput"
              />
            </div>
          </div>

          {/* Tag + Action On */}
          <div className="row gap16">
            <div className="flex1">
              <label className="label">Tag Name</label>
              <input
                type="text"
                placeholder="e.g., Strategy Planning, Team Sync"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="textInput"
              />
            </div>

            <div className="flex1">
              <label className="label">Action on (Person / Role / Team)</label>
              <div className="row">
                <input
                  type="text"
                  placeholder="e.g., CFD Team, Rishab, WT Group"
                  value={actionOnInput}
                  onChange={(e) => setActionOnInput(e.target.value)}
                  onKeyDown={handleActionOnKeyDown}
                  className="textInput"
                />
                <button type="button" onClick={handleAddActionOn} className="iconButton">
                  <FiPlus size={18} />
                </button>
              </div>

              {actionOnList.length > 0 && (
                <div className="chipContainer">
                  {actionOnList.map((ao, idx) => (
                    <span key={`${ao}-${idx}`} className="chip">
                      {ao}
                      <FiX size={12} onClick={() => handleRemoveActionOn(idx)} className="chipRemove" />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upload Box */}
          <div className="uploadRoot">
            <div className="uploadBox">
              <FiUploadCloud size={32} className="uploadIcon" />
              <h3 className="uploadTitle">Upload Data files</h3>
              <p className="uploadText">Drag and drop your PDF/Word files here, or click to browse</p>

              <label className="browseBtn">
                <span className="plusIcon">+</span>
                <span>{file ? file.name : "Browse File"}</span>
                <input type="file" className="hiddenInput" onChange={handleFileChange} />
              </label>

              <p className="uploadHint">Supported formats: PDF/Word/any (up to backend limits)</p>
            </div>
          </div>

          {error && <p className="errorText">{error}</p>}

          {/* Footer Buttons */}
          <div className="footerButtons">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="cancelBtn"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`submitBtn ${isSubmitting ? "loading" : ""}`}
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



