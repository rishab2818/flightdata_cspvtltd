// src/pages/project/ProjectSettingsTab.jsx
import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/auth";
import { projectsApi, usersApi } from "../../lib/api";

export default function ProjectSettingsTab() {
  const { project, reload } = useOutletContext();
  const { user, isHead } = useAuth();

  const isMember = (project?.members || []).includes(user?.username);
  const canManage = isHead && isMember; // GD/DH and part of this project

  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState(project?.members || []);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const timerRef = useRef(null);

  useEffect(() => setMembers(project?.members || []), [project?.members]);

  useEffect(() => {
    if (!canManage) return;
    if (timerRef.current) clearTimeout(timerRef.current);
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
  }, [memberInput, canManage]);

  const add = (u) => {
    if (!u) return;
    setMembers((m) => (m.includes(u) ? m : [...m, u]));
  };
  const remove = (u) => setMembers((m) => m.filter((x) => x !== u));

  const save = async () => {
    if (!canManage) return;
    setSaving(true);
    setErr(null);

    const current = new Set(project.members || []);
    const next = new Set(members);
    const addList = [...next].filter((x) => !current.has(x));
    const remList = [...current].filter((x) => !next.has(x));

    try {
      await projectsApi.patchMembers(project._id || project.id, {
        add: addList,
        remove: remList,
      });
      await reload();
    } catch (e) {
      setErr(e.message || "Failed to update members");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="font-semibold">Settings</div>

      {!canManage && (
        <div className="text-sm text-gray-500">
          You can view project settings. Only GD/DH who are members can manage members.
        </div>
      )}

      <div className="rounded-xl bg-white p-4 border shadow-sm">
        <div className="mb-3 font-medium">Members</div>

        {canManage && (
          <div className="mb-3">
            <div className="relative">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Search username…"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
              />
              {memberInput && (suggestions.length > 0 || searching) && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
                  {searching && <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>}
                  {suggestions.map((u) => (
                    <div key={u.username} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50">
                      <div className="text-sm">
                        <div className="font-medium">{u.username}</div>
                        <div className="text-xs text-gray-500">{u.role}</div>
                      </div>
                      <button className="text-xs border rounded px-2 py-1" onClick={() => add(u.username)}>
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border">
              {m}
              {canManage && (
                <button className="ml-1 text-gray-500" onClick={() => remove(m)} title="remove">×</button>
              )}
            </span>
          ))}
        </div>

        {err && <div className="text-sm text-red-600 mt-3">{err}</div>}

        {canManage && (
          <div className="mt-3">
            <button
              className="rounded-md bg-[#1976d2] text-white px-4 py-2 text-sm disabled:opacity-60"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
