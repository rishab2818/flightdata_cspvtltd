import React from "react";
import { FiFileText } from "react-icons/fi";

export default function UploadHeader({ onUploadClick }) {
  return (
    <div className="Header">
      <div>
        <h3>Uploaded Meeting Minutes</h3>
      </div>
      <button type="button" onClick={onUploadClick} className="UploadButton">
        <FiFileText size={16} />
        <span>Upload Minutes</span>
      </button>
    </div>
  );
}
