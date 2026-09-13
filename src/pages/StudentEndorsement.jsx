import { useEffect, useRef, useState } from "react";
import { Send, Plus, Inbox, Paperclip, Eye } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import Modal from "../components/ui/Modal.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import SearchableSelect from "../components/ui/SearchableSelect.jsx";
import { inputClass, selectClass, labelClass, textareaClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function emptyForm() {
  return { direction: "outbound", studentName: "", studentId: "", program: "", officeId: "", purpose: "", background: "", justification: "", files: [] };
}

export default function StudentEndorsement() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [direction, setDirection] = useState("");
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [offices, setOffices] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const [e, o] = await Promise.all([
        api.get(`/api/student-endorsement${direction ? `?direction=${direction}` : ""}`),
        api.get("/api/offices"),
      ]);
      setItems(e.items);
      setOffices(o.items);
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
  }, [direction]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const isOutbound = form.direction === "outbound";
    if (isOutbound && !form.studentName.trim()) {
      setError("Student name is required for outbound endorsements.");
      return;
    }
    if (!form.officeId || !form.purpose.trim()) {
      setError(`${isOutbound ? "Destination" : "Source"} office and purpose / notes are required.`);
      return;
    }
    try {
      const { id } = await api.post("/api/student-endorsement", form);
      for (const f of form.files) {
        await api.post(`/api/student-endorsement/${id}/files`, { fileId: f.id });
      }
      notify("Endorsement submitted.");
      setModalOpen(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function markStatus(item, status) {
    try {
      await api.patch(`/api/student-endorsement/${item.id}/status`, { status });
      notify("Status updated.");
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-success/10 text-status-success">
            <Send size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Student Endorsement</h1>
            <p className="text-sm text-slate-500">Inbound and outbound endorsements across offices</p>
          </div>
        </div>
        <button onClick={() => setModalOpen(true)} className={primaryButtonClass}><Plus size={16} /> New Endorsement</button>
      </div>

      <div className="flex gap-1.5 rounded-xl2 border border-slate-200 bg-white p-1.5 shadow-card w-fit">
        {[{ v: "", l: "All" }, { v: "outbound", l: "Outbound" }, { v: "inbound", l: "Inbound" }].map((t) => (
          <button key={t.v} onClick={() => setDirection(t.v)} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${direction === t.v ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {state === "loading" && <LoadingState label="Loading endorsements..." />}
      {state === "error" && <ErrorState onRetry={load} />}
      {state === "ready" && items.length === 0 && <EmptyState icon={Inbox} title="No endorsements yet" />}
      {state === "ready" && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e.id} className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {e.direction === "outbound" ? (
                    <p className="text-sm font-semibold text-slate-800">
                      Outbound &middot; {e.student_name} &rarr; {e.office_name}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800">
                      Inbound &middot; from {e.office_name}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">{e.purpose}</p>
                  {e.background && <p className="mt-1.5 text-xs text-slate-500">{e.background}</p>}
                  {e.files?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.files.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setViewingFile(f)}
                          className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                        >
                          <Paperclip size={10} /> {f.original_name} <Eye size={10} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={e.status} />
                  {e.status === "pending" && (
                    <button onClick={() => markStatus(e, "acknowledged")} className={secondaryButtonClass}>Acknowledge</button>
                  )}
                  {e.status === "acknowledged" && (
                    <button onClick={() => markStatus(e, "resolved")} className={secondaryButtonClass}>Resolve</button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Endorsement">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Direction</label>
            <div className="mt-1.5 flex gap-2">
              {[{ v: "outbound", l: "Outbound" }, { v: "inbound", l: "Inbound" }].map((opt) => (
                <button key={opt.v} type="button" onClick={() => setForm((f) => ({ ...f, direction: opt.v }))} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${form.direction === opt.v ? "border-brand-blue bg-blue-50 text-brand-blue" : "border-slate-200 text-slate-500"}`}>{opt.l}</button>
              ))}
            </div>
          </div>

          {form.direction === "outbound" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass}>Student name</label><input className={`${inputClass} mt-1`} value={form.studentName} onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))} /></div>
                <div><label className={labelClass}>Student ID</label><input className={`${inputClass} mt-1`} value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} /></div>
              </div>
              <div><label className={labelClass}>Academic program</label><input className={`${inputClass} mt-1`} value={form.program} onChange={(e) => setForm((f) => ({ ...f, program: e.target.value }))} /></div>
            </>
          )}

          <div>
            <label className={labelClass}>{form.direction === "outbound" ? "Destination office" : "Source office"}</label>
            <div className="mt-1">
              <SearchableSelect
                options={offices.map((o) => ({
                  value: o.id,
                  label: `${o.category} \u00b7 ${o.name} ${o.username ? `\u2014 ${o.username}` : "(no login yet)"}`,
                }))}
                value={form.officeId}
                onChange={(v) => setForm((f) => ({ ...f, officeId: v }))}
                placeholder="Select an authorized office..."
              />
            </div>
          </div>
          <div><label className={labelClass}>{form.direction === "outbound" ? "Referral purpose" : "Notes"}</label><input className={`${inputClass} mt-1`} value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} /></div>

          {form.direction === "outbound" && (
            <>
              <div><label className={labelClass}>Background notes</label><textarea rows={2} className={`${textareaClass} mt-1`} value={form.background} onChange={(e) => setForm((f) => ({ ...f, background: e.target.value }))} /></div>
              <div><label className={labelClass}>Justification</label><textarea rows={2} className={`${textareaClass} mt-1`} value={form.justification} onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))} /></div>
            </>
          )}

          <div>
            <label className={labelClass}>Attachments (optional)</label>
            <div className="mt-1.5">
              <FileDropzone files={form.files} onChange={(files) => setForm((f) => ({ ...f, files }))} label="Clearance forms, recommendation letters, etc." />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>Submit</button>
          </div>
        </form>
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
