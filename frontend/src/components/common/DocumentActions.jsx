
// src/components/common/DocumentActions.jsx
import React from "react";
import { FiEye, FiDownload, FiTrash2, FiEdit2 } from "react-icons/fi";
import { viewDocument, downloadDocument, deleteDocument } from "../../utils/documentActions";

export default function DocumentActions({ doc, onEdit }) {
    return (
        <div className="doc-actions">
            {onEdit && (
                <button
                    type="button"
                    className="icon-btn"
                    onClick={onEdit}
                >
                    <FiEdit2 size={16} />
                </button>
            )}
            <button
                type="button"
                className="icon-btn"
                onClick={() => viewDocument(doc.id)}
            >
                <FiEye size={16} />
            </button>

            <button
                type="button"
                className="icon-btn"
                onClick={() => downloadDocument(doc.id, doc.fileName)}
            >
                <FiDownload size={16} />
            </button>

            <button
                type="button"
                className="icon-btn"
                onClick={() => deleteDocument(doc.id, doc.onDeleted)}
            >
                <FiTrash2 size={16} />
            </button>
        </div>
    );
}
