
// src/components/common/DocumentActions.jsx
import React from "react";
import { FiEye, FiDownload, FiTrash2, FiEdit2 } from "react-icons/fi";
import { viewDocument, downloadDocument, deleteDocument } from "../../utils/documentActions";

export default function DocumentActions({ doc, onEdit, onView, onDownload, onDelete }) {
  const handleView = () => {
    if (onView) return onView(doc);
    return viewDocument(doc.id);
  };

  const handleDownload = () => {
    if (onDownload) return onDownload(doc);
    return downloadDocument(doc.id, doc.fileName);
  };

  const handleDelete = () => {
    if (onDelete) return onDelete(doc);
    return deleteDocument(doc.id, doc.onDeleted);
  };

  return (
    <div className="doc-actions">
      {onEdit && (
        <button type="button" className="icon-btn" onClick={onEdit} aria-label="Edit">
          <FiEdit2 size={16} />
        </button>
      )}
      <button type="button" className="icon-btn" onClick={handleView} aria-label="View">
        <FiEye size={16} />
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={handleDownload}
        aria-label="Download"
      >
        <FiDownload size={16} />
      </button>

      <button
        type="button"
        className="icon-btn"
        onClick={handleDelete}
        aria-label="Delete"
      >
        <FiTrash2 size={16} />
      </button>
    </div>
  );
}
