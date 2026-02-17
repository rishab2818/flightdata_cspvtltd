import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ingestionApi } from "../../../api/ingestionApi"
import { visualizationApi } from "../../../api/visualizationApi"


const TABULAR_EXTENSIONS = new Set([".csv", ".xlsx", ".xls", ".txt", ".dat", ".c", ".mat"])
const INLINE_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".txt",
  ".csv",
])

const getExtension = (name = "") => {
  const idx = name.lastIndexOf(".")
  return idx >= 0 ? name.slice(idx).toLowerCase() : ""
}

const isTabularFile = (file) => TABULAR_EXTENSIONS.has(getExtension(file?.filename || ""))

const canInlinePreview = (file) => {
  const type = (file?.content_type || "").toLowerCase()
  if (type.startsWith("image/") || type.startsWith("text/") || type === "application/pdf") {
    return true
  }
  return INLINE_EXTENSIONS.has(getExtension(file?.filename || ""))
}

const triggerDownload = (url, filename) => {
  const link = document.createElement("a")
  link.href = url
  link.download = filename || "download"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

const forceDownloadFromUrl = async (url, filename) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Download failed")
  const blob = await res.blob()
  const objectUrl = window.URL.createObjectURL(blob)
  try {
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename || "download"
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    window.URL.revokeObjectURL(objectUrl)
  }
}

export default function ProjectTagView() {
  const { projectId, datasetType, tagName } = useParams()
  const navigate = useNavigate()

  const [files, setFiles] = useState([])
  const [plots, setPlots] = useState([])
  const [activeTab, setActiveTab] = useState("raw")

  useEffect(() => {
  if (activeTab !== "plot") return

  visualizationApi
    .listForProject(projectId)
    .then((res) => {
      const list = Array.isArray(res) ? res : res.data || []

      const filtered = list.filter(
        (v) =>
          v.tag_name?.trim().toLowerCase() === tagName?.trim().toLowerCase() &&
          v.dataset_type?.trim().toLowerCase() === datasetType?.trim().toLowerCase()
      )

      setPlots(filtered)
    })
    .catch(() => setPlots([]))
}, [activeTab, projectId, tagName, datasetType])

  
//   useEffect(() => {
//     ingestionApi
//       .listFilesInTag(projectId, datasetType, tagName)
//       .then(setFiles)
//   }, [projectId, datasetType, tagName])

//    useEffect(() => {
//     if (activeTab === "plot") {
//       visualizationApi
//         .listForProject(projectId)
//         .then((data) => {
//           // const filtered = data.filter(
//           //   (v) =>
//           //     v.tag_name === tagName &&
//           //     v.dataset_type === datasetType
//           // )
//           // setPlots(filtered)
//      const filtered = data.filter((v) =>
//   v.tag_name?.toLowerCase() === tagName?.toLowerCase() &&
//   v.dataset_type?.toLowerCase() === datasetType?.toLowerCase()
// )

// setPlots(filtered)   // ✅ YOU FORGOT THIS
//         })


//         .catch(() => setPlots([]))
//     }
//   }, [activeTab, projectId, tagName, datasetType])

  const rawFiles = files
  const processedFiles = files.filter(f => f.processed_key)
  const othersFiles = files.filter(
    f => !f.processed_key && !f.visualize_enabled
  )

  // const rows =
  //   activeTab === "raw"
  //     ? rawFiles
  //     : activeTab === "processed"
  //       ? processedFiles
  //       : activeTab === "others"
  //         ? othersFiles
  //         : []

  const rows =
  activeTab === "plot"
    ? plots
    : activeTab === "raw"
      ? rawFiles
      : activeTab === "processed"
        ? processedFiles
        : activeTab === "others"
          ? othersFiles
          : []

  const handleView = async (file, canEdit) => {
    if (isTabularFile(file) && file.processed_key) {
      const editFlag = canEdit ? "1" : "0"
      window.open(`/processed-preview/${file.job_id}?edit=${editFlag}`, "_blank", "noopener,noreferrer")
      return
    }

    try {
      const { url } = await ingestionApi.download(file.job_id)
      if (canInlinePreview(file)) {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        triggerDownload(url, file.filename)
      }
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || "View failed")
    }
  }

  const handleDownload = async (file) => {
    try {
      const { url } = await ingestionApi.download(file.job_id)
      await forceDownloadFromUrl(url, file.filename)
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || "Download failed")
    }
  }

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.filename}"? This cannot be undone.`)) return
    try {
      await ingestionApi.remove(file.job_id)
      setFiles((prev) => prev.filter((item) => item.job_id !== file.job_id))
    } catch (err) {
      window.alert(err?.response?.data?.detail || err.message || "Delete failed")
    }
  }

  return (
    <div className="project-card">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)}>←</button>
        <h3 style={{ margin: 0 }}>{tagName}</h3>
      </div>

      {/* Tabs */}
      {/* <div className="tablist">
        <button className={activeTab === "raw" ? "active" : ""} onClick={() => setActiveTab("raw")}>Raw</button>
        <button className={activeTab === "processed" ? "active" : ""} onClick={() => setActiveTab("processed")}>Processed</button>
        <button className={activeTab === "others" ? "active" : ""} onClick={() => setActiveTab("others")}>Others</button>
        <button style={{ cursor: "pointer", opacity: 1 }} className={activeTab === "plot" ? "active" : ""} onClick={() => setActiveTab("plot")}>Plot</button>
      </div> */}

      <div>
  <button onClick={() => setActiveTab("raw")}>Raw</button>
  <button onClick={() => setActiveTab("processed")}>Processed</button>
  <button onClick={() => setActiveTab("plot")}>Plot</button>
  <button onClick={() => setActiveTab("others")}>Others</button>
</div>


      {/* Table
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
              <td>{f.sheet_name ? `${f.filename} — ${f.sheet_name}` : f.filename}</td>
              <td>{new Date(f.created_at).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleView(f, activeTab === "processed")} title="View">👁</button>
                <button onClick={() => handleDownload(f)} title="Download">⬇</button>
                <button onClick={() => handleDelete(f)} title="Delete">🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table> */}

  {/* FILE TABLE */}
{activeTab !== "plot" && (
  <>
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
            <td>
              {f.sheet_name
                ? `${f.filename} — ${f.sheet_name}`
                : f.filename}
            </td>
            <td>{new Date(f.created_at).toLocaleDateString()}</td>
            <td>
              <button onClick={() => handleView(f, activeTab === "processed")}>
                👁
              </button>
              <button onClick={() => handleDownload(f)}>⬇</button>
              <button onClick={() => handleDelete(f)}>🗑</button>
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
  </>
)}

{activeTab === "plot" && (
  <>
  <table className="data-table">
  <thead>
    <tr>
      <th>{activeTab === "plot" ? "Plot Name" : "File Name"}</th>
      <th>Created Date</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    {rows.map((item) => (
      <tr key={activeTab === "plot" ? item.viz_id : item._id}>
        <td>
          {activeTab === "plot"
            ? (item.filename || item.chart_type || "Plot")
            : (item.sheet_name
                ? `${item.filename} — ${item.sheet_name}`
                : item.filename)}
        </td>

        <td>
          {new Date(item.created_at).toLocaleDateString()}
        </td>

        <td>
          {activeTab === "plot" ? (
            <button
              onClick={() =>
                window.open(`/visualisation/${item.viz_id}`, "_blank")
              }
            >
              👁
            </button>
          ) : (
            <>
              <button onClick={() => handleView(item, activeTab === "processed")}>
                👁
              </button>
              <button onClick={() => handleDownload(item)}>⬇</button>
              <button onClick={() => handleDelete(item)}>🗑</button>
            </>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>

{!rows.length && (
  <div className="empty-state" style={{ marginTop: 12 }}>
    {activeTab === "plot"
      ? "No saved visualisations for this tag."
      : "No files in this tab."}
  </div>
)}

  </>
)}


    </div>
  )
}
