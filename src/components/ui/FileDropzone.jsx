import { useRef, useState } from "react";
import { UploadCloud, Paperclip, X, Loader2, Eye } from "lucide-react";
import { getToken } from "../../api/client.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop "dropbox" for file attachments (spec section 18 step 1:
 * "uploads supporting files using the integrated dropbox for attachments").
 * Controlled: `files` is the current list of {id, original_name/originalName,
 * size_bytes?} objects; onChange is called with the updated list.
 */
export default function FileDropzone({ files = [], onChange, onPreview, multiple = true, label = "Drop files here or click to browse" }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function uploadOne(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Upload failed.");
    return { id: data.id, original_name: data.originalName, size_bytes: data.sizeBytes };
  }

  async function handleFiles(fileList) {
    const list = Array.from(fileList || []);
    if (list.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of multiple ? list : [list[0]]) {
        uploaded.push(await uploadOne(file));
      }
      onChange(multiple ? [...files, ...uploaded] : uploaded);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(id) {
    onChange(files.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver ? "border-brand-blue bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-brand-blue" />
        ) : (
          <UploadCloud size={20} className="text-slate-400" />
        )}
        <p className="text-xs text-slate-500">{uploading ? "Uploading..." : label}</p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-xs font-medium text-status-danger">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <Paperclip size={13} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-slate-600">{f.original_name || f.originalName}</span>
              {f.size_bytes ? <span className="shrink-0 text-slate-400">{formatSize(f.size_bytes)}</span> : null}
              {onPreview && (
                <button type="button" onClick={() => onPreview(f)} className="shrink-0 text-slate-400 hover:text-brand-blue">
                  <Eye size={13} />
                </button>
              )}
              <button type="button" onClick={() => removeFile(f.id)} className="shrink-0 text-slate-400 hover:text-status-danger">
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
