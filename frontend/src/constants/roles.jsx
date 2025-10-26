// src/constants/roles.js
export const Role = {
  ADMIN: "ADMIN",
  GD: "GD",
  DH: "DH",
  TL: "TL",
  SM: "SM",
  OIC: "OIC",
  JRF: "JRF",
  SRF: "SRF",
  CE: "CE",
  STUDENT: "STUDENT",
};

export const AdminOrHead = new Set([Role.ADMIN, Role.GD, Role.DH]); // can manage users
export const HeadOnly = new Set([Role.GD, Role.DH]);                // can create projects & manage members
