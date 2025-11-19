// Sidebar for project‑specific pages.
//
// Provides navigation links to Data Injection, Plotting and Settings
// sections within a project. Highlights the active link based on the
// current URL. Uses global colour and spacing constants to match
// the existing application theme.

import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { FiUploadCloud, FiBarChart2, FiSettings } from 'react-icons/fi';
import { COLORS, SPACING } from '../../../styles/constants';

export default function ProjectSidebar() {
  const { projectId } = useParams();
  const items = [
    { name: 'Data Injection', icon: FiUploadCloud, path: 'data-injection' },
    { name: 'Plotting', icon: FiBarChart2, path: 'plotting' },
    { name: 'Settings', icon: FiSettings, path: 'settings' },
  ];
  return (
    <div
      style={{
        width: 200,
        background: COLORS.background,
        borderRight: `1px solid ${COLORS.border}`,
        padding: SPACING.lg,
      }}
    >
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        {items.map(({ name, icon: Icon, path }) => (
          <li key={path}>
            <NavLink
              to={`/app/project/${projectId}/${path}`}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                padding: `${SPACING.sm}px ${SPACING.md}px`,
                borderRadius: 4,
                textDecoration: 'none',
                color: isActive ? COLORS.primary : COLORS.textPrimary,
                background: isActive ? COLORS.mutedBackground : 'transparent',
              })}
            >
              <Icon size={18} /> <span>{name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}