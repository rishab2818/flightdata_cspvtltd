import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from '../../../api/projectapi'
import TopBarActions from '../../../components/layout/TopBarActions'
import '../../../styles/project.css'

import Database2 from "../../../assets/Database2.svg";
import TrendUp from "../../../assets/TrendUp.svg";
import GearFine from "../../../assets/GearFine.svg";
import reply from "../../../assets/reply.svg";
import chartLine from "../../../assets/ChartLine.svg"

const navItems = [
  { key: 'data', to: 'data', label: 'Project Overview', icon: Database2 },
  { key: 'visualisation', to: 'visualisation', label: 'Visualize', icon: chartLine },
  { key: 'report', to: 'report', label: 'Report Generation', icon: TrendUp },
  { key: 'settings', to: 'settings', label: 'Settings', icon: GearFine },
]

export default function ProjectShell() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
      ; (async () => {
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
          <button type="button" className="project-shell__back" onClick={() => navigate('/app')}>
            <img src={reply} alt="Back" className="back-icon" />
          </button>
          <div className="project-shell__brand-text">back</div>
        </div>

        <nav className="project-shell__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === ''}
              className={({ isActive }) =>
                (isActive || location.pathname.endsWith(`/${item.to}`))
                  ? 'project-shell_link'
                  : 'project-not-active'
              }
            >
              <img src={item.icon} alt={item.label} className="project-shell__navIcon" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="project-shell__content">
        <header className="project-shell__header">
          <div className="project-shell__header-main">
            <div>
              <p className="project-shell__header-label">
                {loading ? 'Loading…' : project?.project_name}
              </p>
            </div>
          </div>
          <TopBarActions />
        </header>

        {error && <div className="project-shell__error">{error}</div>}
        {loading ? <div className="project-shell__loading">Loading project…</div> : <Outlet context={{ project }} />}
      </div>
    </div>
  )
}
