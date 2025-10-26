// src/lib/api.jsx
import { loadToken, clearToken } from "./storage";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function request(path, { method = "GET", json, headers } = {}) {
  const token = loadToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : undefined,
  });

  // Handle 401: clear stale token so the app can redirect to login
  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.detail || msg;
    } catch {}
    throw new Error(msg);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const authApi = {
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", json: { username, password } }),
};

export const usersApi = {
  create: ({ username, password, role, email }) =>
    request("/api/users", { method: "POST", json: { username, password, role, email } }),
  overview: () => request("/api/users/overview"),
  counts: () => request("/api/users/counts"),
  list: ({ page = 1, limit = 20, role, q } = {}) =>
    request(`/api/users?${new URLSearchParams({ page, limit, ...(role ? { role } : {}), ...(q ? { q } : {}) })}`),
  delete: (username) => request(`/api/users/${encodeURIComponent(username)}`, { method: "DELETE" }),
  search: (q, limit = 10) => request(`/api/users/search?${new URLSearchParams({ q, limit })}`),
};

export const projectsApi = {
  create: ({ title, description, members }) =>
    request("/api/projects", {
      method: "POST",
      json: { title, description, members },
    }),

  list: ({ page = 1, limit = 50 } = {}) =>
    request(`/api/projects?${new URLSearchParams({ page, limit })}`),

  count: () => request("/api/projects/count"),

  get: (id) => request(`/api/projects/${encodeURIComponent(id)}`),

  // PATCH /api/projects/:id/members with { add: [...], remove: [...] }
  patchMembers: (id, { add = [], remove = [] } = {}) =>
    request(`/api/projects/${encodeURIComponent(id)}/members`, {
      method: "PATCH",
      json: { add, remove },
    }),
};


export { API_BASE };
