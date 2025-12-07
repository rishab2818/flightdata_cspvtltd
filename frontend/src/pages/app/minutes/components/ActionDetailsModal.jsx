import React, { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { normalizeDate } from "../utils/formatters";

export default function ActionDetailsModal({ open, doc, onClose, onSave, saving, error }) {
  const [activeTab, setActiveTab] = useState("view");
  const [tag, setTag] = useState(doc?.tag || "");
  const [meetingDate, setMeetingDate] = useState(normalizeDate(doc?.meetingDateRaw));
  const [actionOnInput, setActionOnInput] = useState("");
  const [actionOnList, setActionOnList] = useState(doc?.rawActionOn || []);
  const [apDescription, setApDescription] = useState("");
  const [apAssignee, setApAssignee] = useState("");
  const [actionPoints, setActionPoints] = useState(doc?.actionPoints || []);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!doc) return;
    setTag(doc.tag || "");
    setMeetingDate(normalizeDate(doc.meetingDateRaw));
    setActionOnList(doc.rawActionOn || []);
    setActionPoints(doc.actionPoints || []);
    setApDescription("");
    setApAssignee("");
    setLocalError("");
  }, [doc, open]);

  if (!open || !doc) return null;

  const handleAddActionOn = () => {
    const value = actionOnInput.trim();
    if (!value) return;
    setActionOnList((prev) => [...prev, value]);
    setActionOnInput("");
  };

  const handleRemoveActionOn = (index) => {
    setActionOnList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddActionPoint = () => {
    if (!apDescription.trim()) return;
    setActionPoints((prev) => [
      ...prev,
      {
        description: apDescription.trim(),
        assigned_to: apAssignee.trim(),
        completed: false,
      },
    ]);
    setApDescription("");
    setApAssignee("");
  };

  const handleRemoveActionPoint = (index) => {
    setActionPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateActionPoint = (index, field, value) => {
    setActionPoints((prev) =>
      prev.map((pt, i) => (i === index ? { ...pt, [field]: value } : pt))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!tag.trim() || !meetingDate) {
      setLocalError("Tag and meeting date are required.");
      return;
    }

    const payload = {
      tag: tag.trim(),
      doc_date: meetingDate,
      action_on: actionOnList,
      action_points: actionPoints,
    };

    const result = await onSave?.(payload);
    if (!result?.ok && result?.error) {
      setLocalError(result.error);
    }
  };

  return (
    <div className="ModalOverlay">
      <div className="ModalCard">
        <div className="ModalHeader">
          <h2>Edit Action Details</h2>
          <button type="button" className="CloseButton" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="TabSwitch">
          <button
            type="button"
            className={`tabButton ${activeTab === "view" ? "active" : ""}`}
            onClick={() => setActiveTab("view")}
          >
            View Actions
          </button>
          <button
            type="button"
            className={`tabButton ${activeTab === "edit" ? "active" : ""}`}
            onClick={() => setActiveTab("edit")}
          >
            Edit Actions
          </button>
        </div>

        {activeTab === "view" && (
          <div className="ActionView">
            <div className="ActionMeta">
              <div>
                <h4>Tag</h4>
                <p>{doc.tag}</p>
              </div>
              <div>
                <h4>Meeting Date</h4>
                <p>{doc.meetingDate}</p>
              </div>
              <div>
                <h4>Action On</h4>
                <p>{doc.actionOn}</p>
              </div>
            </div>

            <div className="ActionPoints">
              <h4>Action Points</h4>
              {(doc.actionPoints || []).map((pt, idx) => (
                <div key={`${pt.description}-${idx}`} className="ActionPointItem">
                  <div className="ActionPointMain">
                    <div className="ActionPointTitle">{pt.description}</div>
                    {pt.assigned_to && (
                      <span className="assigneeTag">Assigned: {pt.assigned_to}</span>
                    )}
                  </div>
                  <div className={`status ${pt.completed ? "done" : "pending"}`}>
                    <span className="dot" />
                    {pt.completed ? "Marked done" : "Pending"}
                  </div>
                </div>
              ))}
              {(doc.actionPoints || []).length === 0 && (
                <p className="EmptyText">No action points recorded for this file.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "edit" && (
          <form className="ActionEditForm" onSubmit={handleSubmit}>
            <div className="row gap16">
              <div className="flex1">
                <label className="label">Tag Name</label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="textInput"
                  required
                />
              </div>
              <div className="flex1">
                <label className="label">Meeting Date</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="textInput"
                  required
                />
              </div>
            </div>

            <div className="row gap16">
              <div className="flex1">
                <label className="label">Action on (Person / Role / Team)</label>
                <div className="row">
                  <input
                    type="text"
                    value={actionOnInput}
                    onChange={(e) => setActionOnInput(e.target.value)}
                    className="textInput"
                    placeholder="Add new action owner"
                  />
                  <button type="button" className="icon-btn" onClick={handleAddActionOn}>
                    <FiPlus size={16} />
                  </button>
                </div>
                {actionOnList.length > 0 && (
                  <div className="chipContainer">
                    {actionOnList.map((ao, idx) => (
                      <span key={`${ao}-${idx}`} className="chip">
                        {ao}
                        <FiX
                          size={12}
                          onClick={() => handleRemoveActionOn(idx)}
                          className="chipRemove"
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="ActionEditList">
              <div className="ActionEditHeader">Action Points</div>

              {(actionPoints || []).map((pt, idx) => (
                <div key={`${pt.description}-${idx}`} className="ActionEditItem">
                  <div className="flex1">
                    <label className="label">Description</label>
                    <input
                      type="text"
                      value={pt.description}
                      onChange={(e) => handleUpdateActionPoint(idx, "description", e.target.value)}
                      className="textInput"
                    />
                  </div>
                  <div className="flex1">
                    <label className="label">Assign to</label>
                    <input
                      type="text"
                      value={pt.assigned_to}
                      onChange={(e) => handleUpdateActionPoint(idx, "assigned_to", e.target.value)}
                      className="textInput"
                    />
                  </div>
                  <label className="toggleWrap">
                    <input
                      type="checkbox"
                      checked={Boolean(pt.completed)}
                      onChange={(e) => handleUpdateActionPoint(idx, "completed", e.target.checked)}
                    />
                    <span>Marked done</span>
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleRemoveActionPoint(idx)}
                    aria-label="Remove action point"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}

              <div className="ActionAddRow">
                <input
                  type="text"
                  value={apDescription}
                  onChange={(e) => setApDescription(e.target.value)}
                  placeholder="New action point"
                  className="textInput"
                />
                <input
                  type="text"
                  value={apAssignee}
                  onChange={(e) => setApAssignee(e.target.value)}
                  placeholder="Assign to"
                  className="textInput"
                />
                <button type="button" className="icon-btn" onClick={handleAddActionPoint}>
                  <FiPlus size={16} />
                </button>
              </div>
            </div>

            {(localError || error) && <p className="errorText">{localError || error}</p>}

            <div className="ModalActions">
              <button type="button" className="cancelBtn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="submitBtn" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
