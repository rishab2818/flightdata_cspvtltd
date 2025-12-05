// Cleaned and corrected full component
import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import Folder from "../../assets/Folder.svg";
import CurrencyInr from "../../assets/CurrencyInr.svg";
import Calculator from "../../assets/Calculator.svg";
import DotsThreeOutline from "../../assets/DotsThreeOutline.svg";
import styles from "./DivisionalRecords.module.css";
import FileUploadBox from "../../components/common/FileUploadBox";

const BORDER = "#E2E8F0";
const PRIMARY = "#2563EB";

/* --------------------- Stat Card --------------------- */
function StatCard({ title, value, icon, bg }) {
  return (
    <div className={styles.StatCard} style={{ borderColor: BORDER }}>
      <div className={styles.iconWrap} style={{ background: bg }}>
        <img src={icon} alt="" className={styles.iconImg} />
      </div>
      <div className={styles.StatText}>
        <div className={styles.StatTitle}>{title}</div>
        <div className={styles.StatValue}>{value}</div>
      </div>
    </div>
  );
}

/* --------------------- Badge --------------------- */
function TypeBadge({ value }) {
  const palette = {
    Budget: { bg: "#EEF2FF", text: "#4338CA" },
    AMC: { bg: "#E0F2FE", text: "#075985" },
    "Cyber Security": { bg: "#FFF7ED", text: "#C2410C" },
  }[value] || { bg: "#E5E7EB", text: "#111827" };

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
      {value}
    </span>
  );
}


/* --------------------- Filters Bar --------------------- */
function FiltersBar({ filters, setFilters, openModal }) {
  return (
    <div className={styles.filtersContainer}>
      <div className={styles.leftFilters}>
        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter by Type</span>
          <select
            className={styles.select}
            value={filters.type}
            onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
          >
            <option value="all">All Types</option>
            <option value="Budget">Budget</option>
            <option value="AMC">AMC</option>
            <option value="Cyber Security">Cyber Security</option>
          </select>
        </label>

        <label className={styles.filterGroup}>
          <span className={styles.filterLabel}>Filter by Status</span>
          <select className={styles.select}>
            <option>All Status</option>
            <option>Approved</option>
            <option>Pending</option>
            <option>Rejected</option>
          </select>
        </label>
      </div>

      <button className={styles.uploadBtn} onClick={openModal}>
        <FiPlus size={16} /> Upload Record
      </button>
    </div>
  );
}

/* --------------------- Main Component --------------------- */
export default function DivisionalRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all" });
  const [showModal, setShowModal] = useState(false);

  const openModal = () => setShowModal(true);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await recordsApi.listDivisional();
      setRecords(data);
    } catch {
      setError("Failed to load divisional records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const filtered = useMemo(() => {
    return records.filter((r) => (filters.type === "all" ? true : r.record_type === filters.type));
  }, [records, filters]);

  return (
    <div className={styles.wrapper}>
      {/* Stats */}
      <div className={styles.StatGrid}>
        <StatCard title="Total Records" value={records.length} icon={Folder} bg="#DBEAFE" />
        <StatCard title="Budget" value={records.filter((r) => r.record_type === "Budget").length} icon={CurrencyInr} bg="#FFEDD4" />
        <StatCard title="AMC" value={records.filter((r) => r.record_type === "AMC").length} icon={Calculator} bg="#F3E8FF" />
        <StatCard title="Others" value={records.filter((r) => r.record_type === "Others").length} icon={DotsThreeOutline} bg="#FFEDD4" />
      </div>

      {/* Filters */}
      <FiltersBar filters={filters} setFilters={setFilters} openModal={() => setShowModal(true)} />

      {/* Table */}
      <div className={styles.tableWrapper}>
        <h3>Divisional Records</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              {["Record Name", "Type", "Created Date", "Remarks", "Action"].map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr><td colSpan={5} className={styles.centerText}>Loading...</td></tr>
            )}

            {!loading && error && (
              <tr><td colSpan={5} className={styles.errorText}>{error}</td></tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={5} className={styles.centerText}>No divisional records found.</td></tr>
            )}

            {!loading && !error && filtered.map((row) => (
              <tr key={row.record_id}>
                <td>{row.division_name || "—"}</td>
                <td><TypeBadge value={row.record_type || ""} /></td>
                <td>
                  {row.created_date
                    ? new Date(row.created_date).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td>{row.remarks || "—"}</td>
                <td className={styles.actionCol}>-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <DivisionalModal onClose={() => setShowModal(false)} onCreated={loadRecords} />}
    </div>
  );
}

/* --------------------- Input --------------------- */
function Input({ label, ...rest }) {
  return (
    <label className={styles.InputLabel}>
      <span className={styles.InputText}>{label}</span>
      <input className={styles.InputBox} {...rest} />
    </label>
  );
}

/* --------------------- Modal --------------------- */

function DivisionalModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    division_name: "",
    record_type: "Budget",
    created_date: "",
    rating: "",
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
      let storage_key, original_name, content_type, size_bytes;

      if (file) {
        const content_hash = await computeSha256(file);
        const initRes = await recordsApi.initUpload("divisional-records", {
          section: "divisional-records",
          filename: file.name,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          content_hash,
        });

        await fetch(initRes.upload_url, { method: "PUT", body: file });

        storage_key = initRes.storage_key;
        original_name = file.name;
        content_type = file.type;
        size_bytes = file.size;
      }

      await recordsApi.createDivisional({
        ...form,
        rating: form.rating === "" ? undefined : Number(form.rating || 0),
        created_date: form.created_date || undefined,
        storage_key,
        original_name,
        content_type,
        size_bytes,
      });

      onClose();
      onCreated && onCreated();
    } catch (err) {
      console.error(err);
      setError("Failed to upload divisional record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Upload Divisional Record</h3>
            <p className={styles.modalSubtitle}>Upload tagged divisional entries.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.UploadGrid}>
            <Input className={styles.input} label="Division Name" value={form.division_name} onChange={(e) => onChange("division_name", e.target.value)} />

            <label >
              <span>Type</span>
              <select className={styles.input} value={form.record_type} onChange={(e) => onChange("record_type", e.target.value)}>
                <option value="Budget">Budget</option>
                <option value="AMC">AMC</option>
                <option value="Cyber Security">Cyber Security</option>
              </select>
            </label>

            <Input className={styles.input} label="Created Date" type="date" value={form.created_date} onChange={(e) => onChange("created_date", e.target.value)} />

            <Input className={styles.input} label="Rating" type="number" min={0} step={0.1} value={form.rating} onChange={(e) => onChange("rating", e.target.value)} />

            <label className={styles.inputBox}>
              <span className={styles.inputLabel}>Remarks</span>
              <textarea rows={3} value={form.remarks} onChange={(e) => onChange("remarks", e.target.value)} className={styles.textarea} />
            </label>

            <label className={styles.inputBox}>
              <span className={styles.inputLabel}>Upload Document</span>
              <div className={styles.uploadBoxFile}>
                <FiUploadCloud />
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </label>

            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.modelFooter}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.saveBtn} disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

