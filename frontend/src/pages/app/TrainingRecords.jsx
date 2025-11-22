import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";

const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";

function StatCard({ title, value }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ color: "#475569", fontSize: 13 }}>{title}</span>
      <strong style={{ fontSize: 20 }}>{value}</strong>
    </div>
  );
}

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
    <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Training Records</h2>
        <p style={{ margin: "6px 0 0", color: "#475569" }}>
          Track training cohorts, types, completion and supporting files.
        </p>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >
        <StatCard title="Total Training" value={records.length} />
        <StatCard title="No. of Participants" value={records.length} />
        <StatCard title="Ongoing" value={records.filter((r) => r.status === "Ongoing").length} />
      </div>

      <div
        style={{
          marginTop: 18,
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#475569", fontSize: 13 }}>Filter by Type</span>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                style={{
                  minWidth: 200,
                  height: 38,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  padding: "0 12px",
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
                  minWidth: 200,
                  height: 38,
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  padding: "0 12px",
                }}
              >
                <option value="all">All Status</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Planned">Planned</option>
              </select>
            </label>
          </div>
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
            <FiPlus /> Upload Records
          </button>
        </div>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
          >
            <thead>
              <tr
                style={{
                  color: "#64748B",
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: "left",
                }}
              >
                {["Trainee Name", "Training Name", "Type", "Start Date", "End Date", "Status", "Remarks"].map(
                  (col) => (
                    <th key={col} style={{ padding: "12px 8px", fontWeight: 600 }}>
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: 16, textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "#b91c1c" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "#94A3B8" }}>
                    No training records found.
                  </td>
                </tr>
              )}
              {!loading && !error &&
                filtered.map((row) => (
                  <tr key={row.record_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>{row.trainee_name}</td>
                    <td style={{ padding: "12px 8px" }}>{row.training_name}</td>
                    <td style={{ padding: "12px 8px" }}>{row.training_type}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {new Date(row.start_date).toLocaleDateString("en-GB")}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      {new Date(row.end_date).toLocaleDateString("en-GB")}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={{ padding: "12px 8px", color: "#475569" }}>{row.remarks}</td>
                  </tr>
                ))}
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
    const requiredFields = [
      "trainee_name",
      "training_name",
      "training_type",
      "start_date",
      "end_date",
      "status",
    ];
    if (requiredFields.some((key) => !`${form[key]}`.trim())) {
      setError("Please complete all required training fields.");
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
        const initRes = await recordsApi.initUpload("training-records", {
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
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0 }}>Upload Training Record</h3>
            <p style={{ margin: "6px 0 0", color: "#64748B" }}>
              Store training milestones and attach artifacts.
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
            }}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
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

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Upload Document</span>
            <div
              style={{
                border: `1px dashed ${BORDER}`,
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <FiUploadCloud />
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ flex: 1 }}
              />
            </div>
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
