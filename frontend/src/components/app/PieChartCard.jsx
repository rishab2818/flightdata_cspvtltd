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
        alignItems:"flex-start",
        background: "#fff",
        border: `1px solid ${BORDER}`,
        borderColor:"#0000001A",
        borderRadius: 8,
        display:"flex",
        flexDirection:"column",
        gap: 10,
        height:343,
        padding: "35px 25px",
        position: "relative",
        maxWidth: 520,
      }}
    >
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#000000",fontFamily: `"SF Pro-Bold", Helvetica, sans-serif` }}>{title}</h3>
      </div>
      <div style={{ height:250, left:40, position:"absolute",top:97,width:340,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
        <div style={{ alignItems:"center", display:"flex",flexDirection:"column",gap:7,height:33, left:0, position:"absolute", top:131, width:440}}>
          <div style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#000000",fontFamily: `"SF Pro-Bold", Helvetica, sans-serif`,alignItems:"center"}}> No data available yet.</div>
          <p style={{ fontSize: 11, fontWeight: 400, margin: 0, color: "#333333",fontFamily: `"SF Pro-Regular", Helvetica, sans-serif`,alignItems:"center"}}>Once you upload a project, your visual insights will appear here</p>
          
      </div>
      <img style={{ height:100, width:200}} src={Group} alt="Group" />
        </div>
        
    </div>
  );
}
