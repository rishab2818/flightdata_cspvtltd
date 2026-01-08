import { useState } from "react";

export default function SeeMoreText({ text = "" }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 100;

  if (!text) return null; // ⛔ prevents crash

  return (
    <p>
      {expanded ? text : text.substring(0, limit)}
      {text.length > limit && (
        <span
          style={{ color: "blue", cursor: "pointer", marginLeft: "6px" }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "See Less" : "See More"}
        </span>
      )}
    </p>
  );
}
