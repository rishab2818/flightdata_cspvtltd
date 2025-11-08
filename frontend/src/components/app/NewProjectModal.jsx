// src/components/app/NewProjectModal.jsx
import React, { useState, useEffect } from "react";
import { projectApi } from "../../api/projectapi";

const BORDER = "#0000001A";
const PRIMARY = "#1976D2";

export default function NewProjectModal({ open, onClose, onSubmit, loading }) {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");

  // search + selection state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // reset form whenever we open
  useEffect(() => {
    if (open) {
      setProjectName("");
      setDescription("");
      setSearchTerm("");
      setSearchResults([]);
      setSelectedMembers([]);
    }
  }, [open]);

  // debounce search and call /api/projects/member-search
  useEffect(() => {
    if (!open) return;

    // nothing or single char -> don't call backend
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const data = await projectApi.memberSearch(searchTerm.trim());
        if (!cancelled) {
          const normalized = (data || [])
            .map((u) => ({
              email: u.email || u.user_email || "",
              name:
                u.name ||
                u.full_name ||
                u.display_name ||
                u.email ||
                u.user_email ||
                "",
            }))
            .filter((u) => u.email);
          setSearchResults(normalized);
        }
      } catch (err) {
        console.error("Member search failed", err);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    const member_emails = selectedMembers.map((m) => m.email);

    onSubmit({
      project_name: projectName,
      project_description: description,
      member_emails,
    });
  };

  const handleAddMember = (user) => {
    if (!user.email) return;
    const exists = selectedMembers.some((m) => m.email === user.email);
    if (exists) return;
    setSelectedMembers([...selectedMembers, user]);
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleRemoveMember = (email) => {
    setSelectedMembers(selectedMembers.filter((m) => m.email !== email));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: 520,
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(15,23,42,0.12)",
          border: `1px solid ${BORDER}`,
          padding: "28px 26px 24px",
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 600,
            margin: 0,
            marginBottom: 18,
            color: "#0f172a",
          }}
        >
          Create New Project
        </h3>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <label style={{ fontSize: 14, color: "#334155" }}>
            Project Name
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontSize: 14,
              }}
            />
          </label>

          <label style={{ fontSize: 14, color: "#334155" }}>
            Description
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontSize: 14,
                minHeight: 80,
                resize: "none",
              }}
            />
          </label>

          {/* Members search */}
          <div style={{ fontSize: 14, color: "#334155" }}>
            Add Members
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontSize: 14,
              }}
            />

            {/* search dropdown */}
            {searchTerm && searchResults.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: "#ffffff",
                  boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                  maxHeight: 160,
                  overflowY: "auto",
                }}
              >
                {searchResults.map((user) => (
                  <div
                    key={user.email}
                    onClick={() => handleAddMember(user)}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 14,
                    }}
                  >
                    <span>{user.name}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>
                      {user.email}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {searchTerm && searchLoading && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                Searching...
              </div>
            )}

            {/* selected member chips */}
            {selectedMembers.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {selectedMembers.map((m) => (
                  <span
                    key={m.email}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "#F1F5F9",
                      fontSize: 12,
                      color: "#0f172a",
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    {m.name || m.email}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.email)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 12,
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 18px",
                borderRadius: 6,
                border: "none",
                background: PRIMARY,
                color: "#ffffff",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
