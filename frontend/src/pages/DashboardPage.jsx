// src/pages/DashboardPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi, usersApi } from "../lib/api";
import { useAuth } from "../context/auth";

// tiles
const Stat = ({ title, value, icon }) => (
  <div className="rounded-xl bg-white p-4 shadow-sm border">
    <div className="text-xs text-gray-500 mb-1">{title}</div>
    <div className="flex items-center gap-2">
      <div className="text-2xl font-semibold">{value}</div>
      {icon && <span className="text-gray-400">{icon}</span>}
    </div>
  </div>
);

const Modal = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl p-6">
        {children}
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, canSeeStats, canCreateProject, isAdmin } = useAuth();

  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // modal state (GD/DH only)
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  const fetchProjects = async () => {
    // Admin should NOT see projects
    if (isAdmin) {
      setProjects([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const [c, list] = await Promise.all([
        projectsApi.count(),
        projectsApi.list({ page: 1, limit: 50 }),
      ]);
      setTotal(c?.total ?? 0);
      setProjects(list || []);
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, [isAdmin]);

  // realtime user search for adding members (GD/DH only)
  useEffect(() => {
    if (!canCreateProject) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!memberInput.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await usersApi.search(memberInput.trim(), 8);
        setSuggestions(res || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [memberInput, canCreateProject]);

  const addMember = (username) => {
    if (!username) return;
    setMembers((m) => (m.includes(username) ? m : [...m, username]));
  };
  const removeMember = (u) => setMembers((m) => m.filter((x) => x !== u));

  const create = async () => {
    setCreating(true);
    setErr(null);
    try {
      await projectsApi.create({ title, description: desc, members });
      await fetchProjects();
      setTitle(""); setDesc(""); setMembers([]); setMemberInput("");
      setOpen(false);
    } catch (e) {
      setErr(e.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Stats only for ADMIN/GD/DH */}
      {canSeeStats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat title="Total Projects" value={String(total).padStart(2, "0")} />
          <Stat title="CFD Data" value="143k" />
          <Stat title="Wind Data" value="124k" />
          <Stat title="Flight Data" value="240k" />
          <Stat title="Aero Data" value="123k" />
        </div>
      )}

      {/* For ADMIN: hide the projects section entirely */}
      {!isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-xl bg-white p-4 shadow-sm border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Projects</h3>
              {canCreateProject && (
                <button
                  onClick={() => setOpen(true)}
                  className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                >
                  + New Project
                </button>
              )}
            </div>

            {loading && <div className="text-sm text-gray-500">Loading…</div>}
            {!loading && projects.length === 0 && (
              <div className="text-sm text-gray-500">No projects yet.</div>
            )}

            {projects.map((p, i) => (
              <div key={p.id || p._id || i} className="border-t first:border-t-0 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-gray-500">
                    Active • Members {String(p.members?.length ?? 0).padStart(2, "0")}
                  </div>
                </div>
                <button
                  className="rounded-md border px-3 py-1 text-sm"
                  onClick={() => navigate(`/projects/${p.id || p._id}`)}
                >
                  View Project
                </button>
              </div>
            ))}
          </div>

          {/* keep the right chart unchanged */}
          <div className="rounded-xl bg-white p-4 shadow-sm border">
            <h3 className="font-semibold mb-3">Data Distribution</h3>
            <div className="aspect-square">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="18" />
                <circle cx="60" cy="60" r="45" fill="none" stroke="#1976d2" strokeWidth="18" strokeDasharray="200 100" strokeLinecap="round" transform="rotate(-90 60 60)" />
                <circle cx="60" cy="60" r="25" fill="white" />
                <text x="60" y="65" textAnchor="middle" fontSize="16" fontWeight="600">35500</text>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Modal for GD/DH only */}
      {canCreateProject && (
        <Modal open={open} onClose={() => setOpen(false)}>
          <h3 className="text-lg font-semibold mb-4">Add Project</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600">Title</label>
              <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Airbus 320" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="text-sm text-gray-600">Project Description</label>
              <textarea className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={4} placeholder="Describe the project…" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>

            <div>
              <label className="text-sm text-gray-600">Members (usernames)</label>
              <div className="relative">
                <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Search user…" value={memberInput} onChange={(e) => setMemberInput(e.target.value)} />
                {memberInput && (suggestions.length > 0 || searching) && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
                    {searching && <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>}
                    {suggestions.map((u) => (
                      <div key={u.username} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gray-200" />
                          <div className="text-sm">
                            <div className="font-medium">{u.username}</div>
                            <div className="text-xs text-gray-500">{u.role}</div>
                          </div>
                        </div>
                        <button className="text-xs border rounded px-2 py-1"
                          disabled={members.includes(u.username)} onClick={() => addMember(u.username)}>
                          {members.includes(u.username) ? "Added" : "Add"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!!members.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span key={m} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border">
                      {m}
                      <button className="ml-1 text-gray-500" onClick={() => removeMember(m)} title="remove">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button className="rounded-md bg-[#1976d2] text-white px-4 py-2 text-sm disabled:opacity-60"
                onClick={create} disabled={creating || !title.trim()}>
                {creating ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
