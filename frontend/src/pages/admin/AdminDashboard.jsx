// src/pages/admin/AdminDashboard.jsx
import React, { useState } from "react";
import { Box } from "@mui/material";
import UserOverview from "../../components/admin/UserOverview";
import CreateUserCard from "../../components/admin/CreateUserCard";

export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>

      {/* Right Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          // padding: 3,
          backgroundColor: "#F5f9ff",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >

        {/* Main Grid */}
        <Box
          sx={{
            width: "1450px",
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(320px, 1fr))",
              lg: "minmax(420px, 520px) minmax(440px, 560px)",
            },
            alignContent: "start",
            justifyContent: "start",
            overflow: "hidden",
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
