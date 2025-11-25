import React from "react";
import { Outlet } from "react-router-dom";
import Shell from "../../components/layout/Shell";

export default function AdminShell() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
