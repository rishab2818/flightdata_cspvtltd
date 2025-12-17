import React, { useContext } from "react";
import StatsCards from "../../components/app/StatsCards";
import ProjectsSection from "../../components/app/ProjectsSection";
import PieChartCard from "../../components/app/PieChartCard";
import { AuthContext } from "../../context/AuthContext";
import "../../styles/dashboard.css";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const role = user?.role?.toUpperCase?.();
  const isGDorDH = role === "GD" || role === "DH";

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <StatsCards />

        <div className="dashboard-lower">
          <ProjectsSection />

          {isGDorDH && (
            <div className="dashboard-charts">
              <PieChartCard title="Data Distribution" value={35500} />
              <PieChartCard title="Reports" value={4089} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

