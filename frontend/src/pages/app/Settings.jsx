import React, { useState } from "react";
import { usersApi } from "../../api/usersApi";
import styles from "./Setting.module.css";
import passwordImage from "../../assets/passwordsecuredimage.png";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validatePassword = (password) => {
    const minLength = 8;
    const specialChar = /[!@#$%^&*(),.?":{}|<>]/;

    if (password.length < minLength) {
      return "Password must be at least 8 characters long.";
    }

    if (!specialChar.test(password)) {
      return "Password must include at least one special character.";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("All fields are required.");
      setIsError(true);
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setMessage(validationError);
      setIsError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirm password do not match.");
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

      setMessage("Password updated successfully.");
      setIsError(false);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setIsError(true);
      setMessage("Unable to update password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.section}>
          <h3 className={styles.cardTitle}>Reset password</h3>

          <div className={styles.resetContainer}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label>Current Password</label>
              <div className={styles.passwordField}>
                <input
                  type={showCurrent ? "text" : "password"}
                  placeholder="**********"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <span onClick={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>

              <label>New Password</label>
              <div className={styles.passwordField}>
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="**********"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <span onClick={() => setShowNew(!showNew)}>
                  {showNew ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
              <small>Must be 8+ characters with at least one special character.</small>

              <label>Re-Enter New Password</label>
              <div className={styles.passwordField}>
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="**********"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <span onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>

              <button type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Save Password"}
              </button>

              {message && (
                <p className={isError ? styles.error : styles.success}>{message}</p>
              )}
            </form>

            <div className={styles.imgContainer}>
              <img src={passwordImage} alt="Password" />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h3>About Data Visualisation Tool</h3>
          <p>
            Our data visualization tool transforms complex datasets into clear, actionable
            insights. Explore trends, identify outliers, and make data-driven decisions with
            ease. Interactive charts and graphs bring your data to life, empowering you to
            communicate findings effectively and drive strategic growth. Unlock the power of
            your data with our intuitive and comprehensive visualization solution.
          </p>
        </div>

        <div className={styles.section}>
          <h3>Version 2025.0</h3>
          <p>
            Our data visualization tool transforms complex datasets into clear, actionable
            insights. Explore trends, identify outliers, and make data-driven decisions with
            ease. Interactive charts and graphs bring your data to life, empowering you to
            communicate findings effectively and drive strategic growth. Unlock the power of
            your data with our intuitive and comprehensive visualization solution.
          </p>
        </div>
      </div>
    </div>
  );
}
