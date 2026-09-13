import { useEffect } from "react";
import { NavLink, useMatch } from "react-router-dom";
import { X } from "lucide-react";
import { NAV_GROUPS } from "./navConfig.js";
import { useDashboardSummary } from "../../context/DashboardContext.jsx";

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex h-[19px] min-w-[22px] items-center justify-center rounded-full bg-status-danger px-1.5 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

function NavItem({ item, onNavigate }) {
  const { getVisibleBadge, markSeen } = useDashboardSummary();
  const badgeCount = item.badgeKey ? getVisibleBadge(item.badgeKey) : null;
  const isActive = Boolean(useMatch({ path: item.to, end: item.end }));
  const Icon = item.icon;

  // Acknowledge this module's current badge count once it's open — the
  // badge won't reappear until the underlying count grows again.
  useEffect(() => {
    if (isActive && item.badgeKey) markSeen(item.badgeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, item.badgeKey, badgeCount]);

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={[
        "group relative flex w-full items-center gap-3.5 rounded-xl2 px-4 py-3 text-sm transition-colors duration-150",
        isActive
          ? "bg-white/[0.14] font-semibold text-white"
          : "text-white/60 hover:bg-white/[0.08] hover:text-white/90",
      ].join(" ")}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r bg-gradient-to-b from-indigo-400 to-sky-500" />
      )}
      <Icon size={20} className={isActive ? "opacity-100" : "opacity-65"} strokeWidth={2} />
      <span className="flex-1 truncate">{item.label}</span>
      <NavBadge count={badgeCount} />
    </NavLink>
  );
}

export default function Sidebar({ open = false, onClose }) {
  return (
    <>
      {/* Backdrop — mobile/tablet drawer only */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col overflow-y-auto bg-gradient-to-b from-sidebar-from via-sidebar-via to-sidebar-to pb-8 shadow-[0px_25px_25px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-out",
          "lg:top-[76px] lg:z-20 lg:h-[calc(100vh-76px)] lg:w-[300px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-5 pt-5 lg:hidden">
          <span className="font-heading text-sm font-bold text-white/80">Navigation</span>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-3 px-4 pt-6 lg:pt-8">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[1.65px] text-white/35">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onClose} />
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
