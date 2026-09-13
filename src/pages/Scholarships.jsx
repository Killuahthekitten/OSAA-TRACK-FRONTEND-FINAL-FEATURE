import { useEffect, useRef, useState } from "react";
import { GraduationCap, Plus, X, Users, Archive, RotateCcw, Trash2, CheckCircle2, XCircle, Award, Paperclip, Eye } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDashboardSummary } from "../context/DashboardContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import { inputClass, labelClass, textareaClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function emptyForm() {
  return { name: "", provider: "", deadline: "", amount: "", externalLink: "", requirements: [] };
}

function PostingsPanel() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useDashboardSummary();

  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [reqDraft, setReqDraft] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [applicantsFor, setApplicantsFor] = useState(null); // scholarship object
  const [applicants, setApplicants] = useState([]);
  const [viewingFile, setViewingFile] = useState(null);
  const [attachingFor, setAttachingFor] = useState(null); // applicant id currently showing its dropzone

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/scholarships");
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

  function addRequirement() {
    if (!reqDraft.trim()) return;
    setForm((f) => ({ ...f, requirements: [...f.requirements, reqDraft.trim()] }));
    setReqDraft("");
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.provider.trim()) {
      setError("Scholarship name and provider are required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/scholarships", form);
      notify("Scholarship posted.");
      setModalOpen(false);
      setForm(emptyForm());
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item) {
    try {
      await api.patch(`/api/scholarships/${item.id}/${item.status === "active" ? "close" : "reopen"}`);
      notify(item.status === "active" ? "Scholarship closed." : "Scholarship reactivated.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/api/scholarships/${deleteTarget.id}`);
      notify("Scholarship deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  async function openApplicants(item) {
    setApplicantsFor(item);
    try {
      const data = await api.get(`/api/scholarships/${item.id}/applicants`);
      setApplicants(data.items);
    } catch {
      setApplicants([]);
    }
  }

  async function addApplicantFiles(applicantId, files) {
    const newFile = files[files.length - 1];
    if (!newFile) return;
    try {
      await api.post(`/api/scholarships/applicants/${applicantId}/files`, { fileId: newFile.id });
      notify("File attached.");
      openApplicants(applicantsFor);
    } catch {
      notify("Could not attach file.", "error");
    }
  }

  async function decideApplicant(applicantId, status) {
    try {
      await api.patch(`/api/scholarships/applicants/${applicantId}`, { status });
      notify(status === "accepted" ? "Applicant accepted and added to recipients." : "Applicant rejected.");
      openApplicants(applicantsFor);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  if (state === "loading") return <LoadingState label="Loading scholarships..." />;
  if (state === "error") return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} posting{items.length === 1 ? "" : "s"}</p>
        <button onClick={() => setModalOpen(true)} className={primaryButtonClass}>
          <Plus size={16} /> New Scholarship
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No scholarships posted yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((s) => (
            <div key={s.id} className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-heading text-sm font-semibold text-slate-800">{s.name}</h3>
                  <p className="text-xs text-slate-500">{s.provider}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {s.deadline && <span>Deadline: {s.deadline}</span>}
                {s.amount && <span>₱{Number(s.amount).toLocaleString()}</span>}
                <span>{s.applicant_count} applicant{s.applicant_count === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => openApplicants(s)} className={`${secondaryButtonClass} flex-1`}>
                  <Users size={14} /> Applicants
                </button>
                <button onClick={() => toggleStatus(s)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-status-warning hover:bg-amber-50">
                  {s.status === "active" ? <Archive size={14} /> : <RotateCcw size={14} />}
                </button>
                <button onClick={() => setDeleteTarget(s)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-status-danger hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Scholarship">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Scholarship name</label>
            <input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Provider</label>
            <input className={`${inputClass} mt-1`} value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Deadline</label>
              <input type="date" className={`${inputClass} mt-1`} value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Amount (₱)</label>
              <input type="number" className={`${inputClass} mt-1`} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelClass}>External link (optional)</label>
            <input className={`${inputClass} mt-1`} value={form.externalLink} onChange={(e) => setForm((f) => ({ ...f, externalLink: e.target.value }))} placeholder="https://..." />
          </div>
          <div>
            <label className={labelClass}>Required documents</label>
            <div className="mt-1.5 flex gap-2">
              <input className={inputClass} value={reqDraft} onChange={(e) => setReqDraft(e.target.value)} placeholder="e.g. Certificate of Registration" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRequirement())} />
              <button type="button" onClick={addRequirement} className={secondaryButtonClass}>Add</button>
            </div>
            {form.requirements.length > 0 && (
              <ul className="mt-2 space-y-1">
                {form.requirements.map((r, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    {r}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, requirements: f.requirements.filter((_, idx) => idx !== i) }))} className="text-slate-400 hover:text-status-danger">
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" disabled={saving} className={primaryButtonClass}>Post Scholarship</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(applicantsFor)} onClose={() => setApplicantsFor(null)} title={`Applicants — ${applicantsFor?.name || ""}`}>
        {applicants.length === 0 ? (
          <EmptyState icon={Users} title="No applicants yet" />
        ) : (
          <ul className="space-y-3">
            {applicants.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-100 px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{a.student_name}</p>
                    <p className="text-xs text-slate-400">{a.student_id}</p>
                  </div>
                  {a.status === "pending" ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => decideApplicant(a.id, "accepted")} className="flex size-8 items-center justify-center rounded-lg text-status-success hover:bg-emerald-50" title="Accept">
                        <CheckCircle2 size={16} />
                      </button>
                      <button onClick={() => decideApplicant(a.id, "rejected")} className="flex size-8 items-center justify-center rounded-lg text-status-danger hover:bg-red-50" title="Reject">
                        <XCircle size={16} />
                      </button>
                    </div>
                  ) : (
                    <StatusBadge status={a.status} />
                  )}
                </div>

                <div className="mt-2.5">
                  {a.files?.length > 0 ? (
                    <ul className="space-y-1">
                      {a.files.map((f) => (
                        <li key={f.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                          <Paperclip size={12} className="shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{f.original_name}</span>
                          <button onClick={() => setViewingFile(f)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                            <Eye size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs italic text-slate-400">No requirement files uploaded yet</p>
                  )}

                  {attachingFor === a.id ? (
                    <div className="mt-2">
                      <FileDropzone files={[]} onChange={(files) => addApplicantFiles(a.id, files)} multiple={false} label="Attach a requirement file" />
                    </div>
                  ) : (
                    <button onClick={() => setAttachingFor(a.id)} className="mt-1.5 text-xs font-medium text-brand-blue hover:underline">
                      + Attach file
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete scholarship?"
        description={`"${deleteTarget?.name}" and its applicant records will be permanently deleted.`}
        confirmLabel="Delete"
      />

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

function RecipientsPanel() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [recipients, setRecipients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [form, setForm] = useState({ categoryId: "", studentName: "", studentId: "", program: "", term: "", amount: "", status: "Granted" });
  const [error, setError] = useState(null);

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const [r, c] = await Promise.all([api.get("/api/scholarships/recipients"), api.get("/api/scholarships/categories")]);
      setRecipients(r.items);
      setCategories(c.items);
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

  async function createCategory(e) {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await api.post("/api/scholarships/categories", { name: catName.trim(), kind: "historical" });
      notify("Category created.");
      setCatName("");
      setCatModalOpen(false);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Could not create category.", "error");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.studentName.trim()) {
      setError("Student name is required.");
      return;
    }
    try {
      await api.post("/api/scholarships/recipients", form);
      notify("Recipient added to roster.");
      setModalOpen(false);
      setForm({ categoryId: "", studentName: "", studentId: "", program: "", term: "", amount: "", status: "Granted" });
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  if (state === "loading") return <LoadingState label="Loading recipients..." />;
  if (state === "error") return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">Master roster of approved recipients, by provider</p>
        <div className="flex gap-2">
          <button onClick={() => setCatModalOpen(true)} className={secondaryButtonClass}>+ Category</button>
          <button onClick={() => setModalOpen(true)} className={primaryButtonClass}><Plus size={16} /> Add Recipient</button>
        </div>
      </div>

      {recipients.length === 0 ? (
        <EmptyState icon={Award} title="No recipients recorded yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl2 border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Provider / Category</th>
                <th className="px-5 py-3">Program</th>
                <th className="px-5 py-3">Term</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 text-slate-700">{r.student_name} <span className="text-xs text-slate-400">{r.student_id}</span></td>
                  <td className="px-5 py-3 text-slate-500">{r.scholarship_name || r.category_name || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{r.program || "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{r.term || "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={(r.status || "granted").toLowerCase()} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title="New Category" maxWidth="max-w-sm">
        <form onSubmit={createCategory} className="space-y-4">
          <div>
            <label className={labelClass}>Category name</label>
            <input autoFocus className={`${inputClass} mt-1`} value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. DOST-SEI Undergraduate Scholarship" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCatModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>Create</button>
          </div>
        </form>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Recipient (Historical / Offline)">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Category</label>
            <select className={`${inputClass} mt-1 bg-white`} value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Select category...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Student name</label><input className={`${inputClass} mt-1`} value={form.studentName} onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))} /></div>
            <div><label className={labelClass}>Student ID</label><input className={`${inputClass} mt-1`} value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Program</label><input className={`${inputClass} mt-1`} value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))} /></div>
            <div><label className={labelClass}>Academic term</label><input className={`${inputClass} mt-1`} value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} placeholder="e.g. AY 2025-2026" /></div>
          </div>
          <div><label className={labelClass}>Award amount (₱)</label><input type="number" className={`${inputClass} mt-1`} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>Add to Roster</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function Scholarships() {
  const [tab, setTab] = useState("postings");
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-success/10 text-status-success">
          <GraduationCap size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Scholarships</h1>
          <p className="text-sm text-slate-500">Postings, applicant evaluation, and the recipient roster</p>
        </div>
      </div>
      <div className="flex gap-1.5 rounded-xl2 border border-slate-200 bg-white p-1.5 shadow-card w-fit">
        {[{ k: "postings", l: "Postings" }, { k: "recipients", l: "Recipients" }].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t.k ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            {t.l}
          </button>
        ))}
      </div>
      {tab === "postings" ? <PostingsPanel /> : <RecipientsPanel />}
    </div>
  );
}
