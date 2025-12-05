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
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");
const formatAmount = (value) =>
  value === undefined || value === null || value === ""
    ? "—"
    : `₹ ${Number(value).toLocaleString()}`;

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
  const [editingOrder, setEditingOrder] = useState(null);

  const openModal = () => {
    setEditingOrder(null);
    setShowModal(true);
  };

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

  const handleView = async (row) => {
    try {
      const res = await recordsApi.downloadInventory(row.record_id);
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Unable to open this record. Try downloading instead.");
    }
  };

  const handleDownload = async (row) => {
    try {
      const res = await recordsApi.downloadInventory(row.record_id);
      const link = document.createElement("a");
      link.href = res.download_url;
      link.download = row.original_name || "inventory-record";
      link.click();
      link.remove();
    } catch (err) {
      alert("Download failed. Please try again.");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Delete this supply order?")) return;
    try {
      await recordsApi.removeInventory(row.record_id);
      setOrders((prev) => prev.filter((o) => o.record_id !== row.record_id));
    } catch (err) {
      alert("Delete failed. Please try again.");
    }
  };

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
                  <td>{row.so_number || "—"}</td>
                  <td>{row.particular || "—"}</td>
                  <td>{row.supplier_name || "—"}</td>
                  <td>{row.quantity ?? "—"}</td>
                  <td>
                    {row.duration_months ? `${row.duration_months} Months` : "—"}
                  </td>
                  <td>{formatDate(row.start_date)}</td>
                  <td>{formatDate(row.delivery_date)}</td>
                  <td>{row.duty_officer || "—"}</td>
                  <td>{row.holder || "—"}</td>
                  <td>{formatAmount(row.amount)}</td>
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
                      onEdit={() => {
                        setEditingOrder(row);
                        setShowModal(true);
                      }}
                      onView={() => handleView(row)}
                      onDownload={() => handleDownload(row)}
                      onDelete={() => handleDelete(row)}
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
          onUpdated={(updated) => {
            setOrders((prev) =>
              prev.map((o) => (o.record_id === updated.record_id ? updated : o))
            );
          }}
          editingOrder={editingOrder}
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

function SupplyOrderModal({ onClose, onCreated, onUpdated, editingOrder }) {
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
    storage_key: null,
    original_name: "",
    content_type: "",
    size_bytes: null,
    content_hash: "",
  });

  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!editingOrder) return;

    setForm({
      so_number: editingOrder.so_number || "",
      particular: editingOrder.particular || "",
      supplier_name: editingOrder.supplier_name || "",
      quantity: editingOrder.quantity ?? 1,
      duration_months: editingOrder.duration_months ?? 1,
      start_date: editingOrder.start_date || "",
      delivery_date: editingOrder.delivery_date || "",
      duty_officer: editingOrder.duty_officer || "",
      holder: editingOrder.holder || "",
      amount: editingOrder.amount ?? "",
      status: editingOrder.status || "Ongoing",
      storage_key: editingOrder.storage_key || null,
      original_name: editingOrder.original_name || "",
      content_type: editingOrder.content_type || "",
      size_bytes: editingOrder.size_bytes ?? null,
      content_hash: editingOrder.content_hash || "",
    });
    setFile(null);
    setError("");
  }, [editingOrder]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);

      let storage_key,
        original_name,
        content_type,
        size_bytes,
        content_hash;

      if (file) {
        const hash = await computeSha256(file);

        const initRes = await recordsApi.initUpload("inventory-records", {
          section: "inventory-records",
          filename: file.name,

          content_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          content_hash: hash,
        });

        await fetch(initRes.upload_url, { method: "PUT", body: file });

        storage_key = initRes.storage_key;
        original_name = file.name;
        content_type = file.type || "application/octet-stream";
        size_bytes = file.size;
        content_hash = hash;
      }

      const payload = {
        ...form,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        duration_months: form.duration_months ? Number(form.duration_months) : undefined,
        amount: form.amount === "" ? undefined : Number(form.amount),
        start_date: form.start_date || undefined,
        delivery_date: form.delivery_date || undefined,
        storage_key: storage_key ?? form.storage_key,
        original_name: original_name ?? form.original_name,
        content_type: content_type ?? form.content_type,
        size_bytes: size_bytes ?? form.size_bytes,
        content_hash: content_hash ?? form.content_hash,
      };

      if (editingOrder) {
        const updated = await recordsApi.updateInventory(editingOrder.record_id, payload);
        onUpdated?.(updated);
      } else {
        const created = await recordsApi.createInventory(payload);
        onCreated?.(created);
      }

      onClose();
    } catch (err) {
      setError("Failed to save supply order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>
              {editingOrder ? "Edit Supply Order" : "Add Supply Order"}
            </h3>
            <p className={styles.modalSubtitle}>
              Capture supply details, dates, and attach proof for auditing.
            </p>
          </div>

          <button className={styles.closeBtn} onClick={onClose}>
            X
          </button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <FileUploadBox
            label="Upload Document"
            description="Attach supply record"
            supported="PDF/Word"
            file={file}
            onFileSelected={(f) => setFile(f)}
          />

          <div className={styles.grid}>
            <Input
              label="#SO"
              value={form.so_number}
              onChange={(e) => onChange("so_number", e.target.value)}
            />

            <Input
              label="Particular"
              value={form.particular}
              onChange={(e) => onChange("particular", e.target.value)}
            />

            <Input
              label="Supplier Name"
              value={form.supplier_name}
              onChange={(e) => onChange("supplier_name", e.target.value)}
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
              {submitting
                ? editingOrder
                  ? "Saving..."
                  : "Uploading..."
                : editingOrder
                ? "Save Changes"
                : "Upload Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
