// Improved ProjectCard component.
//
// This version of the ProjectCard imports colour constants from the
// global theme instead of hard-coding them.  It retains the same
// layout and functionality as the original component.

import React from 'react';
import { FiCalendar, FiUser, FiEye } from 'react-icons/fi';
import { COLORS, SPACING } from '../../styles/constants';
import Button from '../common/Button';
import Airplane from '../../assets/Airplane.svg';
import Windmill from '../../assets/Windmill.svg';
import Wind from '../../assets/Wind.svg';
import SeeMoreText from '../common/SeeMoreButton';


const TYPE_ICONS = {
  "Aero Data": Airplane,
  "Wind Data": Windmill,
  "CFD": Wind,
};

export default function ProjectCardImproved({ name, type, date, members, desc, onView }) {
  return (
    <div
      style={{
        width: '100%',
        minHeight: 215,
        // gap: '6px',
        borderTop: `1px solid ${COLORS.border}`,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.background,
        padding: `25px 0px 25px 0px `,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* title + chips */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: "12px" }}>
          <h3
            style={{ fontSize: 16, fontWeight: 600, color: "#000000", margin: 0, fontFamily: "inter-semi-bold, Helvetica" }}
          >
            {name}
          </h3>
          {/* <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: 999,
              background: "#fff",
              border: `1px solid ${COLORS.border}`,
              fontSize: 14,
              color: COLORS.textSecondary,
            }}
          >
            <img
    src={TYPE_ICONS[type]}
    alt={type}
    style={{ width: 16, height: 16, objectFit: "contain" }}
  />
            {type}
          </div> */}

          <span
            style={{
              padding: `${SPACING.sm}px ${SPACING.md}px`,
              borderRadius: 999,
              background: "#DEFFF0",
              color: COLORS.successText,
              fontSize: 14,
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
  fontSize: "12px",
  fontWeight: 400,
  color: "#514F4F",
  fontFamily: "SF Pro, Helvetica, Arial, sans-serif",
  letterSpacing: "0px",
  lineHeight: "normal",   
  flexGrow: 1,
  marginTop:"10px",
}}

      >
       <SeeMoreText text={desc} />

      </p>
      {/* bottom row: created + members + button all in one line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          // marginTop: SPACING.md,
          fontSize: 14,
          color: COLORS.textMuted,
        }}
      >
        {/* created + members group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg + SPACING.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: "#000000" }}>
            {/* <FiCalendar size={24} /> */}
            {/* <div>
              <div style={{ fontSize: 14, color: "#737373" }}>Created</div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: "#000000", marginTop: 2, fontFamily: "inter-semi-bold, Helvetica" }}
              >
                {date}
              </div>
            </div> */}
            <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  }}
>
  <span style={{fontSize:14, color: "#737373" }}>Created</span>
  <span
    style={{
      fontWeight: 600,
      color: "#000000",
      fontFamily: "inter-semi-bold, Helvetica",
    }}
  >
    {date}
  </span>
</div>

          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: "#000000" }}>
            {/* <FiUser size={24} /> */}
            <div
              style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  }}
            >
              <span style={{ fontSize: 14, color: "#737373" }}>Members</span>
              <span
                style={{ fontSize: 14, fontWeight: 600, color: "#000000", marginTop: 2, fontFamily: "inter-semi-bold, Helvetica" }}
              >
                {String(members).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
        {/* view project button */}
        <Button variant="secondary" style={{ width: 160, height: 44, padding: `${SPACING.sm}px ${SPACING.md}px`, borderRadius: 8, color: "#000000", fontFamily: "inter-semi-bold, Helvetica", fontSize: 16 }} onClick={onView}>
          <FiEye size={24} /> <span>View Project</span>
        </Button>
      </div>
    </div>
  );
}