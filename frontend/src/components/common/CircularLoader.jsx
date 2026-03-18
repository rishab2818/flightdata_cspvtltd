import React from "react";
import "./CircularLoader.css";

export default function CircularLoader({ visible, message = "Processing..." }) {
  if (!visible) return null;

  return (
    <div className="app-loader-overlay">
      <div className="app-loader-box">
        <div className="app-loader-spinner" />
        <p className="app-loader-text">{message}</p>
      </div>
    </div>
  );
}