import { useEffect, useRef, useState } from "react";
import { HelpCircle, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { inputClass, labelClass, textareaClass, selectClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const KNOWN_CATEGORIES = [
  "General",
  "User Management",
  "Announcements",
  "Campus Feed",
  "Document Repository",
  "Document Queue",
  "Scholarships",
  "Achievement Management",
  "Job Postings",
  "Student Endorsement",
  "Alumni Profiles",
  "Analytics",
  "FAQ",
];

function emptyForm() {
  return { question: "", answer: "", category: "General", sortOrder: 0 };
}

function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return Array.from(groups.entries());
}

export default function FAQ() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/faq");
      setItems(data.items);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh the FAQ list.", "error");
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
    setForm({ question: item.question, answer: item.answer, category: item.category, sortOrder: item.sort_order });
    setError(null);
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.question.trim() || !form.answer.trim()) {
      setError("Both a question and an answer are required.");
      return;
    }
    try {
      if (editing) await api.put(`/api/faq/${editing.id}`, form);
      else await api.post("/api/faq", form);
      notify(editing ? "FAQ entry updated." : "FAQ entry added.");
      setModalOpen(false);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/api/faq/${deleteTarget.id}`);
      notify("FAQ entry deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  const grouped = groupByCategory(items);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-info/10 text-status-info">
            <HelpCircle size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">FAQ</h1>
            <p className="text-sm text-slate-500">Answers to common questions about using OSAA-TRACK</p>
          </div>
        </div>
        <button onClick={openCreate} className={primaryButtonClass}><Plus size={16} /> New Entry</button>
      </div>

      {state === "loading" && <LoadingState label="Loading FAQ..." />}
      {state === "error" && <ErrorState onRetry={load} />}
      {state === "ready" && items.length === 0 && <EmptyState icon={HelpCircle} title="No FAQ entries yet" description="Add the first question to get started." />}

      {state === "ready" && items.length > 0 && (
        <div className="space-y-7">
          {grouped.map(([category, entries]) => (
            <section key={category}>
              <h2 className="mb-2.5 font-heading text-xs font-bold uppercase tracking-wide text-slate-400">{category}</h2>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
                {entries.map((item) => {
                  const isOpen = openId === item.id;
                  return (
                    <div key={item.id}>
                      <div className="flex items-start gap-2 px-4 py-3.5 sm:px-5">
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? null : item.id)}
                          className="flex flex-1 items-start justify-between gap-3 text-left"
                        >
                          <span className="text-sm font-semibold text-slate-800">{item.question}</span>
                          <ChevronDown size={16} className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => openEdit(item)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-brand-blue" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(item)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-status-danger" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="px-4 pb-4 sm:px-5">
                          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit FAQ Entry" : "New FAQ Entry"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Category</label>
            <select
              className={`${selectClass} mt-1`}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {KNOWN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Question</label>
            <input className={`${inputClass} mt-1`} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Answer</label>
            <textarea rows={5} className={`${textareaClass} mt-1`} value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Display order within category</label>
            <input
              type="number"
              className={`${inputClass} mt-1 w-28`}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
            <p className="mt-1 text-xs text-slate-400">Lower numbers appear first.</p>
          </div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>{editing ? "Save Changes" : "Add Entry"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete FAQ entry?"
        description={`"${deleteTarget?.question}" will be permanently removed.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
