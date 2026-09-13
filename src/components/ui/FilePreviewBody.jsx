import { useEffect, useState } from "react";
import { FileText, Loader2, RotateCw } from "lucide-react";
import { ApiError, fetchProtectedFile } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

function getExt(name = "") {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "";
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];

/**
 * Loads a protected file (with the admin's bearer token) and renders an
 * inline preview: native <iframe> for PDFs, <img> for images, mammoth-
 * rendered HTML for .docx, and a "download to view" fallback otherwise.
 * Used both inline (Document Queue's larger ticket viewer) and inside
 * FileViewerModal (Document Repository / Announcements / Scholarships /
 * Achievements).
 */
export default function FilePreviewBody({ fileName, viewUrl, className = "h-[65vh]" }) {
  const { handleSessionInvalidated } = useAuth();
  const [state, setState] = useState("loading");
  const [objectUrl, setObjectUrl] = useState(null);
  const [docxHtml, setDocxHtml] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const ext = getExt(fileName || "");

  useEffect(() => {
    if (!viewUrl) return;
    let cancelled = false;
    let createdUrl = null;
    setState("loading");
    setDocxHtml(null);
    setObjectUrl(null);

    async function load() {
      try {
        const blob = await fetchProtectedFile(viewUrl);
        if (cancelled) return;

        if (ext === "docx") {
          const arrayBuffer = await blob.arrayBuffer();
          const mammoth = await import("mammoth/mammoth.browser");
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (!cancelled) {
            setDocxHtml(result.value);
            setState("ready");
          }
        } else {
          createdUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setObjectUrl(createdUrl);
            setState("ready");
          }
        }
      } catch (err) {
        if (cancelled) return;
        // Session expired / superseded by another login — this is the
        // real reason a file "randomly" fails to load, not a broken file.
        // Send the admin back to login with a clear explanation instead
        // of showing a generic preview error.
        if (handleSessionInvalidated(err)) return;
        setState(err instanceof ApiError && err.status === 0 ? "offline" : "error");
      }
    }
    load();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUrl, ext, reloadTick]);

  return (
    <div className={`overflow-auto rounded-lg border border-slate-200 bg-slate-50 ${className}`}>
      {state === "loading" && (
        <div className="flex h-full items-center justify-center text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {(state === "error" || state === "offline") && (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
          <FileText size={28} />
          <p className="text-sm">
            {state === "offline"
              ? "Couldn't reach the server — try again."
              : "Couldn't load a preview — try downloading instead."}
          </p>
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <RotateCw size={13} /> Retry
          </button>
        </div>
      )}
      {state === "ready" && ext === "pdf" && <iframe src={objectUrl} title={fileName} className="h-full w-full" />}
      {state === "ready" && IMAGE_EXTS.includes(ext) && (
        <div className="flex h-full items-center justify-center p-4">
          <img src={objectUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
        </div>
      )}
      {state === "ready" && ext === "docx" && (
        <div className="prose prose-sm max-w-none bg-white p-6" dangerouslySetInnerHTML={{ __html: docxHtml }} />
      )}
      {state === "ready" && !["pdf", "docx", ...IMAGE_EXTS].includes(ext) && (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
          <FileText size={28} />
          <p className="text-sm">Preview isn&rsquo;t available for .{ext || "this"} files &mdash; download to view.</p>
        </div>
      )}
    </div>
  );
}
