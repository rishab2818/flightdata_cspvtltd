import React, { useEffect, useState } from "react";
import { FiFileText, FiDownload, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { documentsApi } from "../../api/documentsApi";
import UploadSectionDocumentModal from "../../components/app/UploadSectionDocumentModal";

const BORDER = "#0000001A";
const PRIMARY = "#1976D2";

function formatDate(isoDateString) {
  if (!isoDateString) return "";
  const d = new Date(isoDateString);
  if (Number.isNaN(d.getTime())) return isoDateString;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CustomerFeedbacks() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await documentsApi.listBySection("customer_feedbacks");
      const mapped = data.map((doc) => ({
        id: doc.doc_id,
        fileName: doc.original_name,
        tag: doc.tag,
        date: formatDate(doc.doc_date),
      }));
      setRows(mapped);
    } catch (e) {
      console.error(e);
      setError("Failed to load customer feedbacks.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownload = async (row) => {
    try {
      const res = await documentsApi.getDownloadUrl(row.id);
      const url = res?.download_url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else alert("Download link missing.");
    } catch (e) {
      console.error(e);
      alert("Failed to download document.");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await documentsApi.remove(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete document.");
    }
  };

  return (
    <div style={{ width: 1011 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        Customer Feedbacks
      </h2>

      <div
        style={{
          marginTop: 18,
          border: `1px solid ${BORDER}`,
          background: "#fff",
          borderRadius: 8,
          padding: 24,
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <p style={{ margin: 0, color: "#334155", fontSize: 14 }}>
            Upload, manage and download customer feedback files.
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              padding: "8px 18px",
              borderRadius: 4,
              background: PRIMARY,
              border: "none",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <FiUploadCloud size={16} />
            <span>Upload Document</span>
          </button>
        </div>

        {/* table */}
        <div style={{ marginTop: 8, overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  color: "#6b7280",
                  fontWeight: 500,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <th style={{ padding: "10px 4px" }}>File Name</th>
                <th style={{ padding: "10px 4px" }}>Tag</th>
                <th style={{ padding: "10px 4px" }}>Date</th>
                <th
                  style={{ padding: "10px 4px", textAlign: "center" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "18px 4px",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "18px 4px",
                      textAlign: "center",
                      color: "#b91c1c",
                    }}
                  >
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "18px 4px",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No customer feedback files uploaded yet.
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <td style={{ padding: "10px 4px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 28,
                            borderRadius: 6,
                            border: `1px solid ${BORDER}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#F9FAFB",
                          }}
                        >
                          <FiFileText size={16} />
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            color: "#0f172a",
                          }}
                        >
                          {row.fileName}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 4px" }}>{row.tag}</td>
                    <td style={{ padding: "10px 4px" }}>{row.date}</td>
                    <td style={{ padding: "10px 4px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <IconButton onClick={() => handleDownload(row)}>
                          <FiDownload size={16} />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(row)}>
                          <FiTrash2 size={16} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <UploadSectionDocumentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        section="customer_feedbacks"
        onUploaded={loadData}
      />
    </div>
  );
}

function IconButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 32,
        height: 28,
        borderRadius: 6,
        border: `1px solid ${BORDER}`,
        background: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
