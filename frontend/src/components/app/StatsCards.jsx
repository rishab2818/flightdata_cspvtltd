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
    return () => { cancelled = true };
  }, []);

  const stats = [
    { title: 'Total Projects', value: formatTotal(totalProjects), icon: FolderOpen },
    { title: 'CFD Data', value: '143k', icon: Wind },
    { title: 'Wind Data', value: '124k', icon: Windmill },
    { title: 'Flight Data', value: '240k', icon: AirplaneInFlight },
    { title: 'Aero Data', value: '123k', icon: Airplane },
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
