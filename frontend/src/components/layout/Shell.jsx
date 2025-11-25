import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import "../../styles/layout.css";

export default function Shell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__body">
        <Header />
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
