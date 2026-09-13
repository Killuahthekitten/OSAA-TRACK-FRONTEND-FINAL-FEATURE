import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const DashboardContext = createContext(null);
const SEEN_KEY = "osaa_track_seen_badge_counts";

function loadSeenCounts() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY)) || {};
  } catch {
    return {};
  }
}

export function DashboardProvider({ children }) {
  const { status, handleSessionInvalidated } = useAuth();
  const [summary, setSummary] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ready | error
  const [seenCounts, setSeenCounts] = useState(loadSeenCounts);

  const refresh = useCallback(async () => {
    setState("loading");
    try {
      const data = await api.get("/api/dashboard/summary");
      setSummary(data);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }, [handleSessionInvalidated]);

  useEffect(() => {
    if (status === "authenticated") refresh();
  }, [status, refresh]);

  // Sidebar badges behave like an inbox unread count: opening a module
  // acknowledges its current count, and the badge only reappears once the
  // count grows past what was last seen — not the moment a new item is
  // resolved, since a still-pending item shouldn't keep re-flagging itself
  // every time the admin glances at the sidebar.
  const markSeen = useCallback((key) => {
    setSeenCounts((prev) => {
      const currentCount = summary?.badges?.[key] || 0;
      if (prev[key] === currentCount) return prev;
      const next = { ...prev, [key]: currentCount };
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      return next;
    });
  }, [summary]);

  const getVisibleBadge = useCallback(
    (key) => Math.max(0, (summary?.badges?.[key] || 0) - (seenCounts[key] || 0)),
    [summary, seenCounts]
  );

  return (
    <DashboardContext.Provider value={{ summary, state, refresh, markSeen, getVisibleBadge }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardSummary() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboardSummary must be used within DashboardProvider");
  return ctx;
}
