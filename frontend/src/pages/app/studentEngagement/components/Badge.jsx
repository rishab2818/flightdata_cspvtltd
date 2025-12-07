import React from "react";
import styles from "../../StudentEngagement.module.css";

const BADGE_COLORS = {
  Ongoing: { bg: "#FEF3C7", text: "#B45309" },
  Completed: { bg: "#DCFCE7", text: "#15803D" },
  Cancelled: { bg: "#FEE2E2", text: "#B91C1C" },
  Upcoming: { bg: "#EEF2FF", text: "#4F46E5" },
};

export default function Badge({ value }) {
  const palette = BADGE_COLORS[value] || { bg: "#E5E7EB", text: "#111827" };

  return (
    <span
      className={styles.statusBadge}
      style={{ background: palette.bg, color: palette.text }}
    >
      {value}
    </span>
  );
}
