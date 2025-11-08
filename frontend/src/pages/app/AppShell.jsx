import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../../components/app/Sidebar";
import Header from "../../components/app/Header";

export default function AppShell(){
  return (
    <div style={{ display:'flex', height:'100vh', background:'#F5F9FF' }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Header />
        {/* make only this area scroll, not the whole page */}
        <div
          style={{
            padding: "18px 36px 36px 36px",
            height: "calc(100vh - 65px)", // 65px header
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
