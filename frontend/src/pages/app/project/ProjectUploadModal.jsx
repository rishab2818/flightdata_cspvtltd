import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import { ingestionApi } from '../../../api/ingestionApi'
import {
    PROJECT_TABULAR_EXTENSIONS,
    getFileExtension,
    isRangeTextExtension,
} from '../../../uploadPreview/fileTypes'
import {
    countLocalTextLines,
    DEFAULT_PREVIEW_LINE_LIMIT,
    readLocalTextHead,
    readLocalTextRange,
} from '../../../uploadPreview/localTextPreview'
import { getRestrictedFileTypeMessage, isRestrictedFileType } from '../../../lib/fileRestrictions'
import { useLoader } from '../../../context/LoaderContext'
import './ProjectUploadModal.css'

import Plus from "../../../assets/Plus.svg"
import InfoButton from "../../../components/common/InfoButton"

const DATASET_OPTIONS = [
    { key: 'cfd', label: 'CFD' },
    { key: 'wind', label: 'Wind Data' },
    { key: 'flight', label: 'Flight Data' },
    { key: 'others', label: 'Others' }
]

const TABULAR_EXTS = PROJECT_TABULAR_EXTENSIONS
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
const MAT_EXTS = new Set(['.mat'])

const getExt = getFileExtension
const isTabular = (file) => TABULAR_EXTS.has(getExt(file?.name))
const isImage = (file) => IMAGE_EXTS.has(getExt(file?.name))
const isExcel = (file) => ['.xlsx', '.xls', '.ods'].includes(getExt(file?.name))
const isDatLike = (file) => isRangeTextExtension(getExt(file?.name))
const isMat = (file) => MAT_EXTS.has(getExt(file?.name))
const isHeaderModeCapable = (file) => isTabular(file) && !isMat(file) && !isDatLike(file)
const isCustomHeaderCapable = (file) => isHeaderModeCapable(file)

const NUM_TOKEN_RE = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const stripLeadingJunk = (line) => {
    return line.replace(/^[\s#\$%&@!;:,._-]+/, '')
}

const splitLine = (line, delim) => {
    const cleaned = stripLeadingJunk(line)

    if (delim) return cleaned.trim().split(delim).map((t) => t.trim())
    return cleaned.trim().split(/\s+/).filter((t) => t !== '')
}
const tokenCount = (tokens) => tokens.filter((tok) => tok !== '').length

const trimTrailingEmpty = (tokens) => {
    const out = [...tokens]
    while (out.length && out[out.length - 1] === '') out.pop()
    return out
}

const splitForMode = (line, delim) => trimTrailingEmpty(splitLine(line, delim))

const inferDelimiter = (lines) => {
    const candidates = [null, ',', '\t', ';', '|']
    let bestDelim = null
    let bestScore = [-1, -1, -1]

    for (const delim of candidates) {
        const counts = lines
            .filter((ln) => ln.trim() !== '')
            .map((ln) => tokenCount(splitForMode(ln, delim)))
        const multi = counts.filter((count) => count >= 2)

        let score = [0, 0, 0]
        if (multi.length) {
            const freq = {}
            for (const count of multi) {
                freq[count] = (freq[count] || 0) + 1
            }
            let dominantCols = null
            let dominantFreq = -1
            Object.keys(freq).forEach((k) => {
                const cols = Number(k)
                const f = freq[k]
                if (f > dominantFreq || (f === dominantFreq && cols > dominantCols)) {
                    dominantFreq = f
                    dominantCols = cols
                }
            })
            score = [dominantFreq, multi.length, dominantCols || 0]
        }

        const isBetter =
            score[0] > bestScore[0]
            || (score[0] === bestScore[0] && score[1] > bestScore[1])
            || (score[0] === bestScore[0] && score[1] === bestScore[1] && score[2] > bestScore[2])
        if (isBetter) {
            bestScore = score
            bestDelim = delim
        }
    }

    return bestDelim
}

const findTabularStartIndex = (parsedRows) => {
    const counts = parsedRows.map((row) => tokenCount(row))
    const firstMulti = counts.findIndex((count) => count >= 2)
    const fallback = firstMulti >= 0 ? firstMulti : 0

    for (let i = 0; i < counts.length; i += 1) {
        const count = counts[i]
        if (count < 2) continue
        const tolerance = Math.max(1, Math.floor(count * 0.35))
        let similar = 0
        for (let j = i + 1; j < Math.min(counts.length, i + 6); j += 1) {
            const nextCount = counts[j]
            if (nextCount >= 2 && Math.abs(nextCount - count) <= tolerance) {
                similar += 1
            }
        }
        if (similar >= 1) return i
    }
    return fallback
}

const mostlyNumeric = (tokens) => {
    const values = tokens.filter((tok) => tok !== '')
    if (!values.length) return false
    const numeric = values.filter((tok) => NUM_TOKEN_RE.test(tok)).length
    return numeric / values.length >= 0.6
}

const makeUniqueHeaders = (headers) => {
    const seen = new Map()
    return headers.map((raw, idx) => {
        const base = stripLeadingJunk(String(raw || '').trim()) || `column${idx + 1}`
        const count = (seen.get(base) || 0) + 1
        seen.set(base, count)
        return count === 1 ? base : `${base}_${count}`
    })
}

const looksLikeUnitsRow = (tokens) => {
    const values = tokens.filter((tok) => tok !== '').map((tok) => String(tok).trim())
    if (!values.length) return false

    const unitLikeCount = values.filter((tok) => {
        const t = tok.toLowerCase()
        return (
            /^[a-zA-Z%°/_\-0-9.]+$/.test(tok) &&
            (
                t.includes('/') ||
                ['m', 'km', 'cm', 'mm', 's', 'ms', 'deg', 'rad', 'kg', 'g', 'pa', 'kpa', 'mpa', 'n', 'kn', 'm/s', 'km/h', 'ft/s', 'rpm', 'hz'].includes(t)
            )
        )
    }).length

    return unitLikeCount / values.length >= 0.5
}

const buildTableFromLines = (lines) => {
    const cleanLines = lines.filter((ln) => ln.trim() !== '')
    if (!cleanLines.length) return { headers: [], rows: [] }

    const delim = inferDelimiter(cleanLines)
    const parsedRows = cleanLines.map((ln) => splitForMode(ln, delim))
    const startIdx = findTabularStartIndex(parsedRows)
    const candidateRows = parsedRows.slice(startIdx).filter((row) => tokenCount(row) > 0)
    if (!candidateRows.length) return { headers: [], rows: [] }

    const firstRow = candidateRows[0]
    const secondRow = candidateRows.length > 1 ? candidateRows[1] : null
    const thirdRow = candidateRows.length > 2 ? candidateRows[2] : null

    const firstRowHasText =
        tokenCount(firstRow) >= 2 &&
        firstRow.some((tok) => tok && !NUM_TOKEN_RE.test(tok))

    const secondRowIsUnits = secondRow ? looksLikeUnitsRow(secondRow) : false
    const secondRowIsNumeric = secondRow ? mostlyNumeric(secondRow) : false
    const thirdRowIsNumeric = thirdRow ? mostlyNumeric(thirdRow) : false

    const headerIsPresent =
        firstRowHasText &&
        (
            secondRowIsNumeric ||
            (secondRowIsUnits && thirdRowIsNumeric) ||
            (!secondRow && firstRowHasText)
        )

    const rowsRaw = (
        headerIsPresent
            ? (secondRowIsUnits ? candidateRows.slice(2) : candidateRows.slice(1))
            : candidateRows
    ).filter((row) => tokenCount(row) > 0)

    const maxCols = rowsRaw.reduce((m, r) => Math.max(m, r.length), 0)
    if (maxCols === 0) return { headers: [], rows: [] }

    let headers = []
    if (headerIsPresent) {
        headers = firstRow.map((h, i) => (h || `column${i + 1}`))
    } else {
        headers = Array.from({ length: maxCols }, (_, i) => `column${i + 1}`)
    }

    if (headers.length < maxCols) {
        headers = headers.concat(
            Array.from({ length: maxCols - headers.length }, (_, i) => `column${headers.length + i + 1}`)
        )
    } else {
        headers = headers.slice(0, maxCols)
    }

    headers = makeUniqueHeaders(headers)

    const rows = rowsRaw.slice(0, 10).map((r) => {
        const obj = {}
        headers.forEach((h, i) => {
            obj[h] = r[i] ?? ''
        })
        return obj
    })

    return { headers, rows }
}

// const buildTableFromLines = (lines) => {
//     const cleanLines = lines.filter((ln) => ln.trim() !== '')
//     if (!cleanLines.length) return { headers: [], rows: [] }

//     const delim = inferDelimiter(cleanLines)
//     const parsedRows = cleanLines.map((ln) => splitForMode(ln, delim))
//     const startIdx = findTabularStartIndex(parsedRows)
//     const candidateRows = parsedRows.slice(startIdx).filter((row) => tokenCount(row) > 0)
//     if (!candidateRows.length) return { headers: [], rows: [] }

//     const firstRow = candidateRows[0]
//     const secondRow = candidateRows.length > 1 ? candidateRows[1] : null
//     const headerIsPresent =
//         tokenCount(firstRow) >= 2
//         && firstRow.some((tok) => tok && !NUM_TOKEN_RE.test(tok))
//         && (!secondRow || mostlyNumeric(secondRow))

//     const rowsRaw = (headerIsPresent ? candidateRows.slice(1) : candidateRows)
//         .filter((row) => tokenCount(row) > 0)
//     const maxCols = rowsRaw.reduce((m, r) => Math.max(m, r.length), 0)
//     if (maxCols === 0) return { headers: [], rows: [] }

//     let headers = []
//     if (headerIsPresent) {
//         headers = firstRow.map((h, i) => (h || `column${i + 1}`))
//     } else {
//         headers = Array.from({ length: maxCols }, (_, i) => `column${i + 1}`)
//     }
//     if (headers.length < maxCols) {
//         headers = headers.concat(
//             Array.from({ length: maxCols - headers.length }, (_, i) => `column${headers.length + i + 1}`)
//         )
//     } else {
//         headers = headers.slice(0, maxCols)
//     }
//     headers = makeUniqueHeaders(headers)

//     const rows = rowsRaw.slice(0, 10).map((r) => {
//         const obj = {}
//         headers.forEach((h, i) => {
//             obj[h] = r[i] ?? ''
//         })
//         return obj
//     })

//     return { headers, rows }
// }

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
    mode = 'create',
    initialTag = '',
    initialDatasetType = 'cfd',
}) {
    const [datasetType, setDatasetType] = useState(initialDatasetType || 'cfd')
    const [tagName, setTagName] = useState(initialTag || '')

    const [headerMode, setHeaderMode] = useState('file')
    const [customHeadersText, setCustomHeadersText] = useState('')

    const [files, setFiles] = useState([])
    const hasHeaderModeFiles = useMemo(() => {
        return files.some(item => isHeaderModeCapable(item.file))
    }, [files])
    const [selectedIdx, setSelectedIdx] = useState(null)
    const [preview, setPreview] = useState({ type: 'none' })
    const [rangeInput, setRangeInput] = useState({ start: '1', end: '10' })
    const [applyRangeToAll, setApplyRangeToAll] = useState(false)
    const [applyCustomHeadersToAll, setApplyCustomHeadersToAll] = useState(false)

    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(null)
    const [error, setError] = useState(null)
    const [result, setResult] = useState(null)

    const [excelSheets, setExcelSheets] = useState([])
    const [activeSheet, setActiveSheet] = useState(null)
    const [excelWb, setExcelWb] = useState(null)
    const filesRef = useRef(files)
    const selectedIdxRef = useRef(selectedIdx)
    const lineCountTaskRef = useRef({ token: 0, fileId: null })

    const { showLoader, hideLoader } = useLoader()

    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
            lineCountTaskRef.current = {
                token: lineCountTaskRef.current.token + 1,
                fileId: null,
            }
        }
    }, [])

    useEffect(() => {
        filesRef.current = files
    }, [files])

    useEffect(() => {
        selectedIdxRef.current = selectedIdx
    }, [selectedIdx])

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
        setRangeInput({ start: '1', end: '10' })
        setApplyRangeToAll(false)
        setApplyCustomHeadersToAll(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTag, mode])

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
                headers = rowsRaw[0].map((_, i) => `column${i + 1}`)
                dataRows = rowsRaw
            } else {
                headers = headersList?.length
                    ? headersList
                    : rowsRaw[0].map((_, i) => `column${i + 1}`)
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

    const applyTextPreview = useCallback((lineItems, range, fileName, options = {}) => {
        const safeRange = {
            start: Math.max(1, Number(range?.start) || 1),
            end: Math.max(Math.max(1, Number(range?.start) || 1), Number(range?.end) || Number(range?.start) || 1),
        }
        const selectedLines = (lineItems || [])
            .filter((item) => item.number >= safeRange.start && item.number <= safeRange.end)
            .map((item) => item.text)
        const table = buildTableFromLines(selectedLines)

        setPreview({
            type: 'text-lines',
            fileId: options.fileId || null,
            name: fileName,
            lines: lineItems || [],
            totalLines: options.totalLines ?? null,
            range: safeRange,
            table,
            truncated: Boolean(options.truncated),
            selectionTruncated: Boolean(options.selectionTruncated),
            previewMode: options.previewMode || 'head',
            lineCountStatus: options.lineCountStatus || (options.totalLines != null ? 'ready' : 'idle'),
        })
        setRangeInput({ start: String(safeRange.start), end: String(safeRange.end) })
    }, [])

    const clearActiveLineCount = useCallback((fileId = null) => {
        const activeFileId = fileId ?? lineCountTaskRef.current.fileId
        lineCountTaskRef.current = {
            token: lineCountTaskRef.current.token + 1,
            fileId: null,
        }
        if (!activeFileId) return

        setFiles((prev) =>
            prev.map((item) =>
                fileKey(item.file) === activeFileId && item.lineCountStatus === 'counting'
                    ? { ...item, lineCountStatus: null }
                    : item
            )
        )
    }, [])

    const startBackgroundLineCount = useCallback(async (file, idx) => {
        if (!file || !isDatLike(file)) return

        const item = idx != null ? filesRef.current[idx] : null
        if (item?.totalLines != null) return

        const nextFileId = fileKey(file)
        const activeTask = lineCountTaskRef.current
        if (activeTask.fileId === nextFileId) return
        if (activeTask.fileId && activeTask.fileId !== nextFileId) {
            clearActiveLineCount(activeTask.fileId)
        }

        const token = lineCountTaskRef.current.token + 1
        lineCountTaskRef.current = { token, fileId: nextFileId }

        setFiles((prev) =>
            prev.map((entry) =>
                fileKey(entry.file) === nextFileId && entry.totalLines == null
                    ? { ...entry, lineCountStatus: 'counting' }
                    : entry
            )
        )

        setPreview((prev) =>
            prev?.type === 'text-lines' && prev.fileId === nextFileId
                ? { ...prev, lineCountStatus: 'counting' }
                : prev
        )

        const result = await countLocalTextLines(file, {
            shouldCancel: () => lineCountTaskRef.current.token !== token,
        })

        if (result.aborted || lineCountTaskRef.current.token !== token) return

        lineCountTaskRef.current = { token, fileId: null }

        let resolvedRange = null
        let shouldReloadPreview = false

        setFiles((prev) =>
            prev.map((entry) => {
                if (fileKey(entry.file) !== nextFileId) return entry

                const currentRange = entry.parseRange || { start: 1, end: 1 }
                const nextRange = {
                    start: result.lineCount > 0 ? clamp(currentRange.start || 1, 1, result.lineCount) : 1,
                    end: result.lineCount > 0
                        ? clamp(currentRange.end || currentRange.start || 1, currentRange.start || 1, result.lineCount)
                        : 1,
                }

                if (nextRange.end < nextRange.start) nextRange.end = nextRange.start
                resolvedRange = nextRange

                return {
                    ...entry,
                    totalLines: result.lineCount,
                    parseRange: entry.parseRange ? nextRange : entry.parseRange,
                    lineCountStatus: 'ready',
                }
            })
        )

        setPreview((prev) => {
            if (prev?.type !== 'text-lines' || prev.fileId !== nextFileId) return prev
            const currentRange = prev.range || { start: 1, end: 1 }
            const clampedRange = {
                start: result.lineCount > 0 ? clamp(currentRange.start || 1, 1, result.lineCount) : 1,
                end: result.lineCount > 0
                    ? clamp(currentRange.end || currentRange.start || 1, currentRange.start || 1, result.lineCount)
                    : 1,
            }
            if (clampedRange.end < clampedRange.start) clampedRange.end = clampedRange.start
            shouldReloadPreview =
                clampedRange.start !== currentRange.start || clampedRange.end !== currentRange.end

            return {
                ...prev,
                totalLines: result.lineCount,
                range: clampedRange,
                lineCountStatus: 'ready',
            }
        })

        if (resolvedRange) {
            setRangeInput({
                start: String(resolvedRange.start),
                end: String(resolvedRange.end),
            })
        }

        if (
            shouldReloadPreview &&
            selectedIdxRef.current === idx &&
            filesRef.current[idx]?.file &&
            fileKey(filesRef.current[idx].file) === nextFileId
        ) {
            await loadSelectedTextRangePreview(file, resolvedRange, {
                knownTotalLines: result.lineCount,
            })
        }
    }, [clearActiveLineCount])

    const loadInitialTextPreview = useCallback(async (file, idx) => {
        const existingItem = idx != null ? files[idx] : null
        const head = await readLocalTextHead(file, { maxLines: DEFAULT_PREVIEW_LINE_LIMIT })

        if (!head.lineItems.length) {
            setPreview({ type: 'message', message: 'Selected file is empty.' })
            return
        }

        const totalLines = existingItem?.totalLines ?? head.totalLines
        const existingRange = existingItem?.parseRange
        const nextRange = {
            start: Math.max(1, Number(existingRange?.start) || 1),
            end: Number(existingRange?.end) || Math.min(10, totalLines || 10),
        }

        if (totalLines != null) {
            nextRange.start = clamp(nextRange.start, 1, totalLines)
            nextRange.end = clamp(nextRange.end, nextRange.start, totalLines)
        } else if (nextRange.end < nextRange.start) {
            nextRange.end = nextRange.start
        }

        const lastHeadLineNumber = head.lineItems[head.lineItems.length - 1]?.number || 0
        if (nextRange.start > lastHeadLineNumber) {
            await loadSelectedTextRangePreview(file, nextRange, {
                knownTotalLines: totalLines,
                lineCountStatus: totalLines != null ? 'ready' : existingItem?.lineCountStatus || 'counting',
            })
        } else {
            applyTextPreview(head.lineItems, nextRange, file.name, {
                fileId: fileKey(file),
                totalLines,
                truncated: head.truncated,
                previewMode: 'head',
                lineCountStatus: totalLines != null ? 'ready' : existingItem?.lineCountStatus || 'idle',
            })
        }

        if (idx != null) {
            setFiles((prev) => {
                const clone = [...prev]
                const item = clone[idx]
                if (!item) return prev
                clone[idx] = { ...item, parseRange: nextRange }
                return clone
            })
        }
        if (totalLines == null && idx != null) {
            void startBackgroundLineCount(file, idx)
        }
    }, [applyTextPreview, files, startBackgroundLineCount])

    const loadSelectedTextRangePreview = useCallback(async (file, range, options = {}) => {
        const payload = await readLocalTextRange(file, range, {
            displayLimit: DEFAULT_PREVIEW_LINE_LIMIT,
        })
        const fileId = fileKey(file)
        const cachedItem = filesRef.current.find((entry) => fileKey(entry.file) === fileId)
        const totalLines = payload.totalLines ?? options.knownTotalLines ?? cachedItem?.totalLines ?? null
        const lineCountStatus = totalLines != null ? 'ready' : options.lineCountStatus || cachedItem?.lineCountStatus || 'counting'

        if (!payload.lineItems.length) {
            if (payload.totalLines === 0) {
                setPreview({ type: 'message', message: 'Selected file is empty.' })
            } else if (totalLines != null && range.start > totalLines) {
                setPreview({ type: 'message', message: `Selected range exceeds file length (${totalLines} lines).` })
            } else {
                setPreview({ type: 'message', message: 'No lines found in selected range.' })
            }
            return
        }

        applyTextPreview(payload.lineItems, payload.range, file.name, {
            fileId,
            totalLines,
            truncated: payload.selectionTruncated,
            selectionTruncated: payload.selectionTruncated,
            previewMode: 'selection',
            lineCountStatus,
        })
    }, [applyTextPreview])

    const loadPreview = async (file, idx) => {
        if (!file) return
        const ext = getExt(file.name)
        const targetIdx = idx ?? selectedIdx

        if (!isDatLike(file)) {
            clearActiveLineCount()
        }

        if (isImage(file)) {
            const url = URL.createObjectURL(file)
            setPreview({ type: 'image', url, name: file.name })
            return
        }

        setPreview({ type: 'message', message: 'Loading preview...' })

        if (ext === '.csv') {
            const head = await readLocalTextHead(file, { maxLines: 15 })
            const lines = head.lineItems.map((item) => item.text).filter(Boolean).slice(0, 15)
            if (!lines.length) return setPreview({ type: 'message', message: 'CSV appears empty.' })

            const delimiter = lines[0].includes('\t') ? '\t' : ','
            const rawRows = lines.map((ln) => ln.split(delimiter))

            let headers = []
            let dataRows = []

            if (headerMode === 'file') {
                headers = rawRows[0].map((h) => (h || '').trim())
                dataRows = rawRows.slice(1)
            } else if (headerMode === 'none') {
                headers = rawRows[0].map((_, i) => `column${i + 1}`)
                dataRows = rawRows
            } else {
                headers = headersList?.length ? headersList : rawRows[0].map((_, i) => `column${i + 1}`)
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

        if (isDatLike(file)) {
            await loadInitialTextPreview(file, targetIdx)
            return
        }

        if (ext === '.xlsx' || ext === '.xls' || ext === '.ods') {
            const buf = await file.arrayBuffer()
            const wb = XLSX.read(buf, { type: 'array' })

            if (!wb.SheetNames?.length) {
                setPreview({ type: 'message', message: 'No sheets found in spreadsheet file.' })
                return
            }

            const sheetNames = wb.SheetNames
            const existingItem = targetIdx != null ? files[targetIdx] : null
            const existingSelected = existingItem?.selectedSheets || {}
            const nextSelectedSheets = {}
            sheetNames.forEach((name, i) => {
                if (Object.prototype.hasOwnProperty.call(existingSelected, name)) {
                    nextSelectedSheets[name] = existingSelected[name]
                } else {
                    nextSelectedSheets[name] = i === 0
                }
            })

            const nextActiveSheet =
                existingItem?.activeSheet && sheetNames.includes(existingItem.activeSheet)
                    ? existingItem.activeSheet
                    : sheetNames[0]

            setExcelWb(wb)
            setExcelSheets(sheetNames)
            setActiveSheet(nextActiveSheet)

            if (targetIdx != null) {
                setFiles((prev) => {
                    const clone = [...prev]
                    const item = clone[targetIdx]
                    if (!item) return prev
                    clone[targetIdx] = {
                        ...item,
                        sheetNames,
                        selectedSheets: nextSelectedSheets,
                        activeSheet: nextActiveSheet,
                    }
                    return clone
                })
            }

            parseExcelSheet(wb, nextActiveSheet, file.name)
            return
        }

        if (ext === '.mat') {
            setPreview({
                type: 'message',
                message: 'MAT variable metadata is indexed on upload and available in the Visualization screen.',
            })
            return
        }

        setPreview({ type: 'message', message: 'Preview is not supported for this file type.' })
    }

    const onPickFiles = async (fileList) => {
        const incoming = Array.from(fileList || [])
        if (!incoming.length) return

        setError(null)
        setResult(null)

        const blockedFile = incoming.find((file) => isRestrictedFileType(file))
        if (blockedFile) {
            setError(getRestrictedFileTypeMessage(blockedFile))
            const el = document.getElementById('fd-modal-file-input')
            if (el) el.value = ''
            return
        }

        setFiles((prev) => {
            const existingKeys = new Set(prev.map((x) => fileKey(x.file)))
            const appended = []
            const rangeForNew = {
                start: Number(rangeInput.start) || 1,
                end: Number(rangeInput.end) || 10,
            }
            const nextHeaders = customHeadersText
                .split(',')
                .map((h) => h.trim())
                .filter(Boolean)

            for (const f of incoming) {
                const k = fileKey(f)
                if (existingKeys.has(k)) continue
                appended.push({
                    file: f,
                    visualize: isTabular(f),
                    parseRange: isDatLike(f) ? (applyRangeToAll ? rangeForNew : { start: 1, end: 10 }) : null,
                    totalLines: null,
                    lineCountStatus: null,
                    customHeaders:
                        headerMode === 'custom' && applyCustomHeadersToAll && isCustomHeaderCapable(f)
                            ? nextHeaders
                            : undefined,
                })
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
        if (headerMode === 'custom' && !applyCustomHeadersToAll) {
            const item = files[idx]
            const nextValue = Array.isArray(item?.customHeaders) ? item.customHeaders.join(', ') : ''
            setCustomHeadersText(nextValue)
        }
        setPreview({ type: 'message', message: 'Loading preview...' })
        await loadPreview(files[idx]?.file, idx)
    }

    const updateParseRange = (nextRange) => {
        if (selectedIdx == null) return
        setFiles((prev) => {
            const clone = [...prev]
            if (applyRangeToAll) {
                return clone.map((item) =>
                    isDatLike(item.file) ? { ...item, parseRange: nextRange } : item
                )
            }
            const item = clone[selectedIdx]
            if (!item) return prev
            clone[selectedIdx] = { ...item, parseRange: nextRange }
            return clone
        })
        if (preview?.type === 'text-lines' && selectedFile) {
            const knownTotalLines = preview.totalLines ?? selectedFileEntry?.totalLines ?? null
            void loadSelectedTextRangePreview(selectedFile, nextRange, {
                knownTotalLines,
                lineCountStatus: knownTotalLines != null ? 'ready' : selectedFileEntry?.lineCountStatus || 'counting',
            })
        }
    }

    const commitRangeInput = (nextStartRaw, nextEndRaw) => {
        if (preview?.type !== 'text-lines') return
        const startVal = Number(nextStartRaw)
        const endVal = Number(nextEndRaw)
        if (!Number.isFinite(startVal) || !Number.isFinite(endVal)) return
        const next = {
            start: Math.max(1, Math.trunc(startVal)),
            end: Math.max(1, Math.trunc(endVal)),
        }
        if (preview.totalLines != null) {
            next.start = clamp(next.start, 1, preview.totalLines)
            next.end = clamp(next.end, next.start, preview.totalLines)
        }
        if (next.end < next.start) next.end = next.start
        updateParseRange(next)
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

    const onSaveRename = async () => {
        setError(null)
        const newTag = sanitizeTag(tagName)
        if (!newTag) return setError('Tag Name is required.')

        if (sanitizeTag(initialTag) === newTag) {
            onClose()
            return
        }

        try {
            showLoader('Saving tag name...')
            await ingestionApi.renameTag(projectId, datasetType, initialTag, newTag)
            onClose()
        } catch (err) {
            setError(err?.response?.data?.detail || err.message || 'Rename failed')
        } finally {
            hideLoader()
        }
    }

    const onUpload = async () => {
        setError(null)
        setResult(null)

        const tag = sanitizeTag(tagName)
        if (!tag) return setError('Tag Name is required.')

        if (mode !== 'edit' && !files.length) return setError('Please select at least one file.')

        if (mode === 'edit' && files.length === 0) {
            await onSaveRename()
            return
        }

        const hasCustomHeaderFiles = files.some((it) => isCustomHeaderCapable(it.file))

        if (headerMode === 'custom' && hasCustomHeaderFiles) {
            if (applyCustomHeadersToAll) {
                if (!headersList || !headersList.length) {
                    return setError("Provide custom headers when header_mode is 'custom'.")
                }
            } else {
                const anyCustom = files.some(
                    (it) =>
                        isCustomHeaderCapable(it.file) &&
                        Array.isArray(it.customHeaders) &&
                        it.customHeaders.length
                )
                if (!anyCustom) {
                    return setError("Provide custom headers for at least one file or enable 'Apply custom headers to all files'.")
                }
            }
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

        const missingRange = finalItems.find(
            (it) => it.visualize && isDatLike(it.file) && (!it.parseRange || !it.parseRange.start || !it.parseRange.end)
        )
        if (missingRange) {
            return setError(`Select a line range to parse for "${missingRange.file.name}".`)
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            showLoader('Uploading files...')

            const manifest = finalItems.map((it) => {
                const entry = { visualize: it.visualize }
                if (it.visualize && isExcel(it.file) && Array.isArray(it.sheetNames) && it.sheetNames.length) {
                    const sheets = getSelectedSheets(it)
                    if (sheets.length) entry.sheets = sheets
                }
                if (it.visualize && isDatLike(it.file) && it.parseRange) {
                    entry.parse_range = {
                        start_line: Number(it.parseRange.start),
                        end_line: Number(it.parseRange.end),
                    }
                }
                if (
                    headerMode === 'custom' &&
                    isCustomHeaderCapable(it.file) &&
                    Array.isArray(it.customHeaders) &&
                    it.customHeaders.length
                ) {
                    entry.custom_headers = it.customHeaders
                }
                return entry
            })

            const res = await ingestionApi.startBatch(
                projectId,
                finalItems.map((it) => it.file),
                {
                    datasetType,
                    tagName: tag,
                    source: 'project_overview',
                    headerMode,
                    customHeaders: headerMode === 'custom' && hasCustomHeaderFiles && applyCustomHeadersToAll ? headersList : null,
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
            hideLoader()
            setUploading(false)
            setUploadProgress(null)
        }
    }

    const visualizeInfo = (file, visualize) => {
        if (!isTabular(file)) return 'Forced OFF (not tabular)'
        return visualize ? 'ON' : 'OFF'
    }

    const title = mode === 'edit' ? 'Edit Tag' : 'Upload Files'

    const modalUi = (
        <div className="fd-modal__backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
            <div className="fd-modal__panel" onMouseDown={(e) => e.stopPropagation()}>
                <div className="fd-modal__header">
                    <div className="div_wapper">
                        <h3 className="text_wapper">{title}<InfoButton message="Choose category, tag, header handling, and which files should be processed." /></h3>
                    </div>
                    <button className="close_icon" onClick={onClose} type="button">✕</button>
                </div>

                {error && <div className="project-shell__error" style={{ margin: 14 }}>{error}</div>}

                <div className="fd-modal__grid">
                    <div className="fd-modal__left1">
                        <div className="project-card">
                            <div className="UploadBox">
                                <label className="uploadTile" htmlFor="fd-modal-file-input" style={{ marginTop: 0 }}>
                                    <p className='button' style={{ width: '200px' }}>
                                        <img src={Plus} alt="Browse" className='icon' />
                                        {mode === 'edit' ? 'Browse new files (optional)' : 'Browse Plot files'}
                                    </p>
                                    <p className='uploadtext'>
                                        Supported: CSV, Excel (.xlsx, .xls), ODS (.ods) and line-based text files like TXT, DAT, C, FUL, KUL, PDT, FIN.
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
                                <label className="summaryLabel" style={{ marginTop: 20 }}>Folder / Tag Name <span style={{ color: "red", fontSize: "18px" }}>*</span></label>
                                <input
                                    className="input"
                                    placeholder="Write Folder / Tag Name"
                                    value={tagName}
                                    onChange={(e) => setTagName(e.target.value)}
                                />
                            </div>

                            <div className="form-field">
                                <label className="summaryLabel" style={{ marginTop: 10 }}>Data Type <span style={{ color: "red", fontSize: "18px" }}>*</span></label>
                                <select
                                    className="input-data"
                                    value={datasetType}
                                    onChange={(e) => setDatasetType(e.target.value)}
                                    disabled={mode === 'edit'}
                                >
                                    <option value="" disabled>Select Data Category</option>
                                    {DATASET_OPTIONS.map((opt) => (
                                        <option key={opt.key} value={opt.key}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {hasHeaderModeFiles && (
                                <div className="form-field">
                                    <label style={{ marginTop: 10 }} className="summaryLabel">
                                        Plot File Header
                                        <InfoButton message="Specify whether the uploaded file contains column headers. If not selected, columns will be automatically named (Column1, Column2, etc.)." />
                                    </label>

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
                                            <label
                                                style={{
                                                    marginTop: '5px',
                                                    fontSize: '13px',
                                                    fontWeight: 600
                                                }}
                                                className="summary-label1"
                                            >
                                                Comma separated headers
                                            </label>

                                            <input
                                                className="input-data"
                                                placeholder="e.g. time, alpha, mach"
                                                value={customHeadersText}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setCustomHeadersText(value)

                                                    const nextHeaders = value
                                                        .split(',')
                                                        .map(h => h.trim())
                                                        .filter(Boolean)

                                                    if (applyCustomHeadersToAll) {
                                                        setFiles(prev =>
                                                            prev.map(item =>
                                                                isCustomHeaderCapable(item.file)
                                                                    ? { ...item, customHeaders: nextHeaders }
                                                                    : item
                                                            )
                                                        )
                                                    } else if (selectedIdx != null) {
                                                        setFiles(prev => {
                                                            const clone = [...prev]
                                                            const item = clone[selectedIdx]
                                                            if (!item || !isCustomHeaderCapable(item.file)) return prev
                                                            clone[selectedIdx] = { ...item, customHeaders: nextHeaders }
                                                            return clone
                                                        })
                                                    }
                                                }}
                                            />

                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={applyCustomHeadersToAll}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked
                                                        setApplyCustomHeadersToAll(checked)
                                                        if (!checked) return

                                                        const nextHeaders = customHeadersText
                                                            .split(',')
                                                            .map(h => h.trim())
                                                            .filter(Boolean)

                                                        setFiles(prev =>
                                                            prev.map(item =>
                                                                isCustomHeaderCapable(item.file)
                                                                    ? { ...item, customHeaders: nextHeaders }
                                                                    : item
                                                            )
                                                        )
                                                    }}
                                                />
                                                <span className="summaryLabel" style={{ margin: 0 }}>
                                                    Apply custom headers to all files
                                                </span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

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
                                <div className="fd-filelist" style={{ maxHeight: 260, overflowY: 'auto' }}>
                                    {files.map((item, idx) => (
                                        <div
                                            key={`${fileKey(item.file)}-${idx}`}
                                            className={`fileitem ${idx === selectedIdx ? 'fd-fileitem--active1' : ''}`}
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

                    <div className="fd-modal__right1">
                        <div className="project-card1" >
                            <div className='card'>
                                <h3 style={{ marginTop: "20px", fontSize: '18px', fontWeight: 600 }}>Preview</h3>
                                <div style={{ fontSize: '11px', fontFamily: '"Inter-Regular", Helvetica', fontWeight: 400 }} >
                                    {selectedFile ? selectedFile.name : 'Select a file to preview'}
                                </div>

                                {preview.type === 'text-lines' && (
                                    <div style={{ marginTop: 10 }}>
                                        <div className="summaryLabel" style={{ marginTop: "20px" }}>
                                            Header is auto-detected from the first selected line.
                                        </div>
                                        <div style={{ fontSize: '11px', fontFamily: '"Inter-Regular", Helvetica', fontWeight: 400 }}>
                                            {preview.totalLines != null
                                                ? `Total Line Count: ${preview.totalLines}`
                                                : preview.lineCountStatus === 'counting'
                                                    ? 'Counting total lines in the background. Preview is available now.'
                                                    : 'Preparing line count...'}
                                        </div>

                                        <div style={{ marginTop: "10px", display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <label className="summaryLabel" style={{ margin: 0, marginRight: "-8px" }}>Start line</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={preview.totalLines || undefined}
                                                value={rangeInput.start}
                                                onChange={(e) => {
                                                    setRangeInput((prev) => ({ ...prev, start: e.target.value }))
                                                }}
                                                onBlur={() => commitRangeInput(rangeInput.start, rangeInput.end)}
                                                style={{ width: 120, background: "#f3f3f5", height: "25px", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "8px", marginRight: "10px" }}
                                            />

                                            <label className="summaryLabel" style={{ margin: 0, marginRight: "-8px" }}>End line</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={preview.totalLines || undefined}
                                                value={rangeInput.end}
                                                onChange={(e) => {
                                                    setRangeInput((prev) => ({ ...prev, end: e.target.value }))
                                                }}
                                                onBlur={() => commitRangeInput(rangeInput.start, rangeInput.end)}
                                                style={{ width: 120, background: "#f3f3f5", height: "25px", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "8px" }}
                                            />
                                            <label style={{ marginTop: '-8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={applyRangeToAll}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked
                                                        setApplyRangeToAll(checked)
                                                        if (!checked || !preview?.range) return
                                                        setFiles((prev) =>
                                                            prev.map((item) =>
                                                                isDatLike(item.file)
                                                                    ? { ...item, parseRange: { ...preview.range } }
                                                                    : item
                                                            )
                                                        )
                                                    }}
                                                />
                                                <span style={{ margin: 0, fontSize: '11px', fontFamily: '"Inter-Regular", Helvetica', fontWeight: 400 }}>Apply range to all line-based text files</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

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
                                        <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
                                    )}
                                    {preview.type === 'text-lines' && (
                                        <div style={{ marginTop: "10px", display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div style={{ padding: "12px", maxHeight: 260, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                                                {preview.lines.map((line) => {
                                                    const lineNo = line.number
                                                    const inRange = lineNo >= (preview.range?.start || 1) && lineNo <= (preview.range?.end || 1)
                                                    return (
                                                        <div
                                                            key={`ln-${lineNo}`}
                                                            style={{
                                                                display: 'flex',
                                                                gap: 10,
                                                                padding: '2px 8px',
                                                                background: inRange ? '#EFF7FF' : 'transparent',
                                                                fontFamily: 'monospace',
                                                                fontSize: 12,
                                                                border: '1px solid #e5e7eb',
                                                                alignItems: 'flex-start',
                                                                minWidth: 0,
                                                            }}
                                                        >
                                                            <span style={{ minWidth: 32, color: '#6b7280', textAlign: 'right', paddingTop: 2 }}>{lineNo}</span>

                                                            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                                                {line.text === '' ? ' ' : line.text}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {preview.truncated && (
                                                <div className="summaryLabel">
                                                    {preview.previewMode === 'selection'
                                                        ? `Showing the first ${DEFAULT_PREVIEW_LINE_LIMIT} lines from the selected range window.`
                                                        : `Showing the first ${DEFAULT_PREVIEW_LINE_LIMIT} lines for preview.`}
                                                </div>
                                            )}
                                            {preview.selectionTruncated && (
                                                <div className="summaryLabel">
                                                    Selected range is larger than the preview window. Upload will still use the full start/end range.
                                                </div>
                                            )}

                                            {preview.table?.headers?.length ? (
                                                <div className="excelpreview">
                                                    <table className="data-table">
                                                        <thead>
                                                            <tr>{preview.table.headers.map((h, i) => <th key={`${h}-${i}`}>{h}</th>)}</tr>
                                                        </thead>
                                                        <tbody>
                                                            {preview.table.rows.map((row, rIdx) => (
                                                                <tr key={`r-${rIdx}`}>
                                                                    {preview.table.headers.map((h, cIdx) => <td key={`${rIdx}-${cIdx}`}>{row[h]}</td>)}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="EmptyState">No data rows in selected range.</div>
                                            )}
                                        </div>
                                    )}
                                    {preview.type === 'table' && (
                                        <div className="excelpreview" >
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
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )

    return createPortal(modalUi, document.body)
}
