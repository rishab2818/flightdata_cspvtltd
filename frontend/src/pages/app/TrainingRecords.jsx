// import React, { useEffect, useMemo, useState } from "react";
// import { FiPlus, FiUploadCloud } from "react-icons/fi";
// import { recordsApi } from "../../api/recordsApi";
// import { computeSha256 } from "../../lib/fileUtils";
// import totalTrainingIcon from "../../assets/reports.svg"
// import noOfParticipantsIcon from "../../assets/UsersThree_green.svg"
// import ongoingIcon from "../../assets/SpinnerGap.svg"

// import CommonStatCard from "../../components/common/common_card/common_card";
// import FileUploadBox from "../../components/common/FileUploadBox";

// const BORDER = "#E2E8F0";
// const PRIMARY = "#1976D2";
// const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");



// function StatusBadge({ status }) {
//   const palette =
//     status === "Completed"
//       ? { bg: "#DCFCE7", text: "#15803D" }
//       : { bg: "#FEF3C7", text: "#92400E" };
//   return (
//     <span
//       style={{
//         padding: "6px 12px",
//         background: palette.bg,
//         color: palette.text,
//         borderRadius: 999,
//         fontWeight: 600,
//         fontSize: 12,
//       }}
//     >
//       {status}
//     </span>
//   );
// }

// export default function TrainingRecords() {
//   const [records, setRecords] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [filters, setFilters] = useState({ type: "all", status: "all" });
//   const [showModal, setShowModal] = useState(false);

//   const loadRecords = async () => {
//     try {
//       setLoading(true);
//       setError("");
//       const data = await recordsApi.listTraining();
//       setRecords(data);
//     } catch (e) {
//       console.error(e);
//       setError("Failed to load training records.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadRecords();
//   }, []);

//   const filtered = useMemo(() => {
//     return records.filter((row) => {
//       const matchesType = filters.type === "all" ? true : row.training_type === filters.type;
//       const matchesStatus = filters.status === "all" ? true : row.status === filters.status;
//       return matchesType && matchesStatus;
//     });
//   }, [records, filters]);

//   return (
//     <div style={{ width: "100%", maxWidth: 1440, margin: "0 auto" }}>


//       <div
//         style={{
//           marginTop: 18,
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
//           gap: 12,
//         }}
//       >

//         <CommonStatCard title="Total Training" value={records.length} icon={totalTrainingIcon} bg="#DBEAFE" />
//         <CommonStatCard title="No of Participants" value={records.length} icon={noOfParticipantsIcon} bg="#DCFCE7" />

//         <CommonStatCard title="Ongoing" value={records.filter((r) => r.status === "Ongoing").length} icon={ongoingIcon} bg="#FFEDD4" />
//       </div>
//       {/* Filter section  */}
//       <div
//         style={{
//           marginTop: 22,
//           background: "#fff",
//           border: `1px solid ${BORDER}`,
//           borderRadius: 12,
//           padding: 18,
//           display: "flex",
//           justifyContent: "space-between",
//           alignItems: "center",
//           flexWrap: "wrap",
//           gap: 12
//         }}
//       >
//         {/* Left: filters */}
//         <div
//           style={{
//             display: "flex",

//             gap: 12,
//             alignItems: "center",
//             flexWrap: "wrap",
//             minWidth: 0,
//           }}
//         >
//           <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
//             <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               <span style={{ color: "#475569", fontSize: 13 }}>Filter by Type</span>
//               <select
//                 value={filters.type}
//                 onChange={(e) => setFilters({ ...filters, type: e.target.value })}
//                 style={{
//                   minWidth: 284,
//                   height: 36,
//                   background: "#F3F3F5",
//                   borderRadius: 8,
//                   // border: `1px solid ${BORDER}`,
//                   padding: "0 12px",
//                   border: "none",
//                 }}
//               >
//                 <option value="all">All Types</option>
//                 <option value="Pre-Training">Pre-Training</option>
//                 <option value="Post-Training">Post-Training</option>
//                 <option value="Other">Other</option>
//               </select>
//             </label>
//             <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               <span style={{ color: "#475569", fontSize: 13 }}>Filter by Status</span>
//               <select
//                 value={filters.status}
//                 onChange={(e) => setFilters({ ...filters, status: e.target.value })}
//                 style={{
//                   minWidth: 284,
//                   height: 36,
//                   background: "#F3F3F5",
//                   borderRadius: 8,
//                   // border: `1px solid ${BORDER}`,
//                   padding: "0 12px",
//                   border: "none",
//                 }}
//               >
//                 <option value="all">All Status</option>
//                 <option value="Ongoing">Ongoing</option>
//                 <option value="Completed">Completed</option>
//                 <option value="Planned">Planned</option>
//               </select>
//             </label>
//           </div>
//         </div>

//         {/* Right: upload button */}
//         <div style={{ display: "flex", alignItems: "center" }}>
//           <button
//             type="button"
//             onClick={() => setShowModal(true)}
//             style={{
//               padding: "10px 16px",
//               background: PRIMARY,
//               color: "#fff",
//               border: "none",
//               borderRadius: 10,
//               display: "inline-flex",
//               alignItems: "center",
//               gap: 8,
//               fontWeight: 600,
//               cursor: "pointer",
//             }}
//           >
//             <FiPlus /> Upload Training
//           </button>
//         </div>
//       </div>

//       <div
//         style={{
//           marginTop: 18,
//           background: "#fff",
//           border: `1px solid ${BORDER}`, // Outer Card Border
//           borderRadius: 12,
//           padding: 20,
//         }}
//       >
//         <div style={{ marginTop: 10, overflowX: "auto" }}>
//           <div
//             style={{
//               marginBottom: 10,
//               marginLeft: 5,
//               color: "#0A0A0A",
//               fontSize: 16,
//               fontWeight: "600",
//             }}
//           >
//             Training Records
//           </div>

//           <table
//             style={{
//               width: "100%",
//               borderCollapse: "separate",
//               borderSpacing: 0,
//               // The Table's own border (The "Outside" border you wanted)
//               border: `1px solid ${BORDER}`,
//               borderRadius: 8,
//               // Vital for rounded corners to clip the content
//               overflow: "hidden",
//               minWidth: 900,
//             }}
//           >
//             <thead>
//               <tr
//                 style={{
//                   color: "#000000",
//                   borderBottom: `1px solid ${BORDER}`,
//                   textAlign: "left",
//                   fontWeight: 400,
//                   fontSize: 12,
//                   background: "#EFF7FF"

//                 }}
//               >
//                 {[
//                   "Name",
//                   "Training Name",
//                   "Type",
//                   "Start Date",
//                   "End Date",
//                   "Status",
//                   "Remarks",
//                 ].map((col) => (
//                   <th
//                     key={col}
//                     style={{
//                       padding: "12px 16px", // Increased padding slightly for look
//                       fontWeight: 600,
//                       // color: "#64748B",
//                       // Header always has a bottom border to separate from body
//                       borderBottom: `1px solid ${BORDER}`,
//                     }}
//                   >
//                     {col}
//                   </th>
//                 ))}
//               </tr>
//             </thead>

//             <tbody>
//               {!loading &&
//                 !error &&
//                 filtered.map((row, index) => {
//                   // Check if this is the last row
//                   const isLast = index === filtered.length - 1;

//                   return (
//                     <tr key={row.record_id}>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           fontWeight: 600,
//                           // Remove border if it's the last row, otherwise add divider
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {row.trainee_name}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {row.training_name}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {row.training_type}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {formatDate(row.start_date)}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {formatDate(row.end_date)}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         <StatusBadge status={row.status} />
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           color: "#475569",
//                           // The last cell also needs no bottom border
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {row.remarks}
//                       </td>
//                     </tr>
//                   );
//                 })}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {showModal && <TrainingModal onClose={() => setShowModal(false)} onCreated={loadRecords} />}
//     </div>
//   );
// }

// function Input({ label, ...rest }) {
//   return (
//     <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <span style={{ color: "#475569", fontSize: 13 }}>{label}</span>
//       <input
//         {...rest}
//         style={{
//           height: 40,
//           borderRadius: 8,
//           border: `1px solid ${BORDER}`,
//           padding: "0 12px",
//           background: "#F9FAFB",
//         }}
//       />
//     </label>
//   );
// }



// function TrainingModal({ onClose, onCreated }) {
//   const [form, setForm] = useState({
//     trainee_name: "",
//     training_name: "",
//     training_type: "Pre-Training",
//     start_date: "",
//     end_date: "",
//     status: "Ongoing",
//     remarks: "",
//   });

//   const [file, setFile] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState("");

//   const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");

//     try {
//       setSubmitting(true);
//       let storage_key;
//       let original_name;
//       let content_type;
//       let size_bytes;

//       if (file) {
//         const content_hash = await computeSha256(file);
//         const initRes = await recordsApi.initUpload("training-records", {
//           section: "training-records",
//           filename: file.name,
//           content_type: file.type || "application/octet-stream",
//           size_bytes: file.size,
//           content_hash,
//         });

//         await fetch(initRes.upload_url, { method: "PUT", body: file });

//         storage_key = initRes.storage_key;
//         original_name = file.name;
//         content_type = file.type || "application/octet-stream";
//         size_bytes = file.size;
//       }

//       await recordsApi.createTraining({
//         ...form,
//         start_date: form.start_date || undefined,
//         end_date: form.end_date || undefined,
//         storage_key,
//         original_name,
//         content_type,
//         size_bytes,
//       });

//       onClose();
//       if (onCreated) onCreated();
//     } catch (err) {
//       console.error(err);
//       setError("Failed to save training record.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div
//       style={{
//         position: "fixed",
//         inset: 0,
//         background: "rgba(15,23,42,0.4)",
//         display: "flex",
//         alignItems: "center",
//         justifyContent: "center",
//         padding: 12,
//         zIndex: 100,
//       }}
//     >
//       <div
//         style={{
//           width: "min(900px, 96vw)",
//           background: "#fff",
//           borderRadius: 12,
//           padding: "24px 28px",
//           boxShadow: "0 30px 70px rgba(15,23,42,0.25)",
//         }}
//       >
//         <div style={{ display: "flex", justifyContent: "space-between",height:50, alignItems:"center",flexShrink:0, marginTop:0 }}>
//           <div>
//             <h3 style={{ margin: 0 }}>Upload Files </h3>

//           </div>
//           <button
//             onClick={onClose}
//             aria-label="Close"
//             style={{
//               border: `1px solid ${BORDER}`,
//               background: "#fff",
//               borderRadius: 10,
//               padding: 8,
//               width: 36,
//               height: 36,
//               display: "inline-flex",
//               alignItems: "center",
//               justifyContent: "center",
//               cursor: "pointer",
//               fontSize: 18,
//               lineHeight: 1,

//             }}
//           >
//             ×
//           </button>
//         </div>

//         <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "70vh" }}>

//         {/* 👇 Upload box moved to TOP */}
//         <FileUploadBox
//           label="Upload Document"
//           description="Attach training related file here"
//           supported="PDF/Word"
//           file={file}
//           onFileSelected={(f) => setFile(f)}
//         />

//           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
//             <Input label="Trainee Name" value={form.trainee_name} onChange={(e) => onChange("trainee_name", e.target.value)} />
//             <Input label="Training Name" value={form.training_name} onChange={(e) => onChange("training_name", e.target.value)} />
//             <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               <span style={{ color: "#475569", fontSize: 13 }}>Type</span>
//               <select
//                 value={form.training_type}
//                 onChange={(e) => onChange("training_type", e.target.value)}
//                 style={{
//                   height: 40,
//                   borderRadius: 8,
//                   border: `1px solid ${BORDER}`,
//                   padding: "0 12px",
//                 }}
//               >
//                 <option value="Pre-Training">Pre-Training</option>
//                 <option value="Post-Training">Post-Training</option>
//                 <option value="Other">Other</option>
//               </select>
//             </label>
//             <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => onChange("start_date", e.target.value)} />
//             <Input label="End Date" type="date" value={form.end_date} onChange={(e) => onChange("end_date", e.target.value)} />
//             <Input label="Status" value={form.status} onChange={(e) => onChange("status", e.target.value)} />
//           </div>

//           <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//             <span style={{ color: "#475569", fontSize: 13 }}>Remarks</span>
//             <textarea
//               value={form.remarks}
//               onChange={(e) => onChange("remarks", e.target.value)}
//               rows={3}
//               style={{
//                 borderRadius: 8,
//                 border: `1px solid ${BORDER}`,
//                 padding: 10,
//                 background: "#F9FAFB",
//                 resize: "vertical",
//               }}
//             />
//           </label>

//           {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}

//           <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
//             <button
//               type="button"
//               onClick={onClose}
//               style={{
//                 border: `1px solid ${BORDER}`,
//                 background: "#fff",
//                 padding: "10px 16px",
//                 borderRadius: 10,
//                 cursor: "pointer",
//               }}
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={submitting}
//               style={{
//                 border: "none",
//                 background: PRIMARY,
//                 color: "#fff",
//                 padding: "10px 18px",
//                 borderRadius: 10,
//                 fontWeight: 600,
//                 cursor: submitting ? "not-allowed" : "pointer",
//                 opacity: submitting ? 0.7 : 1,
//               }}
//             >
//               {submitting ? "Saving..." : "Save"}
//             </button>
//           </div>
//         </form>

//       </div>
//     </div>
//   );
// }

import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud, FiSearch } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import totalTrainingIcon from "../../assets/reports.svg";
import noOfParticipantsIcon from "../../assets/UsersThree_green.svg";
import ongoingIcon from "../../assets/SpinnerGap.svg";
import load from "../../assets/load.svg";
import Cap1 from "../../assets/Cap1.svg";

import CommonStatCard from "../../components/common/common_card/common_card";
import FileUploadBox from "../../components/common/FileUploadBox";
import DocumentActions from "../../components/common/DocumentActions";
import EmptySection from "../../components/common/EmptyProject";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { useDownload } from "../../components/common/useDownload";


const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");


/* --------------------- Status Badge --------------------- */
function StatusBadge({ status }) {
  const palette = {
    Completed: { bg: "#DCFCE7", text: "#15803D" },
    Ongoing: { bg: "#E0F2FE", text: "#0369A1" },
    Planned: { bg: "#DBEAFE", text: "#1D4ED8" },
  }[status] || { bg: "#E5E7EB", text: "#4B5563" };

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
      {status}
    </span>
  );
}

/* --------------------- Main Component --------------------- */
export default function TrainingRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);
  // State for editing the record
  const [editingRecord, setEditingRecord] = useState(null);

  /** 🔴 NEW — Delete Modal State */
      const [showDeleteModal, setShowDeleteModal] = useState(false);
      const [recordToDelete, setRecordToDelete] = useState(null);
  
      const { download, view, loadingFiles, errorFiles } = useDownload(recordsApi.downloadTraining);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await recordsApi.listTraining();
      setRecords(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load training records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();

  return records.filter((row) => {
    const matchesType =
      filters.type === "all" || row.training_type === filters.type;

    const matchesStatus =
      filters.status === "all" || row.status === filters.status;

    const matchesSearch =
      !q ||
      row.trainee_name?.toLowerCase().includes(q) ||
      row.training_name?.toLowerCase().includes(q);

    return matchesType && matchesStatus && matchesSearch;
  });
}, [records, filters, search]);


  // const filtered = useMemo(() => {
  //   return records.filter((row) => {
  //     const matchesType = filters.type === "all" ? true : row.training_type === filters.type;
  //     const matchesStatus = filters.status === "all" ? true : row.status === filters.status;
  //     const matchesSearch =
  //     !searchText ||
  //     row.name?.toLowerCase().includes(searchText) ||
  //     row.training_name?.toLowerCase().includes(searchText);
  //     return matchesType && matchesStatus && matchesSearch;
  //   });
  // }, [records, filters, search]);

  /* --------------------- Action Handlers --------------------- */

  const handleView = async (row) => {
    try {
      const res = await recordsApi.downloadTraining(row.record_id);
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Unable to open this record.");
    }
  };

    const handleDownload = (row) => {
  if (!row?.record_id) return;
  download(row.record_id);
};

  // const handleDownload = async (row) => {
  //   try {
  //     const res = await recordsApi.downloadTraining(row.record_id);
  //     const link = document.createElement("a");
  //     link.href = res.download_url;
  //     link.download = row.original_name || "training-record";
  //     link.click();
  //     link.remove();
  //   } catch (err) {
  //     alert("Download failed. Please try again.");
  //   }
  // };

  // const handleDelete = async (row) => {
  //   if (!window.confirm("Delete this training record?")) return;
  //   try {
  //     await recordsApi.removeTraining(row.record_id);
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
    await recordsApi.removeTraining(recordToDelete.record_id);
    setRecords((prev) => prev.filter((r) => r.record_id !== recordToDelete.record_id));
  } catch (err) {
    alert("Unable to delete record.");
  }

  setShowDeleteModal(false);
  setRecordToDelete(null);
};



  // New handler for editing
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

  /* --------------------- Rendering --------------------- */
  return (
    <div style={{ width: "100%", maxWidth: 1640, margin: "0 auto", height:"100%" }}>
      {/* Stat Cards */}
      <div
        style={{
          
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "24px",
        }}
      >
        <CommonStatCard title="Total Training" value={records.length} icon={totalTrainingIcon} bg="#DBEAFE" />
        <CommonStatCard title="No of Participants" value={
          // Simple count of records, ideally should sum participant counts if available
          records.length
        } icon={noOfParticipantsIcon} bg="#DCFCE7" />
        <CommonStatCard title="Ongoing" value={records.filter((r) => r.status === "Ongoing").length} icon={ongoingIcon} bg="#FFEDD4" />
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
          gap: "18px",
        }}
      >
           <div style={{flex:1, maxWidth:"900px", height:"42px",display:"flex",gap: "8px",background: "#f8fafc",border: "1px solid #e2e8f0",borderRadius: "0px",padding: "12px 24px"}}>
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
                placeholder="Search training names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                />
        </div>
          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* <span style={{ color: "#0a0a0a", fontSize: 14, fontFamily: "Inter-Medium, Helvetica", fontWeight:500}}>Filter by Type</span> */}
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                style={{
                  minWidth: "284px",
                  height: "42px",
                  background: "#F3F3F5",
                  borderRadius: "8px",
                  padding: "0 12px",
                  paddingRight: 32, // space for arrow
                  color: "#374151",
                  fontSize: 14,
                  lineHeight: "36px",
                  appearance: "none",
                  border: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "10px 6px",
                }}
              >
                <option value="all">All Types</option>
                <option value="Pre-Training">Pre-Training</option>
                <option value="Post-Training">Post-Training</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* <span style={{color: "#0a0a0a", fontSize: 14, fontFamily: "Inter-Medium, Helvetica", fontWeight:500 }}>Filter by Status</span> */}
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={{
                  minWidth: "284px",
                  height: "42px",
                  background: "#F3F3F5",
                  borderRadius: "8px",
                  padding: "0 12px",
                  paddingRight: 32, // space for arrow
    color: "#374151",
    fontSize: 14,
    lineHeight: "36px",
    appearance: "none",
    border: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    backgroundSize: "10px 6px",
                }}
              >
                <option value="all">All Status</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Planned">Planned</option>
              </select>
            </label>
          </div>
        

        
        

        {/* Right: upload button */}
        
          <button
            type="button"
            onClick={() => { setEditingRecord(null); setShowModal(true); }} // Ensure editingRecord is null for new upload
            style={{
              padding: "10px 16px",
              background: PRIMARY,
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              cursor: "pointer",
              width:"200px",
              height:"42px",
              justifyContent:"center",
            }}
          >
          <img src={Cap1} alt="Training"/>
           Upload Training
          </button>
        </div>
    

      {/* Table Section */}
      <div
        style={{
          marginTop: 23,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: "8px",
          padding: "10px 24px 24px 24px",
          display:"block",
          flexDirection:"column",
          height: "calc(68vh - 70px)", // adjust if header size changes
        }}
      >
        <div style={{ marginTop: 10, maxHeight:"100%", overflowX: "auto",overflowY: "auto" }}>
          <div
            style={{
              marginBottom: 10,
              marginLeft: 5,
              color: "#0A0A0A",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Training Records
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              marginTop:"20px"
            }}
          >
            <thead>
              <tr
                style={{
                  color: "#000000",
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: "left",
                  fontWeight: 400,
                  fontSize: "14px",
                  background: "#EFF7FF"
                }}
              >
                {[
                  "Name",
                  "Training Name",
                  "Type",
                  "Start Date",
                  "End Date",
                  "Status",
                  "Remarks",
                  "Action"
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "12px 16px",
                      fontWeight: 600,
                      borderBottom: `1px solid ${BORDER}`,
                      flexshrink: 0,
                      zindex: 10, 
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody style={{ textAlign: "left",fontSize:"12px",fontWeight:400, color:"#717182", fontFamily:"Inter-Regular, Helvetica" }}>
              {/* Conditional rendering for loading, error, and no results */}
              {loading && (
                <tr><td colSpan={8} style={{ padding: 16, textAlign: "center" }}>Loading...</td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#b91c1c" }}>{error}</td></tr>
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

              {/* Data rows */}
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
                        {row.trainee_name}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.training_name}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.training_type}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {formatDate(row.start_date)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {formatDate(row.end_date)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        <StatusBadge status={row.status} />
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: "#475569",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.remarks}
                      </td>
                      {/* ADDED ACTION COLUMN CELL */}
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        <DocumentActions
                          doc={{ id: row.record_id, fileName: row.original_name }}
                          onEdit={() => handleEdit(row)} // Call handleEdit
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
        <TrainingModal
          onClose={closeModal}
          onCreated={loadRecords}
          editingRecord={editingRecord} // Pass the editing record
          onUpdated={handleUpdate} // Handle successful update
        />
      )}

      {showDeleteModal && (
              <ConfirmationModal
                title="Delete this training record?"
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
          fontSize:14,
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
function TrainingModal({ onClose, onCreated, onUpdated, editingRecord }) {
  const [form, setForm] = useState({
    trainee_name: "",
    training_name: "",
    training_type: "Pre-Training",
    start_date: "",
    end_date: "",
    status: "Ongoing",
    remarks: "",
  });

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Populate form fields if editingRecord is provided
  useEffect(() => {
    if (editingRecord) {
      setForm({
        trainee_name: editingRecord.trainee_name || "",
        training_name: editingRecord.training_name || "",
        training_type: editingRecord.training_type || "Pre-Training",
        // Format date for input type="date"
        start_date: editingRecord.start_date ? editingRecord.start_date.split('T')[0] : "",
        end_date: editingRecord.end_date ? editingRecord.end_date.split('T')[0] : "",
        status: editingRecord.status || "Ongoing",
        remarks: editingRecord.remarks || "",
      });
      setFile(null); // Clear file input when opening for edit
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
        const initRes = await recordsApi.initUpload("training-records", {
          section: "training-records",
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
        // content_hash is already set
      }

      // 2. Prepare Payload
      const payload = {
        ...form,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        storage_key,
        original_name,
        content_type,
        size_bytes,
        content_hash,
      };

      let result;

      // 3. Call Create or Update API
      if (editingRecord) {
        result = await recordsApi.updateTraining(editingRecord.record_id, payload);
        onUpdated?.(result); // Notify parent of update
      } else {
        result = await recordsApi.createTraining(payload);
        onCreated?.(result); // Notify parent of creation
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save training record.");
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
          width: "min(900px, 96vw)",
          background: "#fff",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 30px 70px rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", height: 50, alignItems: "center", flexShrink: 0, marginTop: "-20px"}}>
          <div>
            <h3 style={{ margin: 0 }}>{editingRecord ? "Edit Training Record" : "Upload Training Record"}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: "8px",
              padding: 8,
              width: 30,
              height: 30,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,

            }}
          >
            X
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "70vh" }}>

          <FileUploadBox
            label="Upload Document"
            description="Attach training related file here"
            supported="PDF/Word"
            file={file}
            onFileSelected={(f) => setFile(f)}
            // Display current file name if editing and no new file selected
            currentFileName={editingRecord && !file ? editingRecord.original_name : null}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <Input style={{borderRadius: "8px",background:"#F3F3F5"}} label="Trainee Name" value={form.trainee_name} onChange={(e) => onChange("trainee_name", e.target.value)} />
            <Input style={{borderRadius: "8px",background:"#F3F3F5"}}  label="Training Name" value={form.training_name} onChange={(e) => onChange("training_name", e.target.value)} />
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#475569", fontSize: 13 }}>Type</span>
              <select
                value={form.training_type}
                onChange={(e) => onChange("training_type", e.target.value)}
                style={{
                  height: 40,
                  borderRadius: "8px",
                  border: `1px solid ${BORDER}`,
                  padding: "0 12px",
                  appearance: "none",
              WebkitAppearance: "none",
                  MozAppearance: "none",
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
                }}
              >
                <option value="Pre-Training">Pre-Training</option>
                <option value="Post-Training">Post-Training</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <Input style={{borderRadius: "8px",background:"#F3F3F5",color:"#717182"}} label="Start Date" type="date" value={form.start_date} onChange={(e) => onChange("start_date", e.target.value)} />
            <Input style={{borderRadius: "8px",background:"#F3F3F5",color:"#717182"}} label="End Date" type="date" value={form.end_date} onChange={(e) => onChange("end_date", e.target.value)} />
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#475569", fontSize: 13 }}>Status</span>
              <select
                value={form.status}
                onChange={(e) => onChange("status", e.target.value)}
                style={{
                  height: 40,
                  borderRadius: "8px",
                  border: `1px solid ${BORDER}`,
                  padding: "0 12px",
                  appearance: "none",
              WebkitAppearance: "none",
                  MozAppearance: "none",
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
                  
                }}
              >
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Planned">Planned</option>
              </select>
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Note</span>
            <textarea
              value={form.remarks}
              onChange={(e) => onChange("remarks", e.target.value)}
              rows={3}
              style={{
                borderRadius: "8px",
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