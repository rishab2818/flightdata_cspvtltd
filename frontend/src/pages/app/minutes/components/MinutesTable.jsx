import React from "react";
import { FiCalendar } from "react-icons/fi";
import DocumentActions from "../../../../components/common/DocumentActions";

function IconBadge({ children, clickable, onClick }) {
  return (
    <div
      className={`icon-badge ${clickable ? "clickable" : ""}`}
      onClick={clickable ? onClick : undefined}
    >
      {children}
    </div>
  );
}

function MinutesRow({ row, onViewAction, onEdit, setRows }) {
  return (
    <tr className="minutes-row">
      <td className="cell-text">{row.fileName}</td>
      <td className="cell">
        <span className="tag-pill">{row.tag}</span>
      </td>
      <td className="cell-text">{row.meetingDate}</td>
      <td className="cell-text">{row.actionOn}</td>
      <td className="cell cell-center">
        <IconBadge clickable onClick={() => onViewAction(row.actionPoints)}>
          <FiCalendar size={16} />
        </IconBadge>
      </td>
      <td className="cell cell-center cell-actions">
        <DocumentActions
          doc={{
            id: row.id,
            fileName: row.fileName,
            onDeleted: (id) => setRows((prev) => prev.filter((r) => r.id !== id)),
          }}
          onEdit={() => onEdit(row)}
        />
      </td>
    </tr>
  );
}

export default function MinutesTable({ rows, loading, error, onViewAction, onEdit, setRows }) {
  return (
    <div className="TableGrid">
      <table className="Table">
        <thead>
          <th>File Name</th>
          <th>Tag</th>
          <th>Meeting Date</th>
          <th>Action On</th>
          <th>View Action</th>
          <th>Actions</th>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={6} className="tableLoad">
                Loading documents...
              </td>
            </tr>
          )}

          {!loading && error && (
            <tr>
              <td colSpan={6} className="tableError">
                {error}
              </td>
            </tr>
          )}

          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={6} className="TableEmpty">
                No minutes uploaded yet.
              </td>
            </tr>
          )}

          {!loading &&
            !error &&
            rows.map((row) => (
              <MinutesRow
                key={row.id}
                row={row}
                setRows={setRows}
                onViewAction={onViewAction}
                onEdit={onEdit}
              />
            ))}
        </tbody>
      </table>
    </div>
  );
}
