import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import Users from "../../assets/Users.svg";
import CurrencyInr from "../../assets/CurrencyInr.svg";
import SpinnerGap from "../../assets/SpinnerGap.svg";
import CheckSquareOffset from "../../assets/CheckSquareOffset.svg";
import styles from "./InventoryRecords.module.css";
import DocumentActions from "../../components/common/DocumentActions";

import FileUploadBox from "../../components/common/FileUploadBox";

const BORDER = "#E2E8F0";

/*------------------------- Stat Card --------------------------*/

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

/*------------------------- Status Badge ------------------------*/

function StatusBadge({ status }) {
  const palette =
    status === "Completed"
      ? { bg: "#DCFCE7", text: "#15803D" }
      : { bg: "#E0F2FE", text: "#0369A1" };

  return (
    <span
      className={styles.statusBadge}
      style={{ background: palette.bg, color: palette.text }}
    >
      {status}
    </span>
  );
}

/*-------------------------- Main Component ----------------------*/

export default function InventoryRecords() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);

  const openModal = () => setShowModal(true);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await recordsApi.listInventory();
      setOrders(data);
    } catch (e) {
      setError("Failed to load inventory records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  /*---------------------- Filtering ------------------------*/
  const filtered = useMemo(() => {
    return orders.filter((row) => {
      const matchesType =
        filters.type === "all" ||
        row.particular?.toLowerCase().includes(filters.type.toLowerCase());

      const matchesStatus =
        filters.status === "all" || row.status === filters.status;

      return matchesType && matchesStatus;
    });
  }, [orders, filters]);

  /*------------------------ Stats ---------------------------*/

  const stats = useMemo(() => {
    const total = orders.length;
    const totalCost = orders.reduce(
      (sum, o) => sum + (Number(o.amount) || 0),
      0
    );
    const ongoing = orders.filter((o) => o.status !== "Completed").length;
    const completed = orders.filter((o) => o.status === "Completed").length;

    return { total, totalCost, ongoing, completed };
  }, [orders]);

  /*-------------------------- UI ----------------------------*/

  return (
    <div className={styles.wrapper}>
      {/* Stats */}
      <div className={styles.StatGrid}>
        <StatCard title="Total SO" value={stats.total} icon={Users} bg="#DBEAFE" />
        <StatCard
          title="Total Cost"
          value={`${stats.totalCost.toFixed(2)} Cr`}
          icon={CurrencyInr}
          bg="#FFEDD4"
        />
        <StatCard
          title="Ongoing Programs"
          value={stats.ongoing}
          icon={SpinnerGap}
          bg="#DCFCE7"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckSquareOffset}
          bg="#F3E8FF"
        />
      </div>

      {/* Filters */}
      <div className={styles.filtersContainer}>
        <div className={styles.leftFilters}>
          {/* Filter by Type */}
          <label className={styles.filterGroup}>
            <span className={styles.filterLabel}>Filter by Type</span>
            <select
              className={styles.select}
              value={filters.type}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              <option value="all">All Types</option>
              <option value="Budget">Budget</option>
              <option value="AMC">AMC</option>
              <option value="Cyber Security">Cyber Security</option>
            </select>
          </label>

          {/* Filter by Status */}
          <label className={styles.filterGroup}>
            <span className={styles.filterLabel}>Filter by Status</span>
            <select
              className={styles.select}
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              <option value="all">All Status</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
          </label>
        </div>

        {/* Upload Button */}
        <button className={styles.uploadBtn} onClick={openModal}>
          <FiPlus size={16} /> Upload Record
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <h3>Supply Order</h3>

        <table className={styles.table}>
          <thead>
            <tr>
              {[
                "#SO",
                "Particular",
                "Supplier Name",
                "QTY",
                "Duration",
                "Start Date",
                "Delivery Date",
                "D. Officer",
                "Holder",
                "Amount",
                "Status",
                "Actions"
              ].map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={11}>Loading...</td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={11}>{error}</td>
              </tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={11}>No supply orders found.</td>
              </tr>
            )}

            {!loading &&
              !error &&
              filtered.map((row) => (
                <tr key={row.record_id}>
                  <td>{row.so_number}</td>
                  <td>{row.particular}</td>
                  <td>{row.supplier_name}</td>
                  <td>{row.quantity}</td>
                  <td>{row.duration_months} Months</td>
                  <td>{new Date(row.start_date).toLocaleDateString("en-GB")}</td>
                  <td>{new Date(row.delivery_date).toLocaleDateString("en-GB")}</td>
                  <td>{row.duty_officer}</td>
                  <td>{row.holder}</td>
                  <td>₹ {Number(row.amount).toLocaleString()}</td>
                  <td>
                    <StatusBadge status={row.status || "Ongoing"} />
                  </td>
                  {/* 👉 New Actions Column */}
                  <td className="cell cell-center">
                    <DocumentActions
                      doc={{
                        id: row.record_id,
                        fileName: row.original_name,
                        onDeleted: (id) =>
                          setOrders(prev => prev.filter(r => r.record_id !== id)),
                      }}
                    />

                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <SupplyOrderModal
          onClose={() => setShowModal(false)}
          onCreated={loadOrders}
        />
      )}
    </div>
  );
}

/*-------------------- Input Component -----------------------*/

function Input({ label, ...rest }) {
  return (
    <label className={styles.inputLabel}>
      <span>{label}</span>
      <input {...rest} className={styles.inputBox} />
    </label>
  );
}

/*-------------------- Modal -----------------------*/

function SupplyOrderModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    so_number: "",
    particular: "",
    supplier_name: "",
    quantity: 1,
    duration_months: 1,
    start_date: "",
    delivery_date: "",
    duty_officer: "",
    holder: "",
    amount: "",
    status: "Ongoing",
  });

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const required = [
      "so_number",
      "particular",
      "supplier_name",
      "start_date",
      "delivery_date",
      "duty_officer",
      "holder",
      "amount",
    ];

    if (required.some((k) => !`${form[k]}`.trim())) {
      setError("Please fill all required fields.");
      return;
    }

    if (Number(form.quantity) <= 0 || Number(form.duration_months) <= 0) {
      setError("Quantity and duration must be greater than zero.");
      return;
    }

    try {
      setSubmitting(true);

      let storage_key,
        original_name,
        content_type,
        size_bytes;

      if (file) {
        const content_hash = await computeSha256(file);

        const initRes = await recordsApi.initUpload("inventory-records", {
          section: "inventory-records",
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

      await recordsApi.createInventory({
        ...form,
        quantity: Number(form.quantity),
        duration_months: Number(form.duration_months),
        amount: Number(form.amount),
        storage_key,
        original_name,
        content_type,
        size_bytes,
      });

      onClose();
      onCreated && onCreated();
    } catch (err) {
      setError("Failed to create supply order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Add Supply Order</h3>
            <p className={styles.modalSubtitle}>
              Capture supply details, dates, and attach proof for auditing.
            </p>
          </div>

          <button className={styles.closeBtn} onClick={onClose}>
            X
          </button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          {/* 👇 Upload box moved to TOP */}
                      <FileUploadBox
                        label="Upload Document"
                        description="Attach training related file here"
                        supported="PDF/Word"
                        file={file}
                        onFileSelected={(f) => setFile(f)}
                      />
        
          <div className={styles.grid}>
            <Input
              label="#SO"
              value={form.so_number}
              onChange={(e) => onChange("so_number", e.target.value)}
              required
            />

            <Input
              label="Particular"
              value={form.particular}
              onChange={(e) => onChange("particular", e.target.value)}
              required
            />

            <Input
              label="Supplier Name"
              value={form.supplier_name}
              onChange={(e) => onChange("supplier_name", e.target.value)}
              required
            />

            <Input
              label="QTY"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => onChange("quantity", e.target.value)}
            />

            <Input
              label="Duration(Months)"
              type="number"
              min={1}
              value={form.duration_months}
              onChange={(e) => onChange("duration_months", e.target.value)}
            />

            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) => onChange("start_date", e.target.value)}
            />

            <Input
              label="Delivery Date"
              type="date"
              value={form.delivery_date}
              onChange={(e) => onChange("delivery_date", e.target.value)}
            />

            <Input
              label="D.Officer"
              value={form.duty_officer}
              onChange={(e) => onChange("duty_officer", e.target.value)}
            />

            <Input
              label="Holder"
              value={form.holder}
              onChange={(e) => onChange("holder", e.target.value)}
            />

            <Input
              label="Status"
              value={form.status}
              onChange={(e) => onChange("status", e.target.value)}
            />
          </div>

          <div className={styles.uploadGrid}>
            <Input
              label="Amount"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => onChange("amount", e.target.value)}
            />
            </div>

          {error && <p className={styles.errorText}>{error}</p>}

          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} type="button" onClick={onClose}>
              Cancel
            </button>

            <button className={styles.saveBtn} type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
