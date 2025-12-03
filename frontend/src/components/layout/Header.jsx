import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import TopBarActions from "./TopBarActions";
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
    subtitle: "Keep budgets, AMC, and cyber updates aligned with documentation.",
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
  const { pathname } = useLocation();

  const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isDashboard = normalizedPath === "/app" || normalizedPath === "/admin";

  const meta = useMemo(() => {
    const base = pageMeta[normalizedPath] || { title: "Dashboard", subtitle: "" };
    if (normalizedPath === "/app") return { ...base };
    if (normalizedPath === "/admin") return { ...base };
    return base;
  }, [normalizedPath]);

  return (
    <header className={`app-shell__header ${isDashboard ? "app-shell__header--dashboard" : ""}`}>
      <div className="header__titles">
        <h1 className="header__title">{meta.title}</h1>
        {meta.subtitle ? <p className="header__subtitle">{meta.subtitle}</p> : null}
      </div>

      <TopBarActions />
    </header>
  );
}
