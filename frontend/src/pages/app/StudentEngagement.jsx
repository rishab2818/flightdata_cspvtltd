import React, { useEffect, useMemo, useState } from "react";
import { studentEngagementApi } from "../../api/studentEngagementApi";
import { computeSha256 } from "../../lib/fileUtils";
import { FiDownload, FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";

import Users from "../../assets/Users.svg";
import Book1 from "../../assets/Book1.svg";
import Ongoing from "../../assets/Ongoing.svg";
import Cap from "../../assets/Cap.svg";
import PresentationChart1 from "../../assets/PresentationChart1.svg"
import styles from "./StudentEngagement.module.css";
import FileUploadBox from "../../components/common/FileUploadBox";
import EmptySection from "../../components/common/EmptyProject";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import Delete from '../../assets/Delete.svg'
import PencilSimple from '../../assets/PencilSimple.svg'
import ViewIcon from '../../assets/ViewIcon.svg'
import DownloadSimple from '../../assets/DownloadSimple.svg'


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
      <div className={styles.statIcon} style={{ backgroundColor: bgColor }}>
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
      <div className={styles.modalgrid} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
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

  const [showModal, setShowModal] = useState(false);

  /** 🔴 NEW — Delete Modal State */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const initialForm = {
    student: "",
    college_name: "",
    project_name: "",
    program_type: "Internship",
    duration_months: "",
    start_date: "",
    end_date: "",
    status: "Ongoing",
    notes: "",
    mentor: "",
  };

  const [form, setForm] = useState(initialForm);
  const [dateError, setDateError] = useState("");

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  /* ---------------- Auto Status ---------------- */
  useEffect(() => {
    if (!form.end_date) return;

    const toDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = toDateOnly(new Date());
    const end = toDateOnly(new Date(form.end_date));
    const start = form.start_date ? toDateOnly(new Date(form.start_date)) : null;

    let newStatus = form.status;

    if (end <= today) newStatus = "Completed";
    else if (start && start > today) newStatus = "Upcoming";
    else newStatus = "Ongoing";

    if (form.status !== newStatus) {
      setForm((prev) => ({ ...prev, status: newStatus }));
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
      start_date: record.start_date ? record.start_date.slice(0, 10) : "",
      end_date: record.end_date ? record.end_date.slice(0, 10) : "",
      status: record.status || "Ongoing",
      approval_status: record.approval_status || "waiting",
      notes: record.notes || "",
      mentor: record.mentor || "",
    });

    setExistingFileMeta({
      storage_key: record.storage_key,
      original_name: record.original_name,
      content_type: record.content_type,
      size_bytes: record.size_bytes,
      content_hash: record.content_hash,
    });

    setFile(null);
    setShowModal(true);
  };

  /* -------------------- Submit -------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (dateError) {
      setError(dateError);
      return;
    }

    try {
      setSubmitting(true);

      let storage_key = existingFileMeta?.storage_key;
      let original_name = existingFileMeta?.original_name;
      let content_type = existingFileMeta?.content_type;
      let size_bytes = existingFileMeta?.size_bytes;
      let content_hash = existingFileMeta?.content_hash;

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

      if (editingRecord) {
        resultRecord = await studentEngagementApi.update(
          editingRecord.record_id,
          payload
        );
      } else {
        resultRecord = await studentEngagementApi.create(payload);
      }

      setRecords((prev) => {
        if (editingRecord) {
          return prev.map((r) =>
            r.record_id === resultRecord.record_id ? resultRecord : r
          );
        } else {
          return [...prev, resultRecord];
        }
      });

      setShowModal(false);
      resetFormState();
    } catch (err) {
      setError("Unable to save student engagement record. Please check the details.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------- DELETE WITH CONFIRMATION -------------------- */

  const confirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      await studentEngagementApi.remove(recordToDelete.record_id);

      setRecords((prev) =>
        prev.filter((r) => r.record_id !== recordToDelete.record_id)
      );
    } catch (err) {
      alert("Unable to delete record.");
    }

    setShowDeleteModal(false);
    setRecordToDelete(null);
  };

  /* -------------------- DOCUMENT VIEW / DOWNLOAD -------------------- */

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

  const uploadDisplayFile =
    file ||
    (existingFileMeta?.original_name
      ? { name: existingFileMeta.original_name }
      : null);

  return (
    <div className={styles.wrapper}>
      {/* Stats */}
      <section className={styles.statsGrid}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
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
        <button className={styles.addBtn} onClick={openCreateModal}>
          <img src={PresentationChart1} alt="Add Student"/>
          Add Student
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
                "Actions",
              ].map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td className="TableLoad" colSpan={10}>
                  Loading...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td className="TableError" colSpan={10}>
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr >
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
              filtered.map((row) => (
                <tr key={row.record_id}>
                  <td className={styles.bold}>{row.student || "—"}</td>
                  <td>{row.college_name || "—"}</td>
                  <td>{row.project_name || "—"}</td>
                  <td>{row.program_type || "—"}</td>
                  <td>
                    {row.duration_months
                      ? `${row.duration_months} Months`
                      : "—"}
                  </td>
                  <td>
                    {row.start_date
                      ? new Date(row.start_date).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                  <td>
                    {row.end_date
                      ? new Date(row.end_date).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                  <td>{row.mentor || "—"}</td>
                  <td>
                    <Badge value={row.status} />
                  </td>

                  <td>
                    <div style={{display:'inline-flex', justifyContent:'center',alignItems:'center', gap:8}}>
                       <button
                            type="button"
                             style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                            onClick={() => handleViewDocument(row)}
                            title="View Document"
                          >
                             <img style={{ width: '20px', height: '20px' }} src={ViewIcon} alt="view" />
                          </button>
                      <button
                        type="button"
                         style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                        onClick={() => openEditModal(row)}
                        title="Edit"
                      >
                        <img style={{ width: '20px', height: '20px' }} src={PencilSimple} alt="edit" />
                      </button>

                      {row.storage_key && (
                        <>
                         

                          <button
                            type="button"
                             style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                            onClick={() => handleDownloadDocument(row)}
                            title="Download Document"
                          >
                           <img style={{ width: '20px', height: '20px' }} src={DownloadSimple} alt="download" />
                          </button>
                        </>
                      )}

                      {/* 🔴 OPEN DELETE CONFIRM MODAL */}
                      <button
                        type="button"
                         style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                        onClick={() => {
                          setRecordToDelete(row);
                          setShowDeleteModal(true);
                        }}
                        title="Delete"
                      >
                      <img style={{ width: '20px', height: '20px' }} src={Delete} alt="delete" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showModal && (
        <Modal 
          title={editingRecord ? "Edit Student Program" : "Add Student Program"}
          onClose={handleCloseModal}
        >
          <form onSubmit={handleSubmit} className={styles.formGrid}>
            <FileUploadBox
              label="Upload Document"
              description="Attach project document or certificate"
              supported="PDF/Word"
              file={uploadDisplayFile}
              onFileSelected={(f) => setFile(f)}
            />

            <div className={styles.formModal}>

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

  {/* Dates – full width */}
  <div className={`${styles.inputLabel} ${styles.fullWidth}`}>

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

      <div className={styles.field}>
        <span>Duration (months)</span>
        <input
          type="number"
          readOnly
          value={form.duration_months}
        />
      </div>
    </div>

    {dateError && <div className={styles.errorMsg}>{dateError}</div>}
  </div>

  <label className={styles.inputLabel}>
    <span>Guide</span>
    <input
      placeholder="Enter Guide Name"
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

   {/* <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Note</span>
            <textarea
              value={form.remarks}
              onChange={(e) => onChange("remarks", e.target.value)}
              rows={3}
              style={{
                width:"100%",
                borderRadius: "8px",
                 border: "1px solid #e2e8f0",
                padding: 10,
                background: "#F3F3F5",
                resize: "none",
              }}
            />
          </label> */}

 
  {/* <label className={`${styles.textAreaLabel} ${styles.fullWidth}`}>
    <span>Notes</span>
    <textarea
      value={form.notes}
      onChange={(e) => onChange("notes", e.target.value)}
    />
  </label> */}

</div>


          {/* <div className="styles.formModal">
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

              {dateError && <div className={styles.errorMsg}>{dateError}</div>}
            </label>

            <label className={styles.inputLabel}>
              <span>Guide</span>
              <input
                placeholder="Enter Guide Name"
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
            </div>

            <label className={styles.textAreaLabel}>
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => onChange("notes", e.target.value)}
              />
            </label> */}

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

      {showDeleteModal && (
  
    <ConfirmationModal
      title="Delete Student Records"
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
