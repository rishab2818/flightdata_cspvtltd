import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import TopBarActions from "./TopBarActions";
import { DEFAULT_PAGE_META, PAGE_META } from "../../constants/navigation";
import "../../styles/layout.css";

export default function Header() {
  const { pathname } = useLocation();

  const normalizedPath =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isDashboard = normalizedPath === "/app" || normalizedPath === "/admin";

  const meta = useMemo(() => PAGE_META[normalizedPath] ?? DEFAULT_PAGE_META, [normalizedPath]);

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
