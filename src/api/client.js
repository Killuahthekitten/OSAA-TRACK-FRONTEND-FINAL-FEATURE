const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "osaa_track_admin_token";

// "Remember Me" decides WHERE the token lives: localStorage survives a
// closed browser/tab, sessionStorage is cleared as soon as the tab closes.
// This does not affect how long the session is valid server-side (that's
// SESSION_TTL_HOURS) — only whether the browser keeps offering the token
// on the visitor's next visit.
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token, remember = true) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (token) {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  }
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Is the backend running?");
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || "UNKNOWN_ERROR", data?.message || "Something went wrong.");
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  del: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

// Protected binary endpoints (file view/download) can't go through the
// JSON `request()` helper above, but they still sit behind the same
// bearer-token session and can fail the exact same way (expired TTL,
// superseded by a login elsewhere, or — in dev — a backend restart, since
// the single admin session lives in server memory, not the database).
// Without this, a raw `fetch()` for a file would just come back 401 and
// look like a random "couldn't load" — this makes it throw the same
// ApiError shape `handleSessionInvalidated()` already knows how to catch,
// so file viewers can redirect to login with a clear reason instead of
// silently failing.
export async function fetchProtectedFile(path) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Is the backend running?");
  }
  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json().catch(() => ({})) : null;
    throw new ApiError(res.status, data?.error || "UNKNOWN_ERROR", data?.message || "Could not load the file.");
  }
  return res.blob();
}
