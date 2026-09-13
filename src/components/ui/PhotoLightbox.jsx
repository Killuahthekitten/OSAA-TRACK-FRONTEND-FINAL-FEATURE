import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Loader2, ImageOff, RotateCw } from "lucide-react";
import { useState } from "react";
import { fetchProtectedFile } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

// Same authenticated-blob pattern as the feed's PostPhoto, sized for a
// large floating viewer instead of a grid tile.
function LightboxImage({ file }) {
  const { handleSessionInvalidated } = useAuth();
  const [objectUrl, setObjectUrl] = useState(null);
  const [state, setState] = useState("loading");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!file) return;
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
  }, [file, reloadTick]);

  if (state === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-white/60" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/50">
        <ImageOff size={28} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setReloadTick((n) => n + 1); }}
          className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/60"
        >
          <RotateCw size={13} /> Retry
        </button>
      </div>
    );
  }
  return <img src={objectUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />;
}

/**
 * Floating Facebook-style photo viewer. Renders above the feed post it was
 * opened from, blurring everything behind it, but is deliberately scoped to
 * sit right of the sidebar (and below the header) on large screens instead
 * of covering the whole viewport, so navigation stays reachable.
 */
export default function PhotoLightbox({ media, index, onClose, onNavigate }) {
  const count = media?.length || 0;

  const goPrev = useCallback(() => {
    if (count > 1) onNavigate((index - 1 + count) % count);
  }, [count, index, onNavigate]);

  const goNext = useCallback(() => {
    if (count > 1) onNavigate((index + 1) % count);
  }, [count, index, onNavigate]);

  useEffect(() => {
    if (index == null) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, onClose, goPrev, goNext]);

  if (index == null || !media || !media[index]) return null;
  const file = media[index];

  return (
    <div
      className="fixed inset-0 top-[76px] z-[65] lg:left-[300px]"
      onClick={onClose}
    >
      {/* Blurred, dimmed backdrop — this is what keeps the focus on the photo */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xl" />

      {/* Floating card that holds the photo — minimal chrome, centered, doesn't stretch edge-to-edge */}
      <div className="relative flex h-full w-full items-center justify-center p-4 sm:p-10">
        <div
          className="relative flex max-h-full max-w-full items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <LightboxImage file={file} />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 sm:right-6 sm:top-6"
        >
          <X size={20} />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 sm:left-5"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 sm:right-5"
            >
              <ChevronRight size={22} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm sm:bottom-6">
              {index + 1} / {count}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
