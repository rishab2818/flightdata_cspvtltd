// import React from "react";
// import { useLocation } from "react-router-dom";
// import Sidebar from "./Sidebar";
// import Header from "./Header";
// import "../../styles/layout.css";

// export default function Shell({ children }) {
//   const location = useLocation();
//   const isAdminRoute = location.pathname.startsWith("/admin");

//   return (
//     <div className="app-shell">
//       {!isAdminRoute && <Sidebar />}

//       <div className="app-shell__body">
//          {!isAdminRoute && <Header />}
//         <main className="app-shell__main">{children}</main>
//       </div>
//     </div>
//   );
// }