import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { visualizationApi } from "../../../api/visualizationApi";

export default function ProjectVisualisationFullScreen() {
  const { vizId } = useParams();
  const [plotHtml, setPlotHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlot = async () => {
      try {
        setLoading(true);
        setError(null);
        const detail = await visualizationApi.detail(vizId);
        if (!detail?.html) throw new Error("No HTML returned for this visualization");

        setPlotHtml(detail.html);
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || "Failed to load visualization");
      } finally {
        setLoading(false);
      }
    };
    fetchPlot();
  }, [vizId]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {loading && <div style={{ textAlign: "center", paddingTop: 20 }}>Loading…</div>}
      {error && <div style={{ textAlign: "center", color: "red", paddingTop: 20 }}>{error}</div>}

      {!loading && !error && plotHtml && (
        <iframe
          title="plotly-fullscreen"
          srcDoc={plotHtml}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        />
      )}

      {!loading && !error && !plotHtml && (
        <div style={{ textAlign: "center", paddingTop: 20 }}>No visualization returned.</div>
      )}
    </div>
  );
}