export const RANGE_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.dat',
  '.c',
  '.ful',
  '.kul',
  '.pdt',
  '.fin',
])

export const PROJECT_TABULAR_EXTENSIONS = new Set([
  '.csv',
  '.xlsx',
  '.xls',
  '.mat',
  ...RANGE_TEXT_EXTENSIONS,
])

export const getFileExtension = (name = '') => {
  const idx = String(name).lastIndexOf('.')
  return idx >= 0 ? String(name).slice(idx).toLowerCase() : ''
}

export const isRangeTextExtension = (ext = '') => RANGE_TEXT_EXTENSIONS.has(String(ext).toLowerCase())

