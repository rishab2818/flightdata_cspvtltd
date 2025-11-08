import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

import brandIcon from "../../assets/Database.svg";
import dashboard from "../../assets/Dashboard.svg";
import Minutesofmeeting from "../../assets/PresentationChart.svg";
import StudentEngagement from "../../assets/UsersThree.svg";
import InventoryRecords from "../../assets/inventory.svg";
import DivisionalRecords from "../../assets/divisonal.svg";
import CustomerFeedbacks from "../../assets/customer.svg";
import TechnicalReports from "../../assets/reports.svg";
import Setting from "../../assets/GearFine.svg";

const BORDER = "#0000001A";
const PRIMARY = "#1976D2";

export default function Sidebar() {
  const { user } = useContext(AuthContext);
  const role = user?.role?.toUpperCase?.();

  const baseItems = [
    { path: "/app", icon: dashboard, text: "Dashboard Overview" },
  ];

  const gdDhOnlyItems = [
    { path: "/app/minutes", icon: Minutesofmeeting, text: "Minutes of the Meeting" },
    { path: "/app/student-engagement", icon: StudentEngagement, text: "Student Engagement" },
    { path: "/app/inventory-records", icon: InventoryRecords, text: "Inventory Records" },
    { path: "/app/divisional-records", icon: DivisionalRecords, text: "Divisional Records" },
    { path: "/app/customer-feedbacks", icon: CustomerFeedbacks, text: "Customer Feedbacks" },
    { path: "/app/training-records", icon: TechnicalReports, text: "Training Records" },
    { path: "/app/technical-reports", icon: TechnicalReports, text: "Technical Reports" },
    { path: "/app/setting", icon: Setting, text: "Setting" },
  ];

  // combine based on role
  const items =
    role === "GD" || role === "DH" ? [...baseItems, ...gdDhOnlyItems] : baseItems;

  return (
    <aside
      style={{
        width: 321,
        height: "100vh",
        background: "#FFFFFF",
        borderRight: `1px solid ${BORDER}`,
        padding: "34px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 40,
          width: 209,
          height: 48,
        }}
      >
        <img
          src={brandIcon}
          alt="Brand Icon"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            objectFit: "cover",
            background: "#e5e7eb",
          }}
        />
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Data Visualisation</h3>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((it, i) => (
          <li key={i} style={{ listStyle: "none" }}>
            <NavLink
              to={it.path}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 4,
                padding: 10,
                marginBottom: 10,
                cursor: "pointer",
                width: 224,
                height: 44,
                textDecoration: "none",
                background: isActive ? PRIMARY : "transparent",
                color: isActive ? "#fff" : "#111827",
              })}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>
                <img src={it.icon} alt="" style={{ width: 24, height: 24 }} />
              </span>
              <span style={{ fontSize: 14 }}>{it.text}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}
