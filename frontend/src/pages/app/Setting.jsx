import React, { useState } from "react";
import { usersApi } from "../../api/usersApi";
import styles from "./Setting.module.css";

export default function Setting() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("New password and confirm password do not match.");
      setIsError(true);
      return;
    }
    if (!currentPassword || !newPassword) {
      setMessage("Please fill in all required fields.");
      setIsError(true);
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      await usersApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setIsError(false);
      setMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setIsError(true);
      setMessage(err?.response?.data?.detail || "Unable to update password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Settings</h2>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Change password</h3>
          <p className={styles.cardSubtitle}>
            Update your password regularly to keep your account secure.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Current password</label>
              <input
                type="password"
                className={styles.input}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>New password</label>
              <input
                type="password"
                className={styles.input}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Confirm new password</label>
              <input
                type="password"
                className={styles.input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </div>
          </div>

          {message && (
            <div
              className={`${styles.message} ${isError ? styles.error : styles.success}`}
            >
              {message}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
