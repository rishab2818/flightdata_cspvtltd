import React, { useEffect, useState } from 'react';
import { projectApi } from '../../api/projectapi';

const BORDER = "#0000001A";

// format like "03", "12", etc.
function formatTotal(value) {
  if (value === null || value === undefined) return "--";
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toString().padStart(2, "0");
}

export default function StatsCards() {
  const [totalProjects, setTotalProjects] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const data = await projectApi.getCounts(); // expects { total: number }
        if (!cancelled) {
          setTotalProjects(data?.total ?? 0);
        }
      } catch (e) {
        console.error("Failed to fetch project count", e);
        if (!cancelled) {
          setTotalProjects(0); // fallback default
        }
      }
    }

    fetchCount();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { title: "Total Projects", value: formatTotal(totalProjects) },
    { title: "CFD Data", value: "143k" },
    { title: "Wind Data", value: "124k" },
    { title: "Flight Data", value: "240k" },
    { title: "Aero Data", value: "123k" },
    { title: "Total Reports", value: "12k" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        gap: 10,
        width: "100%",
        marginTop: 20,
      }}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          style={{
            minHeight: 120,
            borderRadius: 8,
            background: "#fff",
            border: `1px solid ${BORDER}`,
            padding: "30px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 13, color: "#334155" }}>{s.title}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
