// src/routes/ProtectedAdmin.jsx
import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedAdmin() {
  const { isAuthenticated, user } = useContext(AuthContext);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/app" replace />;
  return <Outlet />;
}
