// src/App.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import ProtectedAdmin from './routes/ProtectedAdmin'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import "./styles/common.css";


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
import DigitalLibrary from './pages/app/DigitalLibrary'
import BudgetEstimation from './pages/app/budget/BudgetEstimation'
import ProtectedGDorDH from './routes/ProtectedGDorDH'
import AdminShell from './pages/admin/AdminShell'
import Settings from './pages/admin/Settings'
import ProjectShell from './pages/app/project/ProjectShell'
// import ProjectUpload from './pages/app/project/ProjectUpload'
import ProjectOverview from './pages/app/project/project overview/ProjectOverview'
import ProjectVisualisation from './pages/app/project/ProjectVisualisation'
import ProjectSettings from './pages/app/project/ProjectSettings'
import ProjectTagView from './pages/app/project/ProjectTagView'
import ProcessedPreviewPage from './pages/app/project/ProcessedPreviewPage'
import RawPreviewPage from './pages/app/project/RawPreviewPage'
import ProjectVisualisationFullScreen from './pages/app/project/ProjectVisualisationFullScreen'
export default function App() {
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
          <Route path="budget-estimation" element={<BudgetEstimation />} />
          <Route path="divisional-records" element={<DivisionalRecords />} />
          <Route path="customer-feedbacks" element={<CustomerFeedbacks />} />
          <Route path="training-records" element={<TrainingRecords />} />
          <Route path="technical-reports" element={<TechnicalReports />} />
          <Route path="digital-library" element={<DigitalLibrary />} />
          <Route path="setting" element={<Setting />} />
        </Route>
      </Route>

      <Route element={<ProtectedGDorDH />}>
        <Route path="/app/projects/:projectId/*" element={<ProjectShell />}>

          <Route path="data" element={<ProjectOverview />} />
          <Route index element={<ProjectOverview />} />
          <Route path="visualisation" element={<ProjectVisualisation />} />
          <Route path="report" element={<TechnicalReports />} />
          <Route path="digital" element={<DigitalLibrary />} />
          <Route path="settings" element={<ProjectSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
      <Route
        path="/projects/:projectId/data/:datasetType/:tagName"
        element={<ProjectTagView />}
      />
      <Route path="/processed-preview/:jobId" element={<ProcessedPreviewPage />} />
      <Route path="/raw-preview/:jobId" element={<RawPreviewPage />} />
      <Route
        path="/app/projects/:projectId/visualisation/full/:vizId"
        element={<ProjectVisualisationFullScreen />}
      />



    </Routes>
  )
}
