import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { getToken } from "../../api/client.js";
import ProtectedImage from "./ProtectedImage.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/**
 * A single square logo slot — click to upload, click again to replace, "x"
 * to clear. Three of these sit side by side (Org / College / PSU logo) in
 * the branding form, matching the reference mockup: a dashed placeholder
 * with a camera icon until a logo is set, a filled preview once it is.
 *
 * `value` is an uploaded_files object ({id, ...}) or null. `onChange` is
 * called with the new file object, or null when cleared.
 */
export default function LogoUploadSquare({ label, value, onChange, disabled }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed.");
      onChange({ id: data.id, original_name: data.originalName });
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function clear(e) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={`group relative flex size-24 items-center justify-center overflow-hidden rounded-xl border-2 transition ${
          value ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50 hover:border-brand-blue hover:bg-blue-50/40"
        } disabled:cursor-not-allowed`}
      >
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-brand-blue" />
        ) : value ? (
          <>
            <ProtectedImage file={value} alt={label} className="size-full object-contain p-2" />
            <span className="absolute inset-0 hidden items-center justify-center bg-slate-900/40 group-hover:flex">
              <Camera size={18} className="text-white" />
            </span>
          </>
        ) : (
          <Camera size={22} className="text-slate-300 group-hover:text-brand-blue" />
        )}

        {value && !uploading && (
          <span
            onClick={clear}
            role="button"
            title="Remove"
            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-status-danger"
          >
            <X size={12} />
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </button>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {error && <span className="max-w-[7rem] text-center text-[10px] leading-tight text-status-danger">{error}</span>}
    </div>
  );
}
