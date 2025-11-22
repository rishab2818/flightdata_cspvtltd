import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { projectApi } from '../../../api/projectapi'
import brandIcon from '../../../assets/Database.svg'
import '../../../styles/project.css'

const navItems = [
  { key: 'upload', to: '', label: 'Upload File' },
  { key: 'data', to: 'data', label: 'Data Management' },
  { key: 'visualisation', to: 'visualisation', label: 'Data Visualisation' },
  { key: 'settings', to: 'settings', label: 'Settings' },
]

export default function ProjectShell() {
  const { projectId } = useParams()
  const location = useLocation()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await projectApi.getById(projectId)
        if (mounted) {
          setProject(data)
          setError(null)
        }
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [projectId])

  return (
    <div className="project-shell">
      <aside className="project-shell__sidebar">
        <div className="project-shell__brand">
          <img src={brandIcon} alt="logo" />
          <div className="project-shell__brand-text">Data Visualisation</div>
        </div>
        <div className="project-shell__project">
          <div className="project-shell__project-title">{project?.project_name || 'Project'}</div>
          <p className="project-shell__project-desc">{project?.project_description || 'Project workspace'}</p>
        </div>
        <nav className="project-shell__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === ''}
              className={({ isActive }) =>
                ['project-shell__nav-link',
                  isActive || location.pathname.endsWith(`/${item.to}`)
                    ? 'project-shell__nav-link--active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="project-shell__content">
        <header className="project-shell__header">
          <div>
            <p className="project-shell__header-label">Project Overview</p>
            <h1 className="project-shell__header-title">{project?.project_name || 'Project'}</h1>
            {project?.project_description && (
              <p className="project-shell__header-desc">{project.project_description}</p>
            )}
          </div>
          <div className="project-shell__summary">
            <div>
              <div className="summary-label">Owner</div>
              <div className="summary-value">{project?.created_by || 'N/A'}</div>
            </div>
            <div>
              <div className="summary-label">Members</div>
              <div className="summary-value">{project?.members?.length || 0}</div>
            </div>
          </div>
        </header>

        {error && <div className="project-shell__error">{error}</div>}
        {loading ? <div className="project-shell__loading">Loading project…</div> : <Outlet context={{ project }} />}
      </div>
    </div>
  )
}
