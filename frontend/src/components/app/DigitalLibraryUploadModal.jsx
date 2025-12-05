import React, { useEffect, useState } from "react";
import { documentsApi } from "../../api/documentsApi";
import styles from "../../pages/app/DigitalLibrary.module.css";

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
      console.error("Upload failed", err);
      setError(err?.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <h3 className={styles.modalTitle}>Upload file</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Select file</label>
            <input
              type="file"
              className={styles.input}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={submitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Document name</label>
            <input
              type="text"
              className={styles.input}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Enter a label"
              disabled={submitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Date</label>
            <input
              type="date"
              className={styles.input}
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Notes (optional)</label>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a short description"
              disabled={submitting}
            />
            <span className={styles.helperText}>
              Notes are local only and are not stored on the server.
            </span>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                resetForm();
                onClose?.();
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
