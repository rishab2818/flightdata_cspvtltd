import React, { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FiHelpCircle } from "react-icons/fi";
import { projectApi } from '../../../api/projectapi'
import TopBarActions from '../../../components/layout/TopBarActions'
import ProjectSearchButton from '../../../projectSearch/components/ProjectSearchButton'
import ProjectHelpModal from './ProjectHelpModal'
import '../../../styles/project.css'

import Database2 from "../../../assets/Database2.svg";
import GearFine from "../../../assets/GearFine.svg";
import chartLine from "../../../assets/ChartLine.svg";
import ArrowLeft from "../../../assets/ArrowLeft.svg";
import studentIcon from "../../../assets/UsersThree.svg";
import inventoryIcon from "../../../assets/FileText.svg";
import minutesIcon from "../../../assets/PresentationChart.svg";
import divisionalIcon from "../../../assets/Newspaper1.svg";
import customerIcon from "../../../assets/customer.svg";
import trainingIcon from "../../../assets/reports.svg";
import Report2 from "../../../assets/Report2.svg";
import digital from "../../../assets/digital.svg";

const navItems = [
  { key: "overview", to: "", label: "Project Overview", icon: Database2 },
  { key: "visualisation", to: "visualisation", label: "Visualize", icon: chartLine },
  { key: "meeting", to: "meeting", label: "Minutes Of The Meeting", icon: minutesIcon },
  { key: "report", to: "report", label: "Technical Reports", icon: Report2 },
  { key: "digital", to: "digital", label: "Digital Library", icon: digital },
  { key: "student", to: "student", label: "Student Engagement", icon: studentIcon },
  { key: "procurement", to: "procurement", label: "Procurement Reports", icon: inventoryIcon },
  { key: "divisional", to: "divisional", label: "Divisional Records", icon: divisionalIcon },
  { key: "feedback", to: "feedback", label: "Customer Feedbacks", icon: customerIcon },
  { key: "training", to: "training", label: "Training Records", icon: trainingIcon },
  { key: "settings", to: "settings", label: "Settings", icon: GearFine },
];

// small debounce hook
function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function ProjectShell() {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // search
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 350);

  // keep this because your outside click effect uses it
  const [searchOpen, setSearchOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const searchWrapRef = useRef(null);

  const refreshProject = async () => {
    const data = await projectApi.getById(projectId);
    setProject(data);
    setError(null);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await projectApi.getById(projectId);
        if (mounted) {
          setProject(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError(err?.response?.data?.detail || err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    const onDown = (e) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const openFile = (file) => {
    if (!file) return;

    if (file.download_url) {
      window.open(file.download_url, "_blank", "noopener,noreferrer");
    } else {
      console.warn("No download_url found for file:", file);
    }

    setSearchOpen(false);
  };

  return (
    <div className="project-shell">
      <aside className="project-shell__sidebar">
        <div className="project-shell__brand">
          <button type="button" className="project-shell__back" onClick={() => navigate("/app")}>
            <img src={ArrowLeft} alt="Back" className="back-icon" />
          </button>
          <div className="project-shell__brand-text">Back</div>
        </div>

        <div className="full-width-line"></div>

        <nav className="project-shell__nav1">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === ""}
              className={({ isActive }) =>
                isActive || location.pathname.endsWith(`/${item.to}`)
                  ? "project-shell__nav1-link"
                  : "project-not-active"
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
            <div className="project-shell__title-area">
              <p className="project-shell__header-label">
                {loading ? "Loading…" : project?.project_name}
              </p>
            </div>
          </div>

          <div className="project-shell__header-right">
            <ProjectSearchButton projectId={projectId} />

            <button
              type="button"
              className="project-shell__help-btn"
              onClick={() => setShowHelpModal(true)}
              title="Help"
            >
              <FiHelpCircle size={26} />
             
            </button>

            <TopBarActions />
          </div>
        </header>

        {error && <div className="project-shell__error">{error}</div>}
        {loading ? (
          <div className="project-shell__loading">Loading project…</div>
        ) : (
          <Outlet context={{ project, refreshProject }} />
        )}
      </div>

      <ProjectHelpModal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
}
