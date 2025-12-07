import React from "react";
import DocumentActions from "../../../../components/common/DocumentActions";
import styles from "../DivisionalRecords.module.css";

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

export default function RecordTable({
  filtered,
  loading,
  error,
  onEdit,
  onView,
  onDownload,
  onDelete,
}) {
  return (
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
              <td className={styles.actionCol}>
                <DocumentActions
                  doc={{ id: row.record_id, fileName: row.original_name }}
                  onEdit={() => onEdit(row)}
                  onView={() => onView(row)}
                  onDownload={() => onDownload(row)}
                  onDelete={() => onDelete(row)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
