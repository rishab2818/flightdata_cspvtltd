import React, { useEffect, useState } from "react";
import { normalizeDate } from "../utils/formatters";

export default function NextMeetingModal({ open, onClose, initialMeeting, onSave, saving }) {
  const [title, setTitle] = useState(initialMeeting?.title || "");
  const [meetingDate, setMeetingDate] = useState(initialMeeting?.meeting_date || "");
  const [meetingTime, setMeetingTime] = useState(initialMeeting?.meeting_time || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(initialMeeting?.title || "");
    setMeetingDate(normalizeDate(initialMeeting?.meeting_date));
    setMeetingTime(initialMeeting?.meeting_time || "");
    setError("");
  }, [initialMeeting, open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !meetingDate || !meetingTime) {
      setError("Please provide a title, date, and time for the next meeting.");
      return;
    }

    const result = await onSave({
      title: title.trim(),
      meeting_date: meetingDate,
      meeting_time: meetingTime,
    });

    if (!result?.ok && result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="LightModalOverlay">
      <div className="LightModalCard">
        <div className="ModalHeader">
          <h3>Edit next meeting</h3>
          <button type="button" className="CloseButton" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="ModalForm" onSubmit={handleSubmit}>
          <label className="label">Meeting title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="textInput"
            placeholder={`Next ${initialMeeting?.sectionLabel || "Meeting"}`}
          />

          <div className="row gap16">
            <div className="flex1">
              <label className="label">Meeting date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="textInput"
              />
            </div>
            <div className="flex1">
              <label className="label">Time</label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="textInput"
              />
            </div>
          </div>

          {error && <p className="errorText">{error}</p>}

          <div className="ModalActions">
            <button type="button" className="cancelBtn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submitBtn" disabled={saving}>
              {saving ? "Saving..." : "Save meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
