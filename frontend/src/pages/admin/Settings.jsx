import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

export default function Settings() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Card
        sx={{
          width: "min(960px, 100%)",
          borderRadius: 3,
          boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Settings
          </Typography>
          <Typography color="text.secondary">
            Configure administrative preferences here. Add fields as needed to manage profile,
            notifications, and platform defaults.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
