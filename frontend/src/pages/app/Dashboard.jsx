import React, { useContext, useEffect, useState } from "react";
import StatsCards from "../../components/app/StatsCards";
import ProjectsSection from "../../components/app/ProjectsSection";
import PieChartCard from "../../components/app/PieChartCard";
import { projectApi } from "../../api/projectapi";
import { AuthContext } from "../../context/AuthContext";
import "../../styles/dashboard.css";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const role = user?.role?.toUpperCase?.();
  const isGDorDH = role === "GD" || role === "DH";
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const data = await projectApi.getCounts();
        if (!cancelled) {
          setCounts(data || {});
        }
      } catch (error) {
        console.error("Failed to fetch dashboard chart counts", error);
        if (!cancelled) {
          setCounts({
            cfd: 0,
            wind: 0,
            flight: 0,
            others: 0,
          });
        }
      }
    }

    if (isGDorDH) {
      fetchCounts();
    }

    return () => {
      cancelled = true;
    };
  }, [isGDorDH]);

  const distributionData = [
    { name: "Other", shortName: "Aero", value: Number(counts?.others || 0), color: "#7B6CF6" },
    { name: "Wind", shortName: "WTD", value: Number(counts?.wind || 0), color: "#FF8E86" },
    { name: "Flight", shortName: "Flight", value: Number(counts?.flight || 0), color: "#FFC3C0" },
    { name: "CFD", shortName: "CFD", value: Number(counts?.cfd || 0), color: "#43C0DF" },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <StatsCards />

        <div className="dashboard-lower">
          <ProjectsSection />

          {isGDorDH && (
            <div className="dashboard-charts">
              <PieChartCard title="Data Distribution" data={distributionData} />
              <PieChartCard title="Reports" value={4089} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

