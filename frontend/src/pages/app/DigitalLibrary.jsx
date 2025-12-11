import React, { useCallback, useMemo, useState } from "react";
import { FiDownload, FiEdit2, FiEye, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";

import DigitalLibraryUploadModal from "../../components/app/DigitalLibraryUploadModal";
import { documentsApi } from "../../api/documentsApi";
import styles from "./DigitalLibrary.module.css";
import uploadbutton from "../../assets/uploadbutton.svg";
import EmptySection from "../../components/common/EmptyProject";


const typeLabelFromName = (name = "", contentType = "") => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext && contentType) {
    if (contentType.includes("pdf")) return "PDF";
    if (contentType.includes("word")) return "DOCX";
    if (contentType.includes("sheet")) return "XLSX";
  }
  if (["pdf"].includes(ext)) return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOCX";
  if (["xls", "xlsx"].includes(ext)) return "XLSX";
  if (["ppt", "pptx"].includes(ext)) return "PPTX";
  return "Others";
};

const formatBytes = (bytes) => {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toIsoInput = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function DigitalLibrary() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const [showUpload, setShowUpload] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTag, setEditTag] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const mapDocument = useCallback((doc) => ({
    id: doc.doc_id,
    name: doc.original_name,
    tag: doc.tag,
    type: typeLabelFromName(doc.original_name, doc.content_type),
    size: doc.size_bytes,
    createdAt: doc.uploaded_at || doc.doc_date,
    docDate: doc.doc_date,
  }), []);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await documentsApi.listBySection("digital_library");
      setDocuments(data.map(mapDocument));
    } catch (err) {
      console.error(err);
      setError("Unable to load your documents. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [mapDocument]);

  React.useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUploaded = (doc) => {
    setDocuments((prev) => [mapDocument(doc), ...prev]);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this file permanently?")) return;
    try {
      await documentsApi.remove(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert("Delete failed. Please try again.");
    }
  };

  const handleDownload = async (id, fileName) => {
    try {
      const res = await documentsApi.getDownloadUrl(id);
      const link = document.createElement("a");
      link.href = res.download_url;
      link.download = fileName;
      link.click();
      link.remove();
    } catch (err) {
      alert("Download failed. Please try again.");
    }
  };

  const handleView = async (id) => {
    try {
      const res = await documentsApi.getDownloadUrl(id);
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Preview unavailable. Try downloading instead.");
    }
  };

  const openEdit = (doc) => {
    setEditingDoc(doc);
    setEditTag(doc.tag || doc.name || "");
    setEditDate(toIsoInput(doc.docDate || doc.createdAt));
    setEditError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;
    if (!editTag.trim()) {
      setEditError("Document name is required.");
      return;
    }
    if (!editDate) {
      setEditError("Please choose a date.");
      return;
    }

    try {
      setSavingEdit(true);
      const updated = await documentsApi.update(editingDoc.id, {
        tag: editTag.trim(),
        doc_date: editDate,
      });
      const mapped = mapDocument(updated);
      setDocuments((prev) =>
        prev.map((d) => (d.id === mapped.id ? mapped : d))
      );
      setEditingDoc(null);
    } catch (err) {
      setEditError("Update failed. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  const filtered = useMemo(() => {
    return documents
      .filter((doc) => {
        if (typeFilter !== "ALL" && doc.type !== typeFilter) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          doc.name?.toLowerCase().includes(q) || doc.tag?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortBy === "newest" ? db - da : da - db;
      });
  }, [documents, search, typeFilter, sortBy]);

  return (
    <div className={styles.container}>
     

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <FiSearch size={16} color="#64748b" />
          <input
            className={styles.searchInput}
            placeholder="Search reports, tags, projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.select}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">All Types</option>
          <option value="PDF">PDF</option>
          <option value="DOCX">DOC/DOCX</option>
          <option value="XLSX">Excel</option>
          <option value="PPTX">PowerPoint</option>
          <option value="Others">Others</option>
        </select>

        <select
          className={styles.select}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="Newest"> Newest</option>
          <option value="oldest">Oldest first</option>
        </select>

        <button className={styles.uploadBtn} onClick={() => setShowUpload(true)}>
  <img src={uploadbutton} alt="upload" className="btnIcon" />
  Upload Files
</button>
       
      </div>

      <div className={styles.tableWrapper}>
        <div style={{padding: "16px 20px",width:"100%",fontSize:16, fontWeight:600, color: "#0a0a0a",fontfamily: "Inter-semiBold, Helvetica"}}>My Files</div>
        <div className={styles.tableHeader}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Created Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className={styles.loading}>
                    Loading...
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td colSpan={5} className={styles.error}>
                    {error}
                  </td>
                </tr>
              )}

              
               {!loading && !error && filtered.length === 0 && (
                <tr style={{ height: "300px" }}>
                    <td colSpan={10} style={{ padding: 0 }}>
                       <div
                        style={{
                           width: "100%",
                           height: "100%",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           padding: "40px 0",
                                      }}
                    >
                                    <EmptySection />
                                  </div>
                                </td>
                              </tr>
                             )}
              
              {!loading && !error &&
                filtered.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.name}</td>
                    <td>
                      <span className={styles.typeBadge}>{doc.type}</span>
                    </td>
                    <td>{formatBytes(doc.size)}</td>
                    <td>{formatDate(doc.createdAt)}</td>
                    <td>
                      <div className={styles.actionCell}>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => openEdit(doc)}
                          aria-label="Edit"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleView(doc.id)}
                          aria-label="View"
                        >
                          <FiEye size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleDownload(doc.id, doc.name)}
                          aria-label="Download"
                        >
                          <FiDownload size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleDelete(doc.id)}
                          aria-label="Delete"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <DigitalLibraryUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={handleUploaded}
      />

      {editingDoc && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Edit document</h3>
            <form onSubmit={handleEditSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Document name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  disabled={savingEdit}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Date</label>
                <input
                  type="date"
                  className={styles.input}
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={savingEdit}
                />
              </div>

              {editError && <div className={styles.error}>{editError}</div>}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setEditingDoc(null);
                    setEditError("");
                  }}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
