import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { ApiError } from "../api/client.js";
import psuSeal from "../assets/psu-seal.png";
import saaSeal from "../assets/saa-seal.png";

export default function AdminLogin() {
  const { login, sessionNotice, setSessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showForgotNote, setShowForgotNote] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password, remember);
      const redirectTo = location.state?.from || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-navy-700 via-navy-600 to-navy-500">
      {/* decorative glow blobs, matching the Figma background treatment */}
      <div className="pointer-events-none absolute -left-40 -top-44 size-[380px] rounded-full bg-gold/[0.06]" />
      <div className="pointer-events-none absolute bottom-10 right-[6%] size-[280px] rounded-full bg-sky-200/[0.05]" />
      <div className="pointer-events-none absolute right-[14%] top-[35%] size-[160px] rounded-full bg-brand-red/[0.04]" />

      {/* top identity bar — single PSU seal, single line, matches Figma exactly */}
      <div
        className="relative z-10 overflow-hidden shadow-lg"
        style={{ backgroundImage: "linear-gradient(116deg, rgb(17,29,78) 0%, rgb(27,42,107) 40%, rgb(42,61,143) 70%, rgb(27,42,107) 100%)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-[18px]">
            <img
              src={psuSeal}
              alt="Pangasinan State University seal"
              className="size-10 shrink-0 rounded-full object-cover sm:size-[63px]"
            />
            <p
              className="truncate font-banner font-bold text-white sm:text-[19.8px]"
              style={{ letterSpacing: "1px", textShadow: "0px 1px 4px rgba(0,0,0,0.5)" }}
            >
              Pangasinan State University
            </p>
          </div>
          <p
            className="shrink-0 font-banner text-base font-bold uppercase text-gold sm:text-[27.7px]"
            style={{ letterSpacing: "2.24px", textShadow: "0px 2px 6px rgba(0,0,0,0.5)" }}
          >
            Administrator
          </p>
        </div>
        <div
          className="h-[5px] w-full"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgb(212,168,0) 0%, rgb(245,200,0) 40%, rgb(249,218,90) 60%, rgb(245,200,0) 80%, rgb(212,168,0) 100%)",
          }}
        />
      </div>

      {/* login card */}
      <div className="relative flex items-center justify-center px-4 py-10 sm:px-8 sm:py-16">
        <div className="w-full max-w-[980px] overflow-hidden rounded-xl2 shadow-panel lg:flex">
          {/* branding panel */}
          <div
            className="relative flex flex-col items-center justify-center gap-5 overflow-hidden px-8 py-10 text-center lg:w-[392px] lg:shrink-0 lg:py-0"
            style={{
              backgroundImage:
                "linear-gradient(152deg, rgb(13,31,92) 8%, rgb(9,21,71) 58%, rgb(6,14,46) 92%)",
            }}
          >
            <div className="pointer-events-none absolute -left-20 top-2/3 size-[280px] rounded-full bg-brand-red/[0.08]" />
            <div className="pointer-events-none absolute -top-16 right-[-60px] size-[200px] rounded-full bg-sky-200/[0.06]" />

            <div className="relative flex size-[122px] items-center justify-center rounded-full border-[2.5px] border-gold/60 shadow-[0px_0px_38px_rgba(245,200,0,0.15)]">
              <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-white">
                <img src={saaSeal} alt="Student and Alumni Affairs Unit seal" className="size-full object-cover" />
              </div>
            </div>

            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[4px] text-brand-red">Welcome to</p>
              <p className="mt-1 font-display text-[38px] font-black leading-[1.05] tracking-tight text-white">
                OSAA<span className="text-brand-red">-</span>
                <br />
                TRACK
              </p>
              <p className="mt-3 font-accent text-xs tracking-[0.3px] text-[#a8d4f5]">
                Pangasinan State University
                <br />
                Lingayen Campus
              </p>
              <div className="mx-auto my-4 h-px w-12 bg-gradient-to-r from-transparent via-brand-red to-transparent" />
              <p className="font-accent text-[11px] italic leading-relaxed text-[#a8d4f5]/50">
                Administrator Portal &mdash;<br />
                Manage with authority, serve with excellence.
              </p>
            </div>
          </div>

          {/* form panel */}
          <div className="flex-1 bg-white px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto flex max-w-[484px] items-center justify-between rounded-[10px] bg-[#1e1e2e] px-4 py-3 shadow-md sm:px-6">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-[7px] bg-brand-red/[0.18]">
                  <ShieldAlert size={16} className="text-brand-red" />
                </div>
                <p className="font-display text-sm font-black tracking-[3px] text-white">ADMIN</p>
              </div>
              <span className="rounded-full bg-brand-red px-3 py-1 text-[9px] font-extrabold uppercase tracking-[1.5px] text-white">
                Restricted
              </span>
            </div>

            <div className="mx-auto mt-7 max-w-[484px]">
              <h2 className="font-display text-xl font-extrabold text-navy-700">Administrator Sign In</h2>
              <p className="mt-1 text-[13px] text-slate-500">Access the OSAA-TRACK admin portal</p>

              {sessionNotice && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  {sessionNotice}
                  <button type="button" className="ml-1 underline" onClick={() => setSessionNotice(null)}>
                    Dismiss
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="username" className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-navy-800">
                    Email Address
                  </label>
                  <input
                    id="username"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="e.g. osaa_ms@psu.edu.ph"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-[45px] w-full rounded-lg border border-[#d0d9e8] px-3.5 text-[13px] text-slate-700 placeholder:text-[#b0bdd4] focus:border-brand-blue"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-navy-800">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-[45px] w-full rounded-lg border border-[#d0d9e8] px-3.5 pr-11 text-[13px] text-slate-700 placeholder:text-[#b0bdd4] focus:border-brand-blue"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[13px]">
                  <label className="flex items-center gap-2 text-[#5a6a8a]">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="size-[15px] rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                    />
                    Remember Me
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowForgotNote((v) => !v)}
                      className="font-bold text-brand-blue hover:underline"
                    >
                      Forgot Password?
                    </button>
                    {showForgotNote && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-panel">
                        Only one administrator account exists for OSAA-TRACK. Contact the system administrator
                        directly to reset the password &mdash; there is no self-service reset by design.
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-brand-blue text-[13px] font-extrabold uppercase tracking-[2px] text-white shadow-[0px_4px_9px_rgba(37,99,235,0.38)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Signing in...
                    </>
                  ) : (
                    <>
                      <Lock size={14} /> Sign In
                    </>
                  )}
                </button>

                <p className="border-t border-[#e8edf5] pt-4 text-center text-[11px] text-slate-400">
                  Only one active session is allowed per administrator account at a time.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
