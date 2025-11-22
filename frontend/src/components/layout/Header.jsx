import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { MdKeyboardArrowDown } from "react-icons/md";
import "../../styles/layout.css";

const pageMeta = {
  "/app": { title: "Welcome!", subtitle: "" },
  "/app/minutes": {
    title: "Minutes of the Meeting",
    subtitle: "Upload, manage, and track meeting minutes with task assignments",
  },
  "/app/student-engagement": {
    title: "Student Engagement",
    subtitle: "Description here",
  },
  "/app/inventory-records": {
    title: "Inventory Records",
    subtitle: "Description here",
  },
  "/app/divisional-records": {
    title: "Divisional Records",
    subtitle: "Description here",
  },
  "/app/customer-feedbacks": {
    title: "Customer Feedbacks Overview",
    subtitle: "Description here",
  },
  "/app/training-records": {
    title: "Training Records",
    subtitle: "Description here",
  },
  "/app/technical-reports": {
    title: "Technical & Design Reports",
    subtitle: "Manage your technical and design documentation",
  },
  "/app/setting": { title: "Settings", subtitle: "" },
  "/admin": { title: "Dashboard", subtitle: "Admin" },
  "/admin/users": { title: "User Management", subtitle: "" },
  "/admin/settings": { title: "Settings", subtitle: "" },
};

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isDashboard = normalizedPath === "/app" || normalizedPath === "/admin";

  const userId = user?.email || user?.username || user?.name || "User";
  const roleLabel = user?.role || "";

  const meta = useMemo(() => {
    const base = pageMeta[normalizedPath] || { title: "Dashboard", subtitle: "" };
    if (normalizedPath === "/app") return { ...base, subtitle: userId };
    if (normalizedPath === "/admin") return { ...base, subtitle: roleLabel };
    return base;
  }, [normalizedPath, roleLabel, userId]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className={`app-shell__header ${isDashboard ? "app-shell__header--dashboard" : ""}`}>
      <div className="header__titles">
        <h1 className="header__title">{meta.title}</h1>
        {meta.subtitle ? <p className="header__subtitle">{meta.subtitle}</p> : null}
      </div>

      <div className="header__actions" ref={menuRef}>
        <div className="header__profile">
          <div className="header__avatar" aria-hidden />
          <div className="header__info">
            <span className="header__name">{userId}</span>
            <span className="header__role">{roleLabel}</span>
          </div>
          <button
            type="button"
            className="header__toggle"
            aria-label="Open user menu"
            onClick={() => setOpen((v) => !v)}
          >
            <MdKeyboardArrowDown size={22} />
          </button>
        </div>

        {open && (
          <div className="header__menu">
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
