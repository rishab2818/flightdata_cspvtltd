// Placeholder Plotting page.

import React from 'react';
import { COLORS, SPACING } from '../../../styles/constants';

export default function Plotting() {
  return (
    <div style={{ padding: SPACING.lg }}>
      <h2 style={{ color: COLORS.textPrimary, margin: 0 }}>Plotting</h2>
      <p style={{ color: COLORS.textSecondary }}>
        Plotting functionality will be added in a future release. Here you will be able
        to create cross plots and charts from uploaded flight data.
      </p>
    </div>
  );
}