import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../../components/app/Sidebar";
import Header from "../../components/app/Header";

/**
 * Application shell for the user-facing dashboard.
 *
 * This component renders the top navigation (Header) and the main
 * sidebar for all routes under ``/app`` except project‑specific
 * routes. When navigating to project pages (``/app/project/:id``),
 * the sidebar is hidden so that only the project sidebar is
 * displayed. This prevents the UI from showing two sidebars at
 * once.
 */
export default function AppShell() {
  const location = useLocation();
  // Hide the main sidebar for project pages to avoid duplication
  const hideSidebar = location.pathname.startsWith("/app/project/");
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F9FF' }}>
      {!hideSidebar && <Sidebar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />
        {/* Only the main content area should scroll */}
        <div
          style={{
            padding: '18px 36px 36px 36px',
            height: 'calc(100vh - 65px)', // 65px header height
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}