import React, { useEffect, useMemo, useState } from "react"
import { useLocation, useParams } from "react-router-dom"
import { ingestionApi } from "../../../api/ingestionApi"
import "../../../styles/project.css"

export default function ProcessedPreviewPage() {
    const { jobId } = useParams()
    const location = useLocation()
    const isEditable = new URLSearchParams(location.search).get("edit") === "1"

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [originalCols, setOriginalCols] = useState([])
    const [renameMap, setRenameMap] = useState({})
    const [rows, setRows] = useState([])
    const [limit, setLimit] = useState(20)
    const [saving, setSaving] = useState(false)

    const displayCols = useMemo(() => {
        return originalCols.map(c => (renameMap?.[c] ?? c))
    }, [originalCols, renameMap])

    const fetchPreview = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await ingestionApi.getProcessedPreview(jobId, limit)
            setOriginalCols(data.original_columns || [])
            setRenameMap(data.rename_map || {})
            setRows(data.rows || [])
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Failed to load preview")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPreview()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId, limit])

    const onChangeHeader = (oldCol, newName) => {
        setRenameMap(prev => ({ ...(prev || {}), [oldCol]: newName }))
    }

    const validateRenameMap = () => {
        // compute final display names and check duplicates/empties
        const finalNames = originalCols.map(c => (renameMap?.[c] ?? c).trim())
        if (finalNames.some(n => !n)) return "Column name cannot be empty"
        const s = new Set(finalNames)
        if (s.size !== finalNames.length) return "Duplicate column names are not allowed"
        return null
    }

    const onSave = async () => {
        const v = validateRenameMap()
        if (v) { setError(v); return }

        setSaving(true)
        setError(null)
        try {
            // send only changed columns (optional)
            const payload = {}
            originalCols.forEach(c => {
                const v = (renameMap?.[c] ?? c).trim()
                if (v !== c) payload[c] = v
            })
            await ingestionApi.saveProcessedColumns(jobId, payload)
            await fetchPreview()
        } catch (e) {
            setError(e?.response?.data?.detail || e.message || "Save failed")
        } finally {
            setSaving(false)
        }
    }

    const onReset = () => {
        setRenameMap({})
    }

    return (
        <div className="project-page">
        <div className="project-card" style={{  width: "100%", margin: "0px auto", background: "#fff", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                    <h2 style={{ margin: 0 }}>Processed Preview</h2>
                    <p className="summary-label" style={{ marginTop: 6 }}>Job: {jobId}</p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <label className="summary-label" style={{ margin: 0 }}>Rows</label>
                    <select
                        style={{
                width: '100px',
                height: '37px',
                padding: '8px 32px 8px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                cursor: 'pointer',
                boxSizing: 'border-box',
                outline: 'none',
              }}
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                    >
                        {[10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>

                    <button
                        className="project-shell__nav-link"
                        type="button"
                        onClick={onReset}
                        disabled={saving || loading || !isEditable}
                    >
                        Reset
                    </button>
                    <button
                        className="project-shell__nav-link"
                        type="button"
                        onClick={onSave}
                        disabled={saving || loading || !isEditable}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {error && <div className="project-shell__error" style={{ marginTop: 12 }}>{error}</div>}
            {loading && <div className="empty-state" style={{ marginTop: 12 }}>Loading preview…</div>}

            {!loading && !error && (
                <div className="excel-preview" style={{ marginTop: 12, overflow: "auto",width:"100%" }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                {originalCols.map((oldCol, idx) => (
                                    <th key={oldCol} style={{ minWidth: 160 }}>
                                        <div className="summary-label" style={{ marginBottom: 6, marginTop:6 }}>Original: {oldCol}</div>
                                        <input
                                            className="input-control"
                                            value={renameMap?.[oldCol] ?? oldCol}
                                            onChange={(e) => onChangeHeader(oldCol, e.target.value)}
                                            disabled={!isEditable}
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={`r-${i}`}>
                                    {displayCols.map((c, j) => (
                                        <td key={`${i}-${j}`}>{String(r?.[c] ?? "")}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {!rows.length && (
                        <div className="empty-state" style={{ margin: 12 }}>No rows returned.</div>
                    )}
                </div>
            )}
        </div>
        </div>
    )
}