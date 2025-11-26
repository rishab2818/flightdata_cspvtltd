// src/App.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ProtectedAdmin from './routes/ProtectedAdmin'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'

// User app
import AppShell from './pages/app/AppShell'
import Dashboard from './pages/app/Dashboard'
import MinutesOfTheMeeting from './pages/app/MinutesOfTheMeeting'
import StudentEngagement from './pages/app/StudentEngagement'
import InventoryRecords from './pages/app/InventoryRecords'
import DivisionalRecords from './pages/app/DivisionalRecords'
import CustomerFeedbacks from './pages/app/CustomerFeedbacks'
import TrainingRecords from './pages/app/TrainingRecords'
import TechnicalReports from './pages/app/TechnicalReports'
import Setting from './pages/app/Setting'
import ProtectedGDorDH from './routes/ProtectedGDorDH'
import AdminShell from './pages/admin/AdminShell'
import Settings from './pages/admin/Settings'
import ProjectShell from './pages/app/project/ProjectShell'
import ProjectUpload from './pages/app/project/ProjectUpload'
import ProjectDataManagement from './pages/app/project/ProjectDataManagement'
import ProjectVisualisation from './pages/app/project/ProjectVisualisation'
import ProjectSettings from './pages/app/project/ProjectSettings'
export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedAdmin />}>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* USER APP (Sidebar + Header persist via AppShell) */}
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route element={<ProtectedGDorDH />}> 
        <Route path="minutes" element={<MinutesOfTheMeeting />} />
        <Route path="student-engagement" element={<StudentEngagement />} />
        <Route path="inventory-records" element={<InventoryRecords />} />
        <Route path="divisional-records" element={<DivisionalRecords />} />
        <Route path="customer-feedbacks" element={<CustomerFeedbacks />} />
        <Route path="training-records" element={<TrainingRecords />} />
        <Route path="technical-reports" element={<TechnicalReports />} />
        <Route path="setting" element={<Setting />} />
        </Route>
      </Route>

      <Route element={<ProtectedGDorDH />}>
        <Route path="/app/projects/:projectId/*" element={<ProjectShell />}>
          <Route index element={<ProjectUpload />} />
          <Route path="data" element={<ProjectDataManagement />} />
          <Route path="visualisation" element={<ProjectVisualisation />} />
          <Route path="settings" element={<ProjectSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
