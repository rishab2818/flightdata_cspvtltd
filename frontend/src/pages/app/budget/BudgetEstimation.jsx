import React, { useMemo, useState } from 'react';
import BudgetFilterBar from './components/BudgetFilterBar';
import ForecastBudgetTable from './components/ForecastBudgetTable';
import UploadForecastModal from './components/UploadForecastModal';
import styles from './BudgetEstimation.module.css';
import { forecastColumns, forecastRows } from './data';

export default function BudgetEstimation() {
  const [filters, setFilters] = useState({ type: 'all', sort: 'none' });
  const [showModal, setShowModal] = useState(false);
  const [tableDate] = useState('2026-02-27');

  const sortedRows = useMemo(() => {
    if (filters.sort === 'asc') {
      return [...forecastRows].sort((a, b) => a.division.localeCompare(b.division));
    }
    if (filters.sort === 'desc') {
      return [...forecastRows].sort((a, b) => b.division.localeCompare(a.division));
    }
    return forecastRows;
  }, [filters.sort]);

  const filteredRows = useMemo(() => {
    if (filters.type === 'all') return sortedRows;
    return sortedRows.filter((row) => row.item.toLowerCase().includes(filters.type));
  }, [sortedRows, filters.type]);

  const handleSave = (payload) => {
    console.log('Saving forecast budget', payload);
    setShowModal(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.heroCard}>
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>Budget Estimation</h2>
          <p className={styles.heroSubtitle}>Description here</p>
        </div>
      </div>

      <BudgetFilterBar
        filters={filters}
        onChange={setFilters}
        onUpload={() => setShowModal(true)}
      />

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Forecast Budget</h3>
          <div className={styles.dateBadge}>{tableDate}</div>
        </div>
        <ForecastBudgetTable columns={forecastColumns} rows={filteredRows} />
      </section>

      <UploadForecastModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />
    </div>
  );
}
