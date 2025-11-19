// Global style constants
// ----------------------
//
// To avoid duplicating magic strings throughout the frontend, all
// commonly used colours, spacings and other design tokens should be
// defined here.  Components can import the constants from this module
// and reference them in inline styles or styled-components.  Should
// the design ever need to change, updating values here will reflect
// across the entire UI without having to hunt for hard-coded values.

export const COLORS = {
  primary: '#1976D2',          // primary action colour used on buttons
  border: '#0000001A',          // light border colour (10% black)
  textPrimary: '#0f172a',       // primary text colour
  textSecondary: '#334155',     // secondary text colour
  textMuted: '#64748b',         // muted/tertiary text
  background: '#ffffff',        // card and modal backgrounds
  mutedBackground: '#F1F5F9',   // subtle background for chips
  successBackground: '#E7F4E8', // success/active state background
  successText: '#1E8E3E',       // success/active state text
};

export const SPACING = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 18,
  xl: 24,
};

// You can extend this object with additional tokens, such as font
// sizes, radii or shadows, as the design system evolves.