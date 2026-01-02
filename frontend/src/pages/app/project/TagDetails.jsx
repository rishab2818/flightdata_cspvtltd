import React, { useEffect, useState } from 'react'
import { ingestionApi } from '../../../api/ingestionApi'
import ArrowLeft from '../../../assets/ArrowLeft.svg'
import Folder1 from '../../../assets/Folder1.svg'
import CalendarBlank from '../../../assets/CalendarBlank.svg'
import DownloadSimple from '../../../assets/DownloadSimple.svg'
import Delete from '../../../assets/Delete.svg'
import ViewIcon from '../../../assets/ViewIcon.svg'
import './ProjectVisualisation.css'


const TABULAR_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls', '.txt'])
const INLINE_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.txt',
  '.csv',
])

const getExtension = (name = '') => {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

const isTabularFile = (file) => TABULAR_EXTENSIONS.has(getExtension(file?.filename || ''))

const canInlinePreview = (file) => {
  const type = (file?.content_type || '').toLowerCase()
  if (type.startsWith('image/') || type.startsWith('text/') || type === 'application/pdf') {
    return true
  }
  return INLINE_EXTENSIONS.has(getExtension(file?.filename || ''))
}

const triggerDownload = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const forceDownloadFromUrl = async (url, filename) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.URL.revokeObjectURL(objectUrl)
  }
}


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

     const handleView = async (file, canEdit) => {
        if (isTabularFile(file) && file.processed_key) {
          const editFlag = canEdit ? '1' : '0'
          window.open(`/processed-preview/${file.job_id}?edit=${editFlag}`, '_blank', 'noopener,noreferrer')
          return
        }
    
        try {
          const { url } = await ingestionApi.download(file.job_id)
          if (canInlinePreview(file)) {
            window.open(url, '_blank', 'noopener,noreferrer')
          } else {
            triggerDownload(url, file.filename)
          }
        } catch (err) {
          window.alert(err?.response?.data?.detail || err.message || 'View failed')
        }
      }
    
      const handleDownload = async (file) => {
        try {
          const { url } = await ingestionApi.download(file.job_id)
          await forceDownloadFromUrl(url, file.filename)
        } catch (err) {
          window.alert(err?.response?.data?.detail || err.message || 'Download failed')
        }
      }
    
      const handleDelete = async (file) => {
        if (!window.confirm(`Delete "${file.filename}"? This cannot be undone.`)) return
        try {
          await ingestionApi.remove(file.job_id)
          setFiles((prev) => prev.filter((item) => item.job_id !== file.job_id))
        } catch (err) {
          window.alert(err?.response?.data?.detail || err.message || 'Delete failed')
        }
      }

    return (
        <div style={{background:'#ffffff',gap:'10px', padding:'20px', width:'100%', height:'100%', border:'1px solid #00000026', borderRadius:'4px'}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10}}>
                <button onClick={onBack} style={{background:'#ffffff', border:'none'}}>
                    <img style={{width:'24px', height:'24px'}} src={ArrowLeft} alt="arrow"/>
                </button>
                <label style={{color:'#000000',fontFamily:'"Inter-Regular",Helvetica', fontSize:'16px', fontWeight:'600'}}>{tagName}</label>
            </div>

            <div className="tablist">
                <button className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>Raw</button>
                <button className={tab === 'processed' ? 'active' : ''} onClick={() => setTab('processed')}>Processed</button>
                <button disabled>Plot</button>
                <button className={tab === 'others' ? 'active' : ''} onClick={() => setTab('others')}>Others</button>
                
            </div>

            <table className="DataTable">
                <thead>
                    <tr>
                             <th className="tablehead">
                                        <span className="th-content">
                                         <img style={{width:'20px', height:'20px'}} src={Folder1} alt="folder"/>File Name
                                         </span>
                                         </th>
                                      <th className="tablehead">
                                        <span className="th-content">
                                        <img style={{width:'20px', height:'20px'}} src={CalendarBlank} alt="calendar" />Created Date
                                        </span>
                                        </th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(f => (
                        <tr key={f._id}>
                            <td style={{color:'#000000',fontFamily:'inter-regular,Helvetica',fontSize:'14px',fontWeight:'400'}}>
                                <div style={{gap:'6px', display:'flex',alignItems:'center'}}>
                                <img style={{width:'20px', height:'20px'}} src={Folder1} alt="folder"/>
                                {f.filename}
                                </div>
                                </td>
                            <td 
                            style={{color:'#000000',fontFamily:'inter-regular,Helvetica',fontSize:'14px',fontWeight:'400'}}>
                                 <div style={{gap:'6px', display:'flex',alignItems:'center'}}>
                                <img style={{width:'20px', height:'20px'}} src={CalendarBlank} alt="calendar" />
                                {new Date(f.created_at).toLocaleDateString()}
                                </div>
                                </td>
                            <td style={{display:'flex',gap:'8px', alignItems:'center'}}>
                                <button
                                onClick={() => handleView(f, tab === 'processed')} title="View"
                                    // onClick={() => {
                                    //     if (tab === 'processed') {
                                    //         console.log("Processed file object:", f);
                                    //         window.open(`/processed-preview/${f.job_id}`, "_blank", "noopener,noreferrer");
                                    //     } else {
                                    //         alert("We will use another view method for others file");
                                    //     }
                                    // }}
                                     style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px'}}
                                >
                                    <img style={{width:'20px', height:'20px'}} src={ViewIcon} alt="view"/>
                                </button>


                                <button 
                                onClick={() => handleDownload(f)} title="Download"
                                 style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px', alignItems:'center'}}>
                                    <img style={{width:'20px', height:'20px'}} src={DownloadSimple} alt="download"/>
                                    </button>
                                <button onClick={() => handleDelete(f)} title="Delete"
                                 style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px', alignItems:'center'}}>
                                    <img style={{width:'20px', height:'20px'}} src={Delete} alt="delete"/>
                                    </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}