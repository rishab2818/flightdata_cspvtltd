import React, { useState } from "react";
import { usersApi } from "../../api/usersApi";
import styles from "./Setting.module.css";
import passwordImage from "../../assets/passwordsecuredimage.png";

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
      
      {/* MAIN CARD */}
      <div className={styles.card}>

        {/* RESET PASSWORD */}
        <div className={styles.section}>
          <h3 className={styles.cardTitle}>Reset password</h3>

          <div className={styles.resetContainer}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label>Current Password</label>
              <input
                type="password"
                placeholder="**********"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />

              <label>New Password</label>
              <input
                type="password"
                placeholder="**********"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <small>Use at least one special character - @, #, etc.</small>

              <label>Re-Enter New Password</label>
              <input
                type="password"
                placeholder="**********"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Save Password"}
              </button>
            </form>

            <div className={styles.imgContainer}>
              <img src={passwordImage} alt="Password" />
            </div>
          </div>
        </div>

        {/* ABOUT TOOL */}
        <div className={styles.section}>
          <h3>About Data Visualisation Tool</h3>
          <p>
            Our data visualization tool transforms complex datasets 
            into clear, actionable insights. Explore trends, identify outliers, and make data-driven decisions with ease. 
            Interactive charts and graphs bring your data to life, empowering you to communicate findings effectively and drive strategic growth.
             Unlock the power of your data with our intuitive and comprehensive visualization solution. </p>
        </div>
        {/* Version  */}
        <div className={styles.section}>
          <h3>Version 2025.0</h3>
          <p>
            Our data visualization tool transforms complex datasets 
            into clear, actionable insights. Explore trends, identify outliers, and make data-driven decisions with ease. 
            Interactive charts and graphs bring your data to life, empowering you to communicate findings effectively and drive strategic growth.
             Unlock the power of your data with our intuitive and comprehensive visualization solution. </p>
         </div>

      </div>
    </div>
  );
}
