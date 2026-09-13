import { useEffect, useRef, useState } from "react";
import { Bell, Megaphone, Paperclip, Pencil, Plus, Archive, Send, Trash2 } from "lucide-react";
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

const TABS = [
  { key: "", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
];
const AUDIENCE_OPTIONS = [
  { key: "students", label: "Students" },
  { key: "alumni", label: "Alumni" },
  { key: "offices", label: "Offices" },
];

function emptyForm() {
  return { title: "", body: "", priority: "normal", audience: [], attachments: [] };
}

function emailNote(resp) {
  if (!resp) return "";
  if (!resp.emailConfigured) return " (email not set up yet — see README)";
  if (resp.emailNotified > 0) return ` — emailed ${resp.emailNotified} recipient${resp.emailNotified === 1 ? "" : "s"}`;
  return " (no matching recipients had an email on file)";
}

export default function Announcements() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useDashboardSummary();

  const [tab, setTab] = useState("");
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // announcement being edited, or null for create
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [confirmTarget, setConfirmTarget] = useState(null); // { type: 'archive'|'delete', item }
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get(`/api/announcements${tab ? `?status=${tab}` : ""}`);
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
  }, [tab]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ title: item.title, body: item.body, priority: item.priority, audience: item.audience, attachments: item.attachments || [] });
    setFormError(null);
    setModalOpen(true);
  }

  function toggleAudience(key) {
    setForm((f) => ({
      ...f,
      audience: f.audience.includes(key) ? f.audience.filter((a) => a !== key) : [...f.audience, key],
    }));
  }

  async function submit(asDraft) {
    setFormError(null);
    if (!form.title.trim() || !form.body.trim() || form.audience.length === 0) {
      setFormError("Title, content, and at least one audience are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        priority: form.priority,
        audience: form.audience,
        attachmentIds: form.attachments.map((f) => f.id),
      };
      let publishResp = null;
      if (editing) {
        await api.put(`/api/announcements/${editing.id}`, payload);
        if (!asDraft && editing.status === "draft") publishResp = await api.post(`/api/announcements/${editing.id}/publish`);
      } else {
        publishResp = await api.post("/api/announcements", { ...payload, asDraft });
      }
      const base = editing ? "Announcement updated." : asDraft ? "Saved as draft." : "Announcement published.";
      notify(base + (asDraft ? "" : emailNote(publishResp)));
      setModalOpen(false);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function publishDraft(item) {
    try {
      const resp = await api.post(`/api/announcements/${item.id}/publish`);
      notify("Announcement published." + emailNote(resp));
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not publish.", "error");
    }
  }

  async function handleConfirm() {
    setConfirmLoading(true);
    try {
      if (confirmTarget.type === "archive") {
        await api.patch(`/api/announcements/${confirmTarget.item.id}/archive`);
        notify("Announcement archived.");
      } else {
        await api.del(`/api/announcements/${confirmTarget.item.id}`);
        notify("Announcement deleted.");
      }
      setConfirmTarget(null);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Action failed.", "error");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-warning/10 text-status-warning">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Announcements</h1>
            <p className="text-sm text-slate-500">Post updates to students, alumni, or offices</p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className={primaryButtonClass}>
          <Plus size={16} /> New Announcement
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto rounded-xl2 border border-slate-200 bg-white p-1.5 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {state === "loading" && <LoadingState label="Loading announcements..." />}
      {state === "error" && <ErrorState onRetry={load} />}
      {state === "ready" && items.length === 0 && (
        <EmptyState icon={Megaphone} title="No announcements" description="Create one to get started." />
      )}
      {state === "ready" && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {a.priority === "urgent" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-danger">
                        Urgent
                      </span>
                    )}
                    <h3 className="truncate font-heading text-[15px] font-semibold text-slate-800">{a.title}</h3>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{a.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.audience.map((aud) => (
                      <span key={aud} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                        {aud}
                      </span>
                    ))}
                    {a.attachments?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setViewingFile(a.attachments[0])}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-blue"
                      >
                        <Paperclip size={11} /> {a.attachments.length} attachment{a.attachments.length === 1 ? "" : "s"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    aria-label="Edit"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil size={15} />
                  </button>
                  {a.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => publishDraft(a)}
                      aria-label="Publish"
                      className="flex size-8 items-center justify-center rounded-lg text-status-success hover:bg-emerald-50"
                    >
                      <Send size={15} />
                    </button>
                  )}
                  {a.status === "published" && (
                    <button
                      type="button"
                      onClick={() => setConfirmTarget({ type: "archive", item: a })}
                      aria-label="Archive"
                      className="flex size-8 items-center justify-center rounded-lg text-status-warning hover:bg-amber-50"
                    >
                      <Archive size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ type: "delete", item: a })}
                    aria-label="Delete"
                    className="flex size-8 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Announcement" : "New Announcement"}>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={`${inputClass} mt-1`}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Enrollment Adjustment Period Extended"
            />
          </div>
          <div>
            <label className={labelClass}>Content</label>
            <textarea
              rows={4}
              className={`${textareaClass} mt-1`}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Write the announcement..."
            />
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <div className="mt-1.5 flex gap-2">
              {["normal", "urgent"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                    form.priority === p ? "border-brand-blue bg-blue-50 text-brand-blue" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Target Audience</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleAudience(opt.key)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    form.audience.includes(opt.key)
                      ? "border-brand-blue bg-blue-50 text-brand-blue"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Attachments</label>
            <div className="mt-1.5">
              <FileDropzone
                files={form.attachments}
                onChange={(files) => setForm((f) => ({ ...f, attachments: files }))}
                onPreview={(file) => setViewingFile(file)}
                label="Drop files here or click to browse — the integrated dropbox for supporting documents"
              />
            </div>
          </div>

          {formError && <p className="text-xs font-medium text-status-danger">{formError}</p>}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => submit(true)} disabled={saving} className={secondaryButtonClass}>
              Save as Draft
            </button>
            <button type="button" onClick={() => submit(false)} disabled={saving} className={primaryButtonClass}>
              {editing ? "Save & Publish" : "Publish Now"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        loading={confirmLoading}
        title={confirmTarget?.type === "archive" ? "Archive announcement?" : "Delete announcement?"}
        description={
          confirmTarget?.type === "archive"
            ? "It will be hidden from active feeds but kept on record."
            : "This permanently removes the announcement. This can't be undone."
        }
        confirmLabel={confirmTarget?.type === "archive" ? "Archive" : "Delete"}
        danger={confirmTarget?.type !== "archive"}
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
