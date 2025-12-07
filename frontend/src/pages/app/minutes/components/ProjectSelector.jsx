import React from "react";

export default function ProjectSelector({
  projects,
  loading,
  error,
  selectedProjectId,
  onChange,
}) {
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  return (
    <div className="ProjectSelect">
      <label className="label">Select Project</label>
      <div className="ProjectRow">
        <select
          className="textInput"
          value={selectedProjectId}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={!hasProjects || loading}
        >
          <option value="">{loading ? "Loading..." : "Choose a project"}</option>
          {projects.map((project) => (
            <option key={project?._id || project?.id} value={project?._id || project?.id}>
              {project?.project_name || "Untitled Project"}
            </option>
          ))}
        </select>
        {loading && <span className="helperText">Loading projects...</span>}
      </div>
      {error && <p className="errorText">{error}</p>}
      {!loading && !error && !hasProjects && (
        <p className="helperText">You need a project membership to upload PMRC minutes.</p>
      )}
    </div>
  );
}
