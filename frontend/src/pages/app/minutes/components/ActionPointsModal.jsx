import React from "react";

export default function ActionPointsModal({ open, onClose, actionPoints }) {
  const items = actionPoints || [];
  if (!open) return null;

  return (
    <div className="LightModalOverlay">
      <div className="LightModalCard">
        <div className="ModalHeader">
          <h3>Action Points</h3>
          <button type="button" className="CloseButton" onClick={onClose}>
            Close
          </button>
        </div>

        {items.length === 0 ? (
          <p className="EmptyText">No action points recorded for this file.</p>
        ) : (
          <ul className="ActionList">
            {items.map((pt, idx) => (
              <li key={`${pt.description}-${idx}`} className="ActionListItem">
                <div className="ActionDescription">{pt.description}</div>
                {pt.assigned_to && <span className="assigneeTag">Assigned: {pt.assigned_to}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
