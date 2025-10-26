// src/context/auth.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../lib/api";
import { loadToken, saveToken, clearToken, saveUser, loadUser, clearUser } from "../lib/storage";

// ---- Roles (keep strings exactly as backend emits) ----
export const Role = {
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

// Small helpers
export const isAdmin = (role) => role === Role.ADMIN;
export const isHead = (role) => role === Role.GD || role === Role.DH;
const canSeeStats = (role) => isAdmin(role) || isHead(role);
// Your Dashboard wants this explicit flag:
const canCreateProject = (role) => isHead(role); // GD/DH only

// -------------- Context --------------
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadUser());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // On first load: if token present but no user cached, force logout-safe state
  useEffect(() => {
    if (loadToken() && !user) {
      clearToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  const login = async (username, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await authApi.login(username, password);
      // Backend returns: { access_token, username, role, access_level_value, email? }
      const token = res?.access_token;
      if (!token) throw new Error("No token from server");
      saveToken(token);

      const nextUser = {
        username: res.username,
        role: res.role,
        email: res.email ?? null,
        access_level_value: res.access_level_value ?? 99,
      };
      setUser(nextUser);
      saveUser(nextUser);
      return nextUser;
    } catch (e) {
      clearToken();
      clearUser();
      setUser(null);
      setAuthError(e?.message || "Login failed");
      throw e;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    clearUser();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      authLoading,
      authError,
      login,
      logout,

      // role helpers for UI gating
      isAdmin: user ? isAdmin(user.role) : false,
      isHead: user ? isHead(user.role) : false,
      canSeeStats: user ? canSeeStats(user.role) : false,
      // ➜ Needed by DashboardPage for “+ New Project”
      canCreateProject: user ? canCreateProject(user.role) : false,
    }),
    [user, authLoading, authError]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

// -------------- Role Gate Components --------------
// Usage:
// <AdminOnly><CreateUserPanel/></AdminOnly>
// <HeadOnly fallback={null}><NewProjectButton/></HeadOnly>

export function AdminOnly({ children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;
  return isAdmin(user.role) ? children : fallback;
}

export function HeadOnly({ children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;
  return isHead(user.role) ? children : fallback;
}

export function AdminOrHead({ children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;
  return (isAdmin(user.role) || isHead(user.role)) ? children : fallback;
}

export function NotAdmin({ children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;
  return !isAdmin(user.role) ? children : fallback;
}

// Generic roles gate
export function WithRoles({ allow = [], children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;
  return allow.includes(user.role) ? children : fallback;
}
