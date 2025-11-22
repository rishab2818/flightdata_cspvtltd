import React, { useMemo, useState } from "react";

const PRIMARY = "#1D6FE6";
const BORDER = "#E2E8F0";
const BADGE_COLORS = {
  Ongoing: { bg: "#E0F2FE", text: "#0369A1" },
  Completed: { bg: "#DCFCE7", text: "#15803D" },
  Upcoming: { bg: "#EEF2FF", text: "#4F46E5" },
};

const basePrograms = [
  {
    student: "Parik Kapoor",
    programName: "Quantum Encryption Project",
    type: "Internship",
    duration: "12 Months",
    startDate: "2024-01-12",
    endDate: "2024-12-15",
    status: "Completed",
  },
  {
    student: "Vivek Roy",
    programName: "Advanced Privacy Initiative",
    type: "Internship",
    duration: "10 Months",
    startDate: "2024-02-01",
    endDate: "2024-11-01",
    status: "Ongoing",
  },
  {
    student: "Shanaya Gill",
    programName: "Zero Trust Network Optimization",
    type: "Internship",
    duration: "9 Months",
    startDate: "2024-03-10",
    endDate: "2024-12-10",
    status: "Ongoing",
  },
  {
    student: "Anaya Reddy",
    programName: "Infrastructure Upgrade",
    type: "Internship",
    duration: "6 Months",
    startDate: "2024-05-01",
    endDate: "2024-11-01",
    status: "Ongoing",
  },
  {
    student: "Aman Patel",
    programName: "Cloud Native Security",
    type: "Internship",
    duration: "6 Months",
    startDate: "2024-07-01",
    endDate: "2024-12-30",
    status: "Upcoming",
  },
];

const waitingPrograms = [
  {
    student: "Niharika Das",
    programName: "Secure SDLC Audit",
    type: "Internship",
    duration: "6 Months",
    startDate: "2024-08-05",
    endDate: "2025-02-05",
    status: "Ongoing",
  },
  {
    student: "Harsh Khatri",
    programName: "API Security Lab",
    type: "Project",
    duration: "3 Months",
    startDate: "2024-09-01",
    endDate: "2024-12-01",
    status: "Upcoming",
  },
];

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

  const programs = tab === "approved" ? basePrograms : waitingPrograms;

  const filtered = useMemo(() => {
    return programs.filter((p) => {
      const matchesType = typeFilter === "all" || p.type === typeFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesType && matchesStatus;
    });
  }, [programs, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalStudents = basePrograms.length + waitingPrograms.length;
    const internships = [...basePrograms, ...waitingPrograms].filter(
      (p) => p.type === "Internship"
    ).length;
    const ongoing = [...basePrograms, ...waitingPrograms].filter(
      (p) => p.status === "Ongoing"
    ).length;
    const completed = [...basePrograms, ...waitingPrograms].filter(
      (p) => p.status === "Completed"
    ).length;
    return [
      { title: "Total Students", value: totalStudents, icon: "👥" },
      { title: "Internships", value: internships, icon: "🎓" },
      { title: "Ongoing Programs", value: ongoing, icon: "🌀" },
      { title: "Completed", value: completed, icon: "✅" },
    ];
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 1220, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#0F172A" }}>
            Student Engagement
          </h2>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 14 }}>
            Track student programs, internships, and approvals in one place.
          </p>
        </div>
      </div>

      {/* stats */}
      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
        }}
      >
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* filters */}
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
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <FilterSelect
              label="Filter by Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { label: "All Types", value: "all" },
                { label: "Internship", value: "Internship" },
                { label: "Project", value: "Project" },
              ]}
            />
            <FilterSelect
              label="Filter by Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "All Status", value: "all" },
                { label: "Ongoing", value: "Ongoing" },
                { label: "Completed", value: "Completed" },
                { label: "Upcoming", value: "Upcoming" },
              ]}
            />
          </div>

          <button
            type="button"
            style={{
              padding: "10px 18px",
              background: PRIMARY,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add Student
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setTab("approved")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: tab === "approved" ? "none" : `1px solid ${BORDER}`,
                background: tab === "approved" ? PRIMARY : "#fff",
                color: tab === "approved" ? "#fff" : "#0F172A",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Approved
            </button>
            <button
              type="button"
              onClick={() => setTab("waiting")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: tab === "waiting" ? "none" : `1px solid ${BORDER}`,
                background: tab === "waiting" ? PRIMARY : "#fff",
                color: tab === "waiting" ? "#fff" : "#0F172A",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Waiting approval
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 760,
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "#64748B",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  {["Student Name", "Program Name", "Type", "Duration", "Start Date", "End Date", "Status"].map(
                    (col) => (
                      <th key={col} style={{ padding: "12px 8px", fontWeight: 600 }}>
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={`${row.student}-${row.programName}`}
                    style={{ borderBottom: `1px solid ${BORDER}` }}
                  >
                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>
                      {row.student}
                    </td>
                    <td style={{ padding: "12px 8px", color: "#334155" }}>
                      {row.programName}
                    </td>
                    <td style={{ padding: "12px 8px" }}>{row.type}</td>
                    <td style={{ padding: "12px 8px" }}>{row.duration}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {new Date(row.startDate).toLocaleDateString("en-GB")}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      {new Date(row.endDate).toLocaleDateString("en-GB")}
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <Badge value={row.status} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: "#94A3B8",
                      }}
                    >
                      No programs match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
