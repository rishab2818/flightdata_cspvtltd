// src/components/CommonStatCard.jsx
import React from "react";
import styles from "./CommonStatCard.module.css";
import { BORDER } from "../../../constants/colors";


function CommonStatCard({ title, value, icon, bg }) {
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

export default CommonStatCard;
