import React, { useEffect, useState } from "react";

import { documentsApi } from "../../api/documentsApi";

function getDisplayName(user) {
  return user?.name?.trim() || user?.email || "";
}

export default function AssigneeSearchInput({
  value,
  projectId = "",
  placeholder = "Assign to",
  className = "",
  disabled = false,
  onValueChange,
  onSelect,
}) {
  const [options, setOptions] = useState([]);
  const [skipQuery, setSkipQuery] = useState("");

  useEffect(() => {
    if (skipQuery && value === skipQuery) {
      setOptions([]);
      setSkipQuery("");
      return undefined;
    }

    if (disabled || !value?.trim()) {
      setOptions([]);
      return undefined;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const results = await documentsApi.searchAssignableUsers(
          value.trim(),
          projectId || undefined
        );
        if (!cancelled) {
          setOptions(results || []);
        }
      } catch (err) {
        console.error("Failed to search assignable users", err);
        if (!cancelled) {
          setOptions([]);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [disabled, projectId, value]);

  const handleSelect = (user) => {
    const nextValue = getDisplayName(user);
    setSkipQuery(nextValue);
    setOptions([]);
    onValueChange?.(nextValue);
    onSelect?.(user);
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        disabled={disabled}
      />

      {options.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 20,
            border: "1px solid #dbe3ee",
            borderRadius: 6,
            background: "#ffffff",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.10)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {options.map((user) => (
            <button
              key={user.email}
              type="button"
              onClick={() => handleSelect(user)}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ color: "#0f172a", fontSize: 13 }}>
                {getDisplayName(user)}
              </span>
              <span style={{ color: "#64748b", fontSize: 12 }}>{user.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
