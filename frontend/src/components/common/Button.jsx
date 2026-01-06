// A reusable button component.
//
// This component centralizes the common button styles used across the
// application.  Consumers can specify a ``variant`` (e.g. ``primary``
// or ``secondary``) to obtain appropriate colours, and can override
// individual style properties via the ``style`` prop without losing
// the sensible defaults.  Additional variants can be added to the
// ``variants`` object as needed.

import React from 'react';
import { COLORS, SPACING } from '../../styles/constants';

export default function Button({
  children,
  variant = 'primary',
  style = {},
  disabled = false,
  ...props
}) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: `${SPACING.md}px ${SPACING.lg}px`,
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
    fontWeight: 500,
    opacity: disabled ? 0.7 : 1,
    border: 'none',
  };
  const variants = {
    primary: {
      background: COLORS.primary,
      color: '#ffffff',
    },
    secondary: {
      background: COLORS.background,
      color: COLORS.textPrimary,
      border: `1px solid ${COLORS.textPrimary}`,
    },
  };
  const variantStyle = variants[variant] || variants.primary;
  return (
    <button
      style={{ ...baseStyle, ...variantStyle, ...style }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}