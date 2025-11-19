// Improved ProjectCard component.
//
// This version of the ProjectCard imports colour constants from the
// global theme instead of hard-coding them.  It retains the same
// layout and functionality as the original component.

import React from 'react';
import { FiCalendar, FiUser, FiEye } from 'react-icons/fi';
import { COLORS, SPACING } from '../../styles/constants';
import Button from '../common/Button';

export default function ProjectCardImproved({ name, type, date, members, desc }) {
  return (
    <div
      style={{
        width: 573,
        height: 215,
        gap: SPACING.md,
        borderRadius: 8,
        background: COLORS.background,
        border: `1px solid ${COLORS.border}`,
        padding: `${SPACING.lg + SPACING.md}px ${SPACING.lg}px`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* title + chips */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <h3
            style={{ fontSize: 16, fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}
          >
            {name}
          </h3>
          <span
            style={{
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: 999,
              background: COLORS.mutedBackground,
              color: COLORS.textSecondary,
              fontSize: 12,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {type}
          </span>
          <span
            style={{
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: 999,
              background: COLORS.successBackground,
              color: COLORS.successText,
              fontSize: 12,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            Active
          </span>
        </div>
      </div>
      {/* description */}
      <p
        style={{
          fontSize: 13,
          color: COLORS.textSecondary,
          marginTop: SPACING.sm,
          marginRight: SPACING.lg,
          lineHeight: 1.5,
          flexGrow: 1,
        }}
      >
        {desc}
      </p>
      {/* bottom row: created + members + button all in one line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: SPACING.md,
          fontSize: 14,
          color: COLORS.textMuted,
        }}
      >
        {/* created + members group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg + SPACING.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            <FiCalendar size={16} />
            <div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>Created</div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginTop: 2 }}
              >
                {date}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            <FiUser size={16} />
            <div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>Members</div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginTop: 2 }}
              >
                {String(members).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>
        {/* view project button */}
        <Button variant="secondary" style={{ padding: `${SPACING.sm}px ${SPACING.md}px`, borderRadius: 999 }}>
          <FiEye size={16} /> <span>View Project</span>
        </Button>
      </div>
    </div>
  );
}