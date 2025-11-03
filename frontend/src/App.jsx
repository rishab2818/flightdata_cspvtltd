import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ProtectedAdmin from './routes/ProtectedAdmin';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
const Placeholder = ({ title }) => <div style={{padding:24}}><h2>{title}</h2></div>

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
        <Route element={<ProtectedAdmin />}>
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/admin/users" element={<UserManagement />} />
    {/* optional: <Route path="/admin/settings" element={<Settings />} /> */}
    </Route>
      <Route path="/app" element={<Placeholder title="User App (stub)" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
