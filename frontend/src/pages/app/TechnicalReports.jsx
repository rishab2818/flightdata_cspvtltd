import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import totalRecordsIcon from "../../assets/bule_message.svg";
import technicalIcon from "../../assets/setting_black.svg";
import designicon from "../../assets/design_black.svg";

import CommonStatCard from "../../components/common/common_card/common_card";

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

export default function TechnicalReports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all" });
  const [showModal, setShowModal] = useState(false);

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

  const filtered = useMemo(() => {
    return records.filter((row) =>
      filters.type === "all" ? true : row.report_type === filters.type
    );
  }, [records, filters]);

  return (
    <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto" }}>


      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >
        {/* <StatCard title="Total Records" value={records.length} /> */}
        <CommonStatCard title="Total Records" value={records.length} icon={totalRecordsIcon} bg="#DBEAFE" />
        <CommonStatCard title="Technical" value={records.filter((r) => r.report_type === "Technical").length} icon={technicalIcon} bg="#F3E8FF" />
        <CommonStatCard title="Design" value={records.filter((r) => r.report_type === "Design").length} icon={designicon} bg="#DCFCE7" />
        {/* <StatCard title="Technical" value={records.filter((r) => r.report_type === "Technical").length} /> */}

        {/* <StatCard title="Design" value={records.filter((r) => r.report_type === "Design").length} /> */}
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
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "#475569", fontSize: 13 }}>Filter by Type</span>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value })}
            style={{
              minWidth: 284,
              background: "#F3F3F5",
              height: 36,
              borderRadius: 8,
              border: "none",
              padding: "0 12px",
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
          <FiPlus /> Upload Document
        </button>
      </div>
      {/* Table Section  */}
      {/* <div
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
            Technical Reports
          </div>
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
                {["Report Name", "Description", "Type", "Created Date", "Ratings"].map(
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
                    No reports found.
                  </td>
                </tr>
              )}
              {!loading && !error &&
                filtered.map((row) => (
                  <tr key={row.record_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>{row.name}</td>
                    <td style={{ padding: "12px 8px", color: "#475569" }}>{row.description}</td>
                    <td style={{ padding: "12px 8px" }}>{row.report_type}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {new Date(row.created_date).toLocaleDateString("en-GB")}
                    </td>
                    <td style={{ padding: "12px 8px" }}>{Number(row.rating || 0).toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div> */}
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
            Technical Reports
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate", // Required for rounded corners
              borderSpacing: 0,           // Removes gaps between cells
              border: `1px solid ${BORDER}`, // The outer border
              borderRadius: 8,            // The rounded corners
              overflow: "hidden",         // Clips content within corners
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
                {["Report Name", "Description", "Type", "Created Date", "Ratings"].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,

                        borderBottom: `1px solid ${BORDER}`, // Bottom border for header
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
                    No reports found.
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((row, index) => {
                  // 1. Check if this is the last row
                  const isLast = index === filtered.length - 1;

                  return (
                    <tr key={row.record_id}>
                      {/* 2. Apply border logic to cells instead of row */}
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
                        {new Date(row.created_date).toLocaleDateString("en-GB")}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        {Number(row.rating || 0).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <ReportModal onClose={() => setShowModal(false)} onCreated={loadRecords} />}
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

function ReportModal({ onClose, onCreated }) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const requiredFields = ["name", "description", "report_type", "created_date"];
    if (requiredFields.some((key) => !`${form[key]}`.trim())) {
      setError("Please enter report name, type, description, and date.");
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
        const initRes = await recordsApi.initUpload("technical-reports", {
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

      await recordsApi.createTechnical({
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
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0 }}>Upload Report</h3>
            <p style={{ margin: "6px 0 0", color: "#64748B" }}>
              Add report metadata and attach your document.
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
                }}
              >
                <option value="Technical">Technical</option>
                <option value="Design">Design</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <Input label="Created Date" type="date" value={form.created_date} onChange={(e) => onChange("created_date", e.target.value)} />
            <Input label="Ratings" type="number" step="0.1" value={form.rating} onChange={(e) => onChange("rating", e.target.value)} />
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Description</span>
            <textarea
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
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
