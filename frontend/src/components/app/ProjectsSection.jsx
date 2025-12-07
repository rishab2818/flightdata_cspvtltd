// Improved ProjectsSection component.
//
// This file demonstrates how to use the centralised design tokens
// (``COLORS`` and ``SPACING``) and the reusable ``Button`` component.
// The behaviour and layout remain the same as the original
// ``ProjectsSection``.  Only constant definitions and repetitive
// styling have been refactored.

import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';
import { projectApi } from '../../api/projectapi';
import { AuthContext } from '../../context/AuthContext';
import { COLORS, SPACING } from '../../styles/constants';
import Button from '../common/Button';
import folderOpen from '../../assets/FolderOpen.svg';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ProjectsSectionImproved() {
  const { user } = useContext(AuthContext);
  const role = user?.role?.toUpperCase?.();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const currentUserEmail = user?.email || 'unknown@example.com';
  const loadProjects = async () => {
    try {
      const data = await projectApi.list();
      const sorted = (data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setProjects(sorted);
    } catch (err) {
      console.error('Failed to load projects', err);
      setProjects([]);
    }
  };
  useEffect(() => {
    loadProjects();
  }, []);
  const handleCreateProject = async (payloadFromModal) => {
    try {
      setCreating(true);
      const payload = {
        ...payloadFromModal,
        member_emails: [currentUserEmail, ...(payloadFromModal.member_emails || [])],
      };
      await projectApi.create(payload);
      setShowModal(false);
      await loadProjects();
    } catch (err) {
      console.error('Error creating project', err);
    } finally {
      setCreating(false);
    }
  };
  const canCreate = role === 'GD' || role === 'DH';
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
      }}
    >
      <div
        style={{
          background: COLORS.background,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: `${SPACING.lg}px ${SPACING.lg + SPACING.sm}px`,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <img
    src={folderOpen}
    alt="Projects"
    style={{ width: 30, height: 30, objectFit: 'contain'}}
  />
  <span
    style={{
      fontSize: 28,
      fontWeight: 600,
      color: "#000000",
      fontFamily: "inter-semi-bold, Helvetica",
    }}
  >
    Projects
  </span>
</div>

          {canCreate && (
            <Button
              onClick={() => setShowModal(true)}
              variant="primary"
              style={{ width: 200, height: 44, borderRadius: 6 ,fontFamily: "inter-regular, Helvetica", fontSize: 16}}
            >
              + New Project
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {projects.map((p, i) => (
            <ProjectCard
              key={p._id || i}
              name={p.project_name}
              type="Aero Data"
              date={formatDate(p.created_at)}
              members={p.members?.length || 0}
              desc={p.project_description}
              onView={() => navigate(`/app/projects/${p._id}`)}
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      <NewProjectModal
        open={showModal}
        onClose={() => !creating && setShowModal(false)}
        onSubmit={handleCreateProject}
        loading={creating}
      />
    </div>
  );
}
