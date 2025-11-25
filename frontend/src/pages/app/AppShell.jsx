import React from "react";
import { Outlet } from "react-router-dom";
import Shell from "../../components/layout/Shell";

export default function AppShell() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
