import React, { useEffect, useMemo, useState } from "react";
import { FiUploadCloud } from "react-icons/fi";
import { studentEngagementApi } from "../../api/studentEngagementApi";
import { computeSha256 } from "../../lib/fileUtils";

import Users from "../../assets/Users.svg";
import Book1 from "../../assets/Book1.svg";
import Ongoing from "../../assets/Ongoing.svg";
import Cap from "../../assets/Cap.svg";
import styles from "./StudentEngagement.module.css";
import FileUploadBox from "../../components/common/FileUploadBox";

const BADGE_COLORS = {
  Ongoing: { bg: "#FEF3C7", text: "#B45309" },
  Completed: { bg: "#DCFCE7", text: "#15803D" },
  Cancelled: { bg: "#FEE2E2", text: "#B91C1C" },
  Upcoming: { bg: "#EEF2FF", text: "#4F46E5" },
};

/* -------------------- Components ---------------------- */

function StatCard({ title, value, icon, bgColor }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}
      style={{backgroundColor: bgColor}}>
        <img src={icon} alt={title} />
      </div>

      <div>
        <div className={styles.statLabel}>{title}</div>
        <div className={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}

function Badge({ value }) {
  const palette = BADGE_COLORS[value] || { bg: "#E5E7EB", text: "#111827" };

  return (
    <span
      className={styles.statusBadge}
      style={{ background: palette.bg, color: palette.text }}
    >
      {value}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className={styles.filterLabel}>
      <span className={styles.filterText}>{label}</span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.select}
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

function Modal({ title, onClose, children }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          {children}
        </div>

        
      </div>
    </div>
  );
}

/* -------------------- Main Component -------------------- */

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
    mentor: "",
  });

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  /* -------------------- Fetch -------------------- */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await studentEngagementApi.list();
        setRecords(data || []);
      } catch (err) {
        setError("Failed to load student engagement records");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const onChange = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return records
      .filter((r) =>
        tab === "approved"
          ? r.approval_status === "approved"
          : r.approval_status === "waiting"
      )
      .filter((r) => {
        const matchesType = typeFilter === "all" || r.program_type === typeFilter;
        const matchesStatus =
          statusFilter === "all" || r.status === statusFilter;

        return matchesType && matchesStatus;
      });
  }, [records, statusFilter, tab, typeFilter]);

  const stats = useMemo(() => {
    const totalStudents = records.length;
    const internships = records.filter((p) => p.program_type === "Internship").length;
    const ongoing = records.filter((p) => p.status === "Ongoing").length;
    const completed = records.filter((p) => p.status === "Completed").length;

    return [
      { title: "Total Students", value: totalStudents, icon: Users, bgColor: "#DBEAFE" },
      { title: "Internships", value: internships, icon: Book1, bgColor: "#FFEDD4"},
      { title: "Ongoing Programs", value: ongoing, icon: Ongoing,bgColor:"#DCFCE7" },
      { title: "Completed", value: completed, icon: Cap, bgColor:"#F3E8FF"},
    ];
  }, [records]);

  /* -------------------- Submit -------------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.student.trim() || !form.program_name.trim()) {
      setError("Student and program name are required");
      return;
    }

    try {
      setSubmitting(true);

      let storage_key, original_name, content_type, size_bytes;

      if (file) {
        const hash = await computeSha256(file);

        const res = await studentEngagementApi.initUpload({
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          content_hash: hash,
        });

        await fetch(res.upload_url, { method: "PUT", body: file });

        storage_key = res.storage_key;
        original_name = file.name;
        content_type = file.type;
        size_bytes = file.size;
      }

      const payload = {
        ...form,
        duration_months: Number(form.duration_months),
        storage_key,
        original_name,
        content_type,
        size_bytes,
      };

      const created = await studentEngagementApi.create(payload);
      setRecords((prev) => [created, ...prev]);

      setShowModal(false);
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
        mentor: "",
      });
      setFile(null);
    } catch (err) {
      setError("Unable to save student engagement record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Stats */}
      <section className={styles.statsGrid}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} /> // passes value,icons,title,bgColor
        ))}
      </section>

      {/* Filters */}
      <section className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <FilterSelect
            label="Filter by Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "all", label: "All Types" },
              { value: "Internship", label: "Internship" },
              { value: "Project", label: "Project" },
              { value: "Research", label: "Research" },
            ]}
          />

          <FilterSelect
            label="Filter by Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Status" },
              { value: "Ongoing", label: "Ongoing" },
              { value: "Completed", label: "Completed" },
              { value: "Upcoming", label: "Upcoming" },
            ]}
          />
        </div>
           <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          + Add Student
        </button>
      </section>

      {/* Table */}
      <div className={styles.TableWrapper}>
        <h3>Student Programs</h3>
          
            <table className={styles.Table}>
              <thead>
                <tr>
                  {[
                    "Name",
                    "College Name",
                    "Project Name",
                    "Type",
                    "Duration",
                    "Start Date",
                    "End Date",
                    "Guide",
                    "Status",
                  ].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                   {loading && (
              <tr>
                <td className="TableLoad" colSpan={11}>Loading...</td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td className="TableError" colSpan={11}>{error}</td>
              </tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td className="TableEmpty" colSpan={11}>No student engagement records found.</td>
              </tr>
            )}

            {!loading &&
              !error &&
                filtered.map((row) => (
                  <tr key={row.record_id}>
                    <td className={styles.bold}>{row.student}</td>
                    <td>{row.program_name}</td>
                    <td>{row.program_type}</td>
                    <td>{row.duration_months} Months</td>
                    <td>{row.start_date}</td>
                    <td>{row.end_date}</td>
                    <td>{row.mentor || "—"}</td>
                    <td>
                      <Badge value={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

      {/* Modal */}
      {showModal && (
        <Modal title="Add Student Program" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className={styles.formGrid}>

             {/* 👇 Upload box moved to TOP */}
            <FileUploadBox
              label="Upload Document"
              description="Attach training related file here"
              supported="PDF/Word"
              file={file}
              onFileSelected={(f) => setFile(f)}
            />
            
            {/* Repeat input format */}
            <label className={styles.inputLabel}>
              <span>Student Name</span>
              <input placeholder="Enter Student Name"
                required
                value={form.student}
                onChange={(e) => onChange("student", e.target.value)}
              />
            </label>

            <label className={styles.inputLabel}>
              <span>Project Title</span>
              <input placeholder="Enter Project Title"
                required
                value={form.project_title}
                onChange={(e) => onChange("project_title", e.target.value)}
              />
            </label>

            <label className={styles.inputLabel}>
              <span>Program Type</span>
              <select
                value={form.program_type}
                onChange={(e) => onChange("program_type", e.target.value)}
              >
                <option value="Internship">Internship</option>
                <option value="Project">Project</option>
                <option value="Research">Research</option>
              </select>
            </label>

            <label className={styles.inputLabel}>
              <span>Duration (months)</span>
              <input
                type="number"
                min="1"
                value={form.duration_months}
                onChange={(e) => onChange("duration_months", e.target.value)}
              />
            </label>

           <label className={styles.inputLabel}>
            <div className={styles.daterow}>
               <div className={styles.field}>
              <span>Start Date</span>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => onChange("start_date", e.target.value)}
              />
              </div>

              <div className={styles.field}>
              <span>End Date</span>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => onChange("end_date", e.target.value)}
              />
              </div>
            </div>
           </label>
           
            <label className={styles.inputLabel}>
              <span>Guide</span>
              <input placeholder="Enter Guide Name"
                value={form.mentor}
                onChange={(e) => onChange("mentor", e.target.value)}
              />
            </label>

            <label className={styles.inputLabel}>
              <span>Status</span>
              <select
                value={form.status}
                onChange={(e) => onChange("status", e.target.value)}
              >
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Upcoming">Upcoming</option>
              </select>
            </label>

            <label className={styles.inputLabel}>
              <span>Approval Status</span>
              <select
                value={form.approval_status}
                onChange={(e) => onChange("approval_status", e.target.value)}
              >
                <option value="approved">Approved</option>
                <option value="waiting">Waiting</option>
              </select>
            </label>

            <label className={styles.textAreaLabel}>
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => onChange("notes", e.target.value)}
              />
            </label>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>

              <button type="submit" className={styles.saveBtn} disabled={submitting}>
                {submitting ? "Saving..." : "+ Add Program"}
              </button>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}
          </form>
        </Modal>
      )}
    </div>
  );
}
