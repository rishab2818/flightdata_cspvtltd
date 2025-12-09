import React from 'react';
import { FiUploadCloud, FiSearch } from 'react-icons/fi';
import styles from '../BudgetEstimation.module.css';
import { fiscalYearOptions } from '../data';
import CurrencyInr from "../../../../assets/CurrencyInr.svg";


export default function BudgetFilterBar({
  filters,
  onChange,
  forecastYear,
  onForecastYearChange,
  onUpload,
}) {
  const handleSelect = (key) => (e) => {
    onChange({ ...filters, [key]: e.target.value });
  };

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Forecast Year</span>
        <select
          className={styles.select}
          value={forecastYear}
          onChange={(e) => onForecastYearChange(e.target.value)}
        >
          {fiscalYearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

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

      <div className={styles.searchBox}>
        <FiSearch className={styles.searchIcon} />
        <input
          type="search"
          placeholder="Search division or item"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className={styles.searchInput}
        />
      </div>

      <button type="button" className={styles.uploadButton} onClick={onUpload}>
       <img src={CurrencyInr} alt="rupee" className={styles.icon} />
        Upload forecast Budget
      </button>
    </div>
  );
}
