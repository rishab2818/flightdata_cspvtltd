// Plotting page for creating and managing plots from flight data.
//
// Users can select columns from any of their uploaded flight data
// files within the project and schedule a plot to be generated.
// Progress is shown while the backend processes the data, and once
// complete the interactive Plotly plot is displayed. Saved plots can
// be listed, viewed and deleted at any time.

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { flightdataApi } from '../../../api/flightdata';
import { flightplotApi } from '../../../api/flightplot';
import { COLORS, SPACING } from '../../../styles/constants';
import Button from '../../../components/common/Button';

export default function Plotting() {
  const { projectId } = useParams();
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState({});
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [currentPlot, setCurrentPlot] = useState(null);
  const [progress, setProgress] = useState(0);
  const [plotUrl, setPlotUrl] = useState('');
  const [plots, setPlots] = useState([]);
  const [error, setError] = useState(null);

  // Load files and plots on mount
  const loadFiles = async () => {
    try {
      const data = await flightdataApi.list(projectId);
      setFiles(data || []);
    } catch (err) {
      console.error(err);
      setFiles([]);
    }
  };
  const loadPlots = async () => {
    try {
      const data = await flightplotApi.list(projectId);
      setPlots(data || []);
    } catch (err) {
      console.error(err);
      setPlots([]);
    }
  };
  useEffect(() => {
    loadFiles();
    loadPlots();
  }, [projectId]);

  // Handle selection of a column
  const toggleColumn = (fileId, columnName) => {
    setSelected((prev) => {
      const key = `${fileId}:${columnName}`;
      const updated = { ...prev };
      if (updated[key]) {
        delete updated[key];
      } else {
        updated[key] = { file_id: fileId, column_name: columnName };
      }
      return updated;
    });
  };

  // Create a new plot
  const createPlot = async () => {
    const columns = Object.values(selected);
    if (columns.length === 0) {
      alert('Please select at least one column to plot');
      return;
    }
    setCreating(true);
    setProgress(0);
    setPlotUrl('');
    setCurrentPlot(null);
    setError(null);
    try {
      const payload = { project_id: projectId, columns, title: title || undefined };
      const res = await flightplotApi.init(payload);
      setCurrentPlot(res);
      // Poll for progress
      const poll = async () => {
        try {
          const status = await flightplotApi.status(res.plot_id);
          setProgress(status.progress);
          if (status.status === 'completed') {
            const dl = await flightplotApi.downloadUrl(res.plot_id);
            setPlotUrl(dl.download_url);
            setCreating(false);
            await loadPlots();
          } else if (status.status === 'failed') {
            setError('Plot generation failed');
            setCreating(false);
          } else {
            setTimeout(poll, 3000);
          }
        } catch (err) {
          console.error(err);
          setError('Error checking plot status');
          setCreating(false);
        }
      };
      poll();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to create plot');
      setCreating(false);
    }
  };

  // Delete a plot
  const handleDelete = async (plotId) => {
    if (!window.confirm('Are you sure you want to delete this plot?')) return;
    try {
      await flightplotApi.delete(plotId);
      await loadPlots();
    } catch (err) {
      console.error(err);
      alert('Failed to delete plot');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
      <h2 style={{ color: COLORS.textPrimary, margin: 0 }}>Plotting</h2>
      {/* Column selection */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
          background: COLORS.background,
          padding: SPACING.lg,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
        }}
      >
        <h3 style={{ color: COLORS.textPrimary, margin: 0 }}>Select Columns</h3>
        {files.length === 0 ? (
          <p style={{ color: COLORS.textSecondary }}>No flight data files available.</p>
        ) : (
          files.map((file) => (
            <div key={file.file_id} style={{ marginBottom: SPACING.sm }}>
              <strong style={{ color: COLORS.textPrimary }}>{file.original_name}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.sm }}>
                {file.headers && file.headers.length > 0 ? (
                  file.headers.map((h) => (
                    <label key={h} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={!!selected[`${file.file_id}:${h}`]}
                        onChange={() => toggleColumn(file.file_id, h)}
                      />
                      <span style={{ fontSize: 12 }}>{h}</span>
                    </label>
                  ))
                ) : (
                  <span style={{ color: COLORS.textSecondary }}>No headers extracted yet</span>
                )}
              </div>
            </div>
          ))
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <input
            type="text"
            placeholder="Plot title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: SPACING.sm, border: `1px solid ${COLORS.border}`, borderRadius: 4, flex: 1 }}
          />
          <Button onClick={createPlot} disabled={creating || Object.keys(selected).length === 0}>
            {creating ? 'Creating…' : 'Create Plot'}
          </Button>
        </div>
        {creating && (
          <div style={{ width: '100%', background: COLORS.mutedBackground, borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round(progress * 100)}%`,
                background: COLORS.primary,
                height: 8,
              }}
            ></div>
          </div>
        )}
        {error && <span style={{ color: 'red' }}>{error}</span>}
        {plotUrl && (
          <div style={{ marginTop: SPACING.md }}>
            <h4 style={{ color: COLORS.textPrimary }}>Generated Plot</h4>
            <iframe
              src={plotUrl}
              title="Plot"
              style={{ width: '100%', height: 400, border: 'none' }}
            ></iframe>
          </div>
        )}
      </div>
      {/* Saved plots */}
      <div
        style={{
          background: COLORS.background,
          padding: SPACING.lg,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
        }}
      >
        <h3 style={{ color: COLORS.textPrimary, margin: 0 }}>Saved Plots</h3>
        {plots.length === 0 ? (
          <p style={{ color: COLORS.textSecondary }}>No plots created yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: COLORS.mutedBackground }}>
                <th style={{ padding: SPACING.sm, textAlign: 'left' }}>Title</th>
                <th style={{ padding: SPACING.sm, textAlign: 'left' }}>Created At</th>
                <th style={{ padding: SPACING.sm, textAlign: 'left' }}>Status</th>
                <th style={{ padding: SPACING.sm }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((p) => (
                <tr key={p.plot_id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: SPACING.sm }}>{p.title || 'Untitled'}</td>
                  <td style={{ padding: SPACING.sm }}>{new Date(p.created_at).toLocaleString()}</td>
                  <td style={{ padding: SPACING.sm }}>{p.status}</td>
                  <td style={{ padding: SPACING.sm, display: 'flex', gap: SPACING.sm }}>
                    {p.status === 'completed' && (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          const dl = await flightplotApi.downloadUrl(p.plot_id);
                          window.open(dl.download_url, '_blank');
                        }}
                        style={{ padding: `${SPACING.sm}px ${SPACING.md}px` }}
                      >
                        View
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => handleDelete(p.plot_id)}
                      style={{ padding: `${SPACING.sm}px ${SPACING.md}px` }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}