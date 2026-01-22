import { useState } from "react";

export default function SeeMoreText({ text = "" }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 100;

  if (!text) return null;

  return (
    <span style={{ display: "block" }}>
      {expanded ? text : text.substring(0, limit)}
      {text.length > limit && (
        <span
          style={{ color: "#1976D2", cursor: "pointer", marginLeft: 6 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "See Less" : "See More"}
        </span>
      )}
    </span>
  );
}
