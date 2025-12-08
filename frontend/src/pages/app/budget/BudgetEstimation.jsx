import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BudgetFilterBar from './components/BudgetFilterBar';
import ForecastBudgetTable from './components/ForecastBudgetTable';
import UploadForecastModal from './components/UploadForecastModal';
import styles from './BudgetEstimation.module.css';
import { defaultFormState, fiscalYearOptions, forecastColumns } from './data';
import { budgetsApi } from '../../../api/budgetsApi';
import { computeSha256 } from '../../../lib/fileUtils';

const normalizeNumber = (value) =>
  value === '' || value === undefined || value === null ? undefined : Number(value);

const deriveCashSplitYear = (forecastYear) => {
  if (!forecastYear) return '----';
  const match = forecastYear.match(/(\d{4})-(\d{2})/);
  if (!match) return forecastYear;
  const startYear = Number(match[1]) + 2;
  const endYear = Number(match[2]) + 2;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
};

const toFormState = (record) => {
  if (!record) return { ...defaultFormState };
  return {
    ...defaultFormState,
    ...Object.fromEntries(
      Object.keys(defaultFormState).map((key) => [key, record[key] ?? ''])
    ),
    previous_procurement_date: record.previous_procurement_date
      ? record.previous_procurement_date.slice(0, 10)
      : '',
  };
};

export default function BudgetEstimation() {
  const [filters, setFilters] = useState({ type: 'all', sort: 'none', search: '' });
  const [forecastYear, setForecastYear] = useState(fiscalYearOptions[1]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalState, setModalState] = useState({ open: false, mode: 'create', record: null });
  const [formValues, setFormValues] = useState(defaultFormState);
  const [saving, setSaving] = useState(false);

  const cashSplitLabel = useMemo(() => deriveCashSplitYear(forecastYear), [forecastYear]);
  const columns = useMemo(() => forecastColumns(cashSplitLabel), [cashSplitLabel]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await budgetsApi.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Unable to fetch budget forecasts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const sortedRows = useMemo(() => {
    const withSplit = rows.map((row) => ({
      ...row,
      cash_outgo_split_over: row.cash_outgo_split_over || deriveCashSplitYear(row.forecast_year),
    }));

    const filteredByType = filters.type === 'all'
      ? withSplit
      : withSplit.filter((row) => (row.item || '').toLowerCase().includes(filters.type));

    const filteredBySearch = filteredByType.filter((row) => {
      if (!filters.search) return true;
      const search = filters.search.toLowerCase();
      return (
        (row.division_name || '').toLowerCase().includes(search) ||
        (row.item || '').toLowerCase().includes(search)
      );
    });

    if (filters.sort === 'asc') {
      return [...filteredBySearch].sort((a, b) => (a.division_name || '').localeCompare(b.division_name || ''));
    }
    if (filters.sort === 'desc') {
      return [...filteredBySearch].sort((a, b) => (b.division_name || '').localeCompare(a.division_name || ''));
    }
    return filteredBySearch;
  }, [filters.search, filters.sort, filters.type, rows]);

  const handleOpenModal = (mode = 'create', record = null) => {
    setModalState({ open: true, mode, record });
    setFormValues(toFormState(record));
    if (record?.forecast_year) {
      setForecastYear(record.forecast_year);
    }
  };

  const handleCloseModal = () => {
    setModalState({ open: false, mode: 'create', record: null });
    setFormValues(defaultFormState);
    setError('');
  };

  const handleDelete = async (record) => {
    if (!record?.record_id) return;
    const confirmed = window.confirm('Are you sure you want to delete this forecast?');
    if (!confirmed) return;
    try {
      await budgetsApi.remove(record.record_id);
      setRows((prev) => prev.filter((row) => row.record_id !== record.record_id));
    } catch (err) {
      setError('Failed to delete forecast.');
    }
  };

  const handleDownload = async (record) => {
    if (!record?.record_id) return;
    try {
      const { download_url } = await budgetsApi.download(record.record_id);
      if (download_url) {
        window.open(download_url, '_blank');
      }
    } catch (err) {
      setError('Unable to download attachment.');
    }
  };

  const handleSubmit = async ({ values, file }) => {
    setSaving(true);
    setError('');
    const editing = modalState.mode === 'edit' ? modalState.record : null;
    try {
      let uploadMeta = {};
      if (file) {
        const content_hash = await computeSha256(file);
        const initRes = await budgetsApi.initUpload({
          original_name: file.name,
          content_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          content_hash,
        });
        await fetch(initRes.upload_url, { method: 'PUT', body: file });
        uploadMeta = {
          storage_key: initRes.storage_key,
          original_name: file.name,
          content_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          content_hash,
        };
      } else if (editing?.storage_key) {
        uploadMeta = {
          storage_key: editing.storage_key,
          original_name: editing.original_name,
          content_type: editing.content_type,
          size_bytes: editing.size_bytes,
          content_hash: editing.content_hash,
        };
      }

      const payload = {
        forecast_year: forecastYear,
        cash_outgo_split_over: deriveCashSplitYear(forecastYear),
        division_name: values.division_name || undefined,
        descriptions: values.descriptions || undefined,
        item: values.item || undefined,
        qty: normalizeNumber(values.qty),
        previous_procurement_date: values.previous_procurement_date || undefined,
        estimated_cost: normalizeNumber(values.estimated_cost),
        demand_indication_months: normalizeNumber(values.demand_indication_months),
        build_or_project: values.build_or_project || undefined,
        dpp_number: values.dpp_number || undefined,
        cash_outgo: normalizeNumber(values.cash_outgo),
        cash_outgo_split: normalizeNumber(values.cash_outgo_split),
        existing_stock: normalizeNumber(values.existing_stock),
        common_tdcc: values.common_tdcc || undefined,
        cross_project_use: values.cross_project_use || undefined,
        hardware_need: values.hardware_need || undefined,
        condemnation: values.condemnation || undefined,
        remarks: values.remarks || undefined,
        ...uploadMeta,
      };

      if (editing) {
        const updated = await budgetsApi.update(editing.record_id, payload);
        setRows((prev) => prev.map((row) => (row.record_id === editing.record_id ? updated : row)));
      } else {
        const created = await budgetsApi.create(payload);
        setRows((prev) => [created, ...prev]);
      }

      handleCloseModal();
    } catch (err) {
      setError('Failed to save forecast.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.heroCard}>
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>Budget Estimation</h2>
          <p className={styles.heroSubtitle}>Track forecast budgets, uploads, and approvals.</p>
        </div>
      </div>

      <BudgetFilterBar
        filters={filters}
        onChange={setFilters}
        forecastYear={forecastYear}
        onForecastYearChange={setForecastYear}
        onUpload={() => handleOpenModal('create')}
      />

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Forecast Budget</h3>
          <div className={styles.dateBadge}>{forecastYear}</div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {loading ? (
          <div className={styles.emptyState}>Loading forecasts…</div>
        ) : (
          <ForecastBudgetTable
            columns={columns}
            rows={sortedRows}
            onView={(row) => handleOpenModal('view', row)}
            onEdit={(row) => handleOpenModal('edit', row)}
            onDelete={handleDelete}
            onDownload={handleDownload}
          />
        )}
      </section>

      <UploadForecastModal
        open={modalState.open}
        mode={modalState.mode}
        forecastYear={forecastYear}
        cashSplitLabel={cashSplitLabel}
        values={formValues}
        onChange={setFormValues}
        onClose={handleCloseModal}
        onSave={handleSubmit}
        saving={saving}
        onForecastYearChange={setForecastYear}
        existingFileName={modalState.record?.original_name}
      />
    </div>
  );
}
