import React, { useEffect, useMemo, useState } from "react";
import { studentEngagementApi } from "../../api/studentEngagementApi";
import { computeSha256 } from "../../lib/fileUtils";
import { downloadExcel } from "../../lib/excelExport";
import { FiDownload, FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";

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
        style={{ backgroundColor: bgColor }}>
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
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const [existingFileMeta, setExistingFileMeta] = useState(null);

  const initialForm = {
    student: "",
    college_name: "",
    project_name: "",
    program_type: "Internship",
    duration_months: "",
    start_date: "",
    end_date: "",
    status: "Ongoing",
    approval_status: "waiting",
    notes: "",
    mentor: "",
  };

  const [form, setForm] = useState(initialForm);
  const [dateError, setDateError] = useState("");

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  /* -------------------- Fetch -------------------- */
  const loadRecords = async () => {
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

  useEffect(() => {
    loadRecords();
  }, []);

  const onChange = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const calculateDurationMonths = (start, end) => {
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    let months = yearDiff * 12 + monthDiff;

    if (end.getDate() >= start.getDate()) {
      months += 1;
    }

    return Math.max(months, 1);
  };

  useEffect(() => {
    if (form.start_date && form.end_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.end_date);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setDateError("Please enter valid dates");
        setForm((prev) => ({ ...prev, duration_months: "" }));
        return;
      }

      if (start >= end) {
        setDateError("Start date must be before end date");
        setForm((prev) => ({ ...prev, duration_months: "" }));
        return;
      }

      const months = calculateDurationMonths(start, end);
      setDateError("");
      setForm((prev) => ({ ...prev, duration_months: String(months) }));
    } else {
      setDateError("");
      setForm((prev) => ({ ...prev, duration_months: "" }));
    }
  }, [form.start_date, form.end_date]);

  // Auto-update status based on dates:
  useEffect(() => {
    // Only auto-update status if the form is NOT being explicitly edited (i.e., status isn't manually changed by the user)
    // Here we let the status be dictated by the dates if the form is new or if the user hasn't touched the status yet.
    if (!form.end_date) return;

    // Skip auto-update if editing and the status field has a value (assuming user might manually override status)
    // if (editingRecord && form.status) return; 

    const toDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = toDateOnly(new Date());
    const end = toDateOnly(new Date(form.end_date));
    const start = form.start_date ? toDateOnly(new Date(form.start_date)) : null;

    let newStatus = form.status;

    // If end is on or before today => Completed
    if (end <= today) {
      newStatus = "Completed";
    }
    // If start is in future => Upcoming
    else if (start && start > today) {
      newStatus = "Upcoming";
    }
    // Otherwise it's ongoing
    else {
      newStatus = "Ongoing";
    }

    // Only update if the calculated status is different
    if (form.status !== newStatus) {
      setForm(prev => ({ ...prev, status: newStatus }));
    }
  }, [form.start_date, form.end_date]);


  const filtered = useMemo(() => {
    return records
      .filter((r) =>
        approvalFilter === "all" ? true : r.approval_status === approvalFilter
      )
      .filter((r) => {
        const matchesType = typeFilter === "all" || r.program_type === typeFilter;
        const matchesStatus =
          statusFilter === "all" || r.status === statusFilter;

        return matchesType && matchesStatus;
      });
  }, [approvalFilter, records, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const totalStudents = records.length;
    const internships = records.filter((p) => p.program_type === "Internship").length;
    const ongoing = records.filter((p) => p.status === "Ongoing").length;
    const completed = records.filter((p) => p.status === "Completed").length;

    return [
      { title: "Total Students", value: totalStudents, icon: Users, bgColor: "#DBEAFE" },
      { title: "Internships", value: internships, icon: Book1, bgColor: "#FFEDD4" },
      { title: "Ongoing Programs", value: ongoing, icon: Ongoing, bgColor: "#DCFCE7" },
      { title: "Completed", value: completed, icon: Cap, bgColor: "#F3E8FF" },
    ];
  }, [records]);

  const handleExport = () => {
    const columns = [
      { header: "Name", key: "student" },
      { header: "College Name", key: "college_name" },
      { header: "Project Name", key: "project_name" },
      { header: "Type", key: "program_type" },
      { header: "Duration", accessor: (row) => (row.duration_months ? `${row.duration_months} Months` : "") },
      { header: "Start Date", accessor: (row) => (row.start_date ? new Date(row.start_date).toLocaleDateString("en-GB") : "") },
      { header: "End Date", accessor: (row) => (row.end_date ? new Date(row.end_date).toLocaleDateString("en-GB") : "") },
      { header: "Guide", key: "mentor" },
      { header: "Status", key: "status" },
      { header: "Approval", accessor: (row) => (row.approval_status === "approved" ? "Approved" : "Waiting") },
    ];

    downloadExcel({
      rows: filtered,
      columns,
      fileName: "student-engagement",
      sheetName: "Student Programs",
    });
  };

  const resetFormState = () => {
    setForm(initialForm);
    setFile(null);
    setExistingFileMeta(null);
    setEditingRecord(null);
    setError("");
    setDateError("");
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetFormState();
  };

  const openCreateModal = () => {
    resetFormState();
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setForm({
      student: record.student || "",
      college_name: record.college_name || "",
      project_name: record.project_name || "",
      program_type: record.program_type || "Internship",
      duration_months: String(record.duration_months ?? ""),
      // Slice date string to ensure format is compatible with input type="date"
      start_date: record.start_date ? record.start_date.slice(0, 10) : "",
      end_date: record.end_date ? record.end_date.slice(0, 10) : "",
      status: record.status || "Ongoing",
      approval_status: record.approval_status || "waiting",
      notes: record.notes || "",
      mentor: record.mentor || "",
    });
    // Set file metadata for existing document display
    setExistingFileMeta({
      storage_key: record.storage_key,
      original_name: record.original_name,
      content_type: record.content_type,
      size_bytes: record.size_bytes,
      content_hash: record.content_hash,
    });
    setFile(null); // Clear any previously selected file
    setShowModal(true);
  };

  /* -------------------- Submit (FIXED) -------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (dateError) {
      setError(dateError);
      return;
    }

    try {
      setSubmitting(true);

      // Initialize file meta from existing record or null/empty strings if creating
      let storage_key = existingFileMeta?.storage_key;
      let original_name = existingFileMeta?.original_name;
      let content_type = existingFileMeta?.content_type;
      let size_bytes = existingFileMeta?.size_bytes;
      let content_hash = existingFileMeta?.content_hash;

      // 1. If user uploaded a new file, replace existing one
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
        content_hash = hash;
      }

      // 2. Prepare payload
      const payload = {
        ...form,
        duration_months: form.duration_months
          ? Number(form.duration_months)
          : undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        storage_key,
        original_name,
        content_type,
        size_bytes,
        content_hash,
      };

      let resultRecord;

      // 3. Update or create (FIXED: Added immediate local state update)
      if (editingRecord) {
        // Update API returns the updated record
        resultRecord = await studentEngagementApi.update(editingRecord.record_id, payload);
      } else {
        // Create API returns the newly created record
        resultRecord = await studentEngagementApi.create(payload);
      }

      // 4. Update local state with the result record (more efficient than full list refresh)
      setRecords((prev) => {
        if (editingRecord) {
          // Replace the old record with the updated one
          return prev.map((r) =>
            r.record_id === resultRecord.record_id ? resultRecord : r
          );
        } else {
          // Add the new record to the list
          return [...prev, resultRecord];
        }
      });

      // 5. Close modal
      setShowModal(false);
      resetFormState();

    } catch (err) {
      console.error("Save error:", err?.message ?? err);
      // Fallback: reload data if update/create failed (optional, but good for recovery)
      // loadRecords();
      setError("Unable to save student engagement record. Please check the details.");
    } finally {
      setSubmitting(false);
    }
  };


  const handleViewDocument = async (record) => {
    try {
      const res = await studentEngagementApi.downloadUrl(record.record_id);
      if (!res?.download_url) throw new Error("Missing URL");
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Unable to view document.");
    }
  };

  const handleDownloadDocument = async (record) => {
    try {
      const res = await studentEngagementApi.downloadUrl(record.record_id);
      if (!res?.download_url) throw new Error("Missing URL");
      const link = document.createElement("a");
      link.href = res.download_url;
      link.download = record.original_name || "document";
      link.click();
      link.remove();
    } catch (err) {
      alert("Unable to download document.");
    }
  };

  const handleDeleteRecord = async (record) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await studentEngagementApi.remove(record.record_id);
      setRecords((prev) => prev.filter((r) => r.record_id !== record.record_id));
    } catch (err) {
      alert("Unable to delete record.");
    }
  };

  // Determine which file name to display in the FileUploadBox
  const uploadDisplayFile =
    file || (existingFileMeta?.original_name ? { name: existingFileMeta.original_name } : null);

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
            label="Filter by Approval"
            value={approvalFilter}
            onChange={setApprovalFilter}
            options={[
              { value: "all", label: "All Approvals" },
              { value: "approved", label: "Approved" },
              { value: "waiting", label: "Waiting" },
            ]}
          />

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
        <button className={styles.addBtn} onClick={openCreateModal}>
          + Add Student
        </button>
      </section>

      {/* Table */}
      <div className={styles.TableWrapper}>
        <div className={styles.tableHeader}>
          <h3>Student Programs</h3>
          <button type="button" className={styles.exportBtn} onClick={handleExport}>
            <FiDownload size={16} /> Download
          </button>
        </div>

        {(() => {
          const columns = [
            "Name",
            "College Name",
            "Project Name",
            "Type",
            "Duration",
            "Start Date",
            "End Date",
            "Guide",
            "Status",
            "Approval",
            "Actions",
          ];

          const formatDate = (value) =>
            value ? new Date(value).toLocaleDateString("en-GB") : "—";

          return (
            <table className={styles.Table}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td className="TableLoad" colSpan={columns.length}>
                      Loading...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td className="TableError" colSpan={columns.length}>
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td className="TableEmpty" colSpan={columns.length}>
                      No student engagement records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  filtered.map((row) => (
                    <tr key={row.record_id}>
                      <td className={styles.bold}>{row.student || "—"}</td>
                      <td>{row.college_name || "—"}</td>
                      <td>{row.project_name || "—"}</td>
                      <td>{row.program_type || "—"}</td>
                      <td>
                        {row.duration_months ? `${row.duration_months} Months` : "—"}
                      </td>
                      <td>{formatDate(row.start_date)}</td>
                      <td>{formatDate(row.end_date)}</td>
                      <td>{row.mentor || "—"}</td>
                      <td>
                        <Badge value={row.status} />
                      </td>
                      <td>{row.approval_status === "approved" ? "Approved" : "Waiting"}</td>
                      <td>
                        <div className="doc-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openEditModal(row)}
                            title="Edit"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          {/* Only show view/download if a document exists */}
                          {row.storage_key && (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleViewDocument(row)}
                                title="View Document"
                              >
                                <FiEye size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleDownloadDocument(row)}
                                title="Download Document"
                              >
                                <FiDownload size={16} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleDeleteRecord(row)}
                            title="Delete"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          );
        })()}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          title={editingRecord ? "Edit Student Program" : "Add Student Program"}
          onClose={handleCloseModal}
        >
          <form onSubmit={handleSubmit} className={styles.formGrid}>

            {/* 👇 Upload box */}
            <FileUploadBox
              label="Upload Document"
              description="Attach project document or certificate"
              supported="PDF/Word"
              file={uploadDisplayFile}
              onFileSelected={(f) => setFile(f)}
            />

            {/* Repeat input format */}
            <label className={styles.inputLabel}>
              <span>Student Name</span>
              <input
                placeholder="Enter Student Name"
                value={form.student}
                onChange={(e) => onChange("student", e.target.value)}
              />
            </label>

            <label className={styles.inputLabel}>
              <span>College Name</span>
              <input
                placeholder="Enter College Name"
                value={form.college_name}
                onChange={(e) => onChange("college_name", e.target.value)}
              />
            </label>

            <label className={styles.inputLabel}>
              <span>Project Title</span>
              <input
                placeholder="Enter Project Title"
                value={form.project_name}
                onChange={(e) => onChange("project_name", e.target.value)}
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
              <div className={styles.daterow}>
                <div className={styles.field}>
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={form.start_date}
                    max={form.end_date || undefined}
                    onChange={(e) => onChange("start_date", e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <span>End Date</span>
                  <input
                    type="date"
                    value={form.end_date}
                    min={form.start_date || undefined}
                    onChange={(e) => onChange("end_date", e.target.value)}
                  />
                </div>
              </div>
              {dateError && <div className={styles.errorMsg}>{dateError}</div>}
            </label>
            <label className={styles.inputLabel}>
              <span>Duration (months)</span>
              <input
                type="number"
                min="1"
                value={form.duration_months}
                readOnly
                placeholder="Calculated from dates"
              />
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
                onClick={handleCloseModal}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={styles.saveBtn}
                disabled={submitting || Boolean(dateError)}
              >
                {submitting
                  ? "Saving..."
                  : editingRecord
                    ? "Save Changes"
                    : "+ Add Program"}
              </button>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}
          </form>
        </Modal>
      )}
    </div>
  );
}