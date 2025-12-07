import React from "react";
import Folder from "../../../../assets/Folder.svg";
import CurrencyInr from "../../../../assets/CurrencyInr.svg";
import Calculator from "../../../../assets/Calculator.svg";
import DotsThreeOutline from "../../../../assets/DotsThreeOutline.svg";
import styles from "../DivisionalRecords.module.css";

const BORDER = "#E2E8F0";

function StatCard({ title, value, icon, bg }) {
  return (
    <div className={styles.StatCard} style={{ borderColor: BORDER }}>
      <div className={styles.iconWrap} style={{ background: bg }}>
        <img src={icon} alt="" className={styles.iconImg} />
      </div>
      <div className={styles.StatText}>
        <div className={styles.StatTitle}>{title}</div>
        <div className={styles.StatValue}>{value}</div>
      </div>
    </div>
  );
}

export default function StatsRow({ records }) {
  return (
    <div className={styles.StatGrid}>
      <StatCard title="Total Records" value={records.length} icon={Folder} bg="#DBEAFE" />
      <StatCard
        title="Budget"
        value={records.filter((r) => r.record_type === "Budget").length}
        icon={CurrencyInr}
        bg="#FFEDD4"
      />
      <StatCard
        title="AMC"
        value={records.filter((r) => r.record_type === "AMC").length}
        icon={Calculator}
        bg="#F3E8FF"
      />
      <StatCard
        title="Others"
        value={records.filter((r) => r.record_type === "Others").length}
        icon={DotsThreeOutline}
        bg="#FFEDD4"
      />
    </div>
  );
}
