import { useEffect, useMemo, useRef, useState } from "react";
import { Award, ArrowLeft, ChevronDown, Eye, Plus, Paperclip } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDashboardSummary } from "../context/DashboardContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Modal from "../components/ui/Modal.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import { inputClass, selectClass, labelClass, textareaClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function rgb(arr, alpha = 1) {
  return `rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${alpha})`;
}

// ── Level 1: "Select Program" card grid (matches Figma exactly) ─────────
function ProgramGrid({ colleges, colors, counts, onSelect }) {
  const programs = Object.values(colleges).flat();
  return (
    <div>
      <h2 className="mb-5 text-lg font-semibold text-slate-900">Select Program</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => {
          const color = colors[program] || [100, 116, 139];
          return (
            <button
              key={program}
              onClick={() => onSelect(program)}
              className="rounded-xl2 p-6 text-left text-white shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundImage: `linear-gradient(164deg, ${rgb(color)} 0%, ${rgb(color, 0.867)} 100%)` }}
            >
              <h3 className="text-2xl font-bold leading-tight">{program}</h3>
              <p className="mt-2 text-sm opacity-90">{counts[program] || 0} Active Achiever{counts[program] === 1 ? "" : "s"}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function emptyForm(program, college) {
  return { studentName: "", college, program, title: "", description: "", files: [] };
}

// ── Level 2: drill-down table for one program ────────────────────────────
function ProgramTable({ program, college, onBack }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useDashboardSummary();

  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [yearFilter, setYearFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm(program, college));
  const [formError, setFormError] = useState(null);

  const [viewing, setViewing] = useState(null); // achievement being reviewed
  const [viewingFile, setViewingFile] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get(`/api/achievements?program=${encodeURIComponent(program)}`);
      setItems(data.items);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh the list.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    load();
    setForm(emptyForm(program, college));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  const years = useMemo(() => {
    const set = new Set(items.map((a) => new Date(a.submitted_at.replace(" ", "T")).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [items]);

  const filtered = yearFilter
    ? items.filter((a) => new Date(a.submitted_at.replace(" ", "T")).getFullYear() === Number(yearFilter))
    : items;

  async function approve(item) {
    try {
      await api.patch(`/api/achievements/${item.id}/decide`, { status: "approved" });
      notify("Achievement approved and added to the registry.");
      setViewing(null);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  async function reject() {
    if (!rejectReason.trim()) {
      notify("A written justification is required to reject.", "error");
      return;
    }
    try {
      await api.patch(`/api/achievements/${viewing.id}/decide`, { status: "rejected", rejectionReason: rejectReason });
      notify("Achievement rejected.");
      setRejecting(false);
      setRejectReason("");
      setViewing(null);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  async function submitCreate(e) {
    e.preventDefault();
    setFormError(null);
    if (!form.studentName.trim() || !form.title.trim()) {
      setFormError("Student name and achievement title are required.");
      return;
    }
    try {
      const { id } = await api.post("/api/achievements", form);
      for (const f of form.files) {
        await api.post(`/api/achievements/${id}/files`, { fileId: f.id });
      }
      notify("Submission logged.");
      setCreateOpen(false);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-blue">
        <ArrowLeft size={15} /> Back to Programs
      </button>
      <h1 className="mb-5 text-xl font-bold text-slate-900">Student Achievement Management</h1>

      <div className="overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{program}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Plus size={13} /> Log Submission
            </button>
            {years.length > 0 && (
              <div className="relative">
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="appearance-none rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-600"
                >
                  <option value="">All years</option>
                  {years.map((y) => <option key={y} value={y}>A.Y. {y}-{y + 1}</option>)}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            )}
          </div>
        </div>

        {state === "loading" && <div className="p-6"><LoadingState label="Loading submissions..." /></div>}
        {state === "error" && <div className="p-6"><ErrorState onRetry={load} /></div>}
        {state === "ready" && filtered.length === 0 && <div className="p-6"><EmptyState icon={Award} title="No submissions for this program" /></div>}
        {state === "ready" && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-5 py-3">Achievement</th>
                  <th className="px-5 py-3">Date Submitted</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t border-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{a.student_name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{a.title}</td>
                    <td className="px-5 py-3.5 text-slate-500">{new Date(a.submitted_at.replace(" ", "T")).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewing(a)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          View Application
                        </button>
                        {a.status === "pending" ? (
                          <>
                            <button onClick={() => approve(a)} className="rounded-lg bg-status-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                              Approve
                            </button>
                            <button onClick={() => { setViewing(a); setRejecting(true); }} className="rounded-lg bg-status-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${a.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {a.status}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log submission modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Log Achievement Submission">
        <form onSubmit={submitCreate} className="space-y-4">
          <div>
            <label className={labelClass}>Student / organization name</label>
            <input className={`${inputClass} mt-1`} value={form.studentName} onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Achievement title</label>
            <input className={`${inputClass} mt-1`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. 1st Place, Regional Science Fair" />
          </div>
          <div>
            <label className={labelClass}>Description (optional)</label>
            <textarea rows={2} className={`${textareaClass} mt-1`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Certificates / invitations / documentation</label>
            <div className="mt-1.5">
              <FileDropzone files={form.files} onChange={(files) => setForm((f) => ({ ...f, files }))} />
            </div>
          </div>
          {formError && <p className="text-xs font-medium text-status-danger">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>Log Submission</button>
          </div>
        </form>
      </Modal>

      {/* View application modal */}
      <Modal
        open={Boolean(viewing) && !rejecting}
        onClose={() => setViewing(null)}
        title={viewing?.title || "Application"}
        maxWidth="max-w-lg"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Student</p><p className="font-medium text-slate-700">{viewing.student_name}</p></div>
              <div><p className="text-xs text-slate-400">Program</p><p className="font-medium text-slate-700">{viewing.program}</p></div>
              <div><p className="text-xs text-slate-400">Submitted</p><p className="font-medium text-slate-700">{new Date(viewing.submitted_at.replace(" ", "T")).toLocaleDateString()}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><p className="font-medium capitalize text-slate-700">{viewing.status}</p></div>
            </div>
            {viewing.description && <p className="text-sm text-slate-600">{viewing.description}</p>}

            <div>
              <p className={labelClass}>Supporting documentation</p>
              {viewing.files?.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {viewing.files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      <Paperclip size={12} className="shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">{f.original_name}</span>
                      <button onClick={() => setViewingFile(f)} className="shrink-0 text-slate-400 hover:text-brand-blue"><Eye size={13} /></button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs italic text-slate-400">No certificates or documentation attached</p>
              )}
            </div>

            {viewing.status === "pending" && (
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => setRejecting(true)} className="rounded-lg bg-status-danger px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Reject</button>
                <button onClick={() => approve(viewing)} className="rounded-lg bg-status-success px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">Approve</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject reason modal */}
      <Modal open={rejecting} onClose={() => { setRejecting(false); setRejectReason(""); }} title="Reject Achievement" maxWidth="max-w-sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Provide a written justification for rejecting &ldquo;{viewing?.title}&rdquo;.</p>
          <textarea rows={3} className={textareaClass} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setRejecting(false); setRejectReason(""); }} className={secondaryButtonClass}>Cancel</button>
            <button onClick={reject} className="rounded-lg bg-status-danger px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Reject</button>
          </div>
        </div>
      </Modal>

      <FileViewerModal
        open={Boolean(viewingFile)}
        onClose={() => setViewingFile(null)}
        fileName={viewingFile?.original_name}
        viewUrl={viewingFile ? `/api/uploads/${viewingFile.id}/view` : null}
        downloadUrl={viewingFile ? `/api/uploads/${viewingFile.id}/download` : null}
      />
    </div>
  );
}

export default function AchievementManagement() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [colleges, setColleges] = useState({});
  const [colors, setColors] = useState({});
  const [counts, setCounts] = useState({});
  const [selectedProgram, setSelectedProgram] = useState(null);
  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/achievements/programs");
      setColleges(data.colleges);
      setColors(data.colors);
      setCounts(data.counts);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function programCollege(program) {
    return Object.entries(colleges).find(([, list]) => list.includes(program))?.[0] || "";
  }

  if (state === "loading") return <LoadingState label="Loading achievement management..." />;
  if (state === "error") return <ErrorState onRetry={load} />;

  return selectedProgram ? (
    <ProgramTable program={selectedProgram} college={programCollege(selectedProgram)} onBack={() => { setSelectedProgram(null); load(); }} />
  ) : (
    <ProgramGrid colleges={colleges} colors={colors} counts={counts} onSelect={setSelectedProgram} />
  );
}
