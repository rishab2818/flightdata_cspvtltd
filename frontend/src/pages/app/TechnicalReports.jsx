import React, { useEffect, useMemo, useState } from "react";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import totalRecordsIcon from "../../assets/bule_message.svg";
import technicalIcon from "../../assets/setting_black.svg";
import designicon from "../../assets/design_black.svg";
import Report1 from "../../assets/Report1.svg";
import load from "../../assets/load.svg";
import FileUploadBox from "../../components/common/FileUploadBox";
import DocumentActions from "../../components/common/DocumentActions"; // <-- Import DocumentActions
import EmptySection from "../../components/common/EmptyProject";
import CommonStatCard from "../../components/common/common_card/common_card";
import { FiPlus, FiUploadCloud, FiSearch } from "react-icons/fi";
import ConfirmationModal from "../../components/common/ConfirmationModal";

const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");

// StatCard component is replaced by CommonStatCard usage

/* --------------------- Main Component --------------------- */
export default function TechnicalReports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ type: "all" });
  const [showModal, setShowModal] = useState(false);
  // State for editing
  const [editingRecord, setEditingRecord] = useState(null);

  /** 🔴 NEW — Delete Modal State */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await recordsApi.listTechnical();
      setRecords(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load technical reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  // const filtered = useMemo(() => {
  //   return records.filter((row) =>
  //     filters.type === "all" ? true : row.report_type === filters.type
  //   );
  // }, [records, filters]);

  const filtered = useMemo(() => {
    const searchText = search.toLowerCase();

    return records.filter((row) => {
      const typeMatch =
        filters.type === "all" || row.report_type === filters.type;

      const searchMatch =
        row.report_name?.toLowerCase().includes(searchText);

      return typeMatch && searchMatch;
    });
  }, [records, filters, search]);


  /* --------------------- Action Handlers --------------------- */

  const handleView = async (row) => {
    try {
      const res = await recordsApi.downloadTechnical(row.record_id);
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Unable to open this record.");
    }
  };

  const handleDownload = async (row) => {
    try {
      const res = await recordsApi.downloadTechnical(row.record_id);
      const link = document.createElement("a");
      link.href = res.download_url;
      link.download = row.original_name || "technical-report";
      link.click();
      link.remove();
    } catch (err) {
      alert("Download failed. Please try again.");
    }
  };

  // const handleDelete = async (row) => {
  //   if (!window.confirm("Delete this technical report?")) return;
  //   try {
  //     await recordsApi.removeTechnical(row.record_id);
  //     setRecords((prev) => prev.filter((r) => r.record_id !== row.record_id));
  //   } catch (err) {
  //     alert("Delete failed. Please try again.");
  //   }
  // };

  /* -------------------- DELETE WITH CONFIRMATION -------------------- */
  const confirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      // Use recordToDelete instead of row
      await recordsApi.removeTechnical(recordToDelete.record_id);
      setRecords((prev) => prev.filter((r) => r.record_id !== recordToDelete.record_id));
    } catch (err) {
      alert("Unable to delete record.");
    }

    setShowDeleteModal(false);
    setRecordToDelete(null);
  };


  const handleEdit = (row) => {
    setEditingRecord(row);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null); // Clear editing state when closing
  };

  const handleUpdate = (updatedRecord) => {
    setRecords((prev) =>
      prev.map((r) => (r.record_id === updatedRecord.record_id ? updatedRecord : r))
    );
  };


  return (
    <div style={{ width: "100%", maxWidth: 1640, margin: "0 auto",height:"100%", gap:"10px",borderRadius: "8px" }}>

      <div
        style={{
          borderRadius:"8px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "24px",
        }}
      >
        <CommonStatCard title="Total Records" value={records.length} icon={totalRecordsIcon} bg="#DBEAFE" />
        <CommonStatCard title="Technical" value={records.filter((r) => r.report_type === "Technical").length} icon={technicalIcon} bg="#F3E8FF" />
        <CommonStatCard title="Design" value={records.filter((r) => r.report_type === "Design").length} icon={designicon} bg="#DCFCE7" />
      </div>
      {/* Filter section  */}
      <div
        style={{
          marginTop: 22,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: "8px",
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}
      >
            <div style={{flex:1, maxWidth:"850px",height:"42px", display:"flex",gap: 8,background: "#f8fafc",border: "1px solid #e2e8f0",borderradius: "0px",padding: "12px 24px"}}>
                  <FiSearch size={16} color="#64748b" />
                  <input
                    style={{
                      border: "none",
                      outline: "none",
                      minwidth: "350px",
                      background: "transparent",
                      flex: 1,
                      gap:20,
                      fontsize: "14px",
                      color: "#0f172a",

                    }}
                    type="text"
                    placeholder="Search reports, tags, projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* <span style={{  color: "#0a0a0a", fontSize: 14, fontFamily: "Inter-Medium, Helvetica", fontWeight:500 }}>Filter by Type</span> */}
          <select
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value })}
            style={{
              minWidth: "284px",
              background: "#F3F3F5",
              height: "42px",
              borderRadius: "8px",
              border: "none",
              padding: "0 12px",
              paddingRight: 32, // space for arrow
              color: "#374151",
              fontSize: 14,
              lineHeight: "36px",
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              backgroundSize: "10px 6px",
            }}
          >
            <option value="all">All Types</option>
            <option value="Technical">Technical</option>
            <option value="Design">Design</option>
            <option value="Other">Other</option>
          </select>
        </label>

    

        <button
          type="button"
          onClick={() => { setEditingRecord(null); setShowModal(true); }} // Set editingRecord to null for new document
          style={{
            padding: "10px 16px",
            background: PRIMARY,
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent:"center",
            gap: 8,
            fontWeight: 600,
            cursor: "pointer",
            height:"40px",
            width:"200px",
          }}
        >
          <img src={Report1} alt="Document"/>
           Upload Document
        </button>
      </div>

      <div
        style={{
          marginTop: 23,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: "8px",
          padding: "10px 24px 24px 24px",
          display: "flex",
          flexDirection: "column",
          height: "calc(68vh - 70px)", // adjust if header size changes
        }}
      >
        <div style={{ marginTop: 10, flex: 1, maxHeight: "100", overflowX: "auto", overflowY: "auto" }}>
          <div
            style={{
              marginBottom: 10,
              marginLeft: 5,
              color: "#0A0A0A",
              fontSize: 16,
              fontWeight: "600",
              gap: 15,
            }}
          >
            Technical Reports
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              overflow: "hidden",
              minWidth: 900,
              marginTop: "20px"
            }}
          >
            <thead >
              <tr
                style={{
                  color: "#000000",
                  borderBottom: `1px solid ${BORDER}`,
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  textAlign: "left",
                  fontWeight: 400,
                  fontSize: "14px",
                  background: "#EFF7FF",
                }}
              >
                {["Report Name", "Description", "Type", "Created Date", "Ratings", "Action"].map( // <-- ADDED 'Action'
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,

                        borderBottom: `1px solid ${BORDER}`,
                      }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody style={{textAlign: "left",fontSize:"12px",fontWeight:400, color:"#717182", fontFamily:"Inter-Regular, Helvetica" }}>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#b91c1c" }}>
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && filtered.length === 0 && (
                <tr style={{ height: "250px" }}>
                  <td colSpan={10} style={{ padding: 0 }}>
                    <div
                      style={{
                        width: "100%",
                        height: "60%",
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
              {!loading &&
                !error &&
                filtered.map((row, index) => {
                  const isLast = index === filtered.length - 1;

                  return (
                    <tr key={row.record_id}>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontWeight: 600,
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.name}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: "#475569",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.description}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.report_type}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {formatDate(row.created_date)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {Number(row.rating || 0).toFixed(1)}
                      </td>
                      {/* ADDED Action Cell */}
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        <DocumentActions
                          doc={{ id: row.record_id, fileName: row.original_name }}
                          onEdit={() => handleEdit(row)}
                          onView={() => handleView(row)}
                          onDownload={() => handleDownload(row)}
                          onDelete={() => {
                            setRecordToDelete(row);
                            setShowDeleteModal(true);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ReportModal
          onClose={closeModal}
          onCreated={loadRecords}
          editingRecord={editingRecord} // Pass the editing record
          onUpdated={handleUpdate} // Handle successful update
        />
      )}

      {showDeleteModal && (
        <ConfirmationModal
          title="Delete this technical report?"
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

/* --------------------- Input Component --------------------- */
// function Input({ label,style, ...rest }) {
//   return (
//     <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <span style={{ color: "#475569", fontSize: 13 }}>{label}</span>
//       <input
//         {...rest}
//         style={{
//           height: 40,
//           borderRadius: "8px",
//           border: `1px solid ${BORDER}`,
//           padding: "0 12px",
//           background: "#F3F3F5",
//         }}
//       />
//     </label>
//   );
// }

function Input({ label, style, ...rest }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ color: "#475569", fontSize: 14 }}>{label}</span>
      <input
        {...rest}
        style={{
          height: 40,
          borderRadius: "8px",
          border: `1px solid ${BORDER}`,
          padding: "0 12px",
          background: "#F3F3F5",
          ...style, // ✅ APPLY IT
        }}
      />
    </label>
  );
}

/* --------------------- Modal Component (Updated for Edit) --------------------- */
function ReportModal({ onClose, onCreated, onUpdated, editingRecord }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    report_type: "Technical",
    created_date: "",
    rating: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Populate form fields if editingRecord is provided
  useEffect(() => {
    if (editingRecord) {
      setForm({
        name: editingRecord.name || "",
        description: editingRecord.description || "",
        report_type: editingRecord.report_type || "Technical",
        // Format date for input type="date"
        created_date: editingRecord.created_date ? editingRecord.created_date.split('T')[0] : "",
        rating: editingRecord.rating ?? "",
      });
      setFile(null); // Clear file input when editing
      setError("");
    }
  }, [editingRecord]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      setSubmitting(true);

      // Initialize file-related variables with existing data if editing, or null/empty if creating
      let storage_key = editingRecord ? editingRecord.storage_key : null;
      let original_name = editingRecord ? editingRecord.original_name : "";
      let content_type = editingRecord ? editingRecord.content_type : "";
      let size_bytes = editingRecord ? editingRecord.size_bytes : null;
      let content_hash = editingRecord ? editingRecord.content_hash : "";

      // 1. Handle NEW file upload
      if (file) {
        content_hash = await computeSha256(file);
        const initRes = await recordsApi.initUpload("technical-reports", {
          section: "technical-reports",
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          content_hash,
        });
        await fetch(initRes.upload_url, { method: "PUT", body: file });

        storage_key = initRes.storage_key;
        original_name = file.name;
        content_type = file.type || "application/octet-stream";
        size_bytes = file.size;
      }

      // 2. Prepare Payload
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

      let result;

      // 3. Call Create or Update API
      if (editingRecord) {
        result = await recordsApi.updateTechnical(editingRecord.record_id, payload);
        onUpdated?.(result); // Notify parent of update
      } else {
        result = await recordsApi.createTechnical(payload);
        onCreated?.(result); // Notify parent of creation
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: "min(840px, 96vw)",
          background: "#fff",
          borderRadius: 12,
          padding: "24px 28px",
          boxShadow: "0 30px 70px rgba(15,23,42,0.25)",

        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", height: 50, alignItems: "center", flexShrink: 0, marginTop: "-10px" }}>
          <div>
            <h3 style={{ margin: 0 }}>{editingRecord ? "Edit Report" : "Upload Report"}</h3>
            <p style={{ margin: "6px 0 0", color: "#64748B" }}>
              Add report metadata and attach your document.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: "8px",
              padding: "8px 12px",
              cursor: "pointer",
              width: 30,
              height: 30,
            }}
          >
            X
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "70vh" }}>
          <FileUploadBox
            label="Upload Document"
            description="Attach report document here"
            supported="PDF/Word"
            file={file}
            onFileSelected={(f) => setFile(f)}
            currentFileName={editingRecord && !file ? editingRecord.original_name : null}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <Input label="Report Name" value={form.name} onChange={(e) => onChange("name", e.target.value)} />

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#475569", fontSize: 13 }}>Type</span>
              <select
                value={form.report_type}
                onChange={(e) => onChange("report_type", e.target.value)}
                style={{
                  height: 40,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  padding: "0 12px",
                  background: "#F3F3F5",
                  paddingRight: 32, // space for arrow
                  color: "#374151",
                  fontSize: 14,
                  lineHeight: "36px",
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "10px 6px",
                }}
              >
                <option value="Technical">Technical</option>
                <option value="Design">Design</option>
                <option value="Other">Other</option>
              </select>
            </label >
            <Input style={{borderRadius: "8px",background:"#F3F3F5",color:"#717182"}}label="Created Date" type="date" value={form.created_date} onChange={(e) => onChange("created_date", e.target.value)} />
            <Input label="Ratings" type="number" step="0.1" value={form.rating} onChange={(e) => onChange("rating", e.target.value)} />
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Note</span>
            <textarea
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              rows={3}
              style={{
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: 10,
                background: "#F3F3F5",
                resize: "none",
              }}
            />
          </label>



          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: `1px solid #1976D2`,
                 color: "#1976d2",
                background: "#fff",
                padding: "10px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                width:"100px",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                border: "none",
                background: PRIMARY,
                color: "#fff",
                padding: "10px 18px",
                borderRadius: "4px",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                display: "flex",
                alignitems: "center",
                justify0content: "center",
                gap: "8px",
              }}
            >
             <img src={load} alt="load" style={{width:"16px", height:"16px", color:"#fff" }}/>
              {submitting ? "Saving…" : editingRecord ? "Update" : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}