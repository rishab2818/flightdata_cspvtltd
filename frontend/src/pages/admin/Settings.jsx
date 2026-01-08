import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

export default function Settings() {
  return (
    <div style={{display:"flex", justifyContent:"center",padding:"24px", width:"100%", background:"#f8fafc", height:"100%"}}>
      <div style={{ marginTop:"-24px",width:"100%", background:"#ffffff", borderRadius:"8px", overflow:"hidden", border: "1px solid #e2e8f0"}}>
        <div style={{ padding: "20px 24px", fontSize: "24px", fontFamily:"Inter-Regular, Helvetica",fontWeight:500, color:"#000000"}}>
            Settings
           </div>
         <div style={{ padding:"0px 24px", fontSize: "14px", fontFamily:"Inter-Regular, Helvetica",fontWeight:400, color:"#000000"}}>
            Configure administrative preferences here. Add fields as needed to manage profile,
            notifications, and platform defaults.
         </div>
        </div>
    </div>
   
  );
}
