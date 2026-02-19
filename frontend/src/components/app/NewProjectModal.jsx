// Improved modal for creating a new project.
//
// This component is a drop-in replacement for the existing
// ``NewProjectModal``.  It leverages the new ``Button`` component and
// centralised style constants defined in ``src/styles/constants.js``.
// The UI remains visually identical to the original implementation,
// but the hard-coded values have been removed, making the code
// shorter and easier to maintain.

import React, { useState, useEffect } from 'react';
import { projectApi } from '../../api/projectapi';
import { COLORS, SPACING } from '../../styles/constants';
import Button from '../common/Button';

const BORDER = COLORS.border;

const normalizeMembers = (members = []) =>
  (members || [])
    .map((m) => ({
      email: m?.email || '',
      name: m?.name || m?.full_name || m?.display_name || m?.email || '',
    }))
    .filter((m) => m.email);

export default function NewProjectModalImproved({
  open,
  onClose,
  onSubmit,
  loading,
  mode = 'create',
  initialProject = null,
}) {
  const isEditMode = mode === 'edit';
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  // search + selection state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // reset form whenever we open
  useEffect(() => {
    if (open) {
      setProjectName(initialProject?.project_name || '');
      setDescription(initialProject?.project_description || '');
      setSearchTerm('');
      setSearchResults([]);
      setSelectedMembers(normalizeMembers(initialProject?.members));
    }
  }, [open, initialProject]);

  // debounce search and call /api/projects/member-search
  useEffect(() => {
    if (!open) return;
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const data = await projectApi.memberSearch(searchTerm.trim());
        if (!cancelled) {
          const normalized = (data || [])
            .map((u) => ({
              email: u.email || u.user_email || '',
              name: u.name || u.full_name || u.display_name || u.email || u.user_email || '',
            }))
            .filter((u) => u.email);
          setSearchResults(normalized);
        }
      } catch (err) {
        console.error('Member search failed', err);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const member_emails = selectedMembers.map((m) => m.email);
    onSubmit({ project_name: projectName, project_description: description, member_emails });
  };
  const handleAddMember = (user) => {
    if (!user.email) return;
    const exists = selectedMembers.some((m) => m.email === user.email);
    if (exists) return;
    setSelectedMembers([...selectedMembers, user]);
    setSearchTerm('');
    setSearchResults([]);
  };
  const handleRemoveMember = (email) => {
    setSelectedMembers(selectedMembers.filter((m) => m.email !== email));
  };
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: 520,
          background: COLORS.background,
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(15,23,42,0.12)',
          border: `1px solid ${BORDER}`,
          padding: `${SPACING.lg + SPACING.md}px ${SPACING.lg}px ${SPACING.md}px`,
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 600,
            margin: 0,
            marginBottom: SPACING.lg,
            color: COLORS.textPrimary,
          }}
        >
          {isEditMode ? 'Edit Project' : 'Add Project'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 14, color: COLORS.textSecondary }}>
            Project Name
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isEditMode}
              style={{
                width: '100%',
                marginTop: SPACING.sm,
                padding: `${SPACING.md}px ${SPACING.md + SPACING.sm}px`,
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontSize: 14,
                background:"#F3F3F5",
                opacity: isEditMode ? 0.7 : 1,
                cursor: isEditMode ? 'not-allowed' : 'text',
              }}
            />
          </label>
          {isEditMode && (
            <div style={{ marginTop: -8, fontSize: 12, color: COLORS.textMuted }}>
              Project name cannot be changed after creation.
            </div>
          )}
          <label style={{ fontSize: 14, color: COLORS.textSecondary }}>
            Description
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                marginTop: SPACING.sm,
                padding: `${SPACING.md}px ${SPACING.md + SPACING.sm}px`,
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontSize: 14,
                minHeight: 80,
                resize: 'none',
                background:"#F3F3F5",
              }}
            />
          </label>
          {/* Members search */}
          <div style={{ fontSize: 14, color: COLORS.textSecondary }}>
            Add Members
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                marginTop: SPACING.sm,
                padding: `${SPACING.md}px ${SPACING.md + SPACING.sm}px`,
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontSize: 14,
                background:"#F3F3F5",
              }}
            />
            {/* search dropdown */}
            {searchTerm && searchResults.length > 0 && (
              <div
                style={{
                  marginTop: SPACING.sm,
                  borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: COLORS.background,
                  boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
                  maxHeight: 160,
                  overflowY: 'auto',
                }}
              >
                {searchResults.map((user) => (
                  <div
                    key={user.email}
                    onClick={() => handleAddMember(user)}
                    style={{
                      padding: `${SPACING.sm + 2}px ${SPACING.md}px`,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 14,
                    }}
                  >
                    <span>{user.name}</span>
                    <span style={{ color: COLORS.textMuted, fontSize: 12 }}>{user.email}</span>
                  </div>
                ))}
              </div>
            )}
            {searchTerm && searchLoading && (
              <div style={{ marginTop: SPACING.sm, fontSize: 12, color: COLORS.textMuted }}>Searching...</div>
            )}
            {/* selected member chips */}
            {selectedMembers.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: SPACING.sm,
                  marginTop: SPACING.md,
                }}
              >
                {selectedMembers.map((m) => (
                  <span
                    key={m.email}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: SPACING.sm,
                      padding: `${SPACING.sm}px ${SPACING.md}px`,
                      borderRadius: 999,
                      background: COLORS.mutedBackground,
                      fontSize: 12,
                      color: COLORS.textPrimary,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    {m.name || m.email}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.email)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: SPACING.md,
              marginTop: SPACING.md,
            }}
          >
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save' : 'Create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
