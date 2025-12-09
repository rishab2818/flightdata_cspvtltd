import React, { useEffect, useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import styles from '../BudgetEstimation.module.css';
import { modalFields } from '../data';


export default function UploadForecastModal({
  open,
  mode = 'create',
  forecastYear,
  cashSplitLabel,
  values,
  onChange,
  onClose,
  onSave,
  onForecastYearChange,
  saving = false,
  existingFileName,
}) {
  const [file, setFile] = useState(null);
  const readOnly = mode === 'view';

  useEffect(() => {
    if (!open) {
      setFile(null);
    }
  }, [open, values]);

  const groupedFields = useMemo(() => modalFields, []);

  if (!open) return null;

  const handleChange = (key) => (e) => {
    onChange({ ...values, [key]: e.target.value });
  };

  const handleSubmit = () => {
    onSave?.({ values, file });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>
              {mode === 'edit' && 'Edit Forecast Budget'}
              {mode === 'view' && 'View Forecast Budget'}
              {mode === 'create' && 'Upload Forecast Budget'}
            </h3>
            <p className={styles.modalSubtitle}>
              Enter budget details. All fields are optional and attachments are supported.
            </p>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close modal">
            <FiX />
          </button>
        </div>

        <div className={styles.modalBody}>
          
          <div className={styles.modalTopControls}>
            <div className={styles.modalFieldInline}>
              <label className={styles.modalLabel}>Forecast Year</label>
              <input
                type="text"
                value={forecastYear}
                onChange={(e) => onForecastYearChange?.(e.target.value)}
                className={styles.modalInput}
                placeholder="2024-25"
                disabled={readOnly}
              />
            </div>
            <div className={styles.modalFieldInline}>
              <label className={styles.modalLabel}>Cash Outgo Split Over</label>
              <div className={styles.splitBadge}>{cashSplitLabel}</div>
            </div>
          </div>

          <div className={styles.modalGrid}>
            {groupedFields.map((field) => (
              <div key={field.key} className={styles.modalField}>
                <label className={styles.modalLabel}>
                  {field.key === 'cash_outgo_split'
                    ? `${field.label} (${cashSplitLabel})`
                    : field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    className={styles.modalTextarea}
                    placeholder={field.placeholder}
                    value={values[field.key]}
                    onChange={handleChange(field.key)}
                    disabled={readOnly}
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    className={styles.modalInput}
                    placeholder={field.placeholder}
                    value={values[field.key]}
                    onChange={handleChange(field.key)}
                    disabled={readOnly}
                  />
                )}
              </div>
            ))}
          </div>

          <div className={styles.modalFieldFull}>
            <label className={styles.modalLabel}>Upload attachment (optional)</label>
            <input
              type="file"
              className={styles.modalInput}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={readOnly}
            />
            {existingFileName && !file && (
              <div className={styles.subtleText}>Current file: {existingFileName}</div>
            )}
            {file && <div className={styles.subtleText}>Selected: {file.name}</div>}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? 'Saving…' : mode === 'edit' ? 'Update' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
