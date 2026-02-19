import React from 'react';
import { FiDownload, FiEdit2, FiEye, FiTrash2 } from 'react-icons/fi';
import Delete from '../../../../assets/Delete.svg'
import PencilSimple from '../../../../assets/PencilSimple.svg'
import ViewIcon from '../../../../assets/ViewIcon.svg'
import DownloadSimple from '../../../../assets/DownloadSimple.svg'
import styles from '../BudgetEstimation.module.css';
// import EmptySection from "../../components/common/EmptyProject";

const formatDate = (value) => {
  if (!value) return '--';
  try {
    return new Date(value).toLocaleDateString('en-GB');
  } catch (err) {
    return value;
  }
};

const formatCurrency = (value) => {
  if (value === undefined || value === null || value === '') return '--';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return value;
  return `₹ ${numberValue.toLocaleString('en-IN')}`;
};

export default function ForecastBudgetTable({ columns, rows, onView, onEdit, onDelete, onDownload }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* {!loading && !error && filtered.length === 0 && (
                          <tr style={{ height: "300px" }}>
                            <td colSpan={10} style={{ padding: 0 }}>
                              <div
                                 style={{
                                   width: "100%",
                                   height: "100%",
                                   display: "flex",
                                   alignItems: "center",
                                   justifyContent: "center",
                                   padding: "40px 0",
                                  }}
                >
                                <EmptySection />
                              </div>
                            </td>
                          </tr>
                         )} */}
          {rows.map((row, idx) => (
            <tr key={row.record_id || row.id || idx}>
              <td>{idx + 1}</td>
              <td>{row.division_name || '--'}</td>
              <td>{row.item || '--'}</td>
              <td>{row.descriptions || '--'}</td>
              <td>{row.qty ?? '--'}</td>
              <td>{row.existing_stock ?? '--'}</td>
              <td>{formatDate(row.previous_procurement_date)}</td>
              <td>{formatCurrency(row.estimated_cost)}</td>
              <td>{formatCurrency(row.cash_outgo)}</td>
              <td>
                <span className={styles.chip}>{formatCurrency(row.cash_outgo_split)}</span>
                <div className={styles.subtleText}>{row.cash_outgo_split_over || '--'}</div>
              </td>
              <td>{row.common_tdcc || '--'}</td>
              <td>{row.cross_project_use || '--'}</td>
              <td>{row.hardware_need || '--'}</td>
              <td>{row.capital_or_revenue || '--'}</td>
              <td>{row.condemnation || '--'}</td>
              <td>{row.note || '--'}</td>
              <td>
                {row.original_name ? (
                  <button
                    className={styles.linkButton}
                    type="button"
                    onClick={() => onDownload?.(row)}
                  >
                    {row.original_name}
                  </button>
                ) : (
                  <span className={styles.subtleText}>No file</span>
                )}
              </td>
              <td>
                <div style={{display:'inline-flex', justifyContent:'center',alignItems:'center', gap:8}}>
                  <button
                    style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                    title="View"
                    type="button"
                    onClick={() => onView?.(row)}
                  >
                 <img style={{ width: '20px', height: '20px' }} src={ViewIcon} alt="view" />
                  </button>
                  
                  <button
                     style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                    title="Edit"
                    type="button"
                    onClick={() => onEdit?.(row)}
                  >
                  <img style={{ width: '20px', height: '20px' }} src={PencilSimple} alt="edit" />
                  </button>
                  <button
                     style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                    title="Download"
                    type="button"
                    onClick={() => onDownload?.(row)}
                    disabled={!row.storage_key}
                  >
                    <img style={{ width: '20px', height: '20px' }} src={DownloadSimple} alt="download" />
                  </button>
                  <button
                     style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
                    title="Delete"
                    type="button"
                    onClick={() => onDelete?.(row)}
                  >
                     <img style={{ width: '20px', height: '20px' }} src={Delete} alt="delete" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
