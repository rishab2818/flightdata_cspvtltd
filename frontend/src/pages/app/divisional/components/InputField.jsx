import React from "react";
import styles from "../DivisionalRecords.module.css";

export default function InputField({ label, children, ...rest }) {
  return (
    <label className={styles.InputLabel}>
      <span className={styles.InputText}>{label}</span>
      {children || <input className={styles.InputBox} {...rest} />}
    </label>
  );
}
