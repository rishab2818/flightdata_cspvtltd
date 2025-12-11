import React from "react";
import EmptyImg from "../../assets/EmptyImg.svg";

export default function EmptySection() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        flex:1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center", // perfect vertical centering
        padding: "60px 20px",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <img
          src={EmptyImg}
          alt="EmptyImg"
          style={{ width: 180, height: "auto", marginBottom: 20 }}
        />

        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            fontFamily: `"SF Pro-SemiBold", Helvetica, sans-serif`,
            color: "#0F172A",
            marginBottom: 6,
          }}
        >
          No Data Records Found
        </p>

        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            maxWidth: 420,
            fontFamily: `"SF Pro-Regular", Helvetica, sans-serif`,
            color: "#7B899D",
          }}
        >
          Looks like there's no content here right now. Your activities and records will appear here once you upload.
        </p>
      </div>
    </div>
  );
}

