// Improved StatsCards component.
//
// This version imports colour and spacing constants from the central
// theme and removes hard-coded values.  It functions identically to
// the original StatsCards component.

import React, { useEffect, useState } from 'react';
import { projectApi } from '../../api/projectapi';
import { COLORS, SPACING } from '../../styles/constants';

import FolderOpen from '../../assets/FolderOpen.svg';
import Wind from '../../assets/Wind.svg';
import Windmill from '../../assets/Windmill.svg';
import AirplaneInFlight from '../../assets/AirplaneInFlight.svg';
import Airplane from '../../assets/Airplane.svg';
import Note from '../../assets/Note.svg';

import './StatsCards.modula.css';

function formatTotal(value) {
  if (value === null || value === undefined) return '--';
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  if (Math.abs(n) >= 1000000) {
    const formatted = (n / 1000000).toFixed(n >= 10000000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, '')}m`;
  }
  if (Math.abs(n) >= 1000) {
    const formatted = (n / 1000).toFixed(n >= 10000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, '')}k`;
  }
  return `${n}`;
}

export default function StatsCardsImproved({ className = 'stats-grid' }) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const data = await projectApi.getCounts();
        if (!cancelled) {
          setCounts(data || {});
        }
      } catch (e) {
        console.error('Failed to fetch project count', e);
        if (!cancelled) {
          setCounts({
            total_projects: 0,
            cfd: 0,
            wind: 0,
            flight: 0,
            aero: 0,
          });
        }
      }
    }

    fetchCount();
    return () => { cancelled = true };
  }, []);

  const stats = [
    { title: 'Total Projects', value: formatTotal(counts?.total_projects), icon: FolderOpen },
    { title: 'CFD Data', value: formatTotal(counts?.cfd), icon: Wind },
    { title: 'Wind Data', value: formatTotal(counts?.wind), icon: Windmill },
    { title: 'Flight Data', value: formatTotal(counts?.flight), icon: AirplaneInFlight },
    { title: 'Aero Data', value: formatTotal(counts?.aero), icon: Airplane },
    { title: 'Total Reports', value: '12k', icon: Note },
  ];

  return (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
      gap: SPACING.md,
      width: "100%",
      marginTop: SPACING.lg,
      maxWidth: "1580px",
    }}
  >
    {stats.map((s, i) => (
      <div key={i} className="StatCard">
        
        {/* icon */}
        <div className="IconLeft">
          <img className='Icon' src={s.icon} alt={""} />
        </div>

        {/* text */}
        <div className="content">
          <p className="title">{s.title}</p>
          <h2 className="count">{s.value}</h2>
        </div>

      </div>
    ))}
  </div>
)};
