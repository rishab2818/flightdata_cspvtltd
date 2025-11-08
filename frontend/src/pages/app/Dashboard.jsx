import React, { useContext } from "react";
import StatsCards from "../../components/app/StatsCards";
import ProjectsSection from "../../components/app/ProjectsSection";
import PieChartCard from "../../components/app/PieChartCard";
import { AuthContext } from "../../context/AuthContext";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const role = user?.role?.toUpperCase?.();
  const isGDorDH = role === "GD" || role === "DH";

  return (
    <div>
      {/* stats row - visible to everyone */}
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <StatsCards />
      </div>

      {/* projects + charts */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", gap: 18 }}>
          {/* Projects - visible to everyone */}
          <ProjectsSection />

          {/* Right column (pie charts) - only GD/DH */}
          {isGDorDH && (
            <div
              style={{
                width: 420,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <PieChartCard title="Data Distribution" value={35500} />
              <PieChartCard title="Reports" value={4089} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
