import React, { useEffect, useMemo, useState } from "react";
import { studentEngagementApi } from "../../api/studentEngagementApi";
import { computeSha256 } from "../../lib/fileUtils";

import Users from "../../assets/Users.svg";
import Book1 from "../../assets/Book1.svg";
import Ongoing from "../../assets/Ongoing.svg";
import Cap from "../../assets/Cap.svg";
import styles from "./StudentEngagement.module.css";
import FileUploadBox from "../../components/common/FileUploadBox";
import StatCard from "./studentEngagement/components/StatCard";
import FilterSelect from "./studentEngagement/components/FilterSelect";
import Modal from "./studentEngagement/components/Modal";
import ProgramTable from "./studentEngagement/components/ProgramTable";

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
      { title: "Internships", value: internships, icon: Book1, bgColor: "#FFEDD4"},
      { title: "Ongoing Programs", value: ongoing, icon: Ongoing,bgColor:"#DCFCE7" },
      { title: "Completed", value: completed, icon: Cap, bgColor:"#F3E8FF"},
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
        duration_months: form.duration_months ? Number(form.duration_months) : undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        storage_key,
        original_name,
        content_type,
        size_bytes,
        content_hash,
      };

      if (editingRecord) {
        const updated = await studentEngagementApi.update(editingRecord.record_id, payload);
        setRecords((prev) =>
          prev.map((r) => (r.record_id === editingRecord.record_id ? updated : r))
        );
      } else {
        const created = await studentEngagementApi.create(payload);
        setRecords((prev) => [created, ...prev]);
      }

      setShowModal(false);
      resetFormState();
    } catch (err) {
      setError("Unable to save student engagement record");
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

  const uploadDisplayFile =
    file || (existingFileMeta?.original_name ? { name: existingFileMeta.original_name } : null);

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
      <ProgramTable
        rows={filtered}
        loading={loading}
        onView={handleViewDocument}
        onDownload={handleDownloadDocument}
        onEdit={openEditModal}
        onDelete={handleDeleteRecord}
      />
      {/* Modal */}
      {showModal && (
        <Modal
          title={editingRecord ? "Edit Student Program" : "Add Student Program"}
          onClose={handleCloseModal}
        >
          <form onSubmit={handleSubmit} className={styles.formGrid}>

             {/* 👇 Upload box moved to TOP */}
            <FileUploadBox
              label="Upload Document"
              description="Attach training related file here"
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
