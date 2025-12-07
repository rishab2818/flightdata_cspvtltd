import React from "react";
import { MOM_TABS } from "../utils/formatters";

export default function TabsRow({ activeKey, onChange }) {
  return (
    <div className="TabRow">
      {MOM_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tabButton ${activeKey === tab.key ? "active" : ""}`}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
