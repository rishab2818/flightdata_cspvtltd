import React, { useEffect, useState } from 'react'
import { ingestionApi } from '../../../api/ingestionApi'

export default function TagDetails({ projectId, datasetType, tagName, onBack }) {
    const [files, setFiles] = useState([])
    const [tab, setTab] = useState('raw')

    useEffect(() => {
        ingestionApi
            .listFilesInTag(projectId, datasetType, tagName)
            .then(setFiles)
    }, [projectId, datasetType, tagName])

    const rows =
        tab === 'raw'
            ? files
            : tab === 'processed'
                ? files.filter(f => f.processed_key)
                : tab === 'others'
                    ? files.filter(f => !f.processed_key && !f.visualize_enabled)
                    : []

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={onBack}>←</button>
                <h3>{tagName}</h3>
            </div>

            <div className="tablist">
                <button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>Raw</button>
                <button className={tab === 'processed' ? 'active' : ''} onClick={() => setTab('processed')}>Processed</button>
                <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>Others</button>
                <button disabled>Plot</button>
            </div>

            <table className="data-table">
                <thead>
                    <tr>
                        <th>File Name</th>
                        <th>Created Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(f => (
                        <tr key={f._id}>
                            <td>{f.filename}</td>
                            <td>{new Date(f.created_at).toLocaleDateString()}</td>
                            <td>
                                <button
                                    onClick={() => {
                                        if (tab === 'processed') {
                                            console.log("Processed file object:", f);
                                            window.open(`/processed-preview/${f.job_id}`, "_blank", "noopener,noreferrer");
                                        } else {
                                            alert("We will use another view method for others file");
                                        }
                                    }}
                                >
                                    👁
                                </button>


                                <button>⬇</button>
                                <button>🗑</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    )
}
