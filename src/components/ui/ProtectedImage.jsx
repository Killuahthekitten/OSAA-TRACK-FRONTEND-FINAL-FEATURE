import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { fetchProtectedFile } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Renders an uploaded_files record (from /api/uploads) as an <img>. A
 * plain <img src="/api/uploads/:id/view"> can't carry the bearer token
 * the endpoint requires, so this fetches it as an authenticated blob
 * instead — same approach as Campus Feed's post photos.
 *
 * `file` is an {id, ...} object (or null/undefined). `fallback` is shown
 * when there's no file at all (e.g. an officer with no photo yet).
 */
export default function ProtectedImage({ file, alt = "", className = "", fallback = null }) {
  const { handleSessionInvalidated } = useAuth();
  const [objectUrl, setObjectUrl] = useState(null);
  const [state, setState] = useState(file ? "loading" : "empty");

  useEffect(() => {
    if (!file) {
      setState("empty");
      return;
    }
    let cancelled = false;
    let createdUrl = null;
    setState("loading");
    fetchProtectedFile(`/api/uploads/${file.id}/view`)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        setState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (handleSessionInvalidated(err)) return;
        setState("error");
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  if (state === "empty") {
    return fallback ?? <div className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`} />;
  }
  if (state === "loading") {
    return <div className={`flex items-center justify-center bg-slate-50 ${className}`}><Loader2 size={16} className="animate-spin text-slate-300" /></div>;
  }
  if (state === "error") {
    return <div className={`flex items-center justify-center bg-slate-50 text-slate-300 ${className}`}><ImageOff size={16} /></div>;
  }
  return <img src={objectUrl} alt={alt} className={`object-cover ${className}`} />;
}
