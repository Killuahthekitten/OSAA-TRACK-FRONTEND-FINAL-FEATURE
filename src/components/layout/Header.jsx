import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import psuSeal from "../../assets/psu-seal.png";
import saaSeal from "../../assets/saa-seal.png";

function SealBadge({ src, alt, className = "" }) {
  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.6px] border-[#667eea] bg-white shadow-card sm:size-[52px] ${className}`}
    >
      <img src={src} alt={alt} className="size-full object-cover" />
    </div>
  );
}

function getInitials(displayName) {
  const value = (displayName || "Admin").trim();
  if (value.includes(" ")) {
    return value
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  // Email-style identity (e.g. osaa_ms@psu.edu.ph) — use the local part.
  const local = value.split("@")[0];
  const letters = local.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || value.slice(0, 2)).toUpperCase();
}

export default function Header({ onMenuClick }) {
  const { admin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = getInitials(admin?.displayName);

  return (
    <header className="fixed left-0 right-0 top-0 z-30 h-[76px] border-b-[1.6px] border-[#1e1b49] bg-gradient-to-b from-gold to-slate-100 shadow-card">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4 lg:gap-6">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={onMenuClick}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[#334155] transition hover:bg-black/5 lg:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="hidden items-center gap-3 xs:flex">
            <SealBadge src={psuSeal} alt="Pangasinan State University seal" />
            <SealBadge src={saaSeal} alt="Student and Alumni Affairs Unit seal" className="hidden sm:flex" />
          </div>
          <div className="hidden h-11 w-px bg-black/70 sm:block" />
          <div className="min-w-0">
            <h1 className="truncate font-heading text-base font-bold tracking-[0.5px] text-[#2c3e50] sm:text-xl">
              OSAA-TRACK
            </h1>
            <p className="hidden truncate text-[11px] font-medium uppercase tracking-[0.9px] text-[#7f8c8d] sm:block">
              Pangasinan State University &ndash; Lingayen
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl2 px-1.5 py-1.5 transition hover:bg-black/5 sm:gap-3.5 sm:px-3.5 sm:py-2.5"
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-card sm:size-10"
                style={{ backgroundImage: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
              >
                {initials}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-semibold text-[#2c3e50]">{admin?.displayName}</p>
                <span className="mt-0.5 inline-block rounded-full bg-[#e3f2fd] px-2 py-0.5 text-[11px] font-medium text-[#1976d2]">
                  Administrator
                </span>
              </div>
              <ChevronDown size={16} className="hidden text-slate-500 sm:block" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 animate-toast-in overflow-hidden rounded-xl2 border border-slate-200 bg-white py-1.5 shadow-panel">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <p className="text-xs text-slate-500">Signed in as</p>
                  <p className="truncate text-sm font-medium text-slate-700">{admin?.username}</p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-status-danger transition hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
