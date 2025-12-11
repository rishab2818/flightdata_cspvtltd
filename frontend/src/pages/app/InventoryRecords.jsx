
import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2, FiUsers, FiX } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";
import Users from "../../assets/Users.svg";
import CurrencyInr from "../../assets/CurrencyInr.svg";
import SpinnerGap from "../../assets/SpinnerGap.svg";
import CheckSquareOffset from "../../assets/CheckSquareOffset.svg";
import styles from "./InventoryRecords.module.css";
import DocumentActions from "../../components/common/DocumentActions";
import EmptySection from "../../components/common/EmptyProject";
import FileUploadBox from "../../components/common/FileUploadBox";

const BORDER = "#E2E8F0";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-GB") : "—";

const formatAmount = (value) =>
  value === undefined || value === null || value === ""
    ? "—"
    : `₹ ${Number(value).toLocaleString()}`;

const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

// 👉 Duration helper: same logic as in StudentEngagement
const calculateDurationMonths = (start, end) => {
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  let months = yearDiff * 12 + monthDiff;

  if (end.getDate() >= start.getDate()) {
    months += 1;
  }

  return Math.max(months, 1);
};

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

function QuantityDisplay({ quantity, assignees = [], onManage }) {
  const assigned = assignees.reduce(
    (sum, entry) => sum + (Number(entry.items) || 0),
    0
  );

  return (
    <div className={styles.quantityCell}>
      <div className={styles.quantityValue}>{quantity ?? "—"}</div>
      <div className={styles.quantityMeta}>
        <span className={styles.quantityBadge}>
          {assigned}/{quantity ?? 0}
        </span>
        <button
          className={styles.quantityBtn}
          onClick={onManage}
          disabled={!quantity}
          title="Assign quantity"
          type="button"
        >
          <FiUsers size={16} />
        </button>
      </div>
    </div>
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
  const [assigneeModalOrder, setAssigneeModalOrder] = useState(null);

  const openModal = () => {
    setEditingOrder(null);
    setShowModal(true);
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await recordsApi.listInventory();
      setOrders(
        (data || []).map((item) => ({
          ...item,
          quantity_assignees: item.quantity_assignees ?? [],
        }))
      );
    } catch (e) {
      setError("Failed to load inventory records.");
    } finally {
      setLoading(false);
    }
  };

  const buildPayloadFromOrder = (order) => ({
    so_number: order.so_number || "",
    particular: order.particular || "",
    supplier_name: order.supplier_name || "",
    quantity: order.quantity ?? undefined,
    duration_months: order.duration_months ?? undefined,
    start_date: order.start_date ? toDateInputValue(order.start_date) : undefined,
    delivery_date: order.delivery_date
      ? toDateInputValue(order.delivery_date)
      : undefined,
    duty_officer: order.duty_officer || "",
    pl_holder: order.pl_holder || "",
    pl_ppl_number: order.pl_ppl_number || "",
    quantity_assignees: order.quantity_assignees ?? [],
    amount: order.amount ?? undefined,
    status: order.status || "Ongoing",
    storage_key: order.storage_key,
    original_name: order.original_name,
    content_type: order.content_type,
    size_bytes: order.size_bytes,
    content_hash: order.content_hash,
  });

  const handleSaveAssignees = async (order, assignees) => {
    const payload = buildPayloadFromOrder({
      ...order,
      quantity_assignees: assignees,
    });
    const updated = await recordsApi.updateInventory(order.record_id, payload);
    setOrders((prev) =>
      prev.map((o) => (o.record_id === order.record_id ? updated : o))
    );
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
          value={formatAmount(stats.totalCost)} // ✅ exact ₹ amount
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
                "PL Holder",
                "PL/PPL Number",
                "Amount",
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
                <td colSpan={13}>Loading...</td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={13}>{error}</td>
              </tr>
            )}

            {!loading && !error && filtered.length === 0 && (
                            <tr style={{ height: "300px" }}>
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
                  <td>{row.so_number || "—"}</td>
                  <td>{row.particular || "—"}</td>
                  <td>{row.supplier_name || "—"}</td>
                  <td>
                    <QuantityDisplay
                      quantity={row.quantity}
                      assignees={row.quantity_assignees}
                      onManage={() => setAssigneeModalOrder(row)}
                    />
                  </td>
                  <td>
                    {row.duration_months
                      ? `${row.duration_months} Months`
                      : "—"}
                  </td>
                  <td>{formatDate(row.start_date)}</td>
                  <td>{formatDate(row.delivery_date)}</td>
                  <td>{row.duty_officer || "—"}</td>
                  <td>{row.pl_holder || "—"}</td>
                  <td>{row.pl_ppl_number || "—"}</td>
                  <td>{formatAmount(row.amount)}</td>
                  <td>
                    <StatusBadge status={row.status || "Ongoing"} />
                  </td>
                  <td className="cell cell-center">
                    <DocumentActions
                      doc={{
                        id: row.record_id,
                        fileName: row.original_name,
                        onDeleted: (id) =>
                          setOrders((prev) =>
                            prev.filter((r) => r.record_id !== id)
                          ),
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

      {assigneeModalOrder && (
        <QuantityAssigneesModal
          quantity={assigneeModalOrder.quantity}
          initialAssignees={assigneeModalOrder.quantity_assignees}
          onClose={() => setAssigneeModalOrder(null)}
          onSave={(assignees) =>
            handleSaveAssignees(assigneeModalOrder, assignees)
          }
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
    pl_holder: "",
    pl_ppl_number: "",
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
  const [assignees, setAssignees] = useState([]);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const totalAssigned = assignees.reduce(
    (sum, entry) => sum + (Number(entry.items) || 0),
    0
  );

  useEffect(() => {
    if (!editingOrder) return;

    setForm({
      so_number: editingOrder.so_number || "",
      particular: editingOrder.particular || "",
      supplier_name: editingOrder.supplier_name || "",
      quantity: editingOrder.quantity ?? 1,
      duration_months: editingOrder.duration_months ?? 1,
      start_date: toDateInputValue(editingOrder.start_date) || "",
      delivery_date: toDateInputValue(editingOrder.delivery_date) || "",
      duty_officer: editingOrder.duty_officer || "",
      pl_holder: editingOrder.pl_holder || "",
      pl_ppl_number: editingOrder.pl_ppl_number || "",
      amount: editingOrder.amount ?? "",
      status: editingOrder.status || "Ongoing",
      storage_key: editingOrder.storage_key || null,
      original_name: editingOrder.original_name || "",
      content_type: editingOrder.content_type || "",
      size_bytes: editingOrder.size_bytes ?? null,
      content_hash: editingOrder.content_hash || "",
    });
    setAssignees(editingOrder.quantity_assignees || []);
    setFile(null);
    setError("");
  }, [editingOrder]);

  // ✅ Auto-calculate duration (months) from start & delivery date
  useEffect(() => {
    if (form.start_date && form.delivery_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.delivery_date);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
      ) {
        setForm((prev) => ({ ...prev, duration_months: "" }));
        return;
      }

      const months = calculateDurationMonths(start, end);
      setForm((prev) => ({ ...prev, duration_months: months }));
    } else {
      setForm((prev) => ({ ...prev, duration_months: "" }));
    }
  }, [form.start_date, form.delivery_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.start_date && form.delivery_date) {
      const start = new Date(form.start_date);
      const end = new Date(form.delivery_date);

      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end < start
      ) {
        setError("Delivery date cannot be before start date.");
        return;
      }
    }

    if (form.quantity && totalAssigned > Number(form.quantity)) {
      setError("Assigned quantity cannot exceed total quantity.");
      return;
    }

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
        duration_months: form.duration_months
          ? Number(form.duration_months)
          : undefined,
        amount: form.amount === "" ? undefined : Number(form.amount),
        start_date: form.start_date || undefined,
        delivery_date: form.delivery_date || undefined,
        quantity_assignees: assignees,
        storage_key: storage_key ?? form.storage_key,
        original_name: original_name ?? form.original_name,
        content_type: content_type ?? form.content_type,
        size_bytes: size_bytes ?? form.size_bytes,
        content_hash: content_hash ?? form.content_hash,
      };

      if (editingOrder) {
        const updated = await recordsApi.updateInventory(
          editingOrder.record_id,
          payload
        );
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
    <>
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

              {/* ✅ Duration auto-calculated from dates, read-only */}


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
                label="Duration(Months)"
                type="number"
                min={1}
                value={form.duration_months || ""}
                readOnly
                placeholder="Calculated from dates"
              />

              <Input
                label="D.Officer"
                value={form.duty_officer}
                onChange={(e) => onChange("duty_officer", e.target.value)}
              />

              <Input
                label="PL Holder"
                value={form.pl_holder}
                onChange={(e) => onChange("pl_holder", e.target.value)}
              />

              <Input
                label="PL/PPL Number"
                value={form.pl_ppl_number}
                onChange={(e) => onChange("pl_ppl_number", e.target.value)}
              />

              <Input
                label="Status"
                value={form.status}
                onChange={(e) => onChange("status", e.target.value)}
              />
            </div>

            <div className={styles.assigneeSummary}>
              <div>
                <p className={styles.assigneeTitle}>Quantity Allocation</p>
                <p className={styles.assigneeHint}>
                  Assigned {totalAssigned} of {form.quantity || 0} items
                </p>
              </div>
              <button
                type="button"
                className={styles.assigneeBtn}
                onClick={() => setShowAssigneeModal(true)}
                disabled={!form.quantity}
              >
                Manage Assignees
              </button>
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
              <button
                className={styles.cancelBtn}
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                type="submit"
                disabled={submitting}
              >
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

      {showAssigneeModal && (
        <QuantityAssigneesModal
          quantity={form.quantity ? Number(form.quantity) : 0}
          initialAssignees={assignees}
          onClose={() => setShowAssigneeModal(false)}
          onSave={async (list) => {
            setAssignees(list);
            setShowAssigneeModal(false);
          }}
        />
      )}
    </>
  );
}

function QuantityAssigneesModal({
  quantity,
  initialAssignees = [],
  onClose,
  onSave,
}) {
  const [rows, setRows] = useState(
    initialAssignees?.length
      ? initialAssignees.map((row) => ({
        assignee: row.assignee || "",
        items: row.items || "",
      }))
      : [{ assignee: "", items: "" }]
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(
      initialAssignees?.length
        ? initialAssignees.map((row) => ({
          assignee: row.assignee || "",
          items: row.items || "",
        }))
        : [{ assignee: "", items: "" }]
    );
  }, [initialAssignees]);

  const totalAssigned = rows.reduce(
    (sum, entry) => sum + (Number(entry.items) || 0),
    0
  );

  const updateRow = (idx, key, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  };

  const addRow = () =>
    setRows((prev) => [...prev, { assignee: "", items: "" }]);
  const deleteRow = (idx) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const cleaned = rows
      .map((row) => ({
        assignee: row.assignee.trim(),
        items: Number(row.items) || 0,
      }))
      .filter((row) => row.assignee || row.items);

    if (cleaned.some((row) => !row.assignee || !row.items || row.items <= 0)) {
      setError("Please fill assignee name and a quantity greater than 0.");
      return;
    }

    const total = cleaned.reduce((sum, row) => sum + row.items, 0);
    if (quantity && total > Number(quantity)) {
      setError("Assigned items cannot exceed available quantity.");
      return;
    }

    try {
      setSaving(true);
      await onSave(cleaned);
      onClose();
    } catch (err) {
      setError("Failed to save assignees. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.assigneeModalOverlay}>
      <div className={styles.assigneeModal}>
        <div className={styles.assigneeModalHeader}>
          <div>
            <h4>Assignees</h4>
            <p className={styles.assigneeSubtitle}>
              Split the quantity across teams or rooms.
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className={styles.assigneeTotals}>
          <span>Total Quantity: {quantity ?? 0}</span>
          <span>Assigned: {totalAssigned}</span>
          {quantity ? (
            <span>
              Remaining: {Math.max(Number(quantity) - totalAssigned, 0)}
            </span>
          ) : null}
        </div>

        <div className={styles.assigneeList}>
          {rows.map((row, idx) => (
            // ✅ Fix: stable key so typing doesn't reset to 1 character
            <div className={styles.assigneeRow} key={idx}>
              <label className={styles.assigneeInput}>
                <span>Number of Items</span>
                <input
                  type="number"
                  min={1}
                  value={row.items}
                  onChange={(e) => updateRow(idx, "items", e.target.value)}
                />
              </label>

              <label className={styles.assigneeInput}>
                <span>Assign to</span>
                <input
                  type="text"
                  value={row.assignee}
                  onChange={(e) => updateRow(idx, "assignee", e.target.value)}
                  placeholder="Name or location"
                />
              </label>

              <button
                type="button"
                className={styles.assigneeDelete}
                onClick={() => deleteRow(idx)}
                aria-label="Delete assignee"
              >
                <FiTrash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.assigneeActions}>
          <button
            type="button"
            className={styles.addAssigneeBtn}
            onClick={addRow}
          >
            <FiPlus size={16} /> Add Assignee
          </button>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.assigneeFooter}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
