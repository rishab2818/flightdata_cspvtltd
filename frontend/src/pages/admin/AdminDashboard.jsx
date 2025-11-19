// src/pages/admin/AdminDashboard.jsx
import React, { useState } from "react";
import { Box } from "@mui/material";
import Sidebar from "../../components/admin/Sidebar";
import UserOverview from "../../components/admin/UserOverview";
import CreateUserCard from "../../components/admin/CreateUserCard";
import AdminHeader from "../../components/admin/AdminHeader";

export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "#F3F7FF" }}>
      <Sidebar />

      <Box
        component="main"
        sx={{
          flex: 1,
          display: "grid",
          gridTemplateRows: "auto 1fr",
          p: 3,
        }}
      >
        {/* Top bar with welcome + avatar + logout */}
        <AdminHeader />

        {/* Two-column layout */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: "minmax(420px, 510px) minmax(440px, 543px)",
            alignContent: "start",
            justifyContent: "start",
          }}
        >
          <Box key={refreshKey}>
            <UserOverview />
          </Box>
          <CreateUserCard onCreated={() => setRefreshKey((k) => k + 1)} />
        </Box>
      </Box>
    </Box>
  );
}
