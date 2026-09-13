import { useEffect, useRef, useState } from "react";
import { Briefcase, Plus, Pencil, Power, Trash2, ExternalLink } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { inputClass, labelClass, textareaClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

function emptyForm() {
  return { title: "", industry: "", company: "", location: "", deadline: "", description: "", requirements: "", externalLink: "" };
}

export default function JobPostings() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/job-postings");
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
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }
  function openEdit(item) {
    setEditing(item);
    setForm({
      title: item.title, industry: item.industry || "", company: item.company, location: item.location || "",
      deadline: item.deadline || "", description: item.description || "", requirements: item.requirements || "", externalLink: item.external_link || "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.company.trim()) {
      setError("Job title and company are required.");
      return;
    }
    try {
      if (editing) await api.put(`/api/job-postings/${editing.id}`, form);
      else await api.post("/api/job-postings", form);
      notify(editing ? "Job posting updated." : "Job posting created.");
      setModalOpen(false);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function toggleStatus(item) {
    try {
      await api.patch(`/api/job-postings/${item.id}/status`, { status: item.status === "active" ? "inactive" : "active" });
      notify(item.status === "active" ? "Posting deactivated." : "Posting activated.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/api/job-postings/${deleteTarget.id}`);
      notify("Job posting deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
            <Briefcase size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Job Posting</h1>
            <p className="text-sm text-slate-500">Employment opportunities for alumni</p>
          </div>
        </div>
        <button onClick={openCreate} className={primaryButtonClass}><Plus size={16} /> New Posting</button>
      </div>

      {state === "loading" && <LoadingState label="Loading job postings..." />}
      {state === "error" && <ErrorState onRetry={load} />}
      {state === "ready" && items.length === 0 && <EmptyState icon={Briefcase} title="No job postings yet" />}
      {state === "ready" && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((j) => (
            <div key={j.id} className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-sm font-semibold text-slate-800">{j.title}</h3>
                  <p className="text-xs text-slate-500">{j.company} {j.location && `· ${j.location}`}</p>
                </div>
                <StatusBadge status={j.status} />
              </div>
              {j.industry && <p className="mt-2 text-xs text-slate-500">{j.industry}</p>}
              <div className="mt-4 flex items-center gap-2">
                {j.external_link && (
                  <a
                    href={j.external_link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-brand-blue hover:bg-blue-50"
                    title="Visit application link"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button onClick={() => openEdit(j)} className={`${secondaryButtonClass} flex-1`}><Pencil size={13} /> Edit</button>
                <button onClick={() => toggleStatus(j)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-status-warning hover:bg-amber-50"><Power size={14} /></button>
                <button onClick={() => setDeleteTarget(j)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-status-danger hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Job Posting" : "New Job Posting"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Job title</label><input className={`${inputClass} mt-1`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><label className={labelClass}>Company</label><input className={`${inputClass} mt-1`} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Industry</label><input className={`${inputClass} mt-1`} value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} /></div>
            <div><label className={labelClass}>Location</label><input className={`${inputClass} mt-1`} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
          </div>
          <div><label className={labelClass}>Application deadline</label><input type="date" className={`${inputClass} mt-1`} value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} /></div>
          <div><label className={labelClass}>Description</label><textarea rows={3} className={`${textareaClass} mt-1`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div><label className={labelClass}>Requirements</label><textarea rows={2} className={`${textareaClass} mt-1`} value={form.requirements} onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))} /></div>
          <div><label className={labelClass}>External application link</label><input className={`${inputClass} mt-1`} value={form.externalLink} onChange={(e) => setForm((f) => ({ ...f, externalLink: e.target.value }))} placeholder="https://..." /></div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>{editing ? "Save Changes" : "Create Posting"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete job posting?" description={`"${deleteTarget?.title}" will be permanently removed.`} confirmLabel="Delete" />
    </div>
  );
}
