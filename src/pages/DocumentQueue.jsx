import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ClipboardList, Search, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
  FileText, Paperclip, Download, Send, PenLine, Upload, ChevronDown, ChevronUp, CheckCircle,
} from "lucide-react";
import { api, ApiError, fetchProtectedFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDashboardSummary } from "../context/DashboardContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import FilePreviewBody from "../components/ui/FilePreviewBody.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import SearchableSelect from "../components/ui/SearchableSelect.jsx";
import Tooltip from "../components/ui/Tooltip.jsx";
import { selectClass } from "../components/ui/formStyles.js";

// pdfjs-dist + pdf-lib are heavy — only fetched when the sign modal actually opens.
const SignDocumentModal = lazy(() => import("../components/ui/SignDocumentModal.jsx"));

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const TIME_FILTERS = [
  { key: "", label: "All" },
  { key: "1h", label: "1 hr ago" },
  { key: "8h", label: "8 hrs ago" },
  { key: "1d", label: "1 day ago" },
  { key: "7d", label: "7 days ago" },
  { key: "2w", label: "2 wks ago" },
  { key: "1m", label: "1 mo ago" },
];

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso.replace(" ", "T")).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_BADGE = {
  student: "bg-cyan-100 text-cyan-700",
  alumni: "bg-orange-100 text-orange-800",
};

export default function DocumentQueue() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useDashboardSummary();

  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null); // { item, routes }
  const [offices, setOffices] = useState([]);

  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const [signOpen, setSignOpen] = useState(false); // "admin" | routeId | null
  const [moreOpen, setMoreOpen] = useState(false);
  const [routeOfficeId, setRouteOfficeId] = useState("");
  const [routeSignFile, setRouteSignFile] = useState(null); // latest file to load when signing a route

  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (timeFilter) params.set("timeFilter", timeFilter);
      const data = await api.get(`/api/document-queue?${params.toString()}`);
      setItems(data.items);
      setState("ready");
      loadedOnce.current = true;
      if (!selectedId && data.items.length > 0) setSelectedId(data.items[0].id);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh the queue.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, timeFilter]);

  useEffect(() => {
    api.get("/api/offices").then((d) => setOffices(d.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    refreshDetail(selectedId);
    setZoom(1);
    setRotation(0);
    setComment("");
    setMoreOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function refreshDetail(id) {
    try {
      const data = await api.get(`/api/document-queue/${id}`);
      setDetail(data);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Could not load ticket.", "error");
    }
  }

  async function decide(action) {
    if ((action === "reject" || action === "revise") && !comment.trim()) {
      notify(action === "reject" ? "Add a comment explaining the rejection." : "Add a comment with revision instructions.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/document-queue/${detail.item.id}/decide`, { action, remarks: comment });
      const messages = {
        approve: "Approved for physical signing — the requester can now proceed to the office.",
        approve_esign: "Approved for e-signing.",
        reject: "Ticket rejected.",
        revise: "Revision requested — 7-day window started.",
      };
      notify(messages[action]);
      setComment("");
      await refreshDetail(detail.item.id);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function resubmit() {
    try {
      await api.post(`/api/document-queue/${detail.item.id}/resubmit`);
      notify("Ticket returned to the active queue.");
      await refreshDetail(detail.item.id);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not resubmit.", "error");
    }
  }

  async function handleAttach(files) {
    const f = files[files.length - 1];
    if (!f) return;
    try {
      await api.post(`/api/document-queue/${detail.item.id}/attach-file`, { fileId: f.id });
      notify("Document attached.");
      refreshDetail(detail.item.id);
    } catch {
      notify("Could not attach file.", "error");
    }
  }

  async function routeForSignature() {
    if (!routeOfficeId) return;
    try {
      await api.post(`/api/document-queue/${detail.item.id}/routes`, { officeId: routeOfficeId });
      notify("Routed for e-signature.");
      setRouteOfficeId("");
      refreshDetail(detail.item.id);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Routing failed.", "error");
    }
  }

  async function openAdminSign() {
    setSignOpen("admin");
  }

  async function openRouteSign(route) {
    try {
      const { file } = await api.get(`/api/document-queue/${detail.item.id}/latest-file`);
      setRouteSignFile(file);
      setSignOpen(route.id);
    } catch {
      notify("Could not load the document to sign.", "error");
    }
  }

  async function confirmTicketSignature() {
    try {
      await api.post(`/api/document-queue/${detail.item.id}/confirm-signature`);
      notify("Signature confirmed — ready for the requester.");
      refreshDetail(detail.item.id);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not confirm.", "error");
    }
  }

  async function confirmRoute(routeId) {
    try {
      await api.post(`/api/document-queue/routes/${routeId}/confirm`);
      notify("Confirmed.");
      refreshDetail(detail.item.id);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not confirm.", "error");
    }
  }

  async function handleDownload(fileObj) {
    try {
      const blob = await fetchProtectedFile(`/api/uploads/${fileObj.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileObj.original_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Download failed.", "error");
    }
  }

  const pendingCount = items.filter((t) => t.status === "pending").length;
  const canDecide = detail && ["pending", "revision_requested"].includes(detail.item.status);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
          <ClipboardList size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Document Queue</h1>
          <p className="text-sm text-slate-500">Sequential ticketing, review, and e-signature</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[560px] gap-6">
        {/* ── Left: inbox panel ─────────────────────────────────────── */}
        <div className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <p className="text-sm font-semibold text-slate-800">Document Queue Inbox</p>
            {pendingCount > 0 && (
              <span className="rounded-full bg-status-danger px-2.5 py-0.5 text-[11px] font-bold text-white">{pendingCount} Pending</span>
            )}
          </div>

          <div className="border-b border-slate-100 px-4 py-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Document"
                className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3">
            {TIME_FILTERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTimeFilter(t.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  timeFilter === t.key ? "bg-status-indigo text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {state === "loading" && <div className="p-5"><LoadingState label="Loading tickets..." /></div>}
            {state === "ready" && items.length === 0 && <div className="p-5"><EmptyState icon={ClipboardList} title="No matching tickets" /></div>}
            {state === "ready" && items.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`block w-full border-b border-l-[3px] px-4 py-3.5 text-left transition ${
                  selectedId === t.id ? "border-l-status-indigo bg-status-indigo/[0.06]" : "border-l-transparent hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-slate-800">{t.ticket_no}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${TYPE_BADGE[t.requester_type]}`}>{t.requester_type}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-500">{t.requester_name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-700">{t.document_type}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {t.file_id ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                      <span className="flex size-3.5 items-center justify-center rounded bg-status-danger text-[6px] font-bold text-white">PDF</span>
                      attached
                    </span>
                  ) : <span />}
                  <span className="text-[10px] text-slate-400">{relativeTime(t.submitted_at)}</span>
                </div>
              </button>
            ))}
          </div>

          {detail && canDecide && (
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <div className="mb-2 flex gap-2">
                <Tooltip text="Sends the request back to the requester with your comment so they can fix and resubmit it." className="flex-1">
                  <button
                    onClick={() => decide("revise")}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-status-danger py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <PenLine size={13} /> Request Revision
                  </button>
                </Tooltip>
                <Tooltip text="For documents that just need to be picked up and signed in person — no e-signature involved." className="flex-1">
                  <button
                    onClick={() => decide("approve")}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-status-success py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <CheckCircle size={13} /> Physical Signing
                  </button>
                </Tooltip>
              </div>
              <Tooltip text="Opens the e-signature toolkit — add your signature, route to other offices, then confirm." className="w-full">
                <button
                  onClick={() => decide("approve_esign")}
                  disabled={busy}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-blue py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <PenLine size={13} /> Approve for E-Signing
                </button>
              </Tooltip>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Type a comment..."
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-700 placeholder:text-slate-400"
              />
              <Tooltip text="Declines the request outright — the requester is notified and must start a new ticket if needed." side="right">
                <button onClick={() => decide("reject")} disabled={busy} className="mt-2 text-[11px] font-medium text-status-danger hover:underline">
                  Reject instead
                </button>
              </Tooltip>
            </div>
          )}
          {detail && detail.item.status === "approved_for_signing" && (
            <div className="border-t border-slate-100 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-800">
                Approved for <strong>physical signing</strong>. {detail.item.requester_name} can proceed to the office to receive
                their signed document. (Once the student/alumni portal exists, this is the status it will read to notify them directly.)
              </p>
            </div>
          )}
          {detail && detail.item.status === "revision_requested" && (
            <div className="border-t border-slate-100 bg-amber-50 p-4">
              <p className="mb-2 text-[11px] text-amber-800">Revision window open until {detail.item.revision_deadline}.</p>
              <button onClick={resubmit} className="w-full rounded-xl border border-amber-300 bg-white py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                Mark Resubmitted
              </button>
            </div>
          )}
        </div>

        {/* ── Right: document viewer panel ──────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
          {!detail ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Select a ticket to view its document</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-semibold text-slate-700">{detail.item.file?.original_name || "No document attached"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${TYPE_BADGE[detail.item.requester_type]}`}>{detail.item.requester_type}</span>
                  <StatusBadge status={detail.item.status} />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))} className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <ZoomIn size={13} /> Zoom In
                  </button>
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <ZoomOut size={13} /> Zoom Out
                  </button>
                  <button onClick={() => setRotation((r) => (r + 90) % 360)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <RotateCw size={13} /> Rotate
                  </button>
                  <div className="ml-1 flex items-center gap-1 opacity-40">
                    <button disabled className="flex size-7 items-center justify-center rounded-xl border border-slate-200"><ChevronLeft size={13} /></button>
                    <span className="px-1 text-xs text-slate-500">Page 1 of 1</span>
                    <button disabled className="flex size-7 items-center justify-center rounded-xl border border-slate-200"><ChevronRight size={13} /></button>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-start justify-center overflow-auto bg-[#e8eaed] p-8">
                {!detail.item.file ? (
                  <div className="mt-16 w-full max-w-sm">
                    <EmptyState icon={FileText} title="No document attached yet" description="Attach the requester's submitted file below." />
                  </div>
                ) : (
                  <div style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: "top center", transition: "transform 0.15s" }}>
                    <div className="w-[560px] bg-white shadow-[0_25px_25px_rgba(0,0,0,0.25)]">
                      <FilePreviewBody fileName={detail.item.file.original_name} viewUrl={`/api/uploads/${detail.item.file.id}/view`} className="h-[720px] w-[560px]" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 bg-white px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!detail.item.file && (
                    <div className="w-full max-w-xs">
                      <FileDropzone files={[]} onChange={handleAttach} multiple={false} label="Attach requester's document" />
                    </div>
                  )}
                  {detail.item.file && (
                    <button onClick={() => handleDownload(detail.item.file)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <Download size={13} /> Download
                    </button>
                  )}
                  {detail.item.status === "approved_for_esigning" && detail.item.file && !detail.item.confirmed_at && (
                    <button onClick={openAdminSign} className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                      <PenLine size={13} /> {detail.item.signedFile ? "Re-sign Document" : "Add E-Signature"}
                    </button>
                  )}
                  {detail.item.signedFile && (
                    <button onClick={() => handleDownload(detail.item.signedFile)} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      <Download size={13} /> Download Signed Copy
                    </button>
                  )}
                  {detail.item.signedFile && !detail.item.confirmed_at && (
                    <button onClick={confirmTicketSignature} className="flex items-center gap-1.5 rounded-xl bg-status-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                      <CheckCircle size={13} /> Confirm E-Signature
                    </button>
                  )}
                  {detail.item.confirmed_at && (
                    <span className="flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle size={13} /> Done &mdash; released to requester
                    </span>
                  )}
                  {detail.item.status === "approved_for_esigning" && (
                    <button onClick={() => setMoreOpen((v) => !v)} className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
                      E-signature routing {moreOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>

                {moreOpen && detail.item.status === "approved_for_esigning" && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          options={offices.map((o) => ({
                            value: o.id,
                            label: `${o.category} \u00b7 ${o.name} ${o.username ? `\u2014 ${o.username}` : "(no login yet)"}`,
                          }))}
                          value={routeOfficeId}
                          onChange={setRouteOfficeId}
                          placeholder="Route to authorized office..."
                        />
                      </div>
                      <button onClick={routeForSignature} disabled={!routeOfficeId} className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-3 text-xs font-semibold text-white disabled:opacity-50">
                        <Send size={13} />
                      </button>
                    </div>
                    {detail.routes?.length > 0 && (
                      <ul className="space-y-1.5">
                        {detail.routes.map((r) => (
                          <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-slate-700">{r.office_name}</p>
                                {r.office_username && <p className="truncate text-[10px] text-slate-400">{r.office_username}</p>}
                              </div>
                              {r.confirmed_at ? (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  <CheckCircle size={11} /> Done
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {!r.confirmed_at && (
                                <button onClick={() => openRouteSign(r)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100">
                                  {r.signed_file_id ? "Re-sign for office" : "Sign on behalf of office"}
                                </button>
                              )}
                              {r.signedFile && (
                                <button onClick={() => handleDownload(r.signedFile)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100">
                                  Download
                                </button>
                              )}
                              {r.signed_file_id && !r.confirmed_at && (
                                <button onClick={() => confirmRoute(r.id)} className="rounded-lg bg-status-success px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600">
                                  Confirm
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {signOpen && (
        <Suspense fallback={null}>
          <SignDocumentModal
            open={Boolean(signOpen)}
            onClose={() => setSignOpen(false)}
            title={signOpen === "admin" ? "Add E-Signature" : "Sign on Behalf of Office"}
            signEndpoint={
              signOpen === "admin"
                ? `/api/document-queue/${detail?.item.id}/sign`
                : `/api/document-queue/routes/${signOpen}/sign`
            }
            file={signOpen === "admin" ? detail?.item.file : routeSignFile}
            onSaved={() => {
              setSignOpen(false);
              notify("Signed copy saved.");
              refreshDetail(detail.item.id);
              load();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
