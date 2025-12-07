import React from "react";
import styles from "../../StudentEngagement.module.css";

export default function StatCard({ title, value, icon, bgColor }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ backgroundColor: bgColor }}>
        <img src={icon} alt={title} />
      </div>
      <div>
        <div className={styles.statLabel}>{title}</div>
        <div className={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}
