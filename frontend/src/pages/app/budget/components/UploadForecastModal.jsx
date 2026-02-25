import React, { useEffect, useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import styles from '../BudgetEstimation.module.css';
import { modalFields } from '../data';
import FileUploadBox from "../../../../components/common/FileUploadBox";
import load from "../../../../assets/load.svg"


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
  const [error, setError] = useState("");
  const readOnly = mode === 'view';

  // reset file when modal closes
  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  const groupedFields = useMemo(() => modalFields, []);

  if (!open) return null;

  // const handleChange = (key) => (e) => {
  //   onChange({ ...values, [key]: e.target.value });
  // };

  const handleChange = (key, type) => (e) => {
  let value = e.target.value;

  if (type === "number") {
    // allow only numbers + decimal
    if (!/^\d*\.?\d*$/.test(value)) return;
  }

  onChange({ ...values, [key]: value });
};


  const blockInvalidNumberChars = (e) => {
  if (["e", "E", "+", "-"].includes(e.key)) {
    e.preventDefault();
  }
};


  // const handleSubmit = () => {
  //   onSave?.({ values, file });
  // };

  const handleSubmit = () => {

  if (!file && !existingFileName) {
    setError("Please select a file to upload.");
    return;
  }

  setError("");

  for (const field of modalFields) {
    if (field.type === "number" && values[field.key]) {
      if (isNaN(values[field.key])) {
        setError(`${field.label} must be a number`);
        return;
      }
    }
  }

  onSave?.({ values, file });
};

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        
        {/* HEADER */}
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
          <button className={styles.modalClose} onClick={onClose}>
            <FiX />
          </button>
        </div>

        {/* BODY */}
        <div className={styles.modalBody}>

          {/* Document Upload */}
          <FileUploadBox
            label="Upload Document"
            description="Attach supply record"
            supported="PDF/Word"
            file={file}
            onFileSelected={(f) => setFile(f)}
          />

          {/* Forecast Year + Cash Split */}
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

          {/* Dynamic Fields */}
          <div className={styles.modalGrid}>
            {groupedFields.map((field) => (
              <div key={field.key} className={styles.modalField}>
                <label className={styles.modalLabel}>
                  {field.key === 'cash_outgo_split'
                    ? `${field.label} (${cashSplitLabel})`
                    : field.label}
                </label>

                {field.multiline ? (
  <>
    <textarea
      className={styles.modalTextarea}
      placeholder={field.placeholder}
      value={values[field.key] || ''}
      onChange={handleChange(field.key, field.type)}
      disabled={readOnly}
      maxLength={field.maxLength || 500}
    />

    <div
      style={{
        fontSize: 12,
        textAlign: "right",
        color:
          (values[field.key] || "").length > 180 ? "red" : "#666",
      }}
    >
      {(values[field.key] || "").length}/{field.maxLength || 500}
    </div>
  </>
) : field.type === "select" ? (
  <select
    className={styles.ModalSelect}
    value={values[field.key] || ''}
    onChange={handleChange(field.key, field.type)}
    disabled={readOnly}
  >
    <option value="">Select</option>
    {field.options?.map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ))}
  </select>
) : (
  <input
    type="text"
    inputMode={field.type === "number" ? "decimal" : "text"}
    className={styles.modalInput}
    placeholder={field.placeholder}
    value={values[field.key] || ''}
    onChange={handleChange(field.key, field.type)}
    disabled={readOnly}
    onWheel={(e) => e.target.blur()}
    onKeyDown={field.type === "number" ? blockInvalidNumberChars : undefined}
  />
)}

                {/* {field.multiline ? (
                  // <textarea
                  //   className={styles.modalTextarea}
                  //   placeholder={field.placeholder}
                  //   value={values[field.key] || ''}
                  //   onChange={handleChange(field.key)}
                  //   disabled={readOnly}
                  // />
                  <textarea
  className={styles.modalTextarea}
  placeholder={field.placeholder}
  value={values[field.key] || ''}
  onChange={handleChange(field.key, field.type)}
  disabled={readOnly}
/>
                ) : (
                  <input
                  type="text"
  inputMode={field.type === "number" ? "decimal" : "text"}
  className={styles.modalInput}
  placeholder={field.placeholder}
  value={values[field.key] || ''}
  onChange={handleChange(field.key, field.type)}
  disabled={readOnly}
  onWheel={(e) => e.target.blur()}
  onKeyDown={field.type === "number" ? blockInvalidNumberChars : undefined}
/>
                  // <input
                  //   type={field.type || 'text'}
                  //   className={styles.modalInput}
                  //   placeholder={field.placeholder}
                  //   value={values[field.key] || ''}
                  //   onChange={handleChange(field.key)}
                  //   disabled={readOnly}
                  // />
                )} */}
              </div>
            ))}
          </div>
        </div>

        {error && (
  <div style={{ color: "#d32f2f", marginBottom: 10, fontSize: 14, marginLeft:24,fontFamily: "Inter, sans-serif" }}>
    {error}
  </div>
)}

        {/* ACTIONS */}
        <div className={styles.modalActions}>
          <button className={styles.secondaryButton} onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>

          {!readOnly && (
            <button
              className={styles.primaryButton}
              onClick={handleSubmit}
              disabled={saving}
            >
              <img src={load} alt="load" className={styles.icons} />
              {saving ? 'Saving…' : mode === 'edit' ? 'Update' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
