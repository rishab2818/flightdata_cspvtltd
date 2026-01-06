import React from 'react'
import { useOutletContext } from 'react-router-dom'

export default function ProjectSettings() {
  const { project } = useOutletContext()
  return (
    <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Project Settings</h2>
      <p className="summary-label">Update project information or manage members.</p>
      <div className="input-control">Project name: {project?.project_name}</div>
      <div className="input-control">Description: {project?.project_description}</div>
      <p className="summary-label" style={{ margin: 0 }}>
        Settings surface is a placeholder. Connect actions here to your backend when ready.
      </p>
    </div>
  )
}
