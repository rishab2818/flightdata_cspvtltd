import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUploadCloud } from "react-icons/fi";
import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";

const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";

function StatCard({ title, value, accent }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 170,
      }}
    >
      <span style={{ color: "#475569", fontSize: 13 }}>{title}</span>
      <strong style={{ fontSize: 20, color: accent || "#0F172A" }}>{value}</strong>
    </div>
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

function StatusBadge({ status }) {
  const palette =
    status === "Completed"
      ? { bg: "#DCFCE7", text: "#15803D" }
      : { bg: "#E0F2FE", text: "#0369A1" };
  return (
    <span
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.text,
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {status}
    </span>
  );
}

export default function InventoryRecords() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await recordsApi.listInventory();
      setOrders(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load inventory records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((row) => {
      const matchesType =
        filters.type === "all" || row.particular.toLowerCase().includes(filters.type);
      const matchesStatus =
        filters.status === "all" || row.status === filters.status;
      return matchesType && matchesStatus;
    });
  }, [orders, filters]);

  const stats = useMemo(() => {
    const total = orders.length;
    const totalCost = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const ongoing = orders.filter((o) => o.status !== "Completed").length;
    const completed = orders.filter((o) => o.status === "Completed").length;
    return {
      total,
      totalCost,
      ongoing,
      completed,
    };
  }, [orders]);

  return (
    <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Inventory Records</h2>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>
            Upload supply orders, track deliveries, and keep supporting files together.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 12,
        }}
      >
        <StatCard title="SO" value={stats.total} accent="#F8F9FF" />
        <StatCard title="Total Cost" value={`${stats.totalCost.toFixed(2)} Cr`} />
        <StatCard title="Ongoing Programs" value={stats.ongoing} />
        <StatCard title="Completed" value={stats.completed} />
      </div>

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
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <FilterSelect
              label="Filter by Type"
              value={filters.type}
              onChange={(val) => setFilters((prev) => ({ ...prev, type: val }))}
              options={[
                { label: "All Types", value: "all" },
                { label: "Laptop", value: "laptop" },
                { label: "Printer", value: "printer" },
                { label: "Monitor", value: "monitor" },
              ]}
            />
            <FilterSelect
              label="Filter by Status"
              value={filters.status}
              onChange={(val) => setFilters((prev) => ({ ...prev, status: val }))}
              options={[
                { label: "All Status", value: "all" },
                { label: "Ongoing", value: "Ongoing" },
                { label: "Completed", value: "Completed" },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 16px",
              background: PRIMARY,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FiPlus /> Add Supply Order
          </button>
        </div>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 960,
            }}
          >
            <thead>
              <tr
                style={{
                  color: "#64748B",
                  borderBottom: `1px solid ${BORDER}`,
                  textAlign: "left",
                }}
              >
                {["#SO", "Particular", "Supplier Name", "QTY", "Duration", "Start Date", "Delivery Date", "D. Officer", "Holder", "Amount", "Status"].map(
                  (col) => (
                    <th key={col} style={{ padding: "12px 8px", fontWeight: 600 }}>
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} style={{ padding: 16, textAlign: "center" }}>
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={11} style={{ padding: 16, textAlign: "center", color: "#b91c1c" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 16, textAlign: "center", color: "#94A3B8" }}>
                    No supply orders found.
                  </td>
                </tr>
              )}
              {!loading && !error &&
                filtered.map((row) => (
                  <tr key={row.record_id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>{row.so_number}</td>
                    <td style={{ padding: "12px 8px" }}>{row.particular}</td>
                    <td style={{ padding: "12px 8px" }}>{row.supplier_name}</td>
                    <td style={{ padding: "12px 8px" }}>{row.quantity}</td>
                    <td style={{ padding: "12px 8px" }}>{row.duration_months} Months</td>
                    <td style={{ padding: "12px 8px" }}>{new Date(row.start_date).toLocaleDateString("en-GB")}</td>
                    <td style={{ padding: "12px 8px" }}>{new Date(row.delivery_date).toLocaleDateString("en-GB")}</td>
                    <td style={{ padding: "12px 8px" }}>{row.duty_officer}</td>
                    <td style={{ padding: "12px 8px" }}>{row.holder}</td>
                    <td style={{ padding: "12px 8px" }}>₹ {Number(row.amount || 0).toLocaleString()}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <StatusBadge status={row.status || "Ongoing"} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <SupplyOrderModal
          onClose={() => setShowModal(false)}
          onCreated={loadOrders}
        />
      )}
    </div>
  );
}

function Input({ label, ...rest }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ color: "#475569", fontSize: 13 }}>{label}</span>
      <input
        {...rest}
        style={{
          height: 40,
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          padding: "0 12px",
          background: "#F9FAFB",
          fontSize: 14,
        }}
      />
    </label>
  );
}

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

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const requiredFields = [
      "so_number",
      "particular",
      "supplier_name",
      "start_date",
      "delivery_date",
      "duty_officer",
      "holder",
      "amount",
    ];
    if (requiredFields.some((key) => !`${form[key]}`.trim())) {
      setError("Please fill all required fields.");
      return;
    }
    if (Number(form.quantity) <= 0 || Number(form.duration_months) <= 0) {
      setError("Quantity and duration must be greater than zero.");
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
        const initRes = await recordsApi.initUpload("inventory-records", {
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
        amount: Number(form.amount || 0),
        storage_key,
        original_name,
        content_type,
        size_bytes,
      });
      onClose();
      if (onCreated) onCreated();
    } catch (err) {
      console.error(err);
      setError("Failed to create supply order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 12,
      }}
    >
      <div
        style={{
          width: "min(1020px, 96vw)",
          background: "#fff",
          borderRadius: 12,
          padding: "24px 28px",
          boxShadow: "0 30px 70px rgba(15,23,42,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Add Supply Order</h3>
            <p style={{ margin: "6px 0 0", color: "#64748B" }}>
              Capture supply details, dates, and attach proof for auditing.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${BORDER}`,
              background: "#fff",
              borderRadius: 10,
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <Input label="#SO" value={form.so_number} onChange={(e) => onChange("so_number", e.target.value)} required />
            <Input label="Particular" value={form.particular} onChange={(e) => onChange("particular", e.target.value)} required />
            <Input label="Supplier Name" value={form.supplier_name} onChange={(e) => onChange("supplier_name", e.target.value)} required />
            <Input label="QTY" type="number" min={1} value={form.quantity} onChange={(e) => onChange("quantity", e.target.value)} />
            <Input label="Duration (Months)" type="number" min={1} value={form.duration_months} onChange={(e) => onChange("duration_months", e.target.value)} />
            <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => onChange("start_date", e.target.value)} />
            <Input label="Delivery Date" type="date" value={form.delivery_date} onChange={(e) => onChange("delivery_date", e.target.value)} />
            <Input label="D. Officer" value={form.duty_officer} onChange={(e) => onChange("duty_officer", e.target.value)} />
            <Input label="Holder" value={form.holder} onChange={(e) => onChange("holder", e.target.value)} />
            <Input label="Status" value={form.status} onChange={(e) => onChange("status", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, alignItems: "center" }}>
            <Input label="Amount" type="number" min={0} value={form.amount} onChange={(e) => onChange("amount", e.target.value)} />
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
                  cursor: "pointer",
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
          </div>

          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: `1px solid ${BORDER}`,
                background: "#fff",
                padding: "10px 16px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                border: "none",
                background: PRIMARY,
                color: "#fff",
                padding: "10px 18px",
                borderRadius: 10,
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : "Save Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
