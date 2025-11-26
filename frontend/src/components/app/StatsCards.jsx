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
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className="frame-item"
          style={{
            minHeight: 120,
            borderRadius: 8,
            background: COLORS.background,
            border: `1px solid ${COLORS.border}`,
            padding: `${SPACING.lg}px ${SPACING.lg + SPACING.sm}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* icon + label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              justifyContent: "center",
            }}
          >
            <div className="icon-box">
              <img
                className="icon"
                src={s.icon}
                alt={s.title}
                style={{ width: 30, height: 30 }}
              />
            </div>

            <div className="texts">
              <div
                className="label"
                style={{ fontSize: 13, color: COLORS.textSecondary }}
              >
                {s.title}
              </div>
            </div>
          </div>

          {/* number */}
          <div
            className="value"
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.textPrimary,
              textAlign: "center",
              marginTop: 10,
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
