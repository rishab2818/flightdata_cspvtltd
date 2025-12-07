import React, { useEffect, useMemo, useState } from "react";
import { recordsApi } from "../../../api/recordsApi";
import styles from "./DivisionalRecords.module.css";
import StatsRow from "./components/StatsRow";
import FiltersBar from "./components/FiltersBar";
import RecordTable from "./components/RecordTable";
import DivisionalModal from "./components/DivisionalModal";

export default function DivisionalRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ type: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

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

  const handleView = async (row) => {
    try {
      const res = await recordsApi.downloadDivisional(row.record_id);
      window.open(res.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert("Unable to open this record.");
    }
  };

  const handleDownload = async (row) => {
    try {
      const res = await recordsApi.downloadDivisional(row.record_id);
      const link = document.createElement("a");
      link.href = res.download_url;
      link.download = row.original_name || "divisional-record";
      link.click();
      link.remove();
    } catch (err) {
      alert("Download failed. Please try again.");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Delete this divisional record?")) return;
    try {
      await recordsApi.removeDivisional(row.record_id);
      setRecords((prev) => prev.filter((r) => r.record_id !== row.record_id));
    } catch (err) {
      alert("Delete failed. Please try again.");
    }
  };

  const filtered = useMemo(
    () => records.filter((r) => (filters.type === "all" ? true : r.record_type === filters.type)),
    [records, filters]
  );

  return (
    <div className={styles.wrapper}>
      <StatsRow records={records} />
      <FiltersBar filters={filters} setFilters={setFilters} openModal={() => setShowModal(true)} />
      <RecordTable
        filtered={filtered}
        loading={loading}
        error={error}
        onEdit={(row) => {
          setEditingRecord(row);
          setShowModal(true);
        }}
        onView={handleView}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
      {showModal && (
        <DivisionalModal
          onClose={() => setShowModal(false)}
          onCreated={loadRecords}
          editingRecord={editingRecord}
          onUpdated={(updated) => {
            setRecords((prev) => prev.map((r) => (r.record_id === updated.record_id ? updated : r)));
          }}
        />
      )}
    </div>
  );
}
