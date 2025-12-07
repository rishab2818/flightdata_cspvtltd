import React, { useEffect, useState } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../../../api/recordsApi";
import { computeSha256 } from "../../../../lib/fileUtils";
import styles from "../DivisionalRecords.module.css";
import InputField from "./InputField";

export default function DivisionalModal({ onClose, onCreated, onUpdated, editingRecord }) {
  const [form, setForm] = useState({
    division_name: "",
    record_type: "Budget",
    created_date: "",
    rating: "",
    remarks: "",
    storage_key: null,
    original_name: "",
    content_type: "",
    size_bytes: null,
    content_hash: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!editingRecord) return;

    setForm({
      division_name: editingRecord.division_name || "",
      record_type: editingRecord.record_type || "Budget",
      created_date: editingRecord.created_date || "",
      rating: editingRecord.rating ?? "",
      remarks: editingRecord.remarks || "",
      storage_key: editingRecord.storage_key || null,
      original_name: editingRecord.original_name || "",
      content_type: editingRecord.content_type || "",
      size_bytes: editingRecord.size_bytes ?? null,
      content_hash: editingRecord.content_hash || "",
    });
    setFile(null);
    setError("");
  }, [editingRecord]);

  const uploadFileIfNeeded = async () => {
    if (!file) {
      return {
        storage_key: form.storage_key,
        original_name: form.original_name,
        content_type: form.content_type,
        size_bytes: form.size_bytes,
        content_hash: form.content_hash,
      };
    }

    const hash = await computeSha256(file);
    const initRes = await recordsApi.initUpload("divisional-records", {
      section: "divisional-records",
      filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      content_hash: hash,
    });

    await fetch(initRes.upload_url, { method: "PUT", body: file });

    return {
      storage_key: initRes.storage_key,
      original_name: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      content_hash: hash,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);
      const uploadMeta = await uploadFileIfNeeded();

      const payload = {
        ...form,
        rating: form.rating === "" ? undefined : Number(form.rating || 0),
        created_date: form.created_date || undefined,
        ...uploadMeta,
      };

      if (editingRecord) {
        const updated = await recordsApi.updateDivisional(editingRecord.record_id, payload);
        onUpdated?.(updated);
      } else {
        const created = await recordsApi.createDivisional(payload);
        onCreated?.(created);
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save divisional record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>
              {editingRecord ? "Edit Divisional Record" : "Upload Divisional Record"}
            </h3>
            <p className={styles.modalSubtitle}>Upload tagged divisional entries.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.UploadGrid}>
            <InputField
              className={styles.input}
              label="Division Name"
              value={form.division_name}
              onChange={(e) => onChange("division_name", e.target.value)}
            />

            <label>
              <span>Type</span>
              <select
                className={styles.input}
                value={form.record_type}
                onChange={(e) => onChange("record_type", e.target.value)}
              >
                <option value="Budget">Budget</option>
                <option value="AMC">AMC</option>
                <option value="Cyber Security">Cyber Security</option>
              </select>
            </label>

            <InputField
              className={styles.input}
              label="Created Date"
              type="date"
              value={form.created_date}
              onChange={(e) => onChange("created_date", e.target.value)}
            />

            <InputField
              className={styles.input}
              label="Rating"
              type="number"
              min={0}
              step={0.1}
              value={form.rating}
              onChange={(e) => onChange("rating", e.target.value)}
            />

            <label className={styles.inputBox}>
              <span className={styles.inputLabel}>Remarks</span>
              <textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => onChange("remarks", e.target.value)}
                className={styles.textarea}
              />
            </label>

            <label className={styles.inputBox}>
              <span className={styles.inputLabel}>Upload Document</span>
              <div className={styles.uploadBoxFile}>
                <FiUploadCloud />
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </label>

            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.modelFooter}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.saveBtn} disabled={submitting}>
                {submitting ? "Saving..." : editingRecord ? "Save Changes" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
