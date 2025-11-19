// Improved ProjectsSection component.
//
// This file demonstrates how to use the centralised design tokens
// (``COLORS`` and ``SPACING``) and the reusable ``Button`` component.
// The behaviour and layout remain the same as the original
// ``ProjectsSection``.  Only constant definitions and repetitive
// styling have been refactored.

import React, { useEffect, useState, useContext } from 'react';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';
import { projectApi } from '../../api/projectapi';
import { AuthContext } from '../../context/AuthContext';
import { COLORS, SPACING } from '../../styles/constants';
import Button from '../common/Button';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ProjectsSectionImproved() {
  const { user } = useContext(AuthContext);
  const role = user?.role?.toUpperCase?.();
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
        width: 573,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.lg,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            margin: 0,
            color: COLORS.textPrimary,
          }}
        >
          Projects
        </h2>
        {canCreate && (
          <Button onClick={() => setShowModal(true)} variant="primary" style={{ width: 188, height: 44, borderRadius: 4 }}>
            + New Project
          </Button>
        )}
      </div>
      {/* Project cards */}
      {projects.map((p, i) => (
        <ProjectCard
          key={p._id || i}
          name={p.project_name}
          type="Aero Data"
          date={formatDate(p.created_at)}
          members={p.members?.length || 0}
          desc={p.project_description}
        />
      ))}
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