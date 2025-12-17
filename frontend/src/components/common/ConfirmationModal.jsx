// ConfirmationModal.jsx
import React from "react";
import DeleteImg from "../../assets/DeleteImg.png"; // replace with your actual path
import styles from "./ConfirmationModal.module.css";

export default function ConfirmationModal({ onCancel, onConfirm, title}) {
  return (
    <div className={styles.confirmationOverlay}>
      <div className={styles.confirmationBox}>
        <img
          src={DeleteImg}
          alt="delete"
          style={{ width: 200, height: 200, marginBottom: 10 }}
        />
        <h2 className={styles.title}>
        {title}
      </h2>
        <p className={styles.text}>Are you sure you want to delete this record?</p>
        <div className={styles.modalActions}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm}>YES,DELETE</button>
        </div>
      </div>
    </div>
  );
}
