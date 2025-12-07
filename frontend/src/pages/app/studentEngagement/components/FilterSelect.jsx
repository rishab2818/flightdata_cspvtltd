import React from "react";
import styles from "../../StudentEngagement.module.css";

export default function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className={styles.filterLabel}>
      <span className={styles.filterText}>{label}</span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.select}
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
