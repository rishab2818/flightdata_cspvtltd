import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ingestionApi } from "../../../api/ingestionApi"

export default function ProjectTagView() {
    const { projectId, datasetType, tagName } = useParams()
    const navigate = useNavigate()

    const [files, setFiles] = useState([])
    const [activeTab, setActiveTab] = useState("raw")

    useEffect(() => {
        ingestionApi
            .listFilesInTag(projectId, datasetType, tagName)
            .then(setFiles)
    }, [projectId, datasetType, tagName])

    const rawFiles = files
    const processedFiles = files.filter(f => f.processed_key)
    const othersFiles = files.filter(
        f => !f.processed_key && !f.visualize_enabled
    )

    const rows =
        activeTab === "raw"
            ? rawFiles
            : activeTab === "processed"
                ? processedFiles
                : activeTab === "others"
                    ? othersFiles
                    : []

    return (
        <div className="project-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => navigate(-1)}>←</button>
                <h3 style={{ margin: 0 }}>{tagName}</h3>
            </div>

            {/* Tabs */}
            <div className="tablist">
                <button className={activeTab === "raw" ? "active" : ""} onClick={() => setActiveTab("raw")}>Raw</button>
                <button className={activeTab === "processed" ? "active" : ""} onClick={() => setActiveTab("processed")}>Processed</button>
                <button className={activeTab === "others" ? "active" : ""} onClick={() => setActiveTab("others")}>Others</button>
                <button disabled>Plot</button>
            </div>

            {/* Table */}
            <table className="data-table">
                <thead>
                    <tr>
                        <th>File Name</th>
                        <th>Created Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((f) => (
                        <tr key={f._id}>
                            <td>{f.filename}</td>
                            <td>{new Date(f.created_at).toLocaleDateString()}</td>
                            <td>
                                <button title="View">👁</button>
                                <button title="Download">⬇</button>
                                <button title="Delete">🗑</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {!rows.length && (
                <div className="empty-state" style={{ marginTop: 12 }}>
                    No files in this tab.
                </div>
            )}
        </div>
    )
}
