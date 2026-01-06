// src/routes/ProtectedGDorDH.jsx
import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedGDorDH() {
  const { isAuthenticated, user } = useContext(AuthContext);

  // not logged in → back to login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // only GD or DH can access these routes
  const role = user?.role?.toUpperCase?.();
  const allowed = role === 'GD' || role === 'DH';
  if (!allowed) return <Navigate to="/app" replace />;

  // ok → render nested routes
  return <Outlet />;
}
