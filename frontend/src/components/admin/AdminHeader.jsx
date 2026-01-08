
import React, { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import { AuthContext } from "../../context/AuthContext";

export default function AdminHeader({ title = "Welcome!" }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const fullName = useMemo(() => {
    return user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.name || user?.email || "Admin";
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        mb: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Typography
          variant="h5"
          sx={{ fontWeight: 500, color: "#0C3391", mb: 0.5 }}
        >
          {title}
        </Typography>
        <Typography sx={{ color: "#334155" }}>{fullName}</Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "#CBD5E1",
            }}
          />
          <Box>
            <Typography
              sx={{ fontWeight: 600, color: "#0F172A", fontSize: 14 }}
            >
              {fullName}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#64748B" }}>
              {user?.role || "ADMIN"}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={handleLogout}
          sx={{ textTransform: "none", borderRadius: "999px", px: 2.5 }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
}
