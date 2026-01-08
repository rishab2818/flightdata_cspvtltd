// Cleaned and corrected full component
import React, { useEffect, useMemo, useState } from "react";
import { FiDownload, FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import { downloadExcel } from "../../lib/excelExport";
import Folder from "../../assets/Folder.svg";
import CurrencyInr from "../../assets/CurrencyInr.svg";
import Calculator from "../../assets/Calculator.svg";
import DotsThreeOutline from "../../assets/DotsThreeOutline.svg";
import Newspaper from "../../assets/Newspaper.svg"
import styles from "./DivisionalRecords.module.css";
import FileUploadBox from "../../components/common/FileUploadBox";
import DocumentActions from "../../components/common/DocumentActions";
import EmptySection from "../../components/common/EmptyProject";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import DownloadSimple from "../../assets/DownloadSimple.svg";
import load from "../../assets/load.svg"

const BORDER = "#E2E8F0";
const PRIMARY = "#2563EB";

/* --------------------- Stat Card --------------------- */
function StatCard({ title, value, icon, bg }) {
  return (
    <div className={styles.StatCard} style={{ borderColor: BORDER }}>
      <div className={styles.iconWrap} style={{ background: bg }}>
        <img src={icon} alt="" className={styles.iconImg} />
      </div>
      <div className={styles.StatText}>
        <div className={styles.StatTitle}>{title}</div>
        <div className={styles.StatValue}>{value}</div>
      </div>
    </div>
  );
}

/* --------------------- Badge --------------------- */
function TypeBadge({ value }) {
  const palette = {
    Budget: { bg: "#EEF2FF", text: "#4338CA" },
    AMC: { bg: "#E0F2FE", text: "#075985" },
    "Cyber Security": { bg: "#FFF7ED", text: "#C2410C" },
  }[value] || { bg: "#E5E7EB", text: "#111827" };

  return (
    <span
      style={{
        padding: "6px 12px",
        background: palette.bg,
        color: palette.text,
        borderRadius: 999,
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {value}
    </span>
  );
}


/* --------------------- Filters Bar --------------------- */
function FiltersBar({ filters, setFilters, openModal }) {
  return (
    <div className={styles.filtersContainer}>
      <div className={styles.leftFilters}>
        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter by Type</span>
          <select
            className={styles.select}
            value={filters.type}
            onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
          >
            <option value="all">All Types</option>
            <option value="Budget">Budget</option>
            <option value="AMC">AMC</option>
            <option value="Cyber Security">Cyber Security</option>
          </select>
        </label>

        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter by Status</span>
          <select className={styles.select}>
            <option>All Status</option>
            <option>Approved</option>
            <option>Pending</option>
            <option>Rejected</option>
          </select>
        </label>
      </div>

      <button className={styles.uploadBtn} onClick={openModal}>
        <img src={Newspaper} alt="Record"/>
         Upload Record
      </button>
    </div>
  );
}

/* --------------------- Main Component --------------------- */
export default function DivisionalRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  /** 🔴 NEW — Delete Modal State */
      const [showDeleteModal, setShowDeleteModal] = useState(false);
      const [recordToDelete, setRecordToDelete] = useState(null);

  const openModal = () => {
    setEditingRecord(null);
    setShowModal(true);
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await recordsApi.listDivisional();
      setRecords(data);
    } catch {
      setError("Failed to load divisional records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleView = async (row) => {
    try {
      const res = await recordsApi.downloadDivisional(row.record_id);
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Unable to open this record.");
    }
  };

  const handleDownload = async (row) => {
    try {
      const res = await recordsApi.downloadDivisional(row.record_id);
      const link = document.createElement("a");
      link.href = res.download_url;
      link.download = row.original_name || "divisional-record";
      link.click();
      link.remove();
    } catch (err) {
      alert("Download failed. Please try again.");
    }
  };

  // const handleDelete = async (row) => {
  //   if (!window.confirm("Delete this divisional record?")) return;
  //   try {
  //     await recordsApi.removeDivisional(row.record_id);
  //     setRecords((prev) => prev.filter((r) => r.record_id !== row.record_id));
  //   } catch (err) {
  //     alert("Delete failed. Please try again.");
  //   }
  // };

  /* -------------------- DELETE WITH CONFIRMATION -------------------- */
 const confirmDelete = async () => {
  if (!recordToDelete) return;

  console.log("Deleting record:", recordToDelete);

  try {
    const res = await recordsApi.removeDivisional(recordToDelete.record_id);
    console.log("Delete response:", res);
    setRecords((prev) => prev.filter((r) => r.record_id !== recordToDelete.record_id));
  } catch (err) {
    console.error("Delete error:", err);
    alert("Unable to delete record.");
  } finally {
    setShowDeleteModal(false);
    setRecordToDelete(null);
  }
};
  /*----------------------------------------------------------------------*/
  const filtered = useMemo(() => {
    return records.filter((r) => (filters.type === "all" ? true : r.record_type === filters.type));
  }, [records, filters]);

  const handleExport = () => {
    const columns = [
      { header: "Division Name", key: "division_name" },
      { header: "Type", key: "record_type" },
      {
        header: "Created Date",
        accessor: (row) =>
          row.created_date ? new Date(row.created_date).toLocaleDateString("en-GB") : "",
      },
      { header: "Rating", key: "rating" },
      { header: "Remarks", key: "remarks" },
      { header: "Attachment", accessor: (row) => row.original_name || "" },
    ];

    downloadExcel({
      rows: filtered,
      columns,
      fileName: "divisional-records",
      sheetName: "Divisional Records",
    });
  };

  return (
    <div className={styles.wrapper}>
      {/* Stats */}
      <div className={styles.StatGrid}>
        <StatCard title="Total Records" value={records.length} icon={Folder} bg="#DBEAFE" />
        <StatCard title="Budget" value={records.filter((r) => r.record_type === "Budget").length} icon={CurrencyInr} bg="#FFEDD4" />
        <StatCard title="AMC" value={records.filter((r) => r.record_type === "AMC").length} icon={Calculator} bg="#F3E8FF" />
        <StatCard title="Others" value={records.filter((r) => r.record_type === "Others").length} icon={DotsThreeOutline} bg="#FFEDD4" />
      </div>

      {/* Filters */}
      <FiltersBar filters={filters} setFilters={setFilters} openModal={() => setShowModal(true)} />

      {/* Table */}
      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <h3>Divisional Records</h3>
          <button type="button" className={styles.exportButton} onClick={handleExport}>
          <img src={DownloadSimple} alt="download" className={styles.icons} />
          </button>
          {/* <button type="button" className={styles.exportBtn} onClick={handleExport}>
            <FiDownload size={16} /> 
          </button> */}
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              {["Record Name", "Type", "Created Date", "Remarks", "Action"].map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr><td colSpan={5} className={styles.centerText}>Loading...</td></tr>
            )}

            {!loading && error && (
              <tr><td colSpan={5} className={styles.errorText}>{error}</td></tr>
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
            {!loading && !error && filtered.map((row) => (
              <tr key={row.record_id}>
                <td>{row.division_name || "—"}</td>
                <td><TypeBadge value={row.record_type || ""} /></td>
                <td>
                  {row.created_date
                    ? new Date(row.created_date).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td>{row.remarks || "—"}</td>
                <td className={styles.actionCol}>
                  <DocumentActions
                    doc={{ id: row.record_id, fileName: row.original_name }}
                    onEdit={() => {
                      setEditingRecord(row);
                      setShowModal(true);
                    }}
                    onView={() => handleView(row)}
                    onDownload={() => handleDownload(row)}
                    onDelete={() => {
                       setRecordToDelete(row);
                       setShowDeleteModal(true);
                      }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <DivisionalModal
          onClose={() => setShowModal(false)}
          onCreated={loadRecords}
          editingRecord={editingRecord}
          onUpdated={(updated) => {
            setRecords((prev) =>
              prev.map((r) => (r.record_id === updated.record_id ? updated : r))
            );
          }}
        />
      )}

       {showDeleteModal && recordToDelete && (
  <ConfirmationModal
    key={recordToDelete.record_id}  // ✅ forces remount
    title="Delete this divisional record?"
    onCancel={() => {
      setShowDeleteModal(false);
      setRecordToDelete(null);
    }}
    onConfirm={confirmDelete}
  />
)}

    </div>
  );
}

/* --------------------- Input --------------------- */
function Input({ label, ...rest }) {
  return (
    <label className={styles.InputLabel}>
      <span className={styles.InputText}>{label}</span>
      <input className={styles.InputBox} {...rest} />
    </label>
  );
}

/* --------------------- Modal --------------------- */

function DivisionalModal({ onClose, onCreated, onUpdated, editingRecord }) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);
      let storage_key = form.storage_key,
        original_name = form.original_name,
        content_type = form.content_type,
        size_bytes = form.size_bytes,
        content_hash = form.content_hash;

      if (file) {
        const hash = await computeSha256(file);
        const initRes = await recordsApi.initUpload("divisional-records", {
          section: "divisional-records",
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          content_hash: hash,
        });

        await fetch(initRes.upload_url, { method: "PUT", body: file });

        storage_key = initRes.storage_key;
        original_name = file.name;
        content_type = file.type || "application/octet-stream";
        size_bytes = file.size;
        content_hash = hash;
      }

      const payload = {
        ...form,
        rating: form.rating === "" ? undefined : Number(form.rating || 0),
        created_date: form.created_date || undefined,
        storage_key,
        original_name,
        content_type,
        size_bytes,
        content_hash,
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
          <FileUploadBox
                        label="Upload Document"
                        description="Attach supply record"
                        supported="PDF/Word"
                        file={file}
                        onFileSelected={(f) => setFile(f)}
                      />
          <div className={styles.UploadGrid}>
            <Input className={styles.input} label="Division Name" value={form.division_name} onChange={(e) => onChange("division_name", e.target.value)} />

            <label>
              <span>Type</span>
              <select className={styles.inputSelect} value={form.record_type} onChange={(e) => onChange("record_type", e.target.value)}>
                <option value="Budget">Budget</option>
                <option value="AMC">AMC</option>
                <option value="Cyber Security">Cyber Security</option>
              </select>
            </label>

            <Input className={styles.input} label="Created Date" type="date" value={form.created_date} onChange={(e) => onChange("created_date", e.target.value)} />

            <Input className={styles.input} label="Rating" type="number" min={0} step={0.1} value={form.rating} onChange={(e) => onChange("rating", e.target.value)} />

            <label >
               <span className={styles.inputLabel}>Note</span>
              <textarea rows={3} value={form.remarks} onChange={(e) => onChange("remarks", e.target.value)} className={styles.textarea} /> 
            </label>

            {/* <label >
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => onChange("notes", e.target.value)}
                  className="textAreaLabel"
                />
              </label> */}

            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.modelFooter}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              
              <button type="submit" className={styles.saveBtn} disabled={submitting}>
                <img src={load} alt="load" style={{width:"16px", height:"16px", color:"#fff" }}/>
                 {submitting ? "Saving…" : editingRecord ? "Update" : "Upload"}
                {/* {submitting ? "Saving..." : editingRecord ? "Save Changes" : "Save"} */}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
