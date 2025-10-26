// src/lib/roles.js
export const ROLES = {
  ADMIN: "ADMIN",
  GD: "GD",
  DH: "DH",
  // keep others as strings wherever needed: TL, SM, OIC, JRF, SRF, CE, STUDENT ...
};

export const AdminOnly = new Set([ROLES.ADMIN]);
export const HeadOnly = new Set([ROLES.GD, ROLES.DH]);
export const AdminOrHead = new Set([ROLES.ADMIN, ROLES.GD, ROLES.DH]);
