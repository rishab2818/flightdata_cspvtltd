import React from "react";

import { useTaskAcknowledgements } from "../context/TaskAcknowledgementContext";
import "../styles/taskAcknowledgements.css";

export default function TaskAcknowledgementToasts() {
  const { items = [], pendingIds = {}, acknowledge } = useTaskAcknowledgements() || {};

  if (!items.length) {
    return null;
  }

  return (
    <div className="task-ack-toast-stack" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div key={item.id} className="task-ack-toast">
          <div className="task-ack-toast__eyebrow">
            {item.state === "pending_assigner" ? "Acknowledgement" : "Task Assigned"}
          </div>
          <div className="task-ack-toast__message">{item.message}</div>
          <div className="task-ack-toast__meta">{item.task_description}</div>
          <button
            type="button"
            className="task-ack-toast__button"
            onClick={() => acknowledge(item.id)}
            disabled={Boolean(pendingIds[item.id])}
          >
            {pendingIds[item.id] ? "Saving..." : item.button_label || "Okay"}
          </button>
        </div>
      ))}
    </div>
  );
}
