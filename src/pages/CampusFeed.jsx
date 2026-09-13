import { useEffect, useRef, useState } from "react";
import { Rss, Plus, Pencil, Trash2, ImageOff, Loader2, RotateCw } from "lucide-react";
import { api, ApiError, fetchProtectedFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import PhotoLightbox from "../components/ui/PhotoLightbox.jsx";
import { inputClass, labelClass, textareaClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";
import psuSeal from "../assets/psu-seal.png";
import saaSeal from "../assets/saa-seal.png";

// A single photo, fetched as an authenticated blob (a plain <img src>
// can't carry the bearer token a protected endpoint needs).
function PostPhoto({ file, className = "", onClick }) {
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
    return <div className={`flex items-center justify-center bg-slate-50 ${className}`}><Loader2 size={20} className="animate-spin text-slate-300" /></div>;
  }
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setReloadTick((n) => n + 1); }}
        className={`flex items-center justify-center bg-slate-50 text-slate-300 hover:text-slate-400 ${className}`}
        title="Retry loading photo"
      >
        <ImageOff size={20} />
      </button>
    );
  }
  return (
    <img
      src={objectUrl}
      alt=""
      onClick={onClick}
      className={`object-cover ${onClick ? "cursor-pointer transition hover:brightness-95" : ""} ${className}`}
    />
  );
}

// Facebook-style photo grid: 1 = full width, 2 = side by side, 3 = one
// large + two stacked, 4+ = 2x2 with a "+N" overlay on the last tile.
// Every tile opens the full floating viewer (onOpen) at its own index, so
// people can page through the whole set with next/previous from there.
function PostGallery({ media, onOpen }) {
  if (!media || media.length === 0) return null;
  const count = media.length;

  if (count === 1) return <PostPhoto file={media[0]} className="h-auto max-h-[620px] w-full" onClick={() => onOpen(0)} />;

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {media.map((f, i) => <PostPhoto key={f.id} file={f} className="h-80 w-full" onClick={() => onOpen(i)} />)}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        <PostPhoto file={media[0]} className="row-span-2 h-full w-full" onClick={() => onOpen(0)} />
        <PostPhoto file={media[1]} className="h-[195px] w-full" onClick={() => onOpen(1)} />
        <PostPhoto file={media[2]} className="h-[195px] w-full" onClick={() => onOpen(2)} />
      </div>
    );
  }

  const extra = count - 4;
  return (
    <div className="grid grid-cols-2 gap-0.5">
      {media.slice(0, 4).map((f, i) => (
        <div key={f.id} className="relative">
          <PostPhoto file={f} className="h-48 w-full" onClick={() => onOpen(i)} />
          {i === 3 && extra > 0 && (
            <div
              onClick={() => onOpen(3)}
              className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/50 text-lg font-bold text-white transition hover:bg-black/60"
            >
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function emptyForm() {
  return { title: "", body: "", media: [] };
}

export default function CampusFeed() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { media, index } | null

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/campus-feed");
      setItems(data.items);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh the feed.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }
  function openEdit(item) {
    setEditing(item);
    setForm({ title: item.title || "", body: item.body, media: item.media || [] });
    setError(null);
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.body.trim()) {
      setError("Post content is required.");
      return;
    }
    const payload = { title: form.title, body: form.body, mediaFileIds: form.media.map((f) => f.id) };
    try {
      if (editing) await api.put(`/api/campus-feed/${editing.id}`, payload);
      else await api.post("/api/campus-feed", payload);
      notify(editing ? "Post updated." : "Post published.");
      setModalOpen(false);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/api/campus-feed/${deleteTarget.id}`);
      notify("Post removed.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
            <Rss size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Campus Feed</h1>
            <p className="text-sm text-slate-500">Community updates and campus life highlights</p>
          </div>
        </div>
        <button onClick={openCreate} className={primaryButtonClass}><Plus size={16} /> New Post</button>
      </div>

      {state === "loading" && <LoadingState label="Loading feed..." />}
      {state === "error" && <ErrorState onRetry={load} />}
      {state === "ready" && items.length === 0 && <EmptyState icon={Rss} title="No posts yet" description="Share the first campus update." />}

      {/* Decorative seal watermark + stickers — pinned to the viewport (not
          the post list) so adding, deleting, or scrolling through posts
          never shifts them. They sit in a fixed layer that mirrors the
          feed column's horizontal position (sidebar width + centered
          max-w-2xl column) but has a constant, viewport-sized height, so
          nothing about the growing post list can push them around. */}
      <div className="pointer-events-none fixed inset-y-0 left-0 right-0 z-0 hidden xl:block xl:left-[300px]">
        <div className="relative mx-auto h-full max-w-[1229px] px-4 sm:px-6 lg:px-10">
          <div className="relative mx-auto h-full max-w-2xl">
            <img
              src={saaSeal}
              alt=""
              className="absolute -left-48 top-[180px] w-96 -rotate-[18deg] opacity-[0.07]"
            />
            <img
              src={psuSeal}
              alt=""
              className="absolute -right-40 bottom-24 w-80 rotate-[14deg] opacity-[0.08]"
            />
            <div className="absolute -left-28 top-[230px] -rotate-12">
              <span className="flex size-20 items-center justify-center rounded-full bg-white text-4xl shadow-card">📢</span>
            </div>
            <div className="absolute -right-28 top-[150px] rotate-12">
              <span className="flex size-20 items-center justify-center rounded-full bg-white text-4xl shadow-card">📸</span>
            </div>
            <div className="absolute -left-24 bottom-10 rotate-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-white text-2xl shadow-card">⭐</span>
            </div>
            <div className="absolute -right-24 bottom-56 -rotate-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-white text-2xl shadow-card">🏫</span>
            </div>
          </div>
        </div>
      </div>

      {state === "ready" && items.length > 0 && (
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="relative flex flex-col gap-6">
            {items.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
                <div className="flex items-center justify-between gap-3 px-5 pb-1.5 pt-5">
                  <div className="flex items-center gap-3">
                    <img src={psuSeal} alt="" className="size-12 rounded-full object-cover" />
                    <div>
                      <p className="text-[15px] font-semibold text-slate-800">OSAA-TRACK</p>
                      <p className="text-xs text-slate-400">{new Date(p.created_at.replace(" ", "T")).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteTarget(p)} className="flex size-8 items-center justify-center rounded-lg text-status-danger hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="px-5 pb-4 pt-1.5">
                  {p.title && <h3 className="font-heading text-base font-semibold text-slate-800">{p.title}</h3>}
                  <p className="mt-1 whitespace-pre-wrap text-[15px] text-slate-700">{p.body}</p>
                </div>

                <PostGallery media={p.media} onOpen={(i) => setLightbox({ media: p.media, index: i })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          media={lightbox.media}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((prev) => ({ ...prev, index: i }))}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Post" : "New Post"}>
        <form onSubmit={submit} className="space-y-4">
          <div><label className={labelClass}>Title (optional)</label><input className={`${inputClass} mt-1`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div><label className={labelClass}>Content</label><textarea rows={4} className={`${textareaClass} mt-1`} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></div>
          <div>
            <label className={labelClass}>Photos (optional, add as many as you like)</label>
            <div className="mt-1.5 space-y-2">
              {form.media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {form.media.map((f) => (
                    <div key={f.id} className="relative overflow-hidden rounded-lg border border-slate-200">
                      <PostPhoto file={f} className="h-20 w-full" />
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, media: prev.media.filter((m) => m.id !== f.id) }))}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <FileDropzone
                files={[]}
                onChange={(files) => setForm((f) => ({ ...f, media: [...f.media, ...files] }))}
                multiple
                label="Drop photos here or click to browse — you'll see them above before posting"
              />
            </div>
          </div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" className={primaryButtonClass}>{editing ? "Save Changes" : "Publish"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete post?" description="This post will be permanently removed from the feed." confirmLabel="Delete" />
    </div>
  );
}
