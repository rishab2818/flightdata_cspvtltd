// src/components/app/Header.jsx
import React, { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

export default function Header() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const fullName = useMemo(() => {
    return user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.name || user?.email || "User";
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        width: "100%",
        height: 65,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "36px 36px 0 36px",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#0f172a",
            margin: 0,
          }}
        >
          Welcome!
        </h1>
        <p style={{ marginTop: -4, color: "#334155" }}>{fullName}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#0F172A",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Logout
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#cbd5e1",
            }}
          />
          <div>
            <div style={{ fontWeight: 600, color: "#0f172a" }}>{fullName}</div>
            <div style={{ fontSize: 14, color: "#475569" }}>
              {user?.role || ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
