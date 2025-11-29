// src/pages/admin/AdminDashboard.jsx
import React, { useState } from "react";
import { Box } from "@mui/material";
import AdminHeader from "../../components/admin/AdminHeader";
import UserOverview from "../../components/admin/UserOverview";
import CreateUserCard from "../../components/admin/CreateUserCard";
import Sidebar from "../../components/admin/Sidebar";

export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      
      {/* Left Sidebar */}
      <Sidebar />

      {/* Right Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          padding: 3,
          backgroundColor: "#F1F6FF",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {/*  Admin Header goes here */}
        <AdminHeader />

        {/* Main Grid */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(320px, 1fr))",
              lg: "minmax(420px, 520px) minmax(440px, 560px)",
            },
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
