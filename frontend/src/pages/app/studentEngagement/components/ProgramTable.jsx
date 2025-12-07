import React from "react";
import { FiDownload, FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";
import Badge from "./Badge";
import styles from "../../StudentEngagement.module.css";

const columns = [
  "Name",
  "College Name",
  "Project Name",
  "Type",
  "Duration",
  "Start Date",
  "End Date",
  "Guide",
  "Status",
  "Approval",
  "Actions",
];

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "—");

export default function ProgramTable({ rows, loading = false, onView, onDownload, onEdit, onDelete }) {
  return (
    <div className={styles.TableWrapper}>
      <h3>Student Programs</h3>
      <table className={styles.Table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className={styles.TableLoading}>
                Loading...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.TableEmpty}>
                No records found
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.record_id}>
                <td>{row.student}</td>
                <td>{row.college_name}</td>
                <td>{row.project_name}</td>
                <td>{row.program_type}</td>
                <td>{row.duration_months ? `${row.duration_months} months` : "—"}</td>
                <td>{formatDate(row.start_date)}</td>
                <td>{formatDate(row.end_date)}</td>
                <td>{row.mentor || "—"}</td>
                <td>
                  <Badge value={row.status} />
                </td>
                <td>
                  <span className={styles.approvalStatus}>{row.approval_status}</span>
                </td>
                <td>
                  <div className={styles.actionGroup}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => onView(row)}
                      title="View"
                    >
                      <FiEye size={16} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={() => onDownload(row)}
                      title="Download"
                    >
                      <FiDownload size={16} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={() => onEdit(row)}
                      title="Edit"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={() => onDelete(row)}
                      title="Delete"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
