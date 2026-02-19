import React, { useState } from "react";
import { Box } from "@mui/material";
import UserOverview from "../../components/admin/UserOverview";
import CreateUserCard from "../../components/admin/CreateUserCard";

export default function AdminDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        overflow: "hidden",   // ✅ no page scroll
      }}
    >
      {/* Right Main Content */}
      <Box
        sx={{
          flex: 1,
          backgroundColor: "#F5f9ff",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minHeight: 0,       // ✅ critical
          overflow: "hidden",
          p: 2,
        }}
      >
        {/* Grid */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,      // ✅ critical
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
          <Box key={refreshKey} sx={{ minHeight: 0 }}>
            <UserOverview />
          </Box>

          <Box sx={{ minHeight: 0 }}>
            <CreateUserCard
              onCreated={() => setRefreshKey((k) => k + 1)}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
