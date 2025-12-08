import React from 'react';
import { FiDownload, FiEdit2, FiEye, FiTrash2 } from 'react-icons/fi';
import styles from '../BudgetEstimation.module.css';

export default function ForecastBudgetTable({ columns, rows }) {
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
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.division}</td>
              <td>{row.item}</td>
              <td>{row.description}</td>
              <td>{row.qty}</td>
              <td>{row.existingStock}</td>
              <td>{row.previousProcurement}</td>
              <td>₹ {row.estimatedCost}</td>
              <td>
                <span className={styles.chip}>₹ {row.cashOutgo}</span>
              </td>
              <td>{row.commonTdcc}</td>
              <td>{row.crossProjectUse}</td>
              <td>{row.hardwareNeed}</td>
              <td>{row.condemnation}</td>
              <td>{row.remarks}</td>
              <td>
                <div className={styles.actionBar}>
                  <button className={styles.actionButton} title="View" type="button">
                    <FiEye size={16} />
                  </button>
                  <button className={styles.actionButton} title="Download" type="button">
                    <FiDownload size={16} />
                  </button>
                  <button className={styles.actionButton} title="Edit" type="button">
                    <FiEdit2 size={15} />
                  </button>
                  <button className={styles.actionButton} title="Delete" type="button">
                    <FiTrash2 size={16} />
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
