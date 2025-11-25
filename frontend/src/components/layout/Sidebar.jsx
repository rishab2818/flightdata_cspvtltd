import React, { useContext, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import brandIcon from "../../assets/Database.svg";
import dashboardIcon from "../../assets/Dashboard.svg";
import minutesIcon from "../../assets/PresentationChart.svg";
import studentIcon from "../../assets/UsersThree.svg";
import inventoryIcon from "../../assets/inventory.svg";
import divisionalIcon from "../../assets/divisonal.svg";
import customerIcon from "../../assets/customer.svg";
import trainingIcon from "../../assets/reports.svg";
import technicalIcon from "../../assets/reports.svg";
import settingsIcon from "../../assets/GearFine.svg";
import usersIcon from "../../assets/UsersThree.svg";
import "../../styles/layout.css";

const adminMenu = [
  { path: "/admin", label: "Dashboard", icon: dashboardIcon, end: true },
  { path: "/admin/users", label: "User Management", icon: usersIcon },
  { path: "/admin/settings", label: "Settings", icon: settingsIcon },
];

const gdDhMenu = [
  { path: "/app", label: "Dashboard Overview", icon: dashboardIcon, end: true },
  { path: "/app/minutes", label: "Minutes of meeting", icon: minutesIcon },
  { path: "/app/student-engagement", label: "Student Engagement", icon: studentIcon },
  { path: "/app/inventory-records", label: "Inventory records", icon: inventoryIcon },
  { path: "/app/divisional-records", label: "Divisional Records", icon: divisionalIcon },
  { path: "/app/customer-feedbacks", label: "Customer Feedbacks", icon: customerIcon },
  { path: "/app/training-records", label: "Training Records", icon: trainingIcon },
  { path: "/app/technical-reports", label: "Technical Reports", icon: technicalIcon },
  { path: "/app/setting", label: "Settings", icon: settingsIcon },
];

export default function Sidebar() {
  const { user } = useContext(AuthContext);
  const { pathname } = useLocation();
  const role = user?.role?.toUpperCase?.();

  const items = useMemo(() => {
    if (role === "ADMIN") return adminMenu;
    if (role === "GD" || role === "DH") return gdDhMenu;
    return [];
  }, [role]);

  return (
    <aside className="app-shell__sidebar">
      <div className="sidebar__brand">
        <img src={brandIcon} alt="Brand" />
        <span>Data Visualisation</span>
      </div>

      {items.length === 0 ? (
        <div className="sidebar__empty">No navigation available</div>
      ) : (
        <ul className="sidebar__menu">
          {items.map((item) => (
            <li key={item.path} className="sidebar__item">
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "sidebar__link",
                    isActive || (!item.end && pathname.startsWith(item.path))
                      ? "sidebar__link--active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <img src={item.icon} alt="" className="sidebar__icon" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
