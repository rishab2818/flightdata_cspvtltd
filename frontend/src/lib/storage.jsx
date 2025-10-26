// src/lib/storage.jsx

// Small safe wrapper so code won't crash in non-browser contexts.
// In Vite this is usually not needed, but it's harmless.
const hasStorage = typeof window !== "undefined" && !!window.localStorage;

const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

// ------------- Token helpers -------------
export function loadToken() {
  if (!hasStorage) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token) {
  if (!hasStorage) return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

export function clearToken() {
  if (!hasStorage) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

// ------------- User helpers -------------
export function loadUser() {
  if (!hasStorage) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUser(user) {
  if (!hasStorage) return;
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

export function clearUser() {
  if (!hasStorage) return;
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* noop */
  }
}

// Optional convenience: clear both at once
export function clearSession() {
  clearToken();
  clearUser();
}
