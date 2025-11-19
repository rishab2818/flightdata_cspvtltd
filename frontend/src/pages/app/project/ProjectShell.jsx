// ProjectShell layout for project‑specific pages.
//
// This component provides a sidebar for navigating between Data
// Injection, Plotting and Settings pages within the context of a
// project. It renders an Outlet for the active child route. Use this
// component as the element for the `/app/project/:projectId/*` route.

import React from 'react';
import { Outlet } from 'react-router-dom';
import ProjectSidebar from './ProjectSidebar';
import { SPACING } from '../../../styles/constants';

export default function ProjectShell() {
  return (
    <div style={{ display: 'flex' }}>
      <ProjectSidebar />
      <div style={{ flex: 1, padding: SPACING.lg, overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
}