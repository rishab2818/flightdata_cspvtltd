import React from "react";
import "./FilterField.css";

export default function FilterField({ label, children, className = "", style }) {
  return (
    <div className={`filter-field ${className}`.trim()} style={style}>
      <label className="filter-field__label">{label}</label>
      {children}
    </div>
  );
}
