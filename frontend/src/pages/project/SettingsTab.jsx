import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { usersApi } from "../../lib/api";

export default function SettingsTab() {
  const { project, reload } = useOutletContext();
  const projectId = project.id || project._id;

  const [members, setMembers] = useState(project.members || []);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  let timer = null;

  useEffect(() => { setMembers(project.members || []); }, [project]);

  useEffect(() => {
    if (!q.trim()) { setSuggestions([]); return; }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { setSuggestions(await usersApi.search(q.trim(), 8)); } catch { setSuggestions([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const patch = async (add, remove) => {
    const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
    const token = localStorage.getItem("flightdv_token");
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ add, remove }),
    });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).detail || `HTTP ${res.status}`);
    const updated = await res.json();
    setMembers(updated.members || []);
    setQ(""); setSuggestions([]);
    reload && reload(); // refresh header (member count)
  };

  const addMember = (u) => members.includes(u) ? null : patch([u], []);
  const removeMember = (u) => patch([], [u]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">Settings for <span className="font-medium">{project.title}</span></div>

      <div className="rounded-xl bg-white border p-5">
        <div className="font-semibold mb-2">Add Members</div>
        <div className="relative">
          <input value={q} onChange={(e)=>setQ(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Search username…" />
          {q && suggestions.length > 0 && (
            <div className="absolute mt-1 w-full bg-white border rounded shadow z-10">
              {suggestions.map(s => (
                <div key={s.username} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="text-sm font-medium">{s.username}</div>
                    <div className="text-xs text-gray-500">{s.role}</div>
                  </div>
                  <button className="text-xs border rounded px-2 py-1" onClick={()=>addMember(s.username)} disabled={members.includes(s.username)}>
                    {members.includes(s.username) ? "Added" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5">
        <div className="font-semibold mb-2">Current Members</div>
        {members.length === 0 && <div className="text-sm text-gray-500">No members yet.</div>}
        <div className="flex flex-wrap gap-2">
          {members.map(m => (
            <span key={m} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs border">
              {m}
              <button className="ml-1 text-gray-500" onClick={()=>removeMember(m)} title="remove">×</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
