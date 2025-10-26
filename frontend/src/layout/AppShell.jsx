// src/layout/AppShell.jsx
import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth";

export default function AppShell() {
  const { user, logout } = useAuth();

  const role = user?.role || "";
  const isAdmin = role === "ADMIN";
  const isHead = role === "GD" || role === "DH";

  // Active link styling
  const linkCls = ({ isActive }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
      isActive ? "bg-blue-50 text-[#1976d2]" : "hover:bg-gray-50"
    }`;

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <ellipse cx="12" cy="6" rx="7" ry="3" fill="#1976d2" opacity="0.2" />
                <ellipse cx="12" cy="10" rx="7" ry="3" fill="#1976d2" opacity="0.35" />
                <ellipse cx="12" cy="14" rx="7" ry="3" fill="#1976d2" />
              </svg>
            </div>
            <div className="font-medium text-gray-800">Data Visualisation</div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {user?.username} <span className="text-gray-400">•</span> {role}
            </span>
            <button
              onClick={logout}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="rounded-xl bg-white border p-3 space-y-1">
            <NavLink to="/" end className={linkCls}>
              <span>Dashboard</span>
            </NavLink>

            {/* Admin-only: User Management */}
            {isAdmin && (
              <NavLink to="/users" className={linkCls}>
                <span>User Management</span>
              </NavLink>
            )}

            {/* Settings (only keep this if you have a route for it) */}
            <NavLink to="/settings" className={linkCls}>
              <span>Settings</span>
            </NavLink>
          </nav>
        </aside>

        {/* Main content */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
