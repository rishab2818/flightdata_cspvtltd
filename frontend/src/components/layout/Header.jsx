import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { MdKeyboardArrowDown } from "react-icons/md";
import "../../styles/layout.css";

const pageTitles = {
  "/app": "Dashboard Overview",
  "/app/minutes": "Minutes of meeting",
  "/app/student-engagement": "Student Engagement",
  "/app/inventory-records": "Inventory records",
  "/app/divisional-records": "Divisional Records",
  "/app/customer-feedbacks": "Customer Feedbacks",
  "/app/training-records": "Training Records",
  "/app/technical-reports": "Technical Reports",
  "/app/setting": "Settings",
  "/admin": "Dashboard",
  "/admin/users": "User Management",
  "/admin/settings": "Settings",
};

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isDashboard = normalizedPath === "/app" || normalizedPath === "/admin";

  const homePath = useMemo(() => (user?.role?.toUpperCase?.() === "ADMIN" ? "/admin" : "/app"), [user]);

  const userId = user?.email || user?.username || user?.name || "User";
  const roleLabel = user?.role || "";

  const pageTitle = pageTitles[normalizedPath] || "Dashboard";
  const headerTitle = isDashboard ? "Welcome!" : pageTitle;
  const subTitle = isDashboard ? userId : "";

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
    <header className="app-shell__header">
      <div>
        <button className="header__home" type="button" onClick={() => navigate(homePath)}>
          Dashboard
        </button>
      </div>

      <div className="header__titles">
        <h1 className="header__title">{headerTitle}</h1>
        {subTitle ? <p className="header__subtitle">{subTitle}</p> : null}
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
