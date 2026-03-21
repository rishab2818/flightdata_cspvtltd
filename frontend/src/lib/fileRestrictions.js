const RESTRICTED_FILE_EXTENSIONS = new Set([
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.js',
  '.vbs',
  '.ps1',
  '.sh',
  '.py',
  '.php',
  '.html',
  '.htm',
  '.jsp',
  '.asp',
  '.aspx',
])

export const getFileExtension = (name = '') => {
  const normalized = String(name || '').trim()
  const index = normalized.lastIndexOf('.')
  return index >= 0 ? normalized.slice(index).toLowerCase() : ''
}

export const isRestrictedFileType = (fileOrName) => {
  const name = typeof fileOrName === 'string' ? fileOrName : fileOrName?.name
  return RESTRICTED_FILE_EXTENSIONS.has(getFileExtension(name))
}

export const getRestrictedFileTypeMessage = (fileOrName) => {
  const name = typeof fileOrName === 'string' ? fileOrName : fileOrName?.name
  const ext = getFileExtension(name)
  return ext
    ? `Files with the '${ext}' extension are not allowed.`
    : 'This file type is not allowed.'
}
