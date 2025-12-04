import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";

import totalRecord from "../../assets/customer.svg"
import CommonStatCard from "../../components/common/common_card/common_card";
import avergaeRating from "../../assets/Star.svg"
import pending_review from "../../assets/SpinnerGap.svg"
import FileUploadBox from "../../components/common/FileUploadBox";



const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";


function Rating({ value }) {
  return (
    <span style={{ color: "#F59E0B", fontWeight: 700 }}>
      {Number(value || 0).toFixed(1)} ★
    </span>
  );
}

export default function CustomerFeedbacks() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);

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
      const matchesType = filters.type === "all" ? true : row.division === filters.type;
      return matchesType;
    });
  }, [records, filters]);

  return (
    /* Card UI */

    <div style={{ width: "100%", maxWidth: 1440, margin: "0 auto" }}>


      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >

        <CommonStatCard title="Total Feedbacks" value={records.length} icon={totalRecord} bg="#DBEAFE" />


        <CommonStatCard title="Average Rating" value={(
          records.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) /
          (records.length || 1)
        ).toFixed(1)} icon={avergaeRating} bg="#DCFCE7" />

        <CommonStatCard title="Pending Review" value={records.length} icon={pending_review} bg="#FFEDD4" />
      </div>

      {/* FILTER SECTION CARD */}
      <div
        style={{
          marginTop: 22,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}
      >
        {/* Filter By Division */}
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "#475569", fontSize: 13 }}>Filter by Division</span>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            style={{
              minWidth: 280,
              height: 38,
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              padding: "0 12px",
              background:"#F3F3F5",
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
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <FiPlus /> Upload Feedback
        </button>
      </div>

      {/* TABLE SECTION CARD */}



      <div
        style={{
          marginTop: 18,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <div
            style={{
              marginBottom: 10,
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
              borderRadius: 8,
              overflow: "hidden", // Clips corners
              minWidth: 900,
            }}
          >
            <thead>
              <tr
                style={{
                  color: "#000000",
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: "left",
                  fontWeight: 400,
                  fontSize: 12,
                  background: "#EFF7FF"

                }}
              >
                {["Project Name", "Division", "Feedback By", "Ratings", "Feedback Date"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,

                        borderBottom: `1px solid ${BORDER}`, // Header separator
                      }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#b91c1c" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#94A3B8" }}>
                    No feedback records found.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((row, index) => {
                  // 1. Calculate if this is the last row
                  const isLast = index === filtered.length - 1;

                  return (
                    <tr key={row.record_id}>
                      {/* 2. Apply border logic to every cell */}
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
                        {new Date(row.feedback_date).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <FeedbackModal onClose={() => setShowModal(false)} onCreated={loadRecords} />
      )}
    </div>
  );
}

function Input({ label, ...rest }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ color: "#475569", fontSize: 13 }}>{label}</span>
      <input
        {...rest}
        style={{
          height: 40,
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          padding: "0 12px",
          background: "#F9FAFB",
        }}
      />
    </label>
  );
}

function FeedbackModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    project_name: "",
    division: "",
    feedback_from: "",
    rating: "",
    feedback_date: "",
    feedback_by: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const requiredFields = [
      "project_name",
      "division",
      // "feedback_from",
      "rating",
      "feedback_date",
      "feedback_by",
    ];
    if (requiredFields.some((key) => !`${form[key]}`.trim())) {
      setError("Please complete all feedback fields.");
      return;
    }
    try {
      setSubmitting(true);
      let storage_key;
      let original_name;
      let content_type;
      let size_bytes;
      if (file) {
        const content_hash = await computeSha256(file);
        const initRes = await recordsApi.initUpload("customer-feedbacks", {
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

      await recordsApi.createFeedback({
        ...form,
        rating: Number(form.rating || 0),
        storage_key,
        original_name,
        content_type,
        size_bytes,
      });
      onClose();
      if (onCreated) onCreated();
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
        <div style={{ display: "flex", justifyContent: "space-between" ,height:50, alignItems:"center",flexShrink:0, marginTop:0 }}>
          <div>
            <h3 style={{ margin: 0 }}>Upload Feedback</h3>
            <p style={{ margin: "6px 0 0", color: "#64748B" }}>
              Capture customer comments, division, and documents.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
              width:32,
              height:32,
              }}
          >
           X
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14,overflowY: "auto", maxHeight: "70vh" }}>
          <FileUploadBox
                     label="Upload Document"
                     description="Attach training related file here"
                     supported="PDF/Word"
                     file={file}
                     onFileSelected={(f) => setFile(f)}
                   />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <Input label="Project Name" value={form.project_name} onChange={(e) => onChange("project_name", e.target.value)} />
            <Input label="Division" value={form.division} onChange={(e) => onChange("division", e.target.value)} />
            {/* <Input label="Feedback Received" value={form.feedback_from} onChange={(e) => onChange("feedback_from", e.target.value)} /> */}
            <Input label="Ratings" type="number" step="0.1" value={form.rating} onChange={(e) => onChange("rating", e.target.value)} />
            <Input label="Feedback Date" type="date" value={form.feedback_date} onChange={(e) => onChange("feedback_date", e.target.value)} />
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Feedback By</span>
            <textarea
              value={form.feedback_by}
              onChange={(e) => onChange("feedback_by", e.target.value)}
              rows={3}
              style={{
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: 10,
                background: "#F9FAFB",
                resize: "vertical",
              }}
            />
          </label>


          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: `1px solid ${BORDER}`,
                background: "#fff",
                padding: "10px 16px",
                borderRadius: 10,
                cursor: "pointer",
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
                borderRadius: 10,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
