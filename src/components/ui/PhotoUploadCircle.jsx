import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, User, X } from "lucide-react";
import { getToken } from "../../api/client.js";
import ProtectedImage from "./ProtectedImage.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Officer photo picker for the Add/Edit Officer form. The admin asked to
 * "see the image before it's uploaded" — so as soon as a file is chosen,
 * a local preview (an in-browser object URL) is shown immediately, while
 * the upload happens in the background. Once the upload finishes, the
 * same preview keeps showing (no flicker) — it only switches to fetching
 * the image from the server on a later visit (editing an already-saved
 * officer), when there's no local file to preview from.
 */
export default function PhotoUploadCircle({ value, onChange, disabled }) {
  const inputRef = useRef(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Release the object URL when it's replaced or the component unmounts,
  // so we don't leak memory over a long admin session.
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  async function handleFile(file) {
    if (!file) return;
    setError(null);

    // Show the picked image right away — before the network request even
    // starts — so the admin sees exactly what they attached.
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
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
      setLocalPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }

  function clear(e) {
    e.stopPropagation();
    setLocalPreviewUrl(null);
    onChange(null);
  }

  const showLocalPreview = Boolean(localPreviewUrl);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={`group relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 transition ${
          value || showLocalPreview ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50 hover:border-brand-blue hover:bg-blue-50/40"
        } disabled:cursor-not-allowed`}
      >
        {showLocalPreview ? (
          <img src={localPreviewUrl} alt="Selected officer" className="size-full object-cover" />
        ) : value ? (
          <ProtectedImage file={value} alt="Officer" className="size-full object-cover" />
        ) : (
          <User size={26} className="text-slate-300 group-hover:text-brand-blue" />
        )}

        <span className="absolute inset-0 hidden items-center justify-center bg-slate-900/40 group-hover:flex">
          {uploading ? <Loader2 size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}
        </span>

        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-slate-900/30">
            <Loader2 size={18} className="animate-spin text-white" />
          </span>
        )}

        {(value || showLocalPreview) && !uploading && (
          <span
            onClick={clear}
            role="button"
            title="Remove photo"
            className="absolute right-0 top-0 flex size-6 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-status-danger"
          >
            <X size={13} />
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
      <span className="text-xs font-medium text-slate-500">{uploading ? "Uploading..." : "Officer photo"}</span>
      {error && <span className="max-w-[10rem] text-center text-[10px] leading-tight text-status-danger">{error}</span>}
    </div>
  );
}
