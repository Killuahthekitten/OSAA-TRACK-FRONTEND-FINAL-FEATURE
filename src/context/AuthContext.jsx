import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, ApiError } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState("checking"); // checking | authenticated | unauthenticated
  const [sessionNotice, setSessionNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = getToken();
      if (!token) {
        setStatus("unauthenticated");
        return;
      }
      try {
        const data = await api.get("/api/auth/me");
        if (!cancelled) {
          setAdmin(data.admin);
          setStatus("authenticated");
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setStatus("unauthenticated");
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password, remember = true) => {
    const data = await api.post("/api/auth/login", { username, password }, { auth: false });
    setToken(data.token, remember);
    setAdmin(data.admin);
    setStatus("authenticated");
    setSessionNotice(null);
    return data.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore — we're clearing local state regardless
    }
    setToken(null);
    setAdmin(null);
    setStatus("unauthenticated");
  }, []);

  // Called by any request that comes back with SESSION_SUPERSEDED / SESSION_EXPIRED
  const handleSessionInvalidated = useCallback((err) => {
    if (err instanceof ApiError && (err.code === "SESSION_SUPERSEDED" || err.code === "SESSION_EXPIRED")) {
      setToken(null);
      setAdmin(null);
      setStatus("unauthenticated");
      setSessionNotice(err.message);
      return true;
    }
    return false;
  }, []);

  // Called after Settings updates the admin's display name/username, so
  // the header and greeting reflect the change immediately without a
  // full page reload.
  const updateAdmin = useCallback((partial) => {
    setAdmin((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ admin, status, login, logout, sessionNotice, setSessionNotice, handleSessionInvalidated, updateAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
