// Improved StatsCards component.
//
// This version imports colour and spacing constants from the central
// theme and removes hard-coded values.  It functions identically to
// the original StatsCards component.

import React, { useEffect, useState } from 'react';
import { projectApi } from '../../api/projectapi';
import { COLORS, SPACING } from '../../styles/constants';

// format like "03", "12", etc.
function formatTotal(value) {
  if (value === null || value === undefined) return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return n.toString().padStart(2, '0');
}

export default function StatsCardsImproved({ className = 'stats-grid' }) {
  const [totalProjects, setTotalProjects] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const data = await projectApi.getCounts();
        if (!cancelled) {
          setTotalProjects(data?.total ?? 0);
        }
      } catch (e) {
        console.error('Failed to fetch project count', e);
        if (!cancelled) {
          setTotalProjects(0);
        }
      }
    }
    fetchCount();
    return () => {
      cancelled = true;
    };
  }, []);
  const stats = [
    { title: 'Total Projects', value: formatTotal(totalProjects) },
    { title: 'CFD Data', value: '143k' },
    { title: 'Wind Data', value: '124k' },
    { title: 'Flight Data', value: '240k' },
    { title: 'Aero Data', value: '123k' },
    { title: 'Total Reports', value: '12k' },
  ];
  return (
    <div className={className}>
      {stats.map((s, i) => (
        <div
          key={i}
          style={{
            minHeight: 120,
            borderRadius: 8,
            background: COLORS.background,
            border: `1px solid ${COLORS.border}`,
            padding: `${SPACING.lg}px ${SPACING.lg + SPACING.sm}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{s.title}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.textPrimary }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}
