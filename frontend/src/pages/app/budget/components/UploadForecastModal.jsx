import React, { useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import styles from '../BudgetEstimation.module.css';
import { modalFields } from '../data';

export default function UploadForecastModal({ open, onClose, onSave }) {
  const [formState, setFormState] = useState(() =>
    Object.fromEntries(modalFields.map((field) => [field.key, '']))
  );
  const [forecastDate, setForecastDate] = useState('2026-02-27');

  const groupedFields = useMemo(
    () => modalFields.filter((field) => !field.fullWidth),
    []
  );

  if (!open) return null;

  const handleChange = (key) => (e) => {
    setFormState((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = () => {
    onSave({ ...formState, forecastDate });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Upload Forecast Budget</h3>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close modal">
            <FiX />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalTopControls}>
            <input
              type="date"
              value={forecastDate}
              onChange={(e) => setForecastDate(e.target.value)}
              className={styles.modalDateInput}
            />
            <button className={styles.primaryButton} type="button" onClick={() => {}}>
              Ok
            </button>
          </div>

          <div className={styles.modalGrid}>
            {groupedFields.map((field) => (
              <div key={field.key} className={styles.modalField}>
                <label className={styles.modalLabel}>{field.label}</label>
                {field.multiline ? (
                  <textarea
                    className={styles.modalTextarea}
                    placeholder={field.placeholder}
                    value={formState[field.key]}
                    onChange={handleChange(field.key)}
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    className={styles.modalInput}
                    placeholder={field.placeholder}
                    value={formState[field.key]}
                    onChange={handleChange(field.key)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={styles.primaryButton} type="button" onClick={handleSave}>
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
