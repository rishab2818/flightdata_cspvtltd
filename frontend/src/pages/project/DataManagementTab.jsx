import React, { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

export default function UploadTab() {
  const { project } = useOutletContext();
  const [filename, setFilename] = useState("Airbus_flight_223_10jul2024_12");

  const createdStr = useMemo(() => {
    try {
      return new Date(project.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  }, [project.created_at]);

  return (
    <div className="space-y-4">
      {/* (optional) small header summarizing */}
      <div className="text-sm text-gray-600">
        Upload files to <span className="font-medium">{project.title}</span> • Members {String(project.members?.length || 0).padStart(2,"0")}
      </div>

      <div className="rounded-xl bg-white border p-6">
        <div className="border-2 border-dashed rounded-xl p-12 text-center text-gray-600">
          <div className="text-3xl mb-2">⭳</div>
          <div className="font-semibold">Upload Data files</div>
          <div className="text-sm text-gray-500">Drag and drop your CSV, .dat or JSON files here, or click to browse</div>
          <button className="mt-4 rounded-md bg-[#1976d2] text-white px-4 py-2 text-sm">+ Browse File</button>
          <div className="text-xs text-gray-500 mt-3">Supported formats: CSV, JSON, .dat (Max 10MB per file)</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
          <div>
            <label className="text-sm text-gray-600">Data Category</label>
            <select className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option>Aero Data</option>
              <option>Wind Data</option>
              <option>CFD</option>
              <option>Flight</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Filename</label>
            <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={filename} onChange={(e)=>setFilename(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-md bg-[#1976d2] text-white px-4 py-2 text-sm">Upload to server</button>
          </div>
        </div>
      </div>
    </div>
  );
}
