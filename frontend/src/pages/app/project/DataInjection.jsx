// Data Injection page for uploading and managing flight data files.
//
// This component allows users to select a large CSV/Excel file, computes
// a SHA‑256 hash to deduplicate uploads, obtains a presigned URL from
// the backend, uploads the file directly to object storage and then
// confirms the upload. It also lists existing files and provides
// actions to download or delete them. Only files visible to the
// current user (owner or granted access) are shown.

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { flightdataApi, computeSha256 } from '../../../api/flightdata';
import { COLORS, SPACING } from '../../../styles/constants';
import Button from '../../../components/common/Button';

export default function DataInjection() {
  const { projectId } = useParams();
  const [section, setSection] = useState('wind_tunnel');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  // Load existing files
  const loadFiles = async () => {
    try {
      const data = await flightdataApi.list(projectId);
      setFiles(data || []);
    } catch (err) {
      console.error(err);
      setFiles([]);
    }
  };
  useEffect(() => {
    loadFiles();
  }, [projectId]);

  // Handle file upload
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      // Compute hash
      const contentHash = await computeSha256(file);
      // Prepare init payload
      const initPayload = {
        project_id: projectId,
        section: section,
        filename: file.name,
        content_type: file.type || undefined,
        size_bytes: file.size,
        content_hash: contentHash,
      };
      // Request presigned upload URL
      const initRes = await flightdataApi.initUpload(initPayload);
      // Upload to presigned URL using axios so we can track progress
      await axios.put(initRes.upload_url, file, {
        headers: {
          'Content-Type': initPayload.content_type || 'application/octet-stream',
        },
        onUploadProgress: (e) => {
          if (e.total) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setProgress(percent);
          }
        },
      });
      // Confirm upload
      const confirmPayload = {
        project_id: projectId,
        section: section,
        storage_key: initRes.storage_key,
        original_name: file.name,
        content_type: initPayload.content_type,
        size_bytes: file.size,
        content_hash: contentHash,
      };
      await flightdataApi.confirmUpload(confirmPayload);
      // Refresh list
      await loadFiles();
      // Reset state
      setFile(null);
      setProgress(0);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle delete file
  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    try {
      await flightdataApi.delete(fileId);
      await loadFiles();
    } catch (err) {
      console.error(err);
      alert('Failed to delete file');
    }
  };

  // Handle download
  const handleDownload = async (fileId) => {
    try {
      const res = await flightdataApi.downloadUrl(fileId);
      window.open(res.download_url, '_blank');
    } catch (err) {
      console.error(err);
      alert('Failed to get download link');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
      <h2 style={{ color: COLORS.textPrimary, margin: 0 }}>Data Injection</h2>
      {/* Upload form */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          flexWrap: 'wrap',
          background: COLORS.background,
          padding: SPACING.lg,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
        }}
      >
        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          style={{
            padding: `${SPACING.sm}px ${SPACING.md}px`,
            borderRadius: 4,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.background,
            color: COLORS.textPrimary,
            fontSize: 14,
          }}
        >
          <option value="wind_tunnel">Wind Tunnel</option>
          <option value="aero">Aero</option>
          <option value="cfd">CFD</option>
        </select>
        <input
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ fontSize: 14 }}
        />
        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? `Uploading… (${progress}%)` : 'Upload'}
        </Button>
        {error && <span style={{ color: 'red' }}>{error}</span>}
        {uploading && (
          <div style={{ width: '100%', background: COLORS.mutedBackground, borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress}%`,
                background: COLORS.primary,
                height: 8,
              }}
            ></div>
          </div>
        )}
      </div>
      {/* File list */}
      <div>
        <h3 style={{ color: COLORS.textPrimary }}>Existing Files</h3>
        {files.length === 0 ? (
          <p style={{ color: COLORS.textSecondary }}>No files uploaded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: COLORS.mutedBackground }}>
                <th style={{ padding: SPACING.sm }}>Name</th>
                <th style={{ padding: SPACING.sm }}>Section</th>
                <th style={{ padding: SPACING.sm }}>Uploaded At</th>
                <th style={{ padding: SPACING.sm }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.file_id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: SPACING.sm }}>{f.original_name}</td>
                  <td style={{ padding: SPACING.sm }}>{f.section}</td>
                  <td style={{ padding: SPACING.sm }}>{new Date(f.uploaded_at).toLocaleString()}</td>
                  <td style={{ padding: SPACING.sm, display: 'flex', gap: SPACING.sm }}>
                    <Button
                      variant="secondary"
                      style={{ padding: `${SPACING.sm}px ${SPACING.md}px` }}
                      onClick={() => handleDownload(f.file_id)}
                    >
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      style={{ padding: `${SPACING.sm}px ${SPACING.md}px` }}
                      onClick={() => handleDelete(f.file_id)}
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