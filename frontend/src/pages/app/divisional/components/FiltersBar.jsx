import React from "react";
import { FiPlus } from "react-icons/fi";
import styles from "../DivisionalRecords.module.css";

export default function FiltersBar({ filters, setFilters, openModal }) {
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
