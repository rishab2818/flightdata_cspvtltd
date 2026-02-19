// src/components/app/UploadMinutesModal.jsx
import React, { useEffect, useState } from "react";
import { FiUploadCloud, FiPlus, FiCalendar, FiX } from "react-icons/fi";
import { documentsApi } from "../../api/documentsApi";
import UploadSimple from "../../assets/UploadSimple.svg";
import load from "../../assets/load.svg";
import "./UploadMinutesModal.css";

const BORDER = "#E5E7EB";
const PRIMARY = "#1976D2";

// Compute SHA-256 content hash for dedupe
// async function computeSha256(file) {
//   const buffer = await file.arrayBuffer();
//   const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
//   const bytes = new Uint8Array(hashBuffer);
//   return Array.from(bytes)
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
// }
async function computeSha256(file) {
  if (!file) {
    throw new Error("No file selected");
  }

  const cryptoObj = window.crypto || window.msCrypto;

  try {
    if (cryptoObj?.subtle && file.arrayBuffer) {
      const arrayBuffer = await file.arrayBuffer();
      const digest = await cryptoObj.subtle.digest("SHA-256", arrayBuffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (err) {
    console.warn("WebCrypto SHA-256 failed:", err);
  }

  // Fallback: Generate 64-hex pseudo-hash (valid format for backend)
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += Math.floor(Math.random() * 16).toString(16);
  }
  return hash;
}


/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - subsection: "tcm" | "pmrc" | "ebm" | "gdm"
 *  - onUploaded: () => void
 */
export default function UploadMinutesModal({
  open,
  onClose,
  subsection,
  onUploaded,
  projectOptions = [],
  selectedProjectId = "",
  onProjectChange,
  requireProject = false,
}) {
  const [meetingDate, setMeetingDate] = useState("");
  const [tag, setTag] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [actionPointDescription, setActionPointDescription] = useState("");
  const [actionPointAssignee, setActionPointAssignee] = useState("");
  const [actionPoints, setActionPoints] = useState([]);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [projectId, setProjectId] = useState(selectedProjectId || "");

  // For multi "Action on"
  const [actionOnInput, setActionOnInput] = useState("");
  const [actionOnList, setActionOnList] = useState([]);

  useEffect(() => {
    if (!assigneeQuery.trim()) {
      setAssigneeOptions([]);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        const results = await documentsApi.searchAssignees(assigneeQuery.trim());
        setAssigneeOptions(results || []);
      } catch (err) {
        console.error("Failed to search assignees", err);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [assigneeQuery]);

  const handleSelectAssignee = (name) => {
    setActionPointAssignee(name);
    setAssigneeQuery(name);
    setAssigneeOptions([]);
  };

  useEffect(() => {
    setProjectId(selectedProjectId || "");
  }, [selectedProjectId, open]);

  if (!open) return null;

  const resetForm = () => {
    setMeetingDate("");
    setTag("");
    setFile(null);
    setError("");
    setActionPointDescription("");
    setActionPointAssignee("");
    setActionPoints([]);
    setAssigneeOptions([]);
    setAssigneeQuery("");
    setActionOnInput("");
    setActionOnList([]);
    setProjectId(selectedProjectId || "");
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleAddActionPoint = () => {
    const description = actionPointDescription.trim();
    const assignee = actionPointAssignee.trim();
    if (!description) return;

    setActionPoints((prev) => [
      ...prev,
      { description, assigned_to: assignee || "" },
    ]);
    setActionPointDescription("");
    setActionPointAssignee("");
    setAssigneeQuery("");
    setAssigneeOptions([]);
  };

  const handleRemoveActionPoint = (index) => {
    setActionPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddActionOn = () => {
    const v = actionOnInput.trim();
    if (!v) return;
    setActionOnList((prev) => [...prev, v]);
    setActionOnInput("");
  };

  const handleRemoveActionOn = (index) => {
    setActionOnList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    if (requireProject && !projectId) {
      setError("Select a project to upload PMRC minutes.");
      return;
    }
    if (!meetingDate) {
      setError("Please select a meeting date.");
      return;
    }
    if (!tag.trim()) {
      setError("Please enter a tag name.");
      return;
    }
    if (!subsection) {
      setError("No subsection selected.");
      return;
    }
    const normalizedActionPoints = actionPoints
      .map((ap) => ({
        description: ap.description.trim(),
        assigned_to: ap.assigned_to?.trim() || null,
      }))
      .filter((ap) => ap.description);

    if (normalizedActionPoints.length === 0) {
      setError("Please add at least one action point.");
      return;
    }

    const combinedActionOn = Array.from(
      new Set([
        ...actionOnList.map((name) => name.trim()).filter(Boolean),
        ...normalizedActionPoints
          .map((ap) => ap.assigned_to)
          .filter((name) => Boolean(name)),
      ])
    );

    try {
      setIsSubmitting(true);

      // 1) Compute hash of file for dedupe
      const content_hash = await computeSha256(file);

      // 2) Ask backend for upload URL
      const initPayload = {
        section: "minutes_of_meeting",
        subsection, // 'tcm' | 'pmrc' | 'ebm' | 'gdm'
        tag,
        doc_date: meetingDate, // 'YYYY-MM-DD'
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content_hash,

        // NEW: Multi action fields
        action_points: normalizedActionPoints,
        action_on: combinedActionOn,
        project_id: requireProject ? projectId : undefined,
      };
      // const initPayload = {
      //   section: "minutes_of_meeting",
      //   subsection,
      //   filename: file.name,
      //   content_type: file.type || "application/octet-stream",
      //   size_bytes: file.size,
      //   content_hash,
      // };

      const { upload_url, storage_key } = await documentsApi.initUpload(
        initPayload
      );

      // 3) Upload file directly to MinIO
      const putRes = await fetch(upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!putRes.ok) {
        const text = await putRes.text();
        const statusText = putRes.statusText || "";
        throw new Error(
          `File upload to storage failed${
            statusText ? ` (${statusText})` : ""
          }: ${text || putRes.status}`
        );
      }

      // 4) Confirm upload with backend
      const confirmPayload = {
        section: "minutes_of_meeting",
        subsection,
        tag,
        doc_date: meetingDate,
        storage_key,
        original_name: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content_hash,

        // NEW: same fields on confirm
        action_points: normalizedActionPoints,
        action_on: combinedActionOn,
        project_id: requireProject ? projectId : undefined,
      };

      await documentsApi.confirmUpload(confirmPayload);

      // 5) Done
      if (onUploaded) onUploaded();
      resetForm();
      onClose();
    } catch (err) {
      console.error(err);

      if (err?.response?.status === 409) {
        setError("This document already exists (duplicate detected).");
      } else if (err?.response?.data?.detail) {
        // surface backend validation
        const detail = err.response.data.detail;
        setError(
          Array.isArray(detail)
            ? detail.map((d) => d.msg || String(d)).join(", ")
            : String(detail)
        );
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  };

  const handleActionPointKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddActionPoint();
    }
  };

  const handleActionOnKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddActionOn();
    }
  };  

  return (
    <div className="modalOverlay">
      <div className="modalBox">
        <div className="ModalHeader1">
        <h2 className="modalTitle">Upload Meeting Minutes</h2>
         <button type="button" className="CloseButton" onClick={onClose}>
            X
          </button>
          </div>
        

        <form  autoComplete="off" onSubmit={handleSubmit} className="form">

          <input type="text" name="fake-username" autoComplete="username" hidden />
  <input type="password" name="fake-password" autoComplete="current-password" hidden />

          {/* Upload Box */}
          <div className="uploadRoot">
            <div className="uploadBox">
              <img src={UploadSimple} alt="Upload"/>
              <h3 className="uploadTitle">Upload Data files</h3>
              <p className="uploadText">Drag and drop your PDF/Word files here, or click to browse</p>

              <label className="browseBtn">
                <span className="plusIcon">+</span>
                <span>{file ? file.name : "Browse File"}</span>
                <input type="file" className="hiddenInput" onChange={handleFileChange} />
              </label>

              <p className="uploadHint">Supported formats: PDF/Word/any (up to backend limits)</p>
            </div>
          </div>
          {requireProject && (
            <div className="row gap16">
              <div className="flex1">
                <label className="label">Select Project</label>
                <select
                  className="textInput"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    if (onProjectChange) onProjectChange(e.target.value);
                  }}
                  disabled={!projectOptions?.length}
                >
                  <option value="">
                    {projectOptions?.length ? "Choose a project" : "No projects available"}
                  </option>
                  {projectOptions.map((project) => (
                    <option key={project?._id || project?.id} value={project?._id || project?.id}>
                      {project?.project_name || "Untitled Project"}
                    </option>
                  ))}
                </select>
                {!projectOptions?.length && (
                  <p className="helperText">Join a project to upload PMRC minutes.</p>
                )}
              </div>
            </div>
          )}

          {/* Action Points */}

          {/* Action Points */}
<div>
 <label className="label">
  Action Points <span style={{ color: "red",fontSize: "22px" }}>*</span>
</label>


  <div className="actionGrid">
    {/* Action Point */}
    <div className="field">
      {/* <input
        type="text"
        placeholder="CFD analysis to be conducted for Airbus 320"
        value={actionPointDescription}
        onChange={(e) => setActionPointDescription(e.target.value)}
        className="TextInput"
        // onKeyDown={handleActionPointKeyDown}
        // autoComplete="off"
      /> */}

      {/* <input
  type="text"
  name={`ap-desc-${Date.now()}`}   // 🔑 dynamic name
  placeholder="CFD analysis to be conducted for Airbus 320"
  value={actionPointDescription}
  onChange={(e) => setActionPointDescription(e.target.value)}
  className="TextInput"
  autoComplete="new-password"     // 🔑 Chrome autofill killer
  spellCheck={false}
  inputMode="text"
/> */}
<input
  type="text"
  name={`ap-desc-${Date.now()}`}
  placeholder="CFD analysis to be conducted for Airbus 320"
  value={actionPointDescription}
  onChange={(e) => setActionPointDescription(e.target.value)}
  className="Textinput"
  autoComplete="nope"
  spellCheck={false}
  inputMode="text"
/>


    </div>

    {/* Assign To */}
    <div className="field">
      <div className="assigneeInputBox">
        <input
          type="text"
          placeholder="Assign to (optional)"
          value={actionPointAssignee}
          onChange={(e) => {
            setActionPointAssignee(e.target.value);
            setAssigneeQuery(e.target.value);
          }}
          className="Textinput"
        />

        <button
          type="button"
          onClick={handleAddActionPoint}
          className="iconButton"
        >
          <FiPlus size={18} />
        </button>

        {assigneeOptions.length > 0 && (
          <div className="suggestionsBox">
            {assigneeOptions.map((name) => (
              <button
                type="button"
                key={name}
                className="suggestionItem"
                onClick={() => handleSelectAssignee(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>

  {/* Added action points list */}
  {actionPoints.length > 0 && (
    <div className="actionPointList">
      {actionPoints.map((pt, idx) => (
        <div key={idx} className="actionPointCard">
          <div className="actionPointText">{pt.description}</div>
          {pt.assigned_to && <div className="assigneeTag">{pt.assigned_to}</div>}
          <FiX
            size={14}
            onClick={() => handleRemoveActionPoint(idx)}
            className="chipRemove"
          />
        </div>
      ))}
    </div>
  )}
</div>

          {/* <div > 
            <label className="label">Action Points</label>
            <div className="actionPointSection">
              <div className="row">
                <input
                  type="text"
                  placeholder="CFD analysis to be conducted for Airbus 320"
                  value={actionPointDescription}
                  onChange={(e) => setActionPointDescription(e.target.value)}
                  onKeyDown={handleActionPointKeyDown}
                  className="textInput"
                />
                <button type="button" onClick={handleAddActionPoint} className="iconButton">
                  <FiPlus size={18} />
                </button>
              </div>

              <div className="assigneeWrap">
                <span className="label">Assign to (optional)</span>
                <div className="assigneeInputBox">
                  <input
                    type="text"
                    placeholder="Search people, roles or teams"
                    value={actionPointAssignee}
                    onChange={(e) => {
                      setActionPointAssignee(e.target.value);
                      setAssigneeQuery(e.target.value);
                    }}
                    className="textInput"
                  />
                  {assigneeOptions.length > 0 && (
                    <div className="suggestionsBox">
                      {assigneeOptions.map((name) => (
                        <button
                          type="button"
                          key={name}
                          className="suggestionItem"
                          onClick={() => handleSelectAssignee(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {actionPoints.length > 0 && (
              <div className="actionPointList">
                {actionPoints.map((pt, idx) => (
                  <div key={`${pt.description}-${idx}`} className="actionPointCard">
                    <div className="actionPointText">{pt.description}</div>
                    {pt.assigned_to && (
                      <div className="assigneeTag">{pt.assigned_to}</div>
                    )}
                    <FiX
                      size={14}
                      onClick={() => handleRemoveActionPoint(idx)}
                      className="chipRemove"
                    />
                  </div>
                ))}
              </div>
            )}
          </div> */}

          {/* Meeting Date */}
          <div className="dateWrap">
            <label className="label">Meeting Date <span style={{ color: "red",fontSize: "22px" }}>*</span></label>
            <div className="dateBox">
              {/* <FiCalendar size={16} className="dateIcon" /> */}
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="dateInput"
              />
            </div>
          </div>

          {/* Tag + Action On */}
          <div className="row gap16">
            <div className="flex1">
              <label className="label">Tag Name <span style={{ color: "red",fontSize: "22px" }}>*</span></label>
              <input
  type="text"
  name={`tag-${Date.now()}`}     
  placeholder="e.g., Strategy Planning, Team Sync"
  value={tag}
  onChange={(e) => setTag(e.target.value)}
  className="Textinput"
  autoComplete="nope"    
  spellCheck={false}
  inputMode="text"
/>

              {/* <input
                type="text"
                placeholder="e.g., Strategy Planning, Team Sync"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="TextInput"
                autoComplete="off"
              /> */}
            </div>

            {/* <div className="flex1">
              <label className="label">Action on (Person / Role / Team)</label>
              <div className="row">
                <input
                  type="text"
                  placeholder="e.g., CFD Team, Rishab, WT Group"
                  value={actionOnInput}
                  onChange={(e) => setActionOnInput(e.target.value)}
                  onKeyDown={handleActionOnKeyDown}
                  className="textInput"
                />
                <button type="button" onClick={handleAddActionOn} className="iconButton">
                  <FiPlus size={18} />
                </button>
              </div>

              {actionOnList.length > 0 && (
                <div className="chipContainer">
                  {actionOnList.map((ao, idx) => (
                    <span key={`${ao}-${idx}`} className="chip">
                      {ao}
                      <FiX size={12} onClick={() => handleRemoveActionOn(idx)} className="chipRemove" />
                    </span>
                  ))}
                </div>
              )}
            </div> */}
          </div>

          

          {error && <p className="errorText">{error}</p>}

          {/* Footer Buttons */}
          <div className="footerButtons">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="cancelBtn"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`submitBtn ${isSubmitting ? "loading" : ""}`}
            >
              <img src={load} alt="load" style={{width:"16px", height:"16px", color:"#fff" }}/>
              <span>{isSubmitting ? "Uploading..." : "Upload MOM"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



