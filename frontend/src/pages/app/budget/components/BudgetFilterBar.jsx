import React from "react";
import { FiSearch } from "react-icons/fi";
import styles from "../BudgetEstimation.module.css";

export default function BudgetFilterBar({
  filters,
  onChange,
  yearFilter,
  yearOptions = [],
  onYearFilterChange,
  onUpload,
}) {
  const handleSearchChange = (event) => {
    onChange({
      ...filters,
      search: event.target.value,
    });
  };

  return (
    <div className={styles.toolbar}>
      {/* Search */}
      <div className={styles.searchGroup}>
        <label className={styles.filterLabel}>Search</label>

        <div className={styles.searchBox}>
          <FiSearch className={styles.searchIcon} />

          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search division or item"
            value={filters?.search || ""}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Right-side controls */}
      <div className={styles.rightControls}>
        {/* Year Filter */}
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Filter by Years</label>

          <select
            className={styles.select}
            value={yearFilter}
            onChange={(event) =>
              onYearFilterChange(event.target.value)
            }
          >
            <option value="all">All Years</option>

            {yearOptions.map((year) => {
              const value =
                typeof year === "string"
                  ? year
                  : year?.value;

              const label =
                typeof year === "string"
                  ? year
                  : year?.label ?? year?.value;

              if (!value) return null;

              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {/* Upload Button */}
        <button
          type="button"
          className={styles.uploadButton}
          onClick={onUpload}
        >
          <span
            className={styles.rupeeIcon}
            aria-hidden="true"
          >
            ₹
          </span>

          <span>Upload Forecast Budget</span>
        </button>
      </div>
    </div>
  );
}