import React from 'react';
import { FiUploadCloud } from 'react-icons/fi';
import styles from '../BudgetEstimation.module.css';

export default function BudgetFilterBar({ filters, onChange, onUpload }) {
  const handleSelect = (key) => (e) => {
    onChange({ ...filters, [key]: e.target.value });
  };

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Filter by Type</span>
        <select
          className={styles.select}
          value={filters.type}
          onChange={handleSelect('type')}
        >
          <option value="all">All Types</option>
          <option value="hardware">Hardware</option>
          <option value="software">Software</option>
          <option value="services">Services</option>
        </select>
      </div>

      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Sort by</span>
        <select
          className={styles.select}
          value={filters.sort}
          onChange={handleSelect('sort')}
        >
          <option value="none">None</option>
          <option value="asc">A to Z</option>
          <option value="desc">Z to A</option>
        </select>
      </div>

      <button type="button" className={styles.uploadButton} onClick={onUpload}>
        <FiUploadCloud size={18} />
        Upload forecast Budget
      </button>
    </div>
  );
}
