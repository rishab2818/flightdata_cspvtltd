import React, { useContext, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import brandIcon from "../../assets/Database.svg";
import { ROLE_MENUS } from "../../constants/navigation";
import "../../styles/layout.css";

export default function Sidebar() {
  const { user } = useContext(AuthContext);
  const { pathname } = useLocation();
  const role = user?.role?.toUpperCase?.();

  const items = useMemo(() => ROLE_MENUS[role] ?? [], [role]);

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
