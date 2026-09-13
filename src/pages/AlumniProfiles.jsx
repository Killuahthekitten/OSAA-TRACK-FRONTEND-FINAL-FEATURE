import { useEffect, useRef, useState } from "react";
import { Contact, Plus, Trash2, Briefcase } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { inputClass, selectClass, labelClass, textareaClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const EMPLOYMENT_STATUSES = ["Employed", "Unemployed", "Self-Employed", "Further Studies"];

function emptyForm() {
  return { name: "", program: "", batchYear: "", employmentStatus: "", employer: "", jobDescription: "" };
}

export default function AlumniProfiles() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [programFilter, setProgramFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const params = new URLSearchParams();
      if (programFilter) params.set("program", programFilter);
      if (statusFilter) params.set("employmentStatus", statusFilter);
      const data = await api.get(`/api/alumni-profiles?${params.toString()}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programFilter, statusFilter]);

  function openCreate() {
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      await api.post("/api/alumni-profiles", form);
      notify("Profile added.");
      setModalOpen(false);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/api/alumni-profiles/${deleteTarget.id}`);
      notify("Profile removed.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  const programs = [...new Set(items.map((i) => i.program).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
            <Contact size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Alumni Profiles</h1>
            <p className="text-sm text-slate-500">Alumni tracer registry — degree, batch, and employment status</p>
          </div>
        </div>
        <button onClick={openCreate} className={primaryButtonClass}><Plus size={16} /> Add Profile</button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className={`${selectClass} sm:w-64`}>
          <option value="">All programs</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${selectClass} sm:w-48`}>
          <option value="">All employment statuses</option>
          {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {state === "loading" && <LoadingState label="Loading alumni profiles..." />}
      {state === "error" && <ErrorState onRetry={load} />}
      {state === "ready" && items.length === 0 && <EmptyState icon={Contact} title="No alumni profiles yet" />}
      {state === "ready" && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-sm font-semibold text-slate-800">{p.name}</h3>
                  <p className="text-xs text-slate-500">{p.program || "—"} {p.batch_year ? `· Batch ${p.batch_year}` : ""}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {p.employment_status || "Unknown"}
                </span>
              </div>

              {(p.employer || p.job_description) && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                  <Briefcase size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    {p.employer && <p className="text-xs font-semibold text-slate-700">{p.employer}</p>}
                    {p.job_description && <p className="mt-0.5 text-xs text-slate-500">{p.job_description}</p>}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-1">
                <button onClick={() => setDeleteTarget(p)} className="flex size-8 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Alumni Profile" maxWidth="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <div><label className={labelClass}>Full name</label><input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><label className={labelClass}>Degree program</label><input className={`${inputClass} mt-1`} value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Batch year</label><input type="number" className={`${inputClass} mt-1`} value={form.batchYear} onChange={(e) => setForm((f) => ({ ...f, batchYear: e.target.value }))} /></div>
            <div>
              <label className={labelClass}>Employment status</label>
              <select className={`${selectClass} mt-1`} value={form.employmentStatus} onChange={(e) => setForm((f) => ({ ...f, employmentStatus: e.target.value }))}>
                <option value="">Select...</option>
                {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div><label className={labelClass}>Employer</label><input className={`${inputClass} mt-1`} value={form.employer} onChange={(e) => setForm((f) => ({ ...f, employer: e.target.value }))} placeholder="e.g. NorthLuzon Data Systems" /></div>
          <div><label className={labelClass}>Job description</label><textarea rows={3} className={`${textareaClass} mt-1`} value={form.jobDescription} onChange={(e) => setForm((f) => ({ ...f, jobDescription: e.target.value }))} placeholder="What they do in the role..." /></div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>Add Profile</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Remove profile?" description={`"${deleteTarget?.name}" will be permanently removed from the registry.`} confirmLabel="Delete" />
    </div>
  );
}
