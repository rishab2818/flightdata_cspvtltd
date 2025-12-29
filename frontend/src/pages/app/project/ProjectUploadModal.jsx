


// import React, { useEffect, useMemo, useState } from 'react'
// import { createPortal } from 'react-dom'
// import * as XLSX from 'xlsx'
// import { ingestionApi } from '../../../api/ingestionApi'

// const DATASET_OPTIONS = [
//     { key: 'cfd', label: 'CFD' },
//     { key: 'wind', label: 'Wind Data' },
//     { key: 'flight', label: 'Flight Data' },
//     { key: 'others', label: 'Others' }
// ]

// const TABULAR_EXTS = new Set(['.csv', '.xlsx', '.xls'])
// const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

// const getExt = (name = '') => {
//     const idx = name.lastIndexOf('.')
//     return idx >= 0 ? name.slice(idx).toLowerCase() : ''
// }
// const isTabular = (file) => TABULAR_EXTS.has(getExt(file?.name))
// const isImage = (file) => IMAGE_EXTS.has(getExt(file?.name))

// function sanitizeTag(tag) {
//     return (tag || '').trim()
// }

// function fileKey(f) {
//     return `${f.name}__${f.size}__${f.lastModified}`
// }

// export default function UploadModal({
//     projectId,
//     projectName,
//     onClose,
//     mode = 'create',            // "create" | "edit"
//     initialTag = '',            // old tag name when edit
//     datasetTypeFixed = 'cfd',   // active dataset from parent
// }) {
//     // ✅ dataset is fixed by parent; UI selector shown only in create mode
//     const [datasetType, setDatasetType] = useState(datasetTypeFixed || 'cfd')

//     // ✅ prefill tag in edit mode
//     const [tagName, setTagName] = useState(initialTag || '')

//     // header is unchanged (you said no edit needed, but it can stay for uploads)
//     const [headerMode, setHeaderMode] = useState('file')
//     const [customHeadersText, setCustomHeadersText] = useState('')

//     const [files, setFiles] = useState([]) // [{ file, visualize }]
//     const [selectedIdx, setSelectedIdx] = useState(null)
//     const [preview, setPreview] = useState({ type: 'none' })

//     const [uploading, setUploading] = useState(false)
//     const [uploadProgress, setUploadProgress] = useState(null)
//     const [error, setError] = useState(null)
//     const [result, setResult] = useState(null)

//     // lock background scroll
//     useEffect(() => {
//         const prev = document.body.style.overflow
//         document.body.style.overflow = 'hidden'
//         return () => { document.body.style.overflow = prev }
//     }, [])

//     // keep props in sync if modal reused
//     useEffect(() => {
//         setDatasetType(datasetTypeFixed || 'cfd')
//     }, [datasetTypeFixed])

//     useEffect(() => {
//         setTagName(initialTag || '')
//         setFiles([])
//         setSelectedIdx(null)
//         setPreview({ type: 'none' })
//         setError(null)
//         setResult(null)
//     }, [initialTag, mode])

//     const headersList = useMemo(() => {
//         if (headerMode !== 'custom') return null
//         return customHeadersText.split(',').map((h) => h.trim()).filter(Boolean)
//     }, [customHeadersText, headerMode])

//     const selectedFile = useMemo(() => {
//         if (selectedIdx == null) return null
//         return files[selectedIdx]?.file || null
//     }, [files, selectedIdx])

//     const loadPreview = async (file) => {
//         if (!file) return
//         const ext = getExt(file.name)

//         if (isImage(file)) {
//             const url = URL.createObjectURL(file)
//             setPreview({ type: 'image', url, name: file.name })
//             return
//         }

//         if (ext === '.csv') {
//             const text = await file.text()
//             const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 15)
//             if (!lines.length) return setPreview({ type: 'message', message: 'CSV appears empty.' })

//             const delimiter = lines[0].includes('\t') ? '\t' : ','
//             const rawRows = lines.map((ln) => ln.split(delimiter))

//             let headers = []
//             let dataRows = []

//             if (headerMode === 'file') {
//                 headers = rawRows[0].map((h) => (h || '').trim())
//                 dataRows = rawRows.slice(1)
//             } else if (headerMode === 'none') {
//                 headers = rawRows[0].map((_, i) => `column_${i + 1}`)
//                 dataRows = rawRows
//             } else {
//                 headers = headersList?.length ? headersList : rawRows[0].map((_, i) => `column_${i + 1}`)
//                 dataRows = rawRows
//             }

//             const rows = dataRows.slice(0, 10).map((r) => {
//                 const obj = {}
//                 headers.forEach((h, i) => (obj[h] = r[i] ?? ''))
//                 return obj
//             })

//             setPreview({ type: 'table', headers, rows, name: file.name })
//             return
//         }

//         if (ext === '.xlsx' || ext === '.xls') {
//             const buf = await file.arrayBuffer()
//             const wb = XLSX.read(buf, { type: 'array' })
//             const sheetName = wb.SheetNames?.[0]
//             if (!sheetName) return setPreview({ type: 'message', message: 'No sheets found in Excel file.' })

//             const ws = wb.Sheets[sheetName]
//             const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
//             const rowsRaw = (json || []).slice(0, 15).filter((r) => Array.isArray(r))

//             if (!rowsRaw.length) return setPreview({ type: 'message', message: 'Excel sheet appears empty.' })

//             let headers = []
//             let dataRows = []

//             if (headerMode === 'file') {
//                 headers = rowsRaw[0].map((h) => String(h || '').trim())
//                 dataRows = rowsRaw.slice(1)
//             } else if (headerMode === 'none') {
//                 headers = rowsRaw[0].map((_, i) => `column_${i + 1}`)
//                 dataRows = rowsRaw
//             } else {
//                 headers = headersList?.length ? headersList : rowsRaw[0].map((_, i) => `column_${i + 1}`)
//                 dataRows = rowsRaw
//             }

//             const rows = dataRows.slice(0, 10).map((r) => {
//                 const obj = {}
//                 headers.forEach((h, i) => (obj[h] = r[i] ?? ''))
//                 return obj
//             })

//             setPreview({ type: 'table', headers, rows, name: file.name })
//             return
//         }

//         setPreview({ type: 'message', message: 'Preview is not supported for this file type.' })
//     }

//     const onPickFiles = async (fileList) => {
//         const incoming = Array.from(fileList || [])
//         if (!incoming.length) return

//         setError(null)
//         setResult(null)

//         setFiles((prev) => {
//             const existingKeys = new Set(prev.map((x) => fileKey(x.file)))
//             const appended = []

//             for (const f of incoming) {
//                 const k = fileKey(f)
//                 if (existingKeys.has(k)) continue
//                 appended.push({ file: f, visualize: isTabular(f) })
//             }

//             const next = [...prev, ...appended]

//             if (selectedIdx == null && next.length) {
//                 setSelectedIdx(0)
//                 loadPreview(next[0].file)
//             }

//             return next
//         })

//         const el = document.getElementById('fd-modal-file-input')
//         if (el) el.value = ''
//     }

//     const toggleVisualize = (idx) => {
//         setFiles((prev) => {
//             const clone = [...prev]
//             const item = clone[idx]
//             if (!item) return prev

//             if (!isTabular(item.file)) {
//                 clone[idx] = { ...item, visualize: false }
//                 return clone
//             }
//             clone[idx] = { ...item, visualize: !item.visualize }
//             return clone
//         })
//     }

//     const onSelectFile = async (idx) => {
//         setSelectedIdx(idx)
//         await loadPreview(files[idx]?.file)
//     }

//     // ✅ Rename only (edit mode)
//     const onSaveRename = async () => {
//         setError(null)
//         const newTag = sanitizeTag(tagName)
//         if (!newTag) return setError('Tag Name is required.')

//         // no change -> just close
//         if (sanitizeTag(initialTag) === newTag) {
//             onClose()
//             return
//         }

//         try {
//             await ingestionApi.renameTag(projectId, datasetTypeFixed, initialTag, newTag)
//             onClose()
//         } catch (err) {
//             setError(err?.response?.data?.detail || err.message || 'Rename failed')
//         }
//     }

//     const onUpload = async () => {
//         setError(null)
//         setResult(null)

//         const tag = sanitizeTag(tagName)
//         if (!tag) return setError('Tag Name is required.')

//         // ✅ In create mode, files are required. In edit mode, uploading files is optional.
//         if (mode !== 'edit' && !files.length) return setError('Please select at least one file.')

//         // if edit mode and no files, treat as rename-only
//         if (mode === 'edit' && files.length === 0) {
//             await onSaveRename()
//             return
//         }

//         if (headerMode === 'custom' && (!headersList || !headersList.length)) {
//             return setError("Provide custom headers when header_mode is 'custom'.")
//         }

//         const finalItems = files.map((it) => ({
//             ...it,
//             visualize: isTabular(it.file) ? !!it.visualize : false,
//         }))

//         setUploading(true)
//         setUploadProgress(0)

//         try {
//             const manifest = finalItems.map((it) => ({ visualize: it.visualize }))
//             const res = await ingestionApi.startBatch(
//                 projectId,
//                 finalItems.map((it) => it.file),
//                 {
//                     datasetType: datasetTypeFixed, // ✅ fixed from parent
//                     tagName: tag,                  // ✅ new tag name (updated)
//                     headerMode,
//                     customHeaders: headerMode === 'custom' ? headersList : null,
//                     manifest,
//                     onUploadProgress: (evt) => {
//                         if (!evt.total) return setUploadProgress(null)
//                         setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
//                     },
//                 }
//             )
//             setResult(res)
//             if (res?.jobs?.length) onClose()
//         } catch (err) {
//             setError(err?.response?.data?.detail || err.message || 'Upload failed')
//         } finally {
//             setUploading(false)
//             setUploadProgress(null)
//         }
//     }

//     const visualizeInfo = (file, visualize) => {
//         if (!isTabular(file)) return 'Forced OFF (not tabular)'
//         return visualize ? 'ON' : 'OFF'
//     }

//     const title = mode === 'edit' ? 'Edit Tag' : 'Upload Files'
//     const subtitle =
//         mode === 'edit'
//             ? `${projectName} · Update Tag Name. Upload new files (optional).`
//             : `${projectName} · Choose category, tag, header handling, and which files should be processed.`

//     const modalUi = (
//         <div className="fd-modal__backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
//             <div className="fd-modal__panel" onMouseDown={(e) => e.stopPropagation()}>
//                 <div className="fd-modal__header">
//                     <div>
//                         <h3 style={{ margin: 0 }}>{title}</h3>
//                         <p className="summary-label" style={{ margin: '4px 0 0 0' }}>{subtitle}</p>
//                     </div>
//                     <button className="fd-modal__close" onClick={onClose} type="button">✕</button>
//                 </div>

//                 {error && <div className="project-shell__error" style={{ margin: 14 }}>{error}</div>}

//                 <div className="fd-modal__grid">
//                     {/* Left */}
//                     <div className="fd-modal__left">
//                         <div className="project-card" style={{ padding: 14 }}>
//                             {/* ✅ Only show dataset selector in create mode */}
//                             {mode !== 'edit' && (
//                                 <>
//                                     <label className="summary-label">Data Category</label>
//                                     <div className="tablist" style={{ marginTop: 6 }}>
//                                         {DATASET_OPTIONS.map((opt) => (
//                                             <button
//                                                 key={opt.key}
//                                                 type="button"
//                                                 className={datasetType === opt.key ? 'active' : ''}
//                                                 onClick={() => setDatasetType(opt.key)}
//                                             >
//                                                 {opt.label}
//                                             </button>
//                                         ))}
//                                     </div>
//                                 </>
//                             )}

//                             {/* In edit mode show fixed dataset */}
//                             {mode === 'edit' && (
//                                 <div style={{ marginBottom: 10 }}>
//                                     <div className="summary-label">Data Category</div>
//                                     <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
//                                         {DATASET_OPTIONS.find(d => d.key === datasetTypeFixed)?.label || datasetTypeFixed}
//                                     </div>
//                                 </div>
//                             )}

//                             <label className="summary-label" style={{ marginTop: 10 }}>Tag / Folder Name</label>
//                             <input
//                                 className="input-control"
//                                 placeholder="e.g. Run_12"
//                                 value={tagName}
//                                 onChange={(e) => setTagName(e.target.value)}
//                             />

//                             {/* Header handling (kept same; affects new uploads) */}
//                             <div className="header-options" style={{ marginTop: 12 }}>
//                                 <strong>Header handling</strong>
//                                 <div className="actions-row">
//                                     <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//                                         <input type="radio" name="header-mode" checked={headerMode === 'file'} onChange={() => setHeaderMode('file')} />
//                                         Use headers from file
//                                     </label>
//                                     <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//                                         <input type="radio" name="header-mode" checked={headerMode === 'none'} onChange={() => setHeaderMode('none')} />
//                                         File has no headers
//                                     </label>
//                                     <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
//                                         <input type="radio" name="header-mode" checked={headerMode === 'custom'} onChange={() => setHeaderMode('custom')} />
//                                         Provide custom headers
//                                     </label>
//                                 </div>

//                                 {headerMode === 'custom' && (
//                                     <div className="header-options__inputs">
//                                         <label className="summary-label">Comma separated headers</label>
//                                         <input
//                                             className="input-control"
//                                             placeholder="e.g. time, alpha, mach"
//                                             value={customHeadersText}
//                                             onChange={(e) => setCustomHeadersText(e.target.value)}
//                                         />
//                                     </div>
//                                 )}
//                             </div>

//                             <div style={{ marginTop: 12 }}>
//                                 <label className="upload-tile" htmlFor="fd-modal-file-input" style={{ marginTop: 0 }}>
//                                     <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>
//                                         {mode === 'edit' ? 'Browse new files (optional)' : 'Browse files'}
//                                     </p>
//                                     <p style={{ margin: 0, color: '#475569' }}>
//                                         Supported: CSV/Excel for visualization. Images/others stored as raw only.
//                                     </p>
//                                 </label>
//                                 <input
//                                     id="fd-modal-file-input"
//                                     type="file"
//                                     multiple
//                                     style={{ display: 'none' }}
//                                     onChange={(e) => onPickFiles(e.target.files)}
//                                 />
//                             </div>

//                             {/* ✅ Edit mode: Save rename button (works even with no files) */}
//                             {mode === 'edit' && (
//                                 <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
//                                     <button
//                                         className="project-shell__nav-link"
//                                         type="button"
//                                         onClick={onSaveRename}
//                                         disabled={uploading}
//                                     >
//                                         Save Tag Name
//                                     </button>
//                                 </div>
//                             )}
//                         </div>

//                         {/* File list + Upload button (only really needed when user selected files) */}
//                         <div className="project-card" style={{ padding: 14 }}>
//                             <div className="actions-row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
//                                 <strong>Selected files ({files.length})</strong>
//                                 <button
//                                     className="project-shell__nav-link"
//                                     type="button"
//                                     onClick={onUpload}
//                                     disabled={uploading || (mode !== 'edit' && !files.length)}
//                                 >
//                                     {uploading ? 'Uploading…' : (mode === 'edit' ? 'Upload Files' : 'Upload')}
//                                 </button>
//                             </div>

//                             {uploading && (
//                                 <div style={{ marginTop: 10 }}>
//                                     <div className="progress-bar">
//                                         <div className="progress-bar__value" style={{ width: `${uploadProgress ?? 5}%` }} />
//                                     </div>
//                                     <div className="summary-label" style={{ marginTop: 6 }}>
//                                         {uploadProgress != null ? `${uploadProgress}%` : 'Uploading…'}
//                                     </div>
//                                 </div>
//                             )}

//                             {!files.length && (
//                                 <div className="empty-state" style={{ marginTop: 10 }}>
//                                     {mode === 'edit' ? 'No new files selected.' : 'No files selected.'}
//                                 </div>
//                             )}

//                             {files.length > 0 && (
//                                 <div className="fd-filelist" style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
//                                     {files.map((item, idx) => (
//                                         <div
//                                             key={`${fileKey(item.file)}-${idx}`}
//                                             className={`fd-fileitem ${idx === selectedIdx ? 'fd-fileitem--active' : ''}`}
//                                             onClick={() => onSelectFile(idx)}
//                                             role="button"
//                                             tabIndex={0}
//                                         >
//                                             <div style={{ minWidth: 0 }}>
//                                                 <div className="fd-fileitem__name">{item.file.name}</div>
//                                                 <div className="summary-label" style={{ margin: 0 }}>
//                                                     {item.file.type || 'unknown'} · {Math.round(item.file.size / 1024)} KB · {visualizeInfo(item.file, item.visualize)}
//                                                 </div>
//                                             </div>

//                                             <label className="fd-switch" onClick={(e) => e.stopPropagation()}>
//                                                 <input
//                                                     type="checkbox"
//                                                     checked={isTabular(item.file) ? item.visualize : false}
//                                                     onChange={() => toggleVisualize(idx)}
//                                                     disabled={!isTabular(item.file)}
//                                                 />
//                                                 <span className="fd-slider" />
//                                             </label>
//                                         </div>
//                                     ))}
//                                 </div>
//                             )}

//                             {result?.jobs?.length > 0 && (
//                                 <div style={{ marginTop: 12 }}>
//                                     <strong>Uploaded</strong>
//                                     <div className="summary-label" style={{ marginTop: 6 }}>
//                                         {result.jobs.length} file(s) queued/stored.
//                                     </div>
//                                 </div>
//                             )}
//                         </div>
//                     </div>

//                     {/* Right */}
//                     <div className="fd-modal__right">
//                         <div className="project-card" style={{ padding: 14, height: '100%' }}>
//                             <strong>Preview</strong>
//                             <div className="summary-label" style={{ marginTop: 6 }}>
//                                 {selectedFile ? selectedFile.name : 'Select a file to preview'}
//                             </div>

//                             <div className="fd-preview">
//                                 {preview.type === 'none' && <div className="empty-state">No preview</div>}
//                                 {preview.type === 'message' && <div className="empty-state" style={{ textAlign: 'left' }}>{preview.message}</div>}
//                                 {preview.type === 'image' && (
//                                     <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
//                                 )}
//                                 {preview.type === 'table' && (
//                                     <div className="excel-preview" style={{ maxHeight: 420 }}>
//                                         <table className="data-table">
//                                             <thead>
//                                                 <tr>{preview.headers.map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
//                                             </thead>
//                                             <tbody>
//                                                 {preview.rows.map((row, rIdx) => (
//                                                     <tr key={`r-${rIdx}`}>
//                                                         {preview.headers.map((h, cIdx) => <td key={`${rIdx}-${cIdx}`}>{row[h]}</td>)}
//                                                     </tr>
//                                                 ))}
//                                             </tbody>
//                                         </table>
//                                     </div>
//                                 )}
//                             </div>

//                             <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
//                                 <button
//                                     type="button"
//                                     className="project-shell__nav-link"
//                                     onClick={onClose}
//                                     style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }}
//                                 >
//                                     Close
//                                 </button>
//                             </div>
//                         </div>
//                     </div>

//                 </div>
//             </div>
//         </div>
//     )

//     return createPortal(modalUi, document.body)
// }
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import { ingestionApi } from '../../../api/ingestionApi';
import './ProjectUploadModal.css';
// import './ProjectUpload.css';

import Plus from "../../../assets/Plus.svg";

const DATASET_OPTIONS = [
    { key: 'cfd', label: 'CFD' },
    { key: 'wind', label: 'Wind Data' },
    { key: 'flight', label: 'Flight Data' },
    { key: 'others', label: 'Others' }
]

const TABULAR_EXTS = new Set(['.csv', '.xlsx', '.xls', '.txt'])
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

const getExt = (name = '') => {
    const idx = name.lastIndexOf('.')
    return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}
const isTabular = (file) => TABULAR_EXTS.has(getExt(file?.name))
const isImage = (file) => IMAGE_EXTS.has(getExt(file?.name))

function sanitizeTag(tag) {
    return (tag || '').trim()
}

function fileKey(f) {
    return `${f.name}__${f.size}__${f.lastModified}`
}

export default function UploadModal({
    projectId,
    projectName,
    onClose,
    mode = 'create',              // "create" | "edit"
    initialTag = '',              // old tag name when edit
    initialDatasetType = 'cfd',   // ✅ ONLY initial value from parent; modal controls after that
}) {
    // ✅ dataset is controlled INSIDE modal
    const [datasetType, setDatasetType] = useState(initialDatasetType || 'cfd')

    // ✅ prefill tag in edit mode
    const [tagName, setTagName] = useState(initialTag || '')

    const [headerMode, setHeaderMode] = useState('file')
    const [customHeadersText, setCustomHeadersText] = useState('')

    const [files, setFiles] = useState([]) // [{ file, visualize }]
    const [selectedIdx, setSelectedIdx] = useState(null)
    const [preview, setPreview] = useState({ type: 'none' })

    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(null)
    const [error, setError] = useState(null)
    const [result, setResult] = useState(null)

    // lock background scroll
    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = prev }
    }, [])

    // ✅ When modal opens / mode changes, reset things.
    // IMPORTANT: we set datasetType ONLY ONCE per open.
    useEffect(() => {
        setDatasetType(initialDatasetType || 'cfd')
        setTagName(initialTag || '')
        setFiles([])
        setSelectedIdx(null)
        setPreview({ type: 'none' })
        setError(null)
        setResult(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTag, mode]) // intentionally NOT depending on initialDatasetType to avoid overriding user clicks

    const headersList = useMemo(() => {
        if (headerMode !== 'custom') return null
        return customHeadersText.split(',').map((h) => h.trim()).filter(Boolean)
    }, [customHeadersText, headerMode])

    const selectedFile = useMemo(() => {
        if (selectedIdx == null) return null
        return files[selectedIdx]?.file || null
    }, [files, selectedIdx])

    const loadPreview = async (file) => {
        if (!file) return
        const ext = getExt(file.name)

        if (isImage(file)) {
            const url = URL.createObjectURL(file)
            setPreview({ type: 'image', url, name: file.name })
            return
        }

        if (ext === '.csv') {
            const text = await file.text()
            const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 15)
            if (!lines.length) return setPreview({ type: 'message', message: 'CSV appears empty.' })

            const delimiter = lines[0].includes('\t') ? '\t' : ','
            const rawRows = lines.map((ln) => ln.split(delimiter))

            let headers = []
            let dataRows = []

            if (headerMode === 'file') {
                headers = rawRows[0].map((h) => (h || '').trim())
                dataRows = rawRows.slice(1)
            } else if (headerMode === 'none') {
                headers = rawRows[0].map((_, i) => `column_${i + 1}`)
                dataRows = rawRows
            } else {
                headers = headersList?.length ? headersList : rawRows[0].map((_, i) => `column_${i + 1}`)
                dataRows = rawRows
            }

            const rows = dataRows.slice(0, 10).map((r) => {
                const obj = {}
                headers.forEach((h, i) => (obj[h] = r[i] ?? ''))
                return obj
            })

            setPreview({ type: 'table', headers, rows, name: file.name })
            return
        }

        if (ext === '.xlsx' || ext === '.xls') {
            const buf = await file.arrayBuffer()
            const wb = XLSX.read(buf, { type: 'array' })
            const sheetName = wb.SheetNames?.[0]
            if (!sheetName) return setPreview({ type: 'message', message: 'No sheets found in Excel file.' })

            const ws = wb.Sheets[sheetName]
            const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
            const rowsRaw = (json || []).slice(0, 15).filter((r) => Array.isArray(r))

            if (!rowsRaw.length) return setPreview({ type: 'message', message: 'Excel sheet appears empty.' })

            let headers = []
            let dataRows = []

            if (headerMode === 'file') {
                headers = rowsRaw[0].map((h) => String(h || '').trim())
                dataRows = rowsRaw.slice(1)
            } else if (headerMode === 'none') {
                headers = rowsRaw[0].map((_, i) => `column_${i + 1}`)
                dataRows = rowsRaw
            } else {
                headers = headersList?.length ? headersList : rowsRaw[0].map((_, i) => `column_${i + 1}`)
                dataRows = rowsRaw
            }

            const rows = dataRows.slice(0, 10).map((r) => {
                const obj = {}
                headers.forEach((h, i) => (obj[h] = r[i] ?? ''))
                return obj
            })

            setPreview({ type: 'table', headers, rows, name: file.name })
            return
        }

        setPreview({ type: 'message', message: 'Preview is not supported for this file type.' })
    }

    const onPickFiles = async (fileList) => {
        const incoming = Array.from(fileList || [])
        if (!incoming.length) return

        setError(null)
        setResult(null)

        setFiles((prev) => {
            const existingKeys = new Set(prev.map((x) => fileKey(x.file)))
            const appended = []

            for (const f of incoming) {
                const k = fileKey(f)
                if (existingKeys.has(k)) continue
                appended.push({ file: f, visualize: isTabular(f) })
            }

            const next = [...prev, ...appended]

            if (selectedIdx == null && next.length) {
                setSelectedIdx(0)
                loadPreview(next[0].file)
            }

            return next
        })

        const el = document.getElementById('fd-modal-file-input')
        if (el) el.value = ''
    }

    const toggleVisualize = (idx) => {
        setFiles((prev) => {
            const clone = [...prev]
            const item = clone[idx]
            if (!item) return prev

            if (!isTabular(item.file)) {
                clone[idx] = { ...item, visualize: false }
                return clone
            }
            clone[idx] = { ...item, visualize: !item.visualize }
            return clone
        })
    }

    const onSelectFile = async (idx) => {
        setSelectedIdx(idx)
        await loadPreview(files[idx]?.file)
    }

    // ✅ Rename only (edit mode)
    const onSaveRename = async () => {
        setError(null)
        const newTag = sanitizeTag(tagName)
        if (!newTag) return setError('Tag Name is required.')

        // no change -> just close
        if (sanitizeTag(initialTag) === newTag) {
            onClose()
            return
        }

        try {
            // ✅ Use datasetType controlled by modal
            await ingestionApi.renameTag(projectId, datasetType, initialTag, newTag)
            onClose()
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Rename failed')
        }
    }

    const onUpload = async () => {
        setError(null)
        setResult(null)

        const tag = sanitizeTag(tagName)
        if (!tag) return setError('Tag Name is required.')

        // ✅ In create mode, files are required. In edit mode, uploading files is optional.
        if (mode !== 'edit' && !files.length) return setError('Please select at least one file.')

        // if edit mode and no files, treat as rename-only
        if (mode === 'edit' && files.length === 0) {
            await onSaveRename()
            return
        }

        if (headerMode === 'custom' && (!headersList || !headersList.length)) {
            return setError("Provide custom headers when header_mode is 'custom'.")
        }

        const finalItems = files.map((it) => ({
            ...it,
            visualize: isTabular(it.file) ? !!it.visualize : false,
        }))

        setUploading(true)
        setUploadProgress(0)

        try {
            const manifest = finalItems.map((it) => ({ visualize: it.visualize }))
            const res = await ingestionApi.startBatch(
                projectId,
                finalItems.map((it) => it.file),
                {
                    // ✅ Use datasetType selected in modal
                    datasetType,
                    tagName: tag,
                    headerMode,
                    customHeaders: headerMode === 'custom' ? headersList : null,
                    manifest,
                    onUploadProgress: (evt) => {
                        if (!evt.total) return setUploadProgress(null)
                        setUploadProgress(Math.round((evt.loaded / evt.total) * 100))
                    },
                }
            )
            setResult(res)
            if (res?.jobs?.length) onClose()
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Upload failed')
        } finally {
            setUploading(false)
            setUploadProgress(null)
        }
    }

    const visualizeInfo = (file, visualize) => {
        if (!isTabular(file)) return 'Forced OFF (not tabular)'
        return visualize ? 'ON' : 'OFF'
    }

    const title = mode === 'edit' ? 'Edit Tag' : 'Upload Files'
    const subtitle =
        mode === 'edit'
            ? `${projectName} · Update Tag Name. Upload new files (optional).`
            : `${projectName} · Choose category, tag, header handling, and which files should be processed.`

    const modalUi = (
        <div className="fd-modal__backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
            <div className="fd-modal__panel" onMouseDown={(e) => e.stopPropagation()}>
                <div className="fd-modal__header">
                    <div>
                        <h3 style={{ margin: 0 }}>{title}</h3>
                        <p className="summary-label" style={{ margin: '4px 0 0 0' }}>{subtitle}</p>
                    </div>
                    <button className="close_icon" onClick={onClose} type="button">✕</button>
                </div>

                {error && <div className="project-shell__error" style={{ margin: 14 }}>{error}</div>}

                <div className="fd-modal__grid">
                    {/* Left */}
                    <div className="fd-modal__left">
                        <div className="project-card" style={{ padding: 14 }}>
                            {/* ✅ Dataset selector stays in modal; no parent control needed */}
                            {mode !== 'edit' && (
                                <>
                                    <label className="summary-label">Data Category</label>
                                    <div className="tablist" style={{ marginTop: 6 }}>
                                        {DATASET_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                className={datasetType === opt.key ? 'active' : ''}
                                                onClick={() => setDatasetType(opt.key)}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* In edit mode we keep category display (still uses datasetType state) */}
                            {mode === 'edit' && (
                                <div style={{ marginBottom: 10 }}>
                                    <div className="summary-label">Data Category</div>
                                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                                        {DATASET_OPTIONS.find(d => d.key === datasetType)?.label || datasetType}
                                    </div>
                                </div>
                            )}

                            <label className="summary-label" style={{ marginTop: 10 }}>Tag / Folder Name</label>
                            <input
                                className="input-control"
                                placeholder="e.g. Run_12"
                                value={tagName}
                                onChange={(e) => setTagName(e.target.value)}
                            />

                            {/* Header handling (affects new uploads) */}
                            <div className="header-options" style={{ marginTop: 12 }}>
                                <strong>Header handling</strong>
                                <div className="actions-row">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input type="radio" name="header-mode" checked={headerMode === 'file'} onChange={() => setHeaderMode('file')} />
                                        Use headers from file
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input type="radio" name="header-mode" checked={headerMode === 'none'} onChange={() => setHeaderMode('none')} />
                                        File has no headers
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input type="radio" name="header-mode" checked={headerMode === 'custom'} onChange={() => setHeaderMode('custom')} />
                                        Provide custom headers
                                    </label>
                                </div>

                                {headerMode === 'custom' && (
                                    <div className="header-options__inputs">
                                        <label className="summary-label">Comma separated headers</label>
                                        <input
                                            className="input-control"
                                            placeholder="e.g. time, alpha, mach"
                                            value={customHeadersText}
                                            onChange={(e) => setCustomHeadersText(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <label className="upload-tile" htmlFor="fd-modal-file-input" style={{ marginTop: 0 }}>
                                    <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>
                                        {mode === 'edit' ? 'Browse new files (optional)' : 'Browse files'}
                                    </p>
                                    <p style={{ margin: 0, color: '#475569' }}>
                                        Supported: CSV/Excel for visualization. Images/others stored as raw only.
                                    </p>
                                </label>
                                <input
                                    id="fd-modal-file-input"
                                    type="file"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={(e) => onPickFiles(e.target.files)}
                                />
                            </div>

                            {/* Edit mode: Save rename button */}
                            {mode === 'edit' && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                                    <button
                                        className="project-shell__nav-link"
                                        type="button"
                                        onClick={onSaveRename}
                                        disabled={uploading}
                                    >
                                        Save Tag Name
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* File list + Upload button */}
                        <div className="project-card" style={{ padding: 14 }}>
                            <div className="actions-row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
                                <strong>Selected files ({files.length})</strong>
                                <button
                                    className="project-shell__nav-link"
                                    type="button"
                                    onClick={onUpload}
                                    disabled={uploading || (mode !== 'edit' && !files.length)}
                                >
                                    {uploading ? 'Uploading…' : (mode === 'edit' ? 'Upload Files' : 'Upload')}
                                </button>
                            </div>

                            {uploading && (
                                <div style={{ marginTop: 10 }}>
                                    <div className="progress-bar">
                                        <div className="progress-bar__value" style={{ width: `${uploadProgress ?? 5}%` }} />
                                    </div>
                                    <div className="summary-label" style={{ marginTop: 6 }}>
                                        {uploadProgress != null ? `${uploadProgress}%` : 'Uploading…'}
                                    </div>
                                </div>
                            )}

                            {!files.length && (
                                <div className="empty-state" style={{ marginTop: 10 }}>
                                    {mode === 'edit' ? 'No new files selected.' : 'No files selected.'}
                                </div>
                            )}

                            {files.length > 0 && (
                                <div className="fd-filelist" style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                                    {files.map((item, idx) => (
                                        <div
                                            key={`${fileKey(item.file)}-${idx}`}
                                            className={`fd-fileitem ${idx === selectedIdx ? 'fd-fileitem--active' : ''}`}
                                            onClick={() => onSelectFile(idx)}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div className="fd-fileitem__name">{item.file.name}</div>
                                                <div className="label" style={{ margin: 0 }}>
                                                    {item.file.type || 'unknown'} · {Math.round(item.file.size / 1024)} KB · {visualizeInfo(item.file, item.visualize)}
                                                </div>
                                            </div>

                                            <label className="fd-switch" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isTabular(item.file) ? item.visualize : false}
                                                    onChange={() => toggleVisualize(idx)}
                                                    disabled={!isTabular(item.file)}
                                                />
                                                <span className="fd-slider" />
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {result?.jobs?.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <strong>Uploaded</strong>
                                    <div className="summary-label" style={{ marginTop: 6 }}>
                                        {result.jobs.length} file(s) queued/stored.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right */}
                    <div className="fd-modal__right">
                        <div className="project-card" style={{ padding: 14, height: '100%' }}>
                            <strong>Preview</strong>
                            <div className="summary-label" style={{ marginTop: 6 }}>
                                {selectedFile ? selectedFile.name : 'Select a file to preview'}
                            </div>

                            <div className="fd-preview">
                                {preview.type === 'none' && <div className="empty-state">No preview</div>}
                                {preview.type === 'message' && <div className="empty-state" style={{ textAlign: 'left' }}>{preview.message}</div>}
                                {preview.type === 'image' && (
                                    <img src={preview.url} alt={preview.name} />
                                )}
                                {preview.type === 'table' && (
                                    <div className="excel-preview" >
                                        <table className="data-table">
                                            <thead>
                                                <tr>{preview.headers.map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
                                            </thead>
                                            <tbody>
                                                {preview.rows.map((row, rIdx) => (
                                                    <tr key={`r-${rIdx}`}>
                                                        {preview.headers.map((h, cIdx) => <td key={`${rIdx}-${cIdx}`}>{row[h]}</td>)}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="project-shell__nav-link"
                                    onClick={onClose}
                                    style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )

    return createPortal(modalUi, document.body)
}
