import React, { useState } from "react";
import FileUploadBox from "../common/FileUploadBox";
import { computeSha256 } from "../../lib/fileUtils";
import { recordsApi } from "../../api/recordsApi";
import styles from "./DivisionalRecords.module.css";

export default function DivisionalUploadRecord({ onClose, onCreated }) {
  const [form, setForm] = useState({
    division_name: "",
    record_type: "Budget",
    created_date: "",
    rating: "",
    remarks: "",
  });

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const required = ["division_name", "record_type", "created_date", "rating", "remarks"];
    if (required.some((key) => !form[key].trim())) {
      setError("Please fill all required fields");
      return;
    }

    try {
      setSubmitting(true);

      let storage_key, original_name, content_type, size_bytes;

      if (file) {
        const content_hash = await computeSha256(file);

        const initRes = await recordsApi.initUpload("divisional-records", {
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          content_hash,
        });

        await fetch(initRes.upload_url, {
          method: "PUT",
          body: file,
        });

        storage_key = initRes.storage_key;
        original_name = file.name;
        content_type = file.type;
        size_bytes = file.size;
      }

      await recordsApi.createDivisional({
        ...form,
        rating: Number(form.rating),
        storage_key,
        original_name,
        content_type,
        size_bytes,
      });

      onClose();
      onCreated && onCreated();
    } catch (err) {
      console.error(err);
      setError("Failed to upload record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className={styles.title}>Upload Divisional Record</h2>
      <p className={styles.subtitle}>Upload tagged divisional entries</p>

      <form onSubmit={handleSubmit} className={styles.form}>

        <FileUploadBox
          label="Upload Document"
          description="Attach file here"
          supported="PDF/Word"
          file={file}
          onFileSelected={(f) => setFile(f)}
        />

        <label className={styles.label}>
          Division Name
          <input
            className={styles.input}
            value={form.division_name}
            onChange={(e) => onChange("division_name", e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Type
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

        <label className={styles.label}>
          Created Date
          <input
            type="date"
            className={styles.input}
            value={form.created_date}
            onChange={(e) => onChange("created_date", e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Rating
          <input
            type="number"
            min="0"
            step="0.1"
            className={styles.input}
            value={form.rating}
            onChange={(e) => onChange("rating", e.target.value)}
          />
        </label>

        <label className={styles.label}>
          Remarks
          <textarea
            className={styles.textarea}
            value={form.remarks}
            onChange={(e) => onChange("remarks", e.target.value)}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>

          <button type="submit" className={styles.save} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
