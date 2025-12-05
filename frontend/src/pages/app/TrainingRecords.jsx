import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import totalTrainingIcon from "../../assets/reports.svg"
import noOfParticipantsIcon from "../../assets/UsersThree_green.svg"
import ongoingIcon from "../../assets/SpinnerGap.svg"

import CommonStatCard from "../../components/common/common_card/common_card";
import FileUploadBox from "../../components/common/FileUploadBox";

const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");



function StatusBadge({ status }) {
  const palette =
    status === "Completed"
      ? { bg: "#DCFCE7", text: "#15803D" }
      : { bg: "#FEF3C7", text: "#92400E" };
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

export default function TrainingRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);

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
    return records.filter((row) => {
      const matchesType = filters.type === "all" ? true : row.training_type === filters.type;
      const matchesStatus = filters.status === "all" ? true : row.status === filters.status;
      return matchesType && matchesStatus;
    });
  }, [records, filters]);

  return (
    <div style={{ width: "100%", maxWidth: 1440, margin: "0 auto" }}>


      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >

        <CommonStatCard title="Total Training" value={records.length} icon={totalTrainingIcon} bg="#DBEAFE" />
        <CommonStatCard title="No of Participants" value={records.length} icon={noOfParticipantsIcon} bg="#DCFCE7" />

        <CommonStatCard title="Ongoing" value={records.filter((r) => r.status === "Ongoing").length} icon={ongoingIcon} bg="#FFEDD4" />
      </div>
      {/* Filter section  */}
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
        {/* Left: filters */}
        <div
          style={{
            display: "flex",

            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#475569", fontSize: 13 }}>Filter by Type</span>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                style={{
                  minWidth: 284,
                  height: 36,
                  background: "#F3F3F5",
                  borderRadius: 8,
                  // border: `1px solid ${BORDER}`,
                  padding: "0 12px",
                  border: "none",
                }}
              >
                <option value="all">All Types</option>
                <option value="Pre-Training">Pre-Training</option>
                <option value="Post-Training">Post-Training</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#475569", fontSize: 13 }}>Filter by Status</span>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={{
                  minWidth: 284,
                  height: 36,
                  background: "#F3F3F5",
                  borderRadius: 8,
                  // border: `1px solid ${BORDER}`,
                  padding: "0 12px",
                  border: "none",
                }}
              >
                <option value="all">All Status</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Planned">Planned</option>
              </select>
            </label>
          </div>
        </div>

        {/* Right: upload button */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            type="button"
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
            <FiPlus /> Upload Training
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          background: "#fff",
          border: `1px solid ${BORDER}`, // Outer Card Border
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
            Training Records
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              // The Table's own border (The "Outside" border you wanted)
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              // Vital for rounded corners to clip the content
              overflow: "hidden",
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
                {[
                  "Name",
                  "Training Name",
                  "Type",
                  "Start Date",
                  "End Date",
                  "Status",
                  "Remarks",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "12px 16px", // Increased padding slightly for look
                      fontWeight: 600,
                      // color: "#64748B",
                      // Header always has a bottom border to separate from body
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!loading &&
                !error &&
                filtered.map((row, index) => {
                  // Check if this is the last row
                  const isLast = index === filtered.length - 1;

                  return (
                    <tr key={row.record_id}>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontWeight: 600,
                          // Remove border if it's the last row, otherwise add divider
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
                          // The last cell also needs no bottom border
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {row.remarks}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <TrainingModal onClose={() => setShowModal(false)} onCreated={loadRecords} />}
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



function TrainingModal({ onClose, onCreated }) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);
      let storage_key;
      let original_name;
      let content_type;
      let size_bytes;

      if (file) {
        const content_hash = await computeSha256(file);
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
      }

      await recordsApi.createTraining({
        ...form,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        storage_key,
        original_name,
        content_type,
        size_bytes,
      });

      onClose();
      if (onCreated) onCreated();
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
          borderRadius: 12,
          padding: "24px 28px",
          boxShadow: "0 30px 70px rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between",height:50, alignItems:"center",flexShrink:0, marginTop:0 }}>
          <div>
            <h3 style={{ margin: 0 }}>Upload Files </h3>

          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: 10,
              padding: 8,
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,

            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "70vh" }}>

        {/* 👇 Upload box moved to TOP */}
        <FileUploadBox
          label="Upload Document"
          description="Attach training related file here"
          supported="PDF/Word"
          file={file}
          onFileSelected={(f) => setFile(f)}
        />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <Input label="Trainee Name" value={form.trainee_name} onChange={(e) => onChange("trainee_name", e.target.value)} />
            <Input label="Training Name" value={form.training_name} onChange={(e) => onChange("training_name", e.target.value)} />
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#475569", fontSize: 13 }}>Type</span>
              <select
                value={form.training_type}
                onChange={(e) => onChange("training_type", e.target.value)}
                style={{
                  height: 40,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  padding: "0 12px",
                }}
              >
                <option value="Pre-Training">Pre-Training</option>
                <option value="Post-Training">Post-Training</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => onChange("start_date", e.target.value)} />
            <Input label="End Date" type="date" value={form.end_date} onChange={(e) => onChange("end_date", e.target.value)} />
            <Input label="Status" value={form.status} onChange={(e) => onChange("status", e.target.value)} />
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Remarks</span>
            <textarea
              value={form.remarks}
              onChange={(e) => onChange("remarks", e.target.value)}
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

          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}

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
