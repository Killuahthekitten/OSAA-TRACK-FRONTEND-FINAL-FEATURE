import { useEffect, useRef, useState } from "react";
import { ScrollText, Plus, Eye, Download, Trash2, X } from "lucide-react";
import { api, ApiError, fetchProtectedFile } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import FileDropzone from "./FileDropzone.jsx";
import FileViewerModal from "./FileViewerModal.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { labelClass, selectClass, primaryButtonClass, secondaryButtonClass } from "./formStyles.js";

const PRESET_TYPES = ["Constitution & By-Laws", "Resolution", "Order", "Other"];

function docTypeBadgeClass(docType) {
  if (docType === "Constitution & By-Laws") return "bg-status-indigo/10 text-status-indigo";
  if (docType === "Resolution") return "bg-status-info/10 text-status-info";
  if (docType === "Order") return "bg-status-warning/10 text-status-warning";
  return "bg-slate-100 text-slate-500";
}

// One organization's on-file paperwork — its CBL plus any number of
// Resolutions, Orders, or other governance documents, each uploaded and
// removed independently (replaces the old single-CBL-only card).
export default function OrgDocumentsCard({ orgId }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [docType, setDocType] = useState(PRESET_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get(`/api/student-leaders/organizations/${orgId}/documents`);
      setItems(data.items);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh the documents list.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function resetAddForm() {
    setDocType(PRESET_TYPES[0]);
    setCustomType("");
    setPendingFile(null);
    setError(null);
  }

  async function submitAdd(e) {
    e.preventDefault();
    const resolvedType = docType === "Other" ? customType.trim() : docType;
    if (!resolvedType) {
      setError("Please give this document a type.");
      return;
    }
    if (!pendingFile) {
      setError("Please choose a file to upload.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.post(`/api/student-leaders/organizations/${orgId}/documents`, { docType: resolvedType, fileId: pendingFile.id });
      notify("Document uploaded.");
      setAddOpen(false);
      resetAddForm();
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Could not upload the document.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.del(`/api/student-leaders/organizations/${orgId}/documents/${deleteTarget.id}`);
      notify("Document removed.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Could not remove the document.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function downloadDoc(doc) {
    try {
      const blob = await fetchProtectedFile(`/api/uploads/${doc.file_id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file?.original_name || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Download failed.", "error");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText size={18} className="text-status-indigo" />
          <h2 className="font-heading text-base font-semibold text-slate-800">Organization Documents</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            resetAddForm();
            setAddOpen((v) => !v);
          }}
          className={secondaryButtonClass}
        >
          {addOpen ? <X size={14} /> : <Plus size={14} />} {addOpen ? "Cancel" : "Add Document"}
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Constitution &amp; By-Laws, Resolutions, Orders, and any other governance paperwork on file for this organization.
      </p>

      {addOpen && (
        <form onSubmit={submitAdd} className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Document type</label>
              <select className={`${selectClass} mt-1`} value={docType} onChange={(e) => setDocType(e.target.value)}>
                {PRESET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {docType === "Other" && (
              <div>
                <label className={labelClass}>Custom label</label>
                <input
                  className={`${selectClass} mt-1`}
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g. Memorandum of Agreement"
                />
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>File</label>
            <div className="mt-1.5">
              <FileDropzone
                files={pendingFile ? [pendingFile] : []}
                onChange={(files) => setPendingFile(files[files.length - 1] || null)}
                multiple={false}
                label="Drop the document here or click to browse"
              />
            </div>
          </div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Uploading..." : "Save Document"}
            </button>
          </div>
        </form>
      )}

      {state === "loading" ? (
        <p className="py-3 text-xs text-slate-400">Loading documents...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
          No documents uploaded yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${docTypeBadgeClass(doc.doc_type)}`}>
                  {doc.doc_type}
                </span>
                <span className="truncate text-xs text-slate-500">{doc.file?.original_name}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setViewing(doc)}
                  className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-blue"
                  title="View"
                >
                  <Eye size={14} />
                </button>
                <a
                  href={`/api/uploads/${doc.file_id}/download`}
                  className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-blue"
                  title="Download"
                  onClick={(e) => {
                    e.preventDefault();
                    downloadDoc(doc);
                  }}
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => setDeleteTarget(doc)}
                  className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-status-danger"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <FileViewerModal
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
          fileName={viewing.file?.original_name}
          viewUrl={`/api/uploads/${viewing.file_id}/view`}
          downloadUrl={`/api/uploads/${viewing.file_id}/download`}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Remove this document?"
        description={`"${deleteTarget?.file?.original_name}" will be permanently removed from this organization's documents.`}
        confirmLabel="Remove"
      />
    </div>
  );
}
