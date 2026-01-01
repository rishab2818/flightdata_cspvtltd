import React, { useEffect, useState } from 'react'
import { ingestionApi } from '../../../api/ingestionApi'
import ArrowLeft from '../../../assets/ArrowLeft.svg'
import Folder1 from '../../../assets/Folder1.svg'
import CalendarBlank from '../../../assets/CalendarBlank.svg'
import DownloadSimple from '../../../assets/DownloadSimple.svg'
import Delete from '../../../assets/Delete.svg'
import ViewIcon from '../../../assets/ViewIcon.svg'
import './ProjectVisualisation.css'


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
                                    onClick={() => {
                                        if (tab === 'processed') {
                                            console.log("Processed file object:", f);
                                            window.open(`/processed-preview/${f.job_id}`, "_blank", "noopener,noreferrer");
                                        } else {
                                            alert("We will use another view method for others file");
                                        }
                                    }}
                                     style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px'}}
                                >
                                    <img style={{width:'20px', height:'20px'}} src={ViewIcon} alt="view"/>
                                </button>


                                <button  style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px', alignItems:'center'}}>
                                    <img style={{width:'20px', height:'20px'}} src={DownloadSimple} alt="download"/>
                                    </button>
                                <button  style={{background:'#ffffff',border:'0.67px solid #0000001A', width:'40px', height:'35px', borderRadius:'8px', alignItems:'center'}}>
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
