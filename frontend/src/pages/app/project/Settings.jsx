// Placeholder Settings page for project-specific configuration.

import React from 'react';
import { COLORS, SPACING } from '../../../styles/constants';

export default function Settings() {
  return (
    <div style={{ padding: SPACING.lg }}>
      <h2 style={{ color: COLORS.textPrimary, margin: 0 }}>Settings</h2>
      <p style={{ color: COLORS.textSecondary }}>
        Settings for this project will be available soon. You will be able to manage
        access permissions and other configuration here.
      </p>
    </div>
  );
}