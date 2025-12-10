import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import Group from '../../assets/Group.svg';

const BORDER = "#0000001A";

export default function PieChartCard({ title, value }) {
  const data = [
    { name: "Aero", value: 400 },
    { name: "WTD", value: 300 },
    { name: "Flight", value: 200 },
    { name: "CFD", value: 700 },
  ];
  const COLORS = ["#7b61ff", "#ff7b9c", "#00bcd4", "#82ca9d"];

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        height: 343,
        padding: "35px 25px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 520,
      }}
    >
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          margin: 0,
          color: "#000",
          fontFamily: `"SF Pro-Bold", Helvetica, sans-serif`,
        }}
      >
        {title}
      </h3>

      {/* EMPTY STATE CENTERED */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: 10,
        }}
      >
        <img
          src={Group}
          alt="Empty"
          style={{ width: 180, height: "auto" }}
        />
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#000",
            fontFamily: `"SF Pro-Bold", Helvetica, sans-serif`,
          }}
        >
          No data available yet.
        </div>
        <p
          style={{
            fontSize: 12,
            color: "#555",
            margin: 0,
            fontFamily: `"SF Pro-Regular", Helvetica, sans-serif`,
          }}
        >
          Once you upload a project, your visual insights will appear here
        </p>
      </div>
    </div>
  );
}
