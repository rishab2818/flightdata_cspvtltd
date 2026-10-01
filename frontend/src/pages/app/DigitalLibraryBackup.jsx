// Standalone backup Digital Library page (single file).
// Talks only to backend/app/routers/digital_library_backup.py through the
// app's own API host; the browser never contacts MinIO directly.
//
// To use, in App.jsx replace the DigitalLibrary import with:
//   import DigitalLibrary from './pages/app/DigitalLibraryBackup'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { axiosClient } from "../../lib/axiosClient";

// ============================== CONFIG ==============================
const CONFIG = {
  apiPrefix: "/api/digital-library-backup",
  pageSize: 30,
  deleteRoles: ["GD", "DH", "TL", "SM"],
  title: "Digital Library",
  subtitle: "Attach training related files here",
  acceptedFiles: "", // e.g. ".pdf,.doc,.docx" ; empty = any file
};
// ====================================================================

const styles = {
  page: { width: "100%", maxWidth: 1640, margin: "0 auto", fontFamily: "inherit" },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" },
  subtitle: { margin: "4px 0 0", fontSize: 14, color: "#475569" },
  toolbar: { display: "flex", gap: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 20, flexWrap: "wrap" },
  input: { height: 40, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, boxSizing: "border-box" },
  primaryBtn: { height: 40, padding: "0 18px", border: "none", borderRadius: 6, background: "#1976D2", color: "#fff", fontWeight: 600, cursor: "pointer" },
  ghostBtn: { height: 40, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#0f172a", cursor: "pointer" },
  linkBtn: { border: "none", background: "transparent", color: "#1976D2", cursor: "pointer", fontSize: 13, padding: "4px 8px" },
  dangerBtn: { border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", fontSize: 13, padding: "4px 8px" },
  tableWrap: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "12px 16px", background: "#f8fafc", color: "#475569", fontWeight: 600, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" },
  td: { padding: "12px 16px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", verticalAlign: "middle" },
  empty: { padding: 40, textAlign: "center", color: "#64748b" },
  error: { color: "#dc2626", fontSize: 13, margin: "8px 0" },
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300, padding: 24 },
  modal: { width: "min(480px, 100%)", background: "#fff", borderRadius: 10, padding: 24, boxShadow: "0 24px 64px rgba(15,23,42,0.18)" },
  modalTitle: { margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "#0f172a" },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 },
};

const typeOf = (name = "") => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOCX";
  if (["xls", "xlsx"].includes(ext)) return "XLSX";
  if (["ppt", "pptx"].includes(ext)) return "PPTX";
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)) return "VIDEO";
  return "Other";
};

const formatBytes = (n) => {
  if (!n) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (v) => {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const errMsg = (err, fallback) => err?.response?.data?.detail || fallback;

export default function DigitalLibraryBackup() {
  const { projectId } = useParams();
  const { user } = useContext(AuthContext);
  const canDelete = CONFIG.deleteRoles.includes(user?.role?.toUpperCase?.());

  const [docs, setDocs] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadPage = useCallback(
    async (pageNo, replace) => {
      setLoading(true);
      setError("");
      try {
        const { data } = await axiosClient.get(CONFIG.apiPrefix, {
          params: { page: pageNo, limit: CONFIG.pageSize, project_id: projectId || undefined },
        });
        setDocs((prev) => (replace ? data : [...prev, ...data]));
        setHasMore(data.length === CONFIG.pageSize);
        setPage(pageNo);
      } catch (err) {
        setError(errMsg(err, "Unable to load your documents. Please try again."));
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadPage(1, true);
  }, [loadPage]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (typeFilter !== "ALL" && typeOf(d.original_name) !== typeFilter) return false;
      if (!q) return true;
      return (d.tag || "").toLowerCase().includes(q) || (d.original_name || "").toLowerCase().includes(q);
    });
  }, [docs, search, typeFilter]);

  const fetchBlob = (id, download) =>
    axiosClient.get(`${CONFIG.apiPrefix}/${id}/file`, {
      params: download ? { download: true } : undefined,
      responseType: "blob",
    });

  const handleView = async (doc) => {
    // Opened synchronously to avoid popup blockers. No "noopener": it makes
    // window.open return null and the tab would stay blank.
    const tab = window.open("", "_blank");
    try {
      const { data } = await fetchBlob(doc.doc_id, false);
      const url = URL.createObjectURL(data);
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (err) {
      tab?.close();
      alert("Preview unavailable. Try downloading instead.");
    }
  };

  const handleDownload = async (doc) => {
    try {
      const { data } = await fetchBlob(doc.doc_id, true);
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_name || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed. Please try again.");
    }
  };

  const handleDelete = async (doc) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete "${doc.tag || doc.original_name}"?`)) return;
    try {
      await axiosClient.delete(`${CONFIG.apiPrefix}/${doc.doc_id}`);
      setDocs((prev) => prev.filter((d) => d.doc_id !== doc.doc_id));
    } catch (err) {
      alert(errMsg(err, "Unable to delete record."));
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.titleRow}>
        <div>
          <h2 style={styles.title}>{CONFIG.title}</h2>
          <p style={styles.subtitle}>{CONFIG.subtitle}</p>
        </div>
        <button type="button" style={styles.primaryBtn} onClick={() => setShowUpload(true)}>
          + Upload Document
        </button>
      </div>

      <div style={styles.toolbar}>
        <input
          style={{ ...styles.input, flex: 1, minWidth: 220 }}
          placeholder="Search for a file"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={styles.input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="ALL">All types</option>
          <option value="PDF">PDF</option>
          <option value="DOCX">Word</option>
          <option value="XLSX">Excel</option>
          <option value="PPTX">PowerPoint</option>
          <option value="VIDEO">Video</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Size</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <tr key={d.doc_id}>
                <td style={styles.td}>{d.tag || d.original_name}</td>
                <td style={styles.td}>{typeOf(d.original_name)}</td>
                <td style={styles.td}>{formatBytes(d.size_bytes)}</td>
                <td style={styles.td}>{formatDate(d.doc_date || d.uploaded_at)}</td>
                <td style={styles.td}>
                  <button type="button" style={styles.linkBtn} onClick={() => handleView(d)}>View</button>
                  <button type="button" style={styles.linkBtn} onClick={() => handleDownload(d)}>Download</button>
                  <button type="button" style={styles.linkBtn} onClick={() => setEditing(d)}>Edit</button>
                  {canDelete && (
                    <button type="button" style={styles.dangerBtn} onClick={() => handleDelete(d)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && visible.length === 0 && <div style={styles.empty}>No documents found.</div>}
        {loading && <div style={styles.empty}>Loading...</div>}
      </div>

      {hasMore && !loading && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button type="button" style={styles.ghostBtn} onClick={() => loadPage(page + 1, false)}>
            Load more
          </button>
        </div>
      )}

      {showUpload && (
        <UploadModal
          projectId={projectId}
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => setDocs((prev) => [doc, ...prev])}
        />
      )}

      {editing && (
        <EditModal
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) =>
            setDocs((prev) => prev.map((d) => (d.doc_id === updated.doc_id ? updated : d)))
          }
        />
      )}
    </div>
  );
}

function UploadModal({ projectId, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [tag, setTag] = useState("");
  const [docDate, setDocDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const handleFile = (f) => {
    setFile(f);
    if (f) setTag(f.name.replace(/\.[^/.]+$/, ""));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Please select a file to upload.");
    if (!tag.trim()) return setError("Please provide a document name.");

    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tag", tag.trim());
      form.append("doc_date", docDate);
      if (projectId) form.append("project_id", projectId);

      const { data } = await axiosClient.post(`${CONFIG.apiPrefix}/upload`, form);
      onUploaded(data);
      onClose();
    } catch (err) {
      setError(errMsg(err, "Upload failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <form style={styles.modal} onSubmit={submit}>
        <h3 style={styles.modalTitle}>Upload File</h3>

        <div style={styles.field}>
          <span style={styles.label}>File</span>
          <input
            ref={inputRef}
            type="file"
            accept={CONFIG.acceptedFiles || undefined}
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>Document name</span>
          <input style={styles.input} value={tag} onChange={(e) => setTag(e.target.value)} />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>Date</span>
          <input style={styles.input} type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button type="button" style={styles.ghostBtn} onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" style={styles.primaryBtn} disabled={submitting}>
            {submitting ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditModal({ doc, onClose, onSaved }) {
  const [tag, setTag] = useState(doc.tag || "");
  const [docDate, setDocDate] = useState((doc.doc_date || "").slice(0, 10) || todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!tag.trim()) return setError("Please provide a document name.");
    setSaving(true);
    setError("");
    try {
      const { data } = await axiosClient.put(`${CONFIG.apiPrefix}/${doc.doc_id}`, {
        tag: tag.trim(),
        doc_date: docDate,
      });
      onSaved(data);
      onClose();
    } catch (err) {
      setError(errMsg(err, "Unable to save changes."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <form style={styles.modal} onSubmit={submit}>
        <h3 style={styles.modalTitle}>Edit Document</h3>
        <div style={styles.field}>
          <span style={styles.label}>Document name</span>
          <input style={styles.input} value={tag} onChange={(e) => setTag(e.target.value)} />
        </div>
        <div style={styles.field}>
          <span style={styles.label}>Date</span>
          <input style={styles.input} type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.actions}>
          <button type="button" style={styles.ghostBtn} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" style={styles.primaryBtn} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
