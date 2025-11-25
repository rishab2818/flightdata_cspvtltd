import React, { useEffect, useMemo, useState } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { studentEngagementApi } from "../../api/studentEngagementApi";
import { computeSha256 } from "../../lib/fileUtils";

const PRIMARY = "#1D6FE6";
const BORDER = "#E2E8F0";
const BADGE_COLORS = {
  Ongoing: { bg: "#E0F2FE", text: "#0369A1" },
  Completed: { bg: "#DCFCE7", text: "#15803D" },
  Upcoming: { bg: "#EEF2FF", text: "#4F46E5" },
};

function StatCard({ title, value, icon, accent }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        gap: 12,
        alignItems: "center",
        minWidth: 180,
        flex: 1,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: accent || "#EFF6FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          color: PRIMARY,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ color: "#6B7280", fontSize: 12 }}>{title}</div>
        <div style={{ color: "#0F172A", fontWeight: 700, fontSize: 20 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Badge({ value }) {
  const palette = BADGE_COLORS[value] || { bg: "#E5E7EB", text: "#111827" };
  return (
    <span
      style={{
        padding: "6px 12px",
        background: palette.bg,
        color: palette.text,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {value}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ color: "#475569", fontSize: 13 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          minWidth: 180,
          height: 38,
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          padding: "0 12px",
          background: "#fff",
          color: "#0F172A",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function StudentEngagement() {
  const [tab, setTab] = useState("approved");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    student: "",
    program_name: "",
    program_type: "Internship",
    duration_months: "6",
    start_date: "",
    end_date: "",
    status: "Ongoing",
    approval_status: "waiting",
    notes: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await studentEngagementApi.list();
        setRecords(data);
      } catch (err) {
        setError("Failed to load student engagement records");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return records
      .filter((r) =>
        tab === "approved"
          ? r.approval_status === "approved"
          : r.approval_status === "waiting"
      )
      .filter((r) => {
        const matchesType = typeFilter === "all" || r.program_type === typeFilter;
        const matchesStatus = statusFilter === "all" || r.status === statusFilter;
        return matchesType && matchesStatus;
      });
  }, [records, statusFilter, tab, typeFilter]);

  const stats = useMemo(() => {
    const totalStudents = records.length;
    const internships = records.filter((p) => p.program_type === "Internship").length;
    const ongoing = records.filter((p) => p.status === "Ongoing").length;
    const completed = records.filter((p) => p.status === "Completed").length;
    return [
      { title: "Total Students", value: totalStudents, icon: "👥" },
      { title: "Internships", value: internships, icon: "🎓" },
      { title: "Ongoing Programs", value: ongoing, icon: "🌀" },
      { title: "Completed", value: completed, icon: "✅" },
    ];
  }, [records]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.student.trim() || !form.program_name.trim()) {
      setError("Student and program name are required");
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
        const initRes = await studentEngagementApi.initUpload({
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

      const payload = {
        ...form,
        duration_months: Number(form.duration_months || 0),
        storage_key,
        original_name,
        content_type,
        size_bytes,
      };

      const created = await studentEngagementApi.create(payload);
      setRecords((prev) => [created, ...prev]);
      setForm({
        student: "",
        program_name: "",
        program_type: "Internship",
        duration_months: "6",
        start_date: "",
        end_date: "",
        status: "Ongoing",
        approval_status: "waiting",
        notes: "",
      });
      setFile(null);
    } catch (err) {
      setError("Unable to save student engagement record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 1220, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <p style={{ color: "#6B7280", margin: 0 }}>Operations · Student Engagement</p>
        <h1 style={{ margin: 0, color: "#0F172A" }}>Student Engagement</h1>
        <p style={{ color: "#475569", marginTop: 8 }}>
          Track student programs, internships, and approvals in one place.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <section
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Add Student Engagement</h3>
        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Student Name</span>
            <input
              type="text"
              value={form.student}
              onChange={(e) => onChange("student", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Program Name</span>
            <input
              type="text"
              value={form.program_name}
              onChange={(e) => onChange("program_name", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Program Type</span>
            <select
              value={form.program_type}
              onChange={(e) => onChange("program_type", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
            >
              <option value="Internship">Internship</option>
              <option value="Project">Project</option>
              <option value="Research">Research</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Duration (months)</span>
            <input
              type="number"
              min={1}
              value={form.duration_months}
              onChange={(e) => onChange("duration_months", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Start Date</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => onChange("start_date", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>End Date</span>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => onChange("end_date", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Status</span>
            <select
              value={form.status}
              onChange={(e) => onChange("status", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
            >
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Upcoming">Upcoming</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Approval</span>
            <select
              value={form.approval_status}
              onChange={(e) => onChange("approval_status", e.target.value)}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "0 10px",
              }}
            >
              <option value="approved">Approved</option>
              <option value="waiting">Waiting</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => onChange("notes", e.target.value)}
              rows={3}
              style={{
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                padding: "8px 10px",
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

          <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                border: "none",
                background: PRIMARY,
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              {submitting ? "Saving..." : "Save Engagement"}
            </button>
          </div>
        </form>
        {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}
      </section>

      <section
        style={{
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12 }}>
            {["approved", "waiting"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `1px solid ${t === tab ? PRIMARY : BORDER}`,
                  background: t === tab ? PRIMARY : "#fff",
                  color: t === tab ? "#fff" : "#0F172A",
                  cursor: "pointer",
                }}
              >
                {t === "approved" ? "Approved" : "Waiting"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <FilterSelect
              label="Program Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: "all", label: "All" },
                { value: "Internship", label: "Internship" },
                { value: "Project", label: "Project" },
                { value: "Research", label: "Research" },
              ]}
            />
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All" },
                { value: "Ongoing", label: "Ongoing" },
                { value: "Completed", label: "Completed" },
                { value: "Upcoming", label: "Upcoming" },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ margin: 0 }}>Loading records...</p>
        ) : filtered.length === 0 ? (
          <p style={{ margin: 0 }}>No student engagements found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
                  {[
                    "Student",
                    "Program Name",
                    "Type",
                    "Duration",
                    "Start",
                    "End",
                    "Status",
                  ].map((col) => (
                    <th key={col} style={{ padding: "12px 10px", fontWeight: 600 }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={`${row.record_id}`} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ fontWeight: 600 }}>{row.student}</div>
                      <div style={{ color: "#6B7280", fontSize: 12 }}>{row.notes || "—"}</div>
                    </td>
                    <td style={{ padding: "12px 10px" }}>{row.program_name}</td>
                    <td style={{ padding: "12px 10px" }}>{row.program_type}</td>
                    <td style={{ padding: "12px 10px" }}>{`${row.duration_months} months`}</td>
                    <td style={{ padding: "12px 10px" }}>{row.start_date}</td>
                    <td style={{ padding: "12px 10px" }}>{row.end_date}</td>
                    <td style={{ padding: "12px 10px" }}>
                      <Badge value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
