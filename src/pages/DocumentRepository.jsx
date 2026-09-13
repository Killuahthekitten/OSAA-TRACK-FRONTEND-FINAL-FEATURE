import { useEffect, useRef, useState } from "react";
import { Folder, FolderPlus, File, Upload, Archive, RotateCcw, Trash2, Send, ArrowLeftRight, Eye, Download, Paperclip } from "lucide-react";
import FileViewerModal from "../components/ui/FileViewerModal.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import SearchableSelect from "../components/ui/SearchableSelect.jsx";
import { inputClass, labelClass, textareaClass, selectClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function FoldersPanel() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [filesState, setFilesState] = useState("idle");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  const foldersLoadedOnce = useRef(false);
  const filesLoadedOnce = useRef(false);

  async function loadFolders() {
    if (!foldersLoadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/document-repository/folders");
      setFolders(data.items);
      setState("ready");
      foldersLoadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (foldersLoadedOnce.current) notify("Could not refresh folders.", "error");
      else setState("error");
    }
  }

  async function loadFiles(folderId) {
    if (!filesLoadedOnce.current) setFilesState("loading");
    try {
      const data = await api.get(`/api/document-repository/folders/${folderId}/files`);
      setFiles(data.items);
      setFilesState("ready");
      filesLoadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (filesLoadedOnce.current) notify("Could not refresh files.", "error");
      else setFilesState("error");
    }
  }

  useEffect(() => {
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeFolder) {
      filesLoadedOnce.current = false;
      loadFiles(activeFolder.id);
    }
  }, [activeFolder]);

  async function createFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.post("/api/document-repository/folders", { name: newFolderName.trim() });
      notify("Folder created.");
      setNewFolderOpen(false);
      setNewFolderName("");
      loadFolders();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not create folder.", "error");
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeFolder) return;
    setUploading(true);
    try {
      const token = localStorage.getItem("osaa_track_admin_token") || sessionStorage.getItem("osaa_track_admin_token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/document-repository/folders/${activeFolder.id}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed.");
      notify("File uploaded.");
      loadFiles(activeFolder.id);
      loadFolders();
    } catch (err) {
      notify(err.message || "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function toggleArchive(file) {
    try {
      await api.patch(`/api/document-repository/files/${file.id}/${file.status === "active" ? "archive" : "restore"}`);
      notify(file.status === "active" ? "File archived." : "File restored.");
      loadFiles(activeFolder.id);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  async function deleteFile(file) {
    try {
      await api.del(`/api/document-repository/files/${file.id}`);
      notify("File deleted.");
      loadFiles(activeFolder.id);
      loadFolders();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  async function downloadFile(file) {
    try {
      const token = localStorage.getItem("osaa_track_admin_token") || sessionStorage.getItem("osaa_track_admin_token");
      const res = await fetch(`/api/document-repository/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify("Download failed.", "error");
    }
  }

  async function confirmDeleteFolder() {
    try {
      await api.del(`/api/document-repository/folders/${deleteTarget.id}`);
      notify("Folder deleted.");
      setDeleteTarget(null);
      if (activeFolder?.id === deleteTarget.id) setActiveFolder(null);
      loadFolders();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  if (state === "loading") return <LoadingState label="Loading folders..." />;
  if (state === "error") return <ErrorState onRetry={loadFolders} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{folders.length} folder{folders.length === 1 ? "" : "s"}</p>
        <button type="button" onClick={() => setNewFolderOpen(true)} className={primaryButtonClass}>
          <FolderPlus size={16} /> New Folder
        </button>
      </div>

      {folders.length === 0 ? (
        <EmptyState icon={Folder} title="No folders yet" description="Create a folder to start organizing office records." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f)}
              className={`group relative rounded-xl2 border p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg ${
                activeFolder?.id === f.id ? "border-brand-blue bg-blue-50" : "border-slate-200 bg-white"
              }`}
            >
              <Folder size={26} className="text-status-indigo" />
              <p className="mt-2.5 truncate text-sm font-semibold text-slate-800">{f.name}</p>
              <p className="text-xs text-slate-500">{f.file_count} file{f.file_count === 1 ? "" : "s"}</p>
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(f);
                }}
                className="absolute right-2 top-2 hidden size-6 items-center justify-center rounded-full text-slate-400 hover:bg-red-100 hover:text-status-danger group-hover:flex"
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))}
        </div>
      )}

      {activeFolder && (
        <div className="rounded-xl2 border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-sm font-semibold text-slate-800">Files in &ldquo;{activeFolder.name}&rdquo;</h3>
            <label className={`${secondaryButtonClass} cursor-pointer`}>
              {uploading ? "Uploading..." : <><Upload size={15} /> Upload File</>}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          {filesState === "loading" && <LoadingState label="Loading files..." />}
          {filesState === "ready" && files.length === 0 && <EmptyState icon={File} title="No files in this folder" />}
          {filesState === "ready" && files.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <File size={16} className="shrink-0 text-slate-400" />
                    <span className="truncate text-sm text-slate-700">{f.name}</span>
                    {f.status === "archived" && <StatusBadge status="inactive" />}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {f.stored_name && (
                      <>
                        <button
                          onClick={() => setViewingFile(f)}
                          className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <a
                          href={`/api/document-repository/files/${f.id}/download`}
                          onClick={(e) => {
                            e.preventDefault();
                            downloadFile(f);
                          }}
                          className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                      </>
                    )}
                    <button onClick={() => toggleArchive(f)} className="flex size-8 items-center justify-center rounded-lg text-status-warning hover:bg-amber-50">
                      {f.status === "active" ? <Archive size={14} /> : <RotateCcw size={14} />}
                    </button>
                    <button onClick={() => deleteFile(f)} className="flex size-8 items-center justify-center rounded-lg text-status-danger hover:bg-red-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} title="New Folder" maxWidth="max-w-sm">
        <form onSubmit={createFolder} className="space-y-4">
          <div>
            <label className={labelClass}>Folder name</label>
            <input autoFocus className={`${inputClass} mt-1`} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Memoranda" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewFolderOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>Create</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteFolder}
        title="Delete folder?"
        description={`"${deleteTarget?.name}" and all files inside it will be permanently deleted.`}
        confirmLabel="Delete"
      />

      <FileViewerModal
        open={Boolean(viewingFile)}
        onClose={() => setViewingFile(null)}
        fileName={viewingFile?.name}
        viewUrl={viewingFile ? `/api/document-repository/files/${viewingFile.id}/view` : null}
        downloadUrl={viewingFile ? `/api/document-repository/files/${viewingFile.id}/download` : null}
      />
    </div>
  );
}

function TransmissionsPanel() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [offices, setOffices] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ direction: "sent", officeId: "", documentName: "", notes: "", files: [] });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const [t, o] = await Promise.all([
        api.get("/api/document-repository/transmissions"),
        api.get("/api/offices"),
      ]);
      setItems(t.items);
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
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.officeId || !form.documentName.trim()) {
      setError("Office and document name are required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/document-repository/transmissions", {
        ...form,
        fileIds: form.direction === "sent" ? form.files.map((f) => f.id) : [],
      });
      notify(form.direction === "sent" ? "Document sent to office." : "Document requested from office.");
      setModalOpen(false);
      setForm({ direction: "sent", officeId: "", documentName: "", notes: "", files: [] });
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <LoadingState label="Loading inter-office activity..." />;
  if (state === "error") return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Send or request documents from the authorized office network</p>
        <button type="button" onClick={() => setModalOpen(true)} className={primaryButtonClass}>
          <Send size={16} /> New Transmission
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No inter-office activity yet" />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl2 border border-slate-200 bg-white shadow-card">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {t.direction === "sent" ? "Sent to" : "Requested from"} <span className="text-brand-blue">{t.office_name}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{t.document_name}</p>
                {t.files?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {t.files.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setViewingFile(f)}
                        className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-brand-blue"
                      >
                        <Paperclip size={11} /> {f.original_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <StatusBadge status={t.status} />
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Inter-Office Transmission">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Direction</label>
            <div className="mt-1.5 flex gap-2">
              {[{ v: "sent", l: "Send document" }, { v: "requested", l: "Request document" }].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, direction: opt.v, files: opt.v === "sent" ? f.files : [] }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.direction === opt.v ? "border-brand-blue bg-blue-50 text-brand-blue" : "border-slate-200 text-slate-500"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Office</label>
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
          <div>
            <label className={labelClass}>Document name</label>
            <input className={`${inputClass} mt-1`} value={form.documentName} onChange={(e) => setForm((f) => ({ ...f, documentName: e.target.value }))} placeholder="e.g. MOA Draft — Internship Program" />
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea rows={2} className={`${textareaClass} mt-1`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {form.direction === "sent" && (
            <div>
              <label className={labelClass}>Attach file(s)</label>
              <div className="mt-1.5">
                <FileDropzone
                  files={form.files}
                  onChange={(files) => setForm((f) => ({ ...f, files }))}
                  multiple
                  label="Drop files here or click to browse (multiple allowed)"
                />
              </div>
            </div>
          )}
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" disabled={saving} className={primaryButtonClass}>Submit</button>
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

export default function DocumentRepository() {
  const [tab, setTab] = useState("folders");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
          <Folder size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Document Repository</h1>
          <p className="text-sm text-slate-500">Institutional files and inter-office document flow</p>
        </div>
      </div>

      <div className="flex gap-1.5 rounded-xl2 border border-slate-200 bg-white p-1.5 shadow-card w-fit">
        {[{ k: "folders", l: "Folders" }, { k: "transmissions", l: "Inter-Office" }].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t.k ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "folders" ? <FoldersPanel /> : <TransmissionsPanel />}
    </div>
  );
}
