import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "./context/auth";

import AppShell from "./layout/AppShell";
import LoginPage from "./pages/LoginPage";

import DashboardPage from "./pages/DashboardPage";
import UserManagementPage from "./pages/UserManagementPage";

import ProjectViewPage from "./pages/project/ProjectViewPage";
import UploadTab from "./pages/project/UploadTab";
import DataManagementTab from "./pages/project/DataManagementTab";
import DataVisTab from "./pages/project/DataVisTab";
import ProjectSettingsTab from "./pages/project/ProjectSettingsTab";

// ---- Roles (keep in sync with backend) ----
const Role = {
  ADMIN: "ADMIN",
  GD: "GD",
  DH: "DH",
  TL: "TL",
  SM: "SM",
  OIC: "OIC",
  JRF: "JRF",
  SRF: "SRF",
  CE: "CE",
  STUDENT: "STUDENT",
};

// Auth gate
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Role gate
function RequireRoles({ allow, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return allow.includes(user.role) ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected shell (must render <Outlet/> inside AppShell) */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            {/* Default dashboard */}
            <Route index element={<DashboardPage />} />

            {/* Admin-only user management */}
            <Route
              path="users"
              element={
                <RequireRoles allow={[Role.ADMIN]}>
                  <UserManagementPage />
                </RequireRoles>
              }
            />

            {/* Project view with nested tabs */}
            <Route path="projects/:projectId" element={<ProjectViewPage />}>
              <Route index element={<UploadTab />} />
              <Route path="data" element={<DataManagementTab />} />
              <Route path="vis" element={<DataVisTab />} />
              <Route path="settings" element={<ProjectSettingsTab />} />
            </Route>

            {/* Fallback inside shell */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>

          {/* Global fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
