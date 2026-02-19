import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from '../../../api/projectapi'
import TopBarActions from '../../../components/layout/TopBarActions'
import '../../../styles/project.css'

import Database2 from "../../../assets/Database2.svg";
import GearFine from "../../../assets/GearFine.svg";

import chartLine from "../../../assets/ChartLine.svg";
import ArrowLeft from "../../../assets/ArrowLeft.svg";
import studentIcon from "../../../assets/UsersThree.svg";
import inventoryIcon from "../../../assets/Truck.svg";
import minutesIcon from "../../../assets/PresentationChart.svg";
import divisionalIcon from "../../../assets/Newspaper1.svg";
import customerIcon from "../../../assets/customer.svg";
import trainingIcon from "../../../assets/reports.svg";

const navItems = [
  { key: 'overview', to: '', label: 'Project Overview', icon: Database2 },
  { key: 'visualisation', to: 'visualisation', label: 'Visualize', icon: chartLine },
   { key: 'meeting', to: 'meeting', label: 'Minutes Of The Meeting', icon: minutesIcon },
  { key: 'report', to: 'report', label: 'Technical Reports', icon: Report2 },
  { key: 'digital', to: 'digital', label: 'Digital Library', icon: digital },
  { key: 'student', to: 'student', label: 'Student Engagement', icon: studentIcon },
  { key: 'procurement', to: 'procurement', label: 'Procurement Reports', icon: inventoryIcon  },
  { key: 'divisional', to: 'divisional', label: 'Divisional Records', icon: divisionalIcon },
  { key: 'feedback', to: 'feedback', label: 'Customer Feedbacks', icon: customerIcon },
  { key: 'training', to: 'training', label: 'Training Records', icon: trainingIcon },
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
            <img src={ArrowLeft} alt="Back" className="back-icon" />
          </button>
          <div className="project-shell__brand-text">Back</div>
        </div>

         <div class="full-width-line"></div>

        <nav className="project-shell__nav1">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === ''}
              className={({ isActive }) =>
                (isActive || location.pathname.endsWith(`/${item.to}`))
                  ? 'project-shell__nav1-link'
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
