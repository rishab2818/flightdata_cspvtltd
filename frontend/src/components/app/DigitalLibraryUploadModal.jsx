import React, { useEffect, useState } from "react";
import "./DigitalLibraryUploadModal.css";     
import { documentsApi } from "../../api/documentsApi";

const toIsoDate = (d) => d.toISOString().slice(0, 10);

async function computeSha256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function DigitalLibraryUploadModal({ open, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [tag, setTag] = useState("");
  const [docDate, setDocDate] = useState(() => toIsoDate(new Date()));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) return;
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setTag(cleanName);
  }, [file]);

  if (!open) return null;

  const resetForm = () => {
    setFile(null);
    setTag("");
    setNotes("");
    setDocDate(toIsoDate(new Date()));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }
    if (!tag.trim()) {
      setError("Please provide a document name.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const hash = await computeSha256(file);
      const contentType = file.type || "application/octet-stream";

      const initPayload = {
        section: "digital_library",
        tag: tag.trim(),
        doc_date: docDate,
        filename: file.name,
        content_type: contentType,
        size_bytes: file.size,
        content_hash: hash,
      };

      const initRes = await documentsApi.initUpload(initPayload);

      await fetch(initRes.upload_url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      const confirmPayload = {
        section: "digital_library",
        tag: tag.trim(),
        doc_date: docDate,
        storage_key: initRes.storage_key,
        original_name: file.name,
        content_type: contentType,
        size_bytes: file.size,
        content_hash: hash,
      };

      const confirmed = await documentsApi.confirmUpload(confirmPayload);
      onUploaded?.(confirmed);
      resetForm();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="upload-backdrop">
        <div className="upload-card">
          <div className="upload-title">Upload File</div>
          

          <div className="upload-box">
            <div className="upload-add">

            </div>
            <div className="upload-text">
              <h3>Upload Data files</h3>
              <p>Drag & drop your PDF/Word files here, or click to browse</p>
            </div>

            <label className="upload-browse">
              + Browse
              <input type="file" style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>

            <div className="upload-support">
              Supported formats: PDF/word ( Max 10 MB per file)
            </div>
          </div>

          {/* <div className="upload-field">
            <label>File Name</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter Name"
            />
            
            
          </div> */}

          <div className="upload-field">
            <label>Description</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter report description"
            />
          </div>

          {error && <div className="upload-error">{error}</div>}

          <div className="upload-actions">
            <button className="upload-cancel" onClick={onClose}>Cancel</button>
            <button className="upload-submit" onClick={handleSubmit}>
              {submitting ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
