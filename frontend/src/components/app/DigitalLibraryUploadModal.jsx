import React, { useEffect, useState } from "react";
import "./DigitalLibraryUploadModal.css";     
import { documentsApi } from "../../api/documentsApi";
import FileUploadBox from "../../components/common/FileUploadBox";
import load from "../../assets/load.svg";

const toIsoDate = (d) => d.toISOString().slice(0, 10);

export default function DigitalLibraryUploadModal({
  open,
  onClose,
  onUploaded,
  section = "digital_library",
  title = "Upload File",
  uploadLabel = "Upload Document",
  description = "Attach training related file here",
  supported = "PDF/Word",
  projectId = null,
}) {
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
      setError("Please select a file to upload.");
      return;
    }
    if (!tag.trim()) {
      setError("Please provide a document name.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const uploaded = await documentsApi.uploadFile({
        file,
        section,
        tag: tag.trim(),
        docDate,
        projectId: projectId || undefined,
      });

      onUploaded?.(uploaded);
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
          <div className="upload-title">{title}</div>

          <FileUploadBox
  label={uploadLabel}
  description={description}
  supported={supported}
  file={file}
  onFileSelected={(f) => setFile(f)}
  currentFileName={file ? file.name : null}
/>

          

          {/* <div className="upload-box">
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
          </div> */}

          {/* <div className="upload-field">
            <label>File Name</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter Name"
            />
            
            
          </div> */}

          {/* <div className="upload-field">
            <label>Description</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter report description"
            />
          </div> */}

          {error && <div className="upload-error">{error}</div>}

          <div className="upload-actions">
            <button className="upload-cancel" onClick={onClose}>Cancel</button>
            <button className="upload-submit" onClick={handleSubmit}>
              <img src={load} alt="load" style={{width:"16px", height:"16px", color:"#fff" }}/>
              {submitting ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
