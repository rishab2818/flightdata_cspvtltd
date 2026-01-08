import React from "react";
import UploadSimple from "../../assets/UploadSimple.svg";
import { FiUploadCloud } from "react-icons/fi";

const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";

export default function FileUploadBox({
  label = "Upload Files",
  description = "Drag and drop or click to browse",
  supported = "PDF/Word/any",
  file,
  onFileSelected,
}) {
  const handleChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (onFileSelected) onFileSelected(file);
  };

  return (
    <div
      style={{
        marginTop: 4,
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: "#ffffff",
        padding: "28px 20px 24px",
      }}
    >
      <div
        style={{
          borderRadius: 8,
          // border: `1px dashed ${BORDER}`,
          padding: "32px 16px 28px",
          textAlign: "center",
        }}
      >
       
        <img src={UploadSimple} alt="Upload"/>

        <h3
          style={{
            margin: "16px 0 6px",
            fontSize: 18,
            fontWeight: 600,
            color: "#111827",
          }}
        >
          {label}
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          {description}
        </p>

        <label
          style={{
            marginTop: 18,
            padding: "10px 26px",
            borderRadius: "8px",
            background: PRIMARY,
            border: "none",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: "pointer",
            width:"180px",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          <span>{file ? file.name : "Browse File"}</span>

          <input type="file" style={{ display: "none" }} onChange={handleChange} />
        </label>

        <p
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          Supported formats: {supported}
        </p>
      </div>
    </div>
  );
}
