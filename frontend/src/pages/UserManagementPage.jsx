// src/pages/UserManagementPage.jsx
import React, { useEffect, useState } from "react";
import { usersApi } from "../lib/api";
import { useAuth } from "../context/auth";
import { AdminOnly } from "../lib/roles"; // <-- consistent source

export default function UserManagementPage() {
  const { user } = useAuth();
  const role = user?.role || "";
  const isAllowed = AdminOnly.has(role); // admin only

  // early guard (keeps layout consistent, no crashes)
  if (!isAllowed) {
    return (
      <div className="rounded-xl bg-white border p-4">
        <div className="text-sm text-gray-600">Not authorized.</div>
      </div>
    );
  }

  // --- existing UI & logic (unchanged except for imports) ---
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page] = useState(1);
  const [limit] = useState(20);

  // form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleCreate, setRoleCreate] = useState("GD");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, limit, q });
      setList(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const createUser = async (e) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await usersApi.create({ username, password, role: roleCreate, email: email || undefined });
      setUsername("");
      setPassword("");
      setRoleCreate("GD");
      setEmail("");
      await load();
    } catch (e) {
      setErr(e.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const removeUser = async (u) => {
    if (!confirm(`Delete user "${u}"?`)) return;
    try {
      await usersApi.delete(u);
      await load();
    } catch (e) {
      alert(e.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-white border p-4 flex items-center justify-between">
        <h3 className="font-semibold">User Management</h3>
        <div className="text-sm text-gray-500">Admin only</div>
      </div>

      {/* Create panel */}
      <div className="rounded-xl bg-white border p-4">
        <h4 className="font-semibold mb-3">Create User</h4>
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={createUser}>
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={roleCreate}
            onChange={(e) => setRoleCreate(e.target.value)}
          >
            <option value="GD">GD</option>
            <option value="DH">DH</option>
            <option value="TL">TL</option>
            <option value="SM">SM</option>
            <option value="OIC">OIC</option>
            <option value="JRF">JRF</option>
            <option value="SRF">SRF</option>
            <option value="CE">CE</option>
            <option value="STUDENT">STUDENT</option>
          </select>
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />

          {err && <div className="col-span-full text-sm text-red-600">{err}</div>}

          <div className="col-span-full flex justify-end">
            <button
              className="rounded-md bg-[#1976d2] text-white px-4 py-2 text-sm disabled:opacity-60"
              type="submit"
              disabled={submitting || !username || !password}
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>

      {/* Search + list */}
      <div className="rounded-xl bg-white border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Users</h4>
          <input
            className="rounded-md border px-3 py-2 text-sm w-60"
            placeholder="Search username…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading && <div className="text-sm text-gray-600">Loading…</div>}
        {!loading && list.length === 0 && <div className="text-sm text-gray-600">No users.</div>}

        <div className="divide-y">
          {list.map((u) => (
            <div key={u.username} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{u.username}</div>
                <div className="text-xs text-gray-500">{u.role}</div>
              </div>
              <button
                onClick={() => removeUser(u.username)}
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
