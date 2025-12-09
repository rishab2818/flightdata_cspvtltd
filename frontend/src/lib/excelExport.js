import * as XLSX from 'xlsx';

const sanitizeFileName = (name) =>
  name
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-+$)/g, '') || 'export';

/**
 * Convert rows into an Excel file and trigger a download.
 * @param {Object} params
 * @param {Array} params.rows - Array of row objects to export
 * @param {Array} params.columns - Array of column configs: { header, key, accessor? }
 * @param {string} params.fileName - Desired file name (without extension)
 * @param {string} [params.sheetName='Data'] - Sheet name
 */
export const downloadExcel = ({ rows, columns, fileName, sheetName = 'Data' }) => {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const normalized = rows.map((row, index) =>
    columns.reduce((acc, col) => {
      const header = col.header || col.key || `Column ${index + 1}`;
      const value = typeof col.accessor === 'function'
        ? col.accessor(row, index)
        : col.key
          ? row[col.key]
          : undefined;
      acc[header] = value ?? '';
      return acc;
    }, {})
  );

  const worksheet = XLSX.utils.json_to_sheet(normalized);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeName = sanitizeFileName(fileName || 'export');
  XLSX.writeFile(workbook, `${safeName}.xlsx`);
};

