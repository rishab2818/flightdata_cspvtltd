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
const isExcel = (file) => ['.xlsx', '.xls'].includes(getExt(file?.name))

function sanitizeTag(tag) {
    return (tag || '').trim()
}

function fileKey(f) {
    return `${f.name}__${f.size}__${f.lastModified}`
}

function getSelectedSheets(item) {
    return Object.keys(item?.selectedSheets || {}).filter((name) => item.selectedSheets?.[name])
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

    const [files, setFiles] = useState([]) // [{ file, visualize, sheetNames, selectedSheets, activeSheet }]
    const [selectedIdx, setSelectedIdx] = useState(null)
    const [preview, setPreview] = useState({ type: 'none' })

    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(null)
    const [error, setError] = useState(null)
    const [result, setResult] = useState(null)

    const [excelSheets, setExcelSheets] = useState([])   // ['Sheet1', 'Sheet2']
const [activeSheet, setActiveSheet] = useState(null)
const [excelWb, setExcelWb] = useState(null)         // cached workbook


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
        setExcelSheets([])
        setActiveSheet(null)
        setExcelWb(null)
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

    const selectedFileEntry = useMemo(() => {
        if (selectedIdx == null) return null
        return files[selectedIdx] || null
    }, [files, selectedIdx])

    const parseExcelSheet = React.useCallback(
        (wb, sheetName, fileName) => {
            const ws = wb?.Sheets?.[sheetName]
            if (!ws) return

            const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
            const rowsRaw = (json || []).slice(0, 15)

            if (!rowsRaw.length) {
                setPreview({ type: 'message', message: 'Selected sheet is empty.' })
                return
            }

            let headers = []
            let dataRows = []

            if (headerMode === 'file') {
                headers = rowsRaw[0].map((h) => String(h || '').trim())
                dataRows = rowsRaw.slice(1)
            } else if (headerMode === 'none') {
                headers = rowsRaw[0].map((_, i) => `column_${i + 1}`)
                dataRows = rowsRaw
            } else {
                headers = headersList?.length
                    ? headersList
                    : rowsRaw[0].map((_, i) => `column_${i + 1}`)
                dataRows = rowsRaw
            }

            const rows = dataRows.slice(0, 10).map((r) => {
                const obj = {}
                headers.forEach((h, i) => (obj[h] = r[i] ?? ''))
                return obj
            })

            setPreview({
                type: 'table',
                headers,
                rows,
                name: sheetName ? `${fileName} — ${sheetName}` : fileName
            })
        },
        [headerMode, headersList]
    )

   const loadPreview = async (file, idx) => {
    if (!file) return;

    const ext = getExt(file.name);
    const targetIdx = idx ?? selectedIdx;

    // IMAGE PREVIEW
    if (isImage(file)) {
        const url = URL.createObjectURL(file);
        setPreview({ type: 'image', url, name: file.name });
        return;
    }

    // TXT OR CSV
    if (ext === '.txt' || ext === '.csv') {
        const text = await file.text();
        if (!text.trim()) {
            setPreview({ type: 'message', message: 'File is empty.' });
            return;
        }

        // If CSV or tabular TXT, parse table; else show full text
        if (ext === '.csv' || ext === '.txt') {
            const lines = text.split(/\r?\n/).filter(Boolean);
            if (lines.length === 0) {
                setPreview({ type: 'message', message: 'File is empty.' });
                return;
            }

            // Detect delimiter for TXT
            let delimiter = ',';
            if (ext === '.txt') {
                const firstLine = lines[0];
                if (firstLine.includes('\t')) delimiter = '\t';
                else if (firstLine.includes('|')) delimiter = '|';
                else delimiter = /\s+/;
            }

            const rawRows = lines.map(line =>
                delimiter instanceof RegExp ? line.split(delimiter) : line.split(delimiter)
            );

            let headers = [];
            let dataRows = [];

            if (headerMode === 'file') {
                headers = rawRows[0].map(h => String(h || '').trim());
                dataRows = rawRows.slice(1);
            } else if (headerMode === 'none') {
                headers = rawRows[0].map((_, i) => `column_${i + 1}`);
                dataRows = rawRows;
            } else {
                headers = headersList?.length
                    ? headersList
                    : rawRows[0].map((_, i) => `column_${i + 1}`);
                dataRows = rawRows;
            }

            // If tabular, show table; else show full text
            if (headers.length > 1 || ext === '.csv') {
                const rows = dataRows.slice(0, 10).map(r => {
                    const obj = {};
                    headers.forEach((h, i) => (obj[h] = r[i] ?? ''));
                    return obj;
                });
                setPreview({ type: 'table', headers, rows, name: file.name });
            } else {
                // Single-column text → full preview
                setPreview({ type: 'text', content: text, name: file.name });
            }
        }
        return;
    }

    // EXCEL PREVIEW
    if (ext === '.xlsx' || ext === '.xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        if (!wb.SheetNames?.length) {
            setPreview({ type: 'message', message: 'No sheets found in Excel file.' });
            return;
        }

        const sheetNames = wb.SheetNames;
        const existingItem = targetIdx != null ? files[targetIdx] : null;
        const existingSelected = existingItem?.selectedSheets || {};
        const nextSelectedSheets = {};
        sheetNames.forEach((name, i) => {
            nextSelectedSheets[name] = existingSelected[name] ?? i === 0;
        });

        const nextActiveSheet =
            existingItem?.activeSheet && sheetNames.includes(existingItem.activeSheet)
                ? existingItem.activeSheet
                : sheetNames[0];

        setExcelWb(wb);
        setExcelSheets(sheetNames);
        setActiveSheet(nextActiveSheet);

        if (targetIdx != null) {
            setFiles(prev => {
                const clone = [...prev];
                const item = clone[targetIdx];
                if (!item) return prev;
                clone[targetIdx] = { ...item, sheetNames, selectedSheets: nextSelectedSheets, activeSheet: nextActiveSheet };
                return clone;
            });
        }

        parseExcelSheet(wb, nextActiveSheet, file.name);
        return;
    }

    // UNSUPPORTED FILE
    setPreview({ type: 'message', message: 'Preview not supported for this file type.' });
};




//     const loadPreview = async (file, idx) => {
//         if (!file) return
//         const ext = getExt(file.name)
//         const targetIdx = idx ?? selectedIdx

//         if (isImage(file)) {
//             const url = URL.createObjectURL(file)
//             setPreview({ type: 'image', url, name: file.name })
//             return
//         }

// if (ext === '.txt') {
//     const text = await file.text()

//     if (!text.trim()) {
//         setPreview({ type: 'message', message: 'File is empty.' })
//         return
//     }

//     // Show full text
//     setPreview({
//         type: 'text',
//         content: text,
//         name: file.name
//     })
//     return
// }


//     // 🔍 smart delimiter detection
//     const firstLine = lines[0]
//     let delimiter = ','

//     if (firstLine.includes('\t')) delimiter = '\t'
//     else if (firstLine.includes(',')) delimiter = ','
//     else if (firstLine.includes('|')) delimiter = '|'
//     else delimiter = /\s+/   // space-separated txt

//     const rawRows = lines.map(line =>
//         delimiter instanceof RegExp
//             ? line.split(delimiter)
//             : line.split(delimiter)
//     )

//     let headers = []
//     let dataRows = []

//     if (headerMode === 'file') {
//         headers = rawRows[0].map(h => String(h || '').trim())
//         dataRows = rawRows.slice(1)
//     } else if (headerMode === 'none') {
//         headers = rawRows[0].map((_, i) => `column_${i + 1}`)
//         dataRows = rawRows
//     } else {
//         headers = headersList?.length
//             ? headersList
//             : rawRows[0].map((_, i) => `column_${i + 1}`)
//         dataRows = rawRows
//     }

//     const rows = dataRows.slice(0, 10).map(r => {
//         const obj = {}
//         headers.forEach((h, i) => {
//             obj[h] = r[i] ?? ''
//         })
//         return obj
//     })

//     setPreview({
//         type: 'table',
//         headers,
//         rows,
//         name: file.name
//     })
//     return
// }


//         // if (ext === '.csv') {
//         //     const text = await file.text()
//         //     const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 15)
//         //     if (!lines.length) return setPreview({ type: 'message', message: 'CSV appears empty.' })

//         //     const delimiter = lines[0].includes('\t') ? '\t' : ','
//         //     const rawRows = lines.map((ln) => ln.split(delimiter))

//         //     let headers = []
//         //     let dataRows = []

//         //     if (headerMode === 'file') {
//         //         headers = rawRows[0].map((h) => (h || '').trim())
//         //         dataRows = rawRows.slice(1)
//         //     } else if (headerMode === 'none') {
//         //         headers = rawRows[0].map((_, i) => `column_${i + 1}`)
//         //         dataRows = rawRows
//         //     } else {
//         //         headers = headersList?.length ? headersList : rawRows[0].map((_, i) => `column_${i + 1}`)
//         //         dataRows = rawRows
//         //     }

//         //     const rows = dataRows.slice(0, 10).map((r) => {
//         //         const obj = {}
//         //         headers.forEach((h, i) => (obj[h] = r[i] ?? ''))
//         //         return obj
//         //     })

//         //     setPreview({ type: 'table', headers, rows, name: file.name })
//         //     return
//         // }

//         if (ext === '.xlsx' || ext === '.xls') {
//             const buf = await file.arrayBuffer()
//             const wb = XLSX.read(buf, { type: 'array' })

//             if (!wb.SheetNames?.length) {
//                 setPreview({ type: 'message', message: 'No sheets found in Excel file.' })
//                 return
//             }

//             const sheetNames = wb.SheetNames
//             const existingItem = targetIdx != null ? files[targetIdx] : null
//             const existingSelected = existingItem?.selectedSheets || {}
//             const nextSelectedSheets = {}
//             sheetNames.forEach((name, i) => {
//                 if (Object.prototype.hasOwnProperty.call(existingSelected, name)) {
//                     nextSelectedSheets[name] = existingSelected[name]
//                 } else {
//                     nextSelectedSheets[name] = i === 0
//                 }
//             })

//             const nextActiveSheet =
//                 existingItem?.activeSheet && sheetNames.includes(existingItem.activeSheet)
//                     ? existingItem.activeSheet
//                     : sheetNames[0]

//             setExcelWb(wb)
//             setExcelSheets(sheetNames)
//             setActiveSheet(nextActiveSheet)

//             if (targetIdx != null) {
//                 setFiles((prev) => {
//                     const clone = [...prev]
//                     const item = clone[targetIdx]
//                     if (!item) return prev
//                     clone[targetIdx] = {
//                         ...item,
//                         sheetNames,
//                         selectedSheets: nextSelectedSheets,
//                         activeSheet: nextActiveSheet,
//                     }
//                     return clone
//                 })
//             }

//             parseExcelSheet(wb, nextActiveSheet, file.name)
//             return
//             /* legacy preview block (kept for reference)
//             if (ext === '.xlsx' || ext === '.xls') {
//     const buf = await file.arrayBuffer()
//     const wb = XLSX.read(buf, { type: 'array' })

//     if (!wb.SheetNames?.length) {
//         setPreview({ type: 'message', message: 'No sheets found in Excel file.' })
//         return
//     }

//     const parseExcelSheet = (wb, sheetName, fileName) => {
//     const ws = wb.Sheets[sheetName]
//     if (!ws) return

//     const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
//     const rowsRaw = (json || []).slice(0, 15)

//     if (!rowsRaw.length) {
//         setPreview({ type: 'message', message: 'Selected sheet is empty.' })
//         return
//     }

//     let headers = []
//     let dataRows = []

//     if (headerMode === 'file') {
//         headers = rowsRaw[0].map((h) => String(h || '').trim())
//         dataRows = rowsRaw.slice(1)
//     } else if (headerMode === 'none') {
//         headers = rowsRaw[0].map((_, i) => `column_${i + 1}`)
//         dataRows = rowsRaw
//     } else {
//         headers = headersList?.length
//             ? headersList
//             : rowsRaw[0].map((_, i) => `column_${i + 1}`)
//         dataRows = rowsRaw
//     }

//     const rows = dataRows.slice(0, 10).map((r) => {
//         const obj = {}
//         headers.forEach((h, i) => (obj[h] = r[i] ?? ''))
//         return obj
//     })

//     setPreview({
//         type: 'table',
//         headers,
//         rows,
//         name: `${fileName} — ${sheetName}`
//     })
// }

// const onSelectSheet = (sheetName) => {
//     setActiveSheet(sheetName)
//     if (excelWb) {
//         parseExcelSheet(excelWb, sheetName, selectedFile.name)
//     }
// }


//     // store workbook + sheets
//     setExcelWb(wb)
//     setExcelSheets(wb.SheetNames)

//     // default sheet (first one OR previously selected)
//     const sheetToUse = activeSheet && wb.SheetNames.includes(activeSheet)
//         ? activeSheet
//         : wb.SheetNames[0]

//     setActiveSheet(sheetToUse)

//     parseExcelSheet(wb, sheetToUse, file.name)
//     return
// }

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
//             */
//         }

//         setPreview({ type: 'message', message: 'Preview is not supported for this file type.' })
//     }

    

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
                loadPreview(next[0].file, 0)
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
        setExcelSheets([])
        setActiveSheet(null)
        setExcelWb(null)

        setSelectedIdx(idx)
        await loadPreview(files[idx]?.file, idx)
    }

    const onSelectSheet = (sheetName) => {
        setActiveSheet(sheetName)
        if (selectedIdx != null) {
            setFiles((prev) => {
                const clone = [...prev]
                const item = clone[selectedIdx]
                if (!item) return prev
                clone[selectedIdx] = { ...item, activeSheet: sheetName }
                return clone
            })
        }
        if (excelWb && selectedFile) {
            parseExcelSheet(excelWb, sheetName, selectedFile.name)
        }
    }

    const toggleSheetSelection = (sheetName) => {
        if (selectedIdx == null) return
        setFiles((prev) => {
            const clone = [...prev]
            const item = clone[selectedIdx]
            if (!item) return prev
            const current = item.selectedSheets || {}
            clone[selectedIdx] = {
                ...item,
                selectedSheets: {
                    ...current,
                    [sheetName]: !current[sheetName],
                },
            }
            return clone
        })
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

        const missingSheet = finalItems.find(
            (it) =>
                it.visualize &&
                isExcel(it.file) &&
                Array.isArray(it.sheetNames) &&
                it.sheetNames.length > 0 &&
                getSelectedSheets(it).length === 0
        )
        if (missingSheet) {
            return setError(`Select at least one sheet to plot for "${missingSheet.file.name}".`)
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            const manifest = finalItems.map((it) => {
                const entry = { visualize: it.visualize }
                if (it.visualize && isExcel(it.file) && Array.isArray(it.sheetNames) && it.sheetNames.length) {
                    const sheets = getSelectedSheets(it)
                    if (sheets.length) entry.sheets = sheets
                }
                return entry
            })
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
                    <div className="div_wapper">
                        <h3 className="text_wapper">{title}</h3>
                        <p className="subtitle" style={{ margin: '4px 0 0 0' }}>{subtitle}</p>
                    </div>
                    <button className="close_icon" onClick={onClose} type="button">✕</button>
                </div>

                {error && <div className="project-shell__error" style={{ margin: 14 }}>{error}</div>}

                <div className="fd-modal__grid">
                    {/* Left */}
                    <div className="fd-modal__left">
                        <div className="project-card">

                           <div className="UploadBox">
                                <label className="uploadTile" htmlFor="fd-modal-file-input" style={{ marginTop: 0 }}>
                                    <p className='button'style={{width:'200px'}}>
                                        <img src={Plus} ait="Browse" className='icon'/>
                                        {mode === 'edit' ? 'Browse new files (optional)' : 'Browse Plot files'}
                                    </p>
                                    <p className='uploadtext'>
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

                            <div className="form-field">

                            <label className="summaryLabel" style={{ marginTop: 8 }}>Folder / Tag Name</label>
                            <input
                                className="input"
                                placeholder="Write File Name/Tag"
                                value={tagName}
                                onChange={(e) => setTagName(e.target.value)}
                            />
                            </div>

                            <div className="form-field">
  <label className="summaryLabel"style={{ marginTop: 8 }}>Data Type</label>
  <select
    className="input-data"
    value={datasetType}
    onChange={(e) => setDatasetType(e.target.value)}
     disabled={mode === 'edit'} // ✅ disable in edit mode
  >
    <option value="" disabled>Select Data Category</option>
    {DATASET_OPTIONS.map((opt) => (
      <option key={opt.key} value={opt.key}>
        {opt.label}
      </option>
    ))}
  </select>
</div>

                            {/* ✅ Dataset selector stays in modal; no parent control needed
                            {mode !== 'edit' && (
                                <>
                                    <label className="summary-label">Data Type</label>
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
                            )} */}

                            {/* In edit mode we keep category display (still uses datasetType state) */}
                            {/* {mode === 'edit' && (
                                <div style={{ marginBottom: 10 }}>
                                    <div className="summaryLabel">Data Type</div>
                                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: 10 }}>
                                        {DATASET_OPTIONS.find(d => d.key === datasetType)?.label || datasetType}
                                    </div>
                                </div>
                            )} */}

                            

                            {/* Header handling (affects new uploads) */}
                            {/* <div className="header-options" style={{ marginTop: 12 }}>
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
                                </div> */}

                                <div className="form-field">
  <label style={{marginTop:8}} className="summaryLabel">Plot File Header</label>

  <select
    className="input-data"
    value={headerMode}
    onChange={(e) => setHeaderMode(e.target.value)}
  >
    <option value="file">Use headers from file</option>
    <option value="none">File has no headers</option>
    <option value="custom">Provide custom headers</option>
  </select>

                                {headerMode === 'custom' && (
                                    <div className="header-options__inputs">
                                        <label style={{marginTop:'5px',color:'#000000',fontSize:'13px',fontWeight:'600',fontFamily:'inter-regular,Helvetica'}} className="summary-label">Comma separated headers</label>
                                        <input
                                            className="input-data"
                                            placeholder="e.g. time, alpha, mach"
                                            value={customHeadersText}
                                            onChange={(e) => setCustomHeadersText(e.target.value)}
                                        />
                                    </div>
                                )}
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
                        <div className="project-card2" >
                            <div className="actions-row">
                                <strong>Selected Files ({files.length})</strong>
                                <button
                                    className="project-button"
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
                                    <div className="summaryLabel" style={{ marginTop: 6 }}>
                                        {uploadProgress != null ? `${uploadProgress}%` : 'Uploading…'}
                                    </div>
                                </div>
                            )}

                            {!files.length && (
                                <div className="EmptyState" style={{ marginTop: 10 }}>
                                    {mode === 'edit' ? 'No new files selected.' : 'No files selected.'}
                                </div>
                            )}

                            {files.length > 0 && (
                                <div className="fd-filelist" style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                                    {files.map((item, idx) => (
                                        <div
                                            key={`${fileKey(item.file)}-${idx}`}
                                            className={`fileitem ${idx === selectedIdx ? 'fd-fileitem--active' : ''}`}
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

                                            <label className="toggle" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isTabular(item.file) ? item.visualize : false}
                                                    onChange={() => toggleVisualize(idx)}
                                                    disabled={!isTabular(item.file)}
                                                />
                                                <span className="slider" />
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {result?.jobs?.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <strong>Uploaded</strong>
                                    <div className="summaryLabel" style={{ marginTop: 6 }}>
                                        {result.jobs.length} file(s) queued/stored.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right */}
                    <div className="fd-modal__right">
                        <div className="project-card1" >
                            <div className='card'>
                            <h3 style={{marginTop:"20px"}}>Preview</h3>
                            <div className="summaryLabel" >
                                {selectedFile ? selectedFile.name : 'Select a file to preview'}
                            </div>

                            {excelSheets.length > 0 && (
                                <>
                                    <div className="summaryLabel" style={{ marginTop: 10 }}>Excel Sheets</div>
                                    <div className="sheet-list">
                                        {excelSheets.map((sheet) => {
                                            const isActive = sheet === activeSheet
                                            const isSelected = !!selectedFileEntry?.selectedSheets?.[sheet]
                                            return (
                                                <div key={sheet} className={`sheet-row ${isActive ? 'active' : ''}`}>
                                                    <button
                                                        type="button"
                                                        className="sheet-name"
                                                        onClick={() => onSelectSheet(sheet)}
                                                    >
                                                        {sheet}
                                                    </button>
                                                    <label className="toggle" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSheetSelection(sheet)}
                                                        />
                                                        <span className="slider" />
                                                    </label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                            )}

                            <div className="fd-preview">
    {preview.type === 'none' && <div className="EmptyState">No preview</div>}
    {preview.type === 'message' && <div className="EmptyState" style={{ textAlign: 'left' }}>{preview.message}</div>}
    {preview.type === 'image' && (
        <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }}/>
    )}
    {preview.type === 'table' && (
        <div className="excel-preview">
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
    {preview.type === 'text' && (
        <pre
            style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 520,
                overflowY: 'auto',
                overflowX: 'auto',
                padding: 8,
                background: '#F3F3F5',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'monospace'
            }}
        >
            {preview.content}
        </pre>
    )}
</div>



                            {/* <div className="fd-preview">
                                {preview.type === 'none' && <div className="EmptyState">No preview</div>}
                                {preview.type === 'message' && <div className="EmptyState" style={{ textAlign: 'left' }}>{preview.message}</div>}
                                {preview.type === 'image' && (
                                    <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }}/>
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
                            </div> */}

                            {/* <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="project-shell__nav-link"
                                    onClick={onClose}
                                    style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }}
                                >
                                    Close
                                </button>
                            </div> */}
                        </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )

    return createPortal(modalUi, document.body)
}
