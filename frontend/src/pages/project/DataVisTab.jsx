import React from "react";
import { useOutletContext } from "react-router-dom";

export default function DataVisTab() {
  const { project } = useOutletContext();
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">Visualisations for <span className="font-medium">{project.title}</span></div>
      <div className="rounded-xl bg-white border p-6 text-sm text-gray-600">
        Charts and visualisations will appear here.
      </div>
    </div>
  );
}
