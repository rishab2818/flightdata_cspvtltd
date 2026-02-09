
// import React, { useEffect, useMemo, useState } from "react";
// import { FiDownload, FiPlus, FiUploadCloud } from "react-icons/fi";
// import { recordsApi } from "../../api/recordsApi";
// import { computeSha256 } from "../../lib/fileUtils";
// import { downloadExcel } from "../../lib/excelExport";

// import totalRecord from "../../assets/customer.svg";
// import CommonStatCard from "../../components/common/common_card/common_card";
// import avergaeRating from "../../assets/Star.svg";
// import pending_review from "../../assets/SpinnerGap.svg";
// // 1 import docuemnt actions
// import DocumentActions from "../../components/common/DocumentActions";

// const BORDER = "#E2E8F0";
// const PRIMARY = "#1976D2";
// const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");

// /* --------------------- Rating Badge --------------------- */
// function Rating({ value }) {
//   return (
//     <span style={{ color: "#F59E0B", fontWeight: 700 }}>
//       {Number(value || 0).toFixed(1)} ★
//     </span>
//   );
// }

// /* --------------------- Main Component --------------------- */
// export default function CustomerFeedbacks() {
//   const [records, setRecords] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [filters, setFilters] = useState({ type: "all", status: "all" });
//   const [showModal, setShowModal] = useState(false);
//   // For editing the document
//   const [editingRecord, setEditingRecord] = useState(null);

//   const loadRecords = async () => {
//     try {
//       setLoading(true);
//       setError("");
//       const data = await recordsApi.listFeedbacks();
//       setRecords(data);
//     } catch (e) {
//       console.error(e);
//       setError("Failed to load customer feedbacks.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadRecords();
//   }, []);

//   const filtered = useMemo(() => {
//     return records.filter((row) => {
//       // Corrected filter: division should match filters.type
//       const matchesType = filters.type === "all" ? true : row.division === filters.type;
//       return matchesType;
//     });
//   }, [records, filters]);

//   const handleExport = () => {
//     const columns = [
//       { header: "Project Name", key: "project_name" },
//       { header: "Division", key: "division" },
//       { header: "Feedback", key: "feedback_text" },
//       { header: "Ratings", key: "rating" },
//       {
//         header: "Feedback Date",
//         accessor: (row) => (row.feedback_date ? new Date(row.feedback_date).toLocaleDateString("en-GB") : ""),
//       },
//       { header: "Attachment", accessor: (row) => row.original_name || "" },
//     ];

//     downloadExcel({
//       rows: filtered,
//       columns,
//       fileName: "customer-feedbacks",
//       sheetName: "Feedbacks",
//     });
//   };

//   return (
//     /* Card UI */
//     <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto" }}>
//       {/* Stat Cards */}
//       <div
//         style={{
//           marginTop: 18,
//           display: "grid",
//           gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
//           gap: 12,
//         }}
//       >
//         <CommonStatCard title="Total Feedbacks" value={records.length} icon={totalRecord} bg="#DBEAFE" />
//         <CommonStatCard title="Average Rating" value={averageRating} icon={avergaeRating} bg="#DCFCE7" />
//         {/* Placeholder for Pending Review (currently just showing total count again) */}
//         <CommonStatCard title="Pending Review" value={records.length} icon={pending_review} bg="#FFEDD4" />
//       </div>

//       {/* FILTER SECTION CARD */}
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
//           gap: 12,
//         }}
//       >
//         {/* Filter By Division */}
//         <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//           <span style={{ color: "#475569", fontSize: 13 }}>Filter by Division</span>
//           <select
//             value={filters.type}
//             onChange={(e) => setFilters({ ...filters, type: e.target.value })}
//             style={{
//               minWidth: 200,
//               height: 38,
//               borderRadius: 8,
//               border: `1px solid ${BORDER}`,
//               padding: "0 12px",
//             }}
//           >
//             <option value="all">All Divisions</option>
//             {[...new Set(records.map((r) => r.division))].filter(Boolean)
//               .map((div) => (
//                 <option value={div} key={div}>{div}</option>
//               ))}
//           </select>
//         </label>

//         {/* Upload Button */}
//         <button
//           onClick={() => setShowModal(true)}
//           style={{
//             padding: "10px 16px",
//             background: PRIMARY,
//             color: "#fff",
//             border: "none",
//             borderRadius: 10,
//             display: "inline-flex",
//             alignItems: "center",
//             gap: 8,
//             fontWeight: 600,
//             cursor: "pointer",
//           }}
//         >
//           <FiPlus /> Upload Feedback
//         </button>
//       </div>

//       {/* TABLE SECTION CARD */}
//       <div
//         style={{
//           marginTop: 18,
//           background: "#fff",
//           border: `1px solid ${BORDER}`,
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
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "space-between",
//               gap: 12,
//             }}
//           >
//             <span>Feedbacks Records</span>
//             <button
//               type="button"
//               onClick={handleExport}
//               style={{
//                 display: "inline-flex",
//                 alignItems: "center",
//                 gap: 8,
//                 padding: "10px 14px",
//                 borderRadius: 10,
//                 border: `1px solid ${BORDER}`,
//                 background: PRIMARY,
//                 color: "#fff",
//                 fontWeight: 700,
//                 cursor: "pointer",
//               }}
//             >
//               <FiDownload /> Download
//             </button>
//           </div>
//           <table
//             style={{
//               width: "100%",
//               borderCollapse: "separate",
//               borderSpacing: 0,
//               border: `1px solid ${BORDER}`, // Outer border
//               borderRadius: 8,
//               overflow: "hidden", // Clips corners
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
//                   background: "#EFF7FF",
//                 }}
//               >
//                 {["Project Name", "Division", "Feedback", "Ratings", "Feedback Date", "Action"].map(
//                   (col) => (
//                     <th
//                       key={col}
//                       style={{
//                         padding: "12px 16px",
//                         fontWeight: 600,
//                         borderBottom: `1px solid ${BORDER}`, // Header separator
//                       }}
//                     >
//                       {col}
//                     </th>
//                   )
//                 )}
//               </tr>
//             </thead>
//             <tbody>
//               {loading && (
//                 <tr>
//                   <td colSpan={6} style={{ padding: 16, textAlign: "center" }}>
//                     Loading...
//                   </td>
//                 </tr>
//               )}
//               {!loading && error && (
//                 <tr>
//                   <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#b91c1c" }}>
//                     {error}
//                   </td>
//                 </tr>
//               )}
//               {!loading && !error && filtered.length === 0 && (
//                 <tr>
//                   <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#94A3B8" }}>
//                     No feedback records found.
//                   </td>
//                 </tr>
//               )}
//               {!loading &&
//                 !error &&
//                 filtered.map((row, index) => {
//                   const isLast = index === filtered.length - 1;

//                   return (
//                     <tr key={row.record_id}>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           fontWeight: 600,
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {row.project_name}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {row.division}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           color: "#475569",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {row.feedback_text}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         <Rating value={row.rating} />
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         {formatDate(row.feedback_date)}
//                       </td>
//                       <td
//                         style={{
//                           padding: "12px 16px",
//                           borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
//                         }}
//                       >
//                         <DocumentActions
//                           doc={{ id: row.record_id, fileName: row.original_name }}
//                           onEdit={() => handleEdit(row)}
//                           onView={() => handleView(row)}
//                           onDownload={() => handleDownload(row)}
//                           onDelete={() => handleDelete(row)}
//                         />
//                       </td>
//                     </tr>
//                   );
//                 })}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {showModal && (
//         <FeedbackModal
//           onClose={closeModal}
//           onCreated={loadRecords}
//           editingRecord={editingRecord}
//           onUpdated={(updated) => {
//             setRecords((prev) =>
//               prev.map((r) =>
//                 r.record_id === updated.record_id ? updated : r
//               )
//             );
//           }}
//         />
//       )}
//     </div>
//   );
// }

// /* --------------------- Input Component --------------------- */
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

// /* --------------------- Modal Component --------------------- */
// function FeedbackModal({ onClose, onCreated, onUpdated, editingRecord }) {
//   const [form, setForm] = useState({
//     project_name: "",
//     division: "",
//     // feedback_from: "", // Removed as it was commented out in the form, but kept below for consistency
//     rating: "",
//     feedback_date: "",
//     feedback_text: "",
//   });
//   const [file, setFile] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState("");

//   const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

//   // Populate form when editingRecord changes
//   useEffect(() => {
//     if (!editingRecord) return;

//     setForm({
//       project_name: editingRecord.project_name || "",
//       division: editingRecord.division || "",
//       feedback_from: editingRecord.feedback_from || "", // Assuming this is part of the API model
//       rating: editingRecord.rating ?? "",
//       feedback_date: editingRecord.feedback_date ? editingRecord.feedback_date.split('T')[0] : "", // Format date for input type="date"
//       feedback_text: editingRecord.feedback_text || "",
//     });
//     setFile(null); // Clear file input on edit
//     setError("");
//   }, [editingRecord]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");

//     try {
//       setSubmitting(true);

//       // Initialize file-related variables with existing record data if editing
//       let storage_key = editingRecord ? editingRecord.storage_key : null;
//       let original_name = editingRecord ? editingRecord.original_name : "";
//       let content_type = editingRecord ? editingRecord.content_type : "";
//       let size_bytes = editingRecord ? editingRecord.size_bytes : null;
//       let content_hash = editingRecord ? editingRecord.content_hash : ""; // Added content_hash for consistency

//       // 1. Handle NEW file upload
//       if (file) {
//         content_hash = await computeSha256(file);
//         const initRes = await recordsApi.initUpload("customer-feedbacks", {
//           section: "customer-feedbacks",
//           filename: file.name,
//           content_type: file.type || "application/octet-stream",
//           size_bytes: file.size,
//           content_hash,
//         });

//         await fetch(initRes.upload_url, { method: "PUT", body: file });

//         // Update metadata for the payload
//         storage_key = initRes.storage_key;
//         original_name = file.name;
//         content_type = file.type || "application/octet-stream";
//         size_bytes = file.size;
//         // content_hash is already set
//       }

//       // 2. Prepare the final payload
//       const payload = {
//         ...form,
//         rating: form.rating === "" ? undefined : Number(form.rating || 0),
//         // Ensure date is formatted correctly if needed, otherwise rely on API to handle ISO format
//         feedback_date: form.feedback_date || undefined,
//         storage_key,
//         original_name,
//         content_type,
//         size_bytes,
//         content_hash,
//       };

//       let result;

//       // 3. Call the correct API based on editing state
//       if (editingRecord) {
//         // **FIXED LOGIC HERE**
//         result = await recordsApi.updateFeedback(editingRecord.record_id, payload);
//         onUpdated?.(result);
//       } else {
//         result = await recordsApi.createFeedback(payload);
//         onCreated?.(result);
//       }

//       onClose();
//     } catch (err) {
//       console.error(err);
//       setError("Failed to save feedback.");
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
//           width: "min(840px, 96vw)",
//           background: "#fff",
//           borderRadius: 12,
//           padding: "24px 28px",
//           boxShadow: "0 30px 70px rgba(15,23,42,0.25)",
//         }}
//       >
//         <div style={{ display: "flex", justifyContent: "space-between" }}>
//           <div>
//             <h3 style={{ margin: 0 }}>{editingRecord ? "Edit Feedback" : "Upload Feedback"}</h3>
//             <p style={{ margin: "6px 0 0", color: "#64748B" }}>
//               Capture customer comments, division, and documents.
//             </p>
//           </div>
//           <button
//             onClick={onClose}
//             style={{
//               border: `1px solid ${BORDER}`,
//               background: "#fff",
//               borderRadius: 10,
//               padding: "8px 12px",
//               cursor: "pointer",
//             }}
//           >
//             Close
//           </button>
//         </div>

//         <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
//           <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
//             <Input label="Project Name" value={form.project_name} onChange={(e) => onChange("project_name", e.target.value)} />
//             <Input label="Division" value={form.division} onChange={(e) => onChange("division", e.target.value)} />
//             {/* <Input label="Feedback Received" value={form.feedback_from} onChange={(e) => onChange("feedback_from", e.target.value)} /> */}
//             <Input label="Ratings" type="number" step="0.1" value={form.rating} onChange={(e) => onChange("rating", e.target.value)} />
//             <Input label="Feedback Date" type="date" value={form.feedback_date} onChange={(e) => onChange("feedback_date", e.target.value)} />
//           </div>
//           <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//             <span style={{ color: "#475569", fontSize: 13 }}>Feedback Text</span>
//             <textarea
//               value={form.feedback_text}
//               onChange={(e) => onChange("feedback_text", e.target.value)}
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

//           <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//             <span style={{ color: "#475569", fontSize: 13 }}>Upload Document {editingRecord && !file ? "(Existing file attached)" : ""}</span>
//             <div
//               style={{
//                 border: `1px dashed ${BORDER}`,
//                 borderRadius: 10,
//                 padding: "10px 12px",
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 10,
//               }}
//             >
//               <FiUploadCloud />
//               <input
//                 type="file"
//                 onChange={(e) => setFile(e.target.files?.[0] || null)}
//                 style={{ flex: 1 }}
//               />
//             </div>
//             {editingRecord?.original_name && !file && (
//               <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>
//                 Current File: **{editingRecord.original_name}**. Upload a new file to replace it.
//               </p>
//             )}
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
//               {submitting ? "Saving..." : editingRecord ? "Save Changes" : "Save"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";

import totalRecord from "../../assets/customer.svg";
import CommonStatCard from "../../components/common/common_card/common_card";
import avergaeRating from "../../assets/Star.svg";
import pending_review from "../../assets/SpinnerGap.svg";
import Book2 from "../../assets/Book2.svg";
import load from "../../assets/load.svg";

// 1 import docuemnt actions
import DocumentActions from "../../components/common/DocumentActions";
import FileUploadBox from "../../components/common/FileUploadBox";
import EmptySection from "../../components/common/EmptyProject";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { useDownload } from "../../components/common/useDownload";


const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");

/* --------------------- Rating Badge --------------------- */
function Rating({ value }) {
  return (
    <span style={{ color: "#F59E0B", fontWeight: 700 }}>
      {Number(value || 0).toFixed(1)} ★
    </span>
  );
}

/* --------------------- Main Component --------------------- */
export default function CustomerFeedbacks() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);
  // For editing the document
  const [editingRecord, setEditingRecord] = useState(null);

  /** 🔴 NEW — Delete Modal State */
      const [showDeleteModal, setShowDeleteModal] = useState(false);
      const [recordToDelete, setRecordToDelete] = useState(null);

      const { download, view, loadingFiles, errorFiles } = useDownload(recordsApi.downloadFeedback);

//       const { download, view, loadingFiles, errorFiles } = useDownload(
//   (recordId) => recordsApi.downloadFeedback(recordId)
// );


  const loadRecords = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await recordsApi.listFeedbacks();
      setRecords(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load customer feedbacks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const filtered = useMemo(() => {
    return records.filter((row) => {
      // Corrected filter: division should match filters.type
      const matchesType = filters.type === "all" ? true : row.division === filters.type;
      return matchesType;
    });
  }, [records, filters]);

  // handle view
  // const handleView = async (row) => {
  //   try {
  //     const res = await recordsApi.downloadFeedback(row.record_id);
  //     window.open(res.download_url, "_blank", "noopener,noreferrer");
  //   } catch (err) {
  //     alert("Unable to open this file.");
  //   }
  // };

     const handleView = (row) => {
  if (!row?.record_id) return;
  view(row.record_id);
};

  const handleDownload = (row) => {
  if (!row?.record_id) return;
  download(row.record_id);
};

//     const handleDownload = (row) => {
//   if (!row?.record_id) return;
//   download(row.record_id);
// };


  // handle download
  // const handleDownload = async (row) => {
  //   try {
  //     const res = await recordsApi.downloadFeedback(row.record_id);
  //     const link = document.createElement("a");
  //     link.href = res.download_url;
  //     link.download = row.original_name || "feedback-file";
  //     link.click();
  //     link.remove();
  //   } catch (err) {
  //     alert("Download failed. Please try again.");
  //   }
  // };

  // // handle delete
  // const handleDelete = async (row) => {
  //   if (!window.confirm("Delete this feedback?")) return;
  //   try {
  //     await recordsApi.removeFeedback(row.record_id);
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
    await recordsApi.removeFeedback(recordToDelete.record_id);

    setRecords((prev) =>
      prev.filter((r) => r.record_id !== recordToDelete.record_id)
    );
  } catch (err) {
    alert("Unable to delete record.");
  }

  setShowDeleteModal(false);
  setRecordToDelete(null);
};


  // handle edit
  const handleEdit = (row) => {
    setEditingRecord(row);
    setShowModal(true);
  };

  // Calculate Average Rating for Stat Card
  const averageRating = useMemo(() => {
    const totalRating = records.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
    return (totalRating / (records.length || 1)).toFixed(1);
  }, [records]);

  // Handle closing modal
  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
  };

  return (
    /* Card UI */
    <div style={{ width: "100%", maxWidth: 1640, margin: "0 auto", height:"100%", marginTop:"-18px" }}>
      {/* Stat Cards */}
      <div
        style={{
          marginTop: 18,
          borderRadius:"8px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "24px",
        }}
      >
        <CommonStatCard title="Total Feedbacks" value={records.length} icon={totalRecord} bg="#DBEAFE" />
        <CommonStatCard title="Average Rating" value={averageRating} icon={avergaeRating} bg="#DCFCE7" />
        {/* Placeholder for Pending Review (currently just showing total count again) */}
        <CommonStatCard title="Pending Review" value={records.length} icon={pending_review} bg="#FFEDD4" />
      </div>

      {/* FILTER SECTION CARD */}
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
          gap: 12,
        }}
      >
        {/* Filter By Division */}
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "#0a0a0a", fontSize: 14, fontFamily: "Inter-Medium, Helvetica", fontWeight:500 }}>Filter by Division</span>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              style={{
    minWidth: 270,
    height: 36,
    borderRadius: "8px",
    backgroundColor: "#F3F3F5",
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
            <option value="all">All Divisions</option>
            {[...new Set(records.map((r) => r.division))].filter(Boolean)
              .map((div) => (
                <option value={div} key={div}>{div}</option>
              ))}
          </select>
        </label>

        {/* Upload Button */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 16px",
            background: PRIMARY,
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent:"center",
            gap: "8px",
            fontWeight: 600,
            width: "190px",
            cursor: "pointer",
          }}
        >
           <img src={Book2} alt="Feedback"/>
           Upload Feedback
        </button>
      </div>

      {/* TABLE SECTION CARD */}
      <div
        style={{
          marginTop: 22,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: "8px",
          padding: "10px 24px 24px 24px",
          display:"block",
          flexDirection:"column",
          gap:16,
          height: "calc(68vh - 70px)", // adjust if header size changes
        }}
      >
        <div style={{ marginTop: 10,maxHeight:"45vh", overflowX: "auto",overflowY: "auto" }}>
          <div
            style={{
              marginBottom: 20,
              marginLeft: 5,
              color: "#0A0A0A",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Feedbacks Records
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              border: `1px solid ${BORDER}`, // Outer border
              borderRadius: "8px",
              overflow: "hidden", // Clips corners
              minWidth: 900,
              gap:16,
              marginTop:"20px",
            }}
          >
            <thead>
              <tr
                style={{
                  color: "#000000",
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: "left",
                  fontWeight: 400,
                  fontSize: 14,
                  background: "#EFF7FF",
                  fontFamily:"Inter-Regular, Helvetica",
                }}
              >
                {["Project Name", "Division", "Note", "Ratings", "Feedback Date", "Action"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,
                        textAlign: "left",
                        borderBottom: `1px solid ${BORDER}`, // Header separator
                      }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody style={{ fontSize:"12px",fontWeight:400,textAlign: "left", color:"#717182", fontFamily:"Inter-Regular, Helvetica" }}>
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
                        {row.project_name}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.division}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: "#475569",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.feedback_text}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        <Rating value={row.rating} />
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {formatDate(row.feedback_date)}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        <DocumentActions
                          doc={{ id: row.record_id, fileName: row.original_name }}
                          onEdit={() => handleEdit(row)}
                          onDownload={() => download(row.record_id)}
                          onView={() => view(row.record_id)}
                           onDelete={() => {
                       setRecordToDelete(row);
                       setShowDeleteModal(true);
                      }}
                      // loading={loadingFiles[row.record_id]}

                        />
                        {/* {errorFiles[row.record_id] && (
                <p style={{ color: "red", fontSize: "12px" }}>
                  {errorFiles[row.record_id]}
                </p>
              )} */}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <FeedbackModal
          onClose={closeModal}
          onCreated={loadRecords}
          editingRecord={editingRecord}
          onUpdated={(updated) => {
            setRecords((prev) =>
              prev.map((r) =>
                r.record_id === updated.record_id ? updated : r
              )
            );
          }}
        />
      )}

      {showDeleteModal && (
        <ConfirmationModal
          title="Delete This Feedback?"
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
      <span style={{ color: "#475569", fontSize: 13 }}>{label}</span>
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

/* --------------------- Modal Component --------------------- */
function FeedbackModal({ onClose, onCreated, onUpdated, editingRecord }) {
  const [form, setForm] = useState({
    project_name: "",
    division: "",
    // feedback_from: "", // Removed as it was commented out in the form, but kept below for consistency
    rating: "",
    feedback_date: "",
    feedback_text: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Populate form when editingRecord changes
  useEffect(() => {
    if (!editingRecord) return;

    setForm({
      project_name: editingRecord.project_name || "",
      division: editingRecord.division || "",
      feedback_from: editingRecord.feedback_from || "", // Assuming this is part of the API model
      rating: editingRecord.rating ?? "",
      feedback_date: editingRecord.feedback_date ? editingRecord.feedback_date.split('T')[0] : "", // Format date for input type="date"
      feedback_text: editingRecord.feedback_text || "",
    });
    setFile(null); // Clear file input on edit
    setError("");
  }, [editingRecord]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);

      // Initialize file-related variables with existing record data if editing
      let storage_key = editingRecord ? editingRecord.storage_key : null;
      let original_name = editingRecord ? editingRecord.original_name : "";
      let content_type = editingRecord ? editingRecord.content_type : "";
      let size_bytes = editingRecord ? editingRecord.size_bytes : null;
      let content_hash = editingRecord ? editingRecord.content_hash : ""; // Added content_hash for consistency

      // 1. Handle NEW file upload
      if (file) {
        content_hash = await computeSha256(file);
        const initRes = await recordsApi.initUpload("customer-feedbacks", {
          section: "customer-feedbacks",
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          content_hash,
        });

        await fetch(initRes.upload_url, { method: "PUT", body: file });

        // Update metadata for the payload
        storage_key = initRes.storage_key;
        original_name = file.name;
        content_type = file.type || "application/octet-stream";
        size_bytes = file.size;
        // content_hash is already set
      }

      // 2. Prepare the final payload
      const payload = {
        ...form,
        rating: form.rating === "" ? undefined : Number(form.rating || 0),
        // Ensure date is formatted correctly if needed, otherwise rely on API to handle ISO format
        feedback_date: form.feedback_date || undefined,
        storage_key,
        original_name,
        content_type,
        size_bytes,
        content_hash,
      };

      let result;

      // 3. Call the correct API based on editing state
      if (editingRecord) {
        // **FIXED LOGIC HERE**
        result = await recordsApi.updateFeedback(editingRecord.record_id, payload);
        onUpdated?.(result);
      } else {
        result = await recordsApi.createFeedback(payload);
        onCreated?.(result);
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save feedback.");
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
         borderRadius: "8px",
        padding: 12,
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: "min(840px, 96vw)",
          background: "#fff",
          borderRadius: "8px",
          padding: "24px 28px",
          boxShadow: "0 30px 70px rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0 }}>{editingRecord ? "Edit Feedback" : "Upload Feedback"}</h3>
            <p style={{ margin: "6px 0 0", color: "#64748B" }}>
              Capture customer comments, division, and documents.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width:36,
              height:36,
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: "8px",
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
           X
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <FileUploadBox
                      label="Upload Document"
                      description="Attach report document here"
                      supported="PDF/Word"
                      file={file}
                      onFileSelected={(f) => setFile(f)}
                      currentFileName={editingRecord && !file ? editingRecord.original_name : null}
                    />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <Input label="Project Name" value={form.project_name} onChange={(e) => onChange("project_name", e.target.value)} />
            <Input label="Division" value={form.division} onChange={(e) => onChange("division", e.target.value)} />
            {/* <Input label="Feedback Received" value={form.feedback_from} onChange={(e) => onChange("feedback_from", e.target.value)} /> */}
            {/* <Input label="Ratings" type="number"  min={0} max={5} step="0.1" value={form.rating} onChange={(e) => onChange("rating", e.target.value)} /> */}
            <Input
  label="Ratings"
  type="number"
  min={0}
  max={5}
  step="0.1"
  value={form.rating}
  onChange={(e) => {
    const value = e.target.value;
    if (value === "" || (Number(value) >= 0 && Number(value) <= 5)) {
      onChange("rating", value);
    }
  }}
/>

            {/* <Input  
              style={{
    fontSize: "14px",
    fontFamily: "Inter-Regular, Helvetica",
    fontWeight: 500
  }}
            label="Feedback Date" 
            type="date" 
            value={form.feedback_date} onChange={(e) => onChange("feedback_date", e.target.value)} /> */}
     <Input
  style={{
    fontSize: "14px",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    fontWeight: 500,
    color:"#717182",
    
  }}
  label="Feedback Date"
  type="date"
  value={form.feedback_date}
  onChange={(e) => onChange("feedback_date", e.target.value)}
/>


          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Note</span>
            <textarea
              value={form.feedback_text}
              onChange={(e) => onChange("feedback_text", e.target.value)}
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
            {/* <button
  type="submit"
  disabled={submitting}
  style={{
    Width:"100px",
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
</button> */}
<button
  type="submit"
  disabled={submitting}
  style={{
    width: "100px", // fix typo: 'Width' → 'width'
    border: "none",
    background: PRIMARY,
    color: "#fff",
    padding: "10px 18px",
    borderRadius: "4px",
    fontWeight: 600,
    cursor: submitting ? "not-allowed" : "pointer",
    opacity: submitting ? 0.7 : 1,
  }}
>
  {submitting ? "Saving..." : editingRecord ? "Save Changes" : "Save"}
</button>


           
          </div>
        </form>
      </div>
    </div>
  );
}