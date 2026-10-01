import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// Maps each app role to its role-specific help guide folder under public/help-guides.
const ROLE_GUIDE_MAP = {
  ADMIN: "admin",
  GD: "gd-dh",
  DH: "gd-dh",
  TL: "tl-sm-oic",
  SM: "tl-sm-oic",
  OIC: "tl-sm-oic",
  JRF: "jrf-srf-ce-student",
  SRF: "jrf-srf-ce-student",
  CE: "jrf-srf-ce-student",
  STUDENT: "jrf-srf-ce-student",
};

const DEFAULT_GUIDE = "jrf-srf-ce-student";

export function useHelpGuideUrl() {
  const { user } = useContext(AuthContext) || {};
  const guideFolder = ROLE_GUIDE_MAP[user?.role] || DEFAULT_GUIDE;
  return `/help-guides/${guideFolder}/index.html`;
}

export function openHelpGuide(guideUrl) {
  window.open(guideUrl, "_blank", "noopener,noreferrer");
}