import { useEffect, useRef, useState } from "react";
import {
  FileBarChart2,
  GraduationCap,
  Users,
  Briefcase,
  ClipboardList,
  Download,
  Trash2,
  Loader2,
  Play,
  History,
  FileText,
} from "lucide-react";
import { api, ApiError, fetchProtectedFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import SearchableSelect from "../components/ui/SearchableSelect.jsx";
import { inputClass, labelClass, selectClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const GROUP_ICON = {
  Scholarships: GraduationCap,
  "Student Life": Users,
  "Campus Opportunities": Briefcase,
  Administration: ClipboardList,
};
const GROUP_ORDER = ["Scholarships", "Student Life", "Campus Opportunities", "Administration"];

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

async function triggerDownload(fileId, suggestedName, handleSessionInvalidated) {
  try {
    const blob = await fetchProtectedFile(`/api/uploads/${fileId}/download`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(suggestedName || "report").replace(/[\\/:*?"<>|]/g, "")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    handleSessionInvalidated(err);
    return false;
  }
}

// ── one dynamic filter field, rendered from a report definition ───────
function FilterField({ field, value, onChange, colleges, collegePrograms, cascadeValue, optionsCache, optionsLoading }) {
  if (field.type === "text") {
    return (
      <input
        className={`${inputClass} mt-1`}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ""}
      />
    );
  }

  let opts;
  if (field.cascadeFrom) {
    // Course/Program filter that follows the sibling College filter: once
    // a college is picked, only that college's own courses are offered.
    const collegeCourses = cascadeValue ? collegePrograms?.[cascadeValue] : null;
    const source = collegeCourses && collegeCourses.length ? collegeCourses : Object.values(collegePrograms || {}).flat();
    opts = source.map((p) => ({ value: p, label: p }));
  } else if (field.optionsSource === "colleges") opts = colleges.map((c) => ({ value: c.id, label: c.name }));
  else if (field.optionsSource) opts = (optionsCache[field.optionsSource] || []).map((o) => ({ value: o.id, label: o.name }));
  else opts = field.options;

  const loading = field.optionsSource && optionsLoading.has(field.optionsSource);
  const placeholder = field.cascadeFrom
    ? cascadeValue
      ? `All courses in ${cascadeValue}`
      : field.placeholder || "All courses / programs"
    : field.placeholder || (field.required ? "Select one..." : "All");

  // "Pick a student" filters (a specific applicant/achievement out of
  // potentially many) get a type-to-filter combobox instead of a plain
  // <select>, since scanning a long native dropdown by eye doesn't scale.
  // The Course/Program cascade also gets one — a college's course list is
  // short, but several colleges combined (when no college is picked yet)
  // is not, so it's searchable either way for a consistent feel.
  if ((field.searchable && field.optionsSource) || field.cascadeFrom) {
    return (
      <div className="mt-1">
        <SearchableSelect options={opts} value={value} onChange={onChange} placeholder={placeholder} loading={loading} />
      </div>
    );
  }

  return (
    <select className={`${selectClass} mt-1`} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={loading}>
      {field.optionsSource && <option value="">{loading ? "Loading..." : placeholder}</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── generate modal — filters for one report, then downloads the PDF ───
function GenerateReportModal({ open, onClose, definition, colleges, collegePrograms, optionsCache, optionsLoading, ensureOptions, onGenerated }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [filters, setFilters] = useState({});
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open && definition) {
      setFilters({});
      setError(null);
      (definition.filters || []).forEach((f) => {
        if (f.optionsSource && f.optionsSource !== "colleges") ensureOptions(f.optionsSource);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, definition]);

  if (!definition) return null;

  const hasCascadingProgram = (definition.filters || []).some((f) => f.cascadeFrom === "college");

  function handleFilterChange(fieldKey, val) {
    setFilters((s) => {
      const next = { ...s, [fieldKey]: val };
      // Changing College clears whatever Course/Program was already
      // picked, since it may no longer belong to the newly-picked college.
      if (fieldKey === "college" && hasCascadingProgram) next.program = "";
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    for (const f of definition.filters || []) {
      if (f.required && !filters[f.key]) {
        setError(`${f.label} is required for this report.`);
        return;
      }
    }
    setError(null);
    setGenerating(true);
    try {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined));
      const result = await api.post("/api/reports/generate", { reportKey: definition.key, filters: cleanFilters });
      notify(`${result.rowCount} record${result.rowCount === 1 ? "" : "s"} \u2014 report ready.`);
      await triggerDownload(result.fileId, result.title, handleSessionInvalidated);
      onGenerated();
      onClose();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Could not generate the report.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={definition.label} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-500">{definition.description}</p>
        {(definition.filters || []).length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">No filters for this report \u2014 it will include every record.</p>
        )}
        {(definition.filters || []).map((f) => (
          <div key={f.key}>
            <label className={labelClass}>
              {f.label}
              {f.required && <span className="text-status-danger"> *</span>}
            </label>
            <FilterField
              field={f}
              value={filters[f.key]}
              onChange={(v) => handleFilterChange(f.key, v)}
              colleges={colleges}
              collegePrograms={collegePrograms}
              cascadeValue={f.cascadeFrom ? filters[f.cascadeFrom] : undefined}
              optionsCache={optionsCache}
              optionsLoading={optionsLoading}
            />
          </div>
        ))}
        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={generating} className={primaryButtonClass}>
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {generating ? "Generating..." : "Generate & Download"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── one report card ─────────────────────────────────────────────────
function ReportCard({ definition, onGenerate }) {
  const Icon = GROUP_ICON[definition.group] || FileBarChart2;
  return (
    <div className="flex flex-col gap-3 rounded-xl2 border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex size-10 items-center justify-center rounded-lg bg-status-indigo/10 text-status-indigo">
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-slate-800">{definition.label}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{definition.description}</p>
      </div>
      <button type="button" onClick={() => onGenerate(definition)} className={`${secondaryButtonClass} w-full`}>
        <FileBarChart2 size={15} /> Generate
      </button>
    </div>
  );
}

// ── page ────────────────────────────────────────────────────────────
export default function Reports() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [definitions, setDefinitions] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [collegePrograms, setCollegePrograms] = useState({});
  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState("loading");
  const [activeDefinition, setActiveDefinition] = useState(null);
  const [optionsCache, setOptionsCache] = useState({});
  const [optionsLoading, setOptionsLoading] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const loadedOnce = useRef(false);

  async function loadDefinitions() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/reports/definitions");
      setDefinitions(data.items);
      setColleges(data.colleges || []);
      setCollegePrograms(data.collegePrograms || {});
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }

  async function loadHistory() {
    setHistoryState("loading");
    try {
      const data = await api.get("/api/reports/history");
      setHistory(data.items);
      setHistoryState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setHistoryState("error");
    }
  }

  useEffect(() => {
    loadDefinitions();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ensureOptions(source) {
    if (optionsCache[source] || optionsLoading.has(source)) return;
    setOptionsLoading((s) => new Set(s).add(source));
    try {
      const data = await api.get(`/api/reports/lookup/${source}`);
      setOptionsCache((s) => ({ ...s, [source]: data.items.map((o) => ({ id: o.id, name: o.name })) }));
    } catch (err) {
      handleSessionInvalidated(err);
    } finally {
      setOptionsLoading((s) => {
        const next = new Set(s);
        next.delete(source);
        return next;
      });
    }
  }

  async function handleDownloadHistory(item) {
    setDownloadingId(item.id);
    await triggerDownload(item.file_id, item.title, handleSessionInvalidated);
    setDownloadingId(null);
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api.del(`/api/reports/history/${deleteTarget.id}`);
      notify("Report removed.");
      setDeleteTarget(null);
      loadHistory();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Could not delete this report.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <PageShell><LoadingState label="Loading report types..." /></PageShell>;
  if (state === "error") return <PageShell><ErrorState onRetry={loadDefinitions} /></PageShell>;

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: definitions.filter((d) => d.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <PageShell>
      <div className="space-y-8">
        {grouped.map(({ group, items }) => (
          <div key={group} className="space-y-3">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-slate-400">{group}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((d) => (
                <ReportCard key={d.key} definition={d} onGenerate={setActiveDefinition} />
              ))}
            </div>
          </div>
        ))}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-400" />
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-slate-400">Recent Reports</h2>
          </div>

          {historyState === "loading" && <LoadingState label="Loading report history..." />}
          {historyState === "error" && <ErrorState onRetry={loadHistory} />}
          {historyState === "ready" && history.length === 0 && (
            <EmptyState icon={FileText} title="No reports generated yet" description="Pick a report above and click Generate to create your first PDF." />
          )}
          {historyState === "ready" && history.length > 0 && (
            <div className="overflow-x-auto rounded-xl2 border border-slate-200 bg-white shadow-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Report</th>
                    <th className="px-5 py-3">Generated</th>
                    <th className="px-5 py-3">Records</th>
                    <th className="px-5 py-3">Size</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 text-slate-700">{item.title}</td>
                      <td className="px-5 py-3 text-slate-500">{formatDateTime(item.generated_at)}</td>
                      <td className="px-5 py-3 text-slate-500">{item.row_count}</td>
                      <td className="px-5 py-3 text-slate-500">{formatSize(item.size_bytes)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleDownloadHistory(item)}
                            disabled={downloadingId === item.id}
                            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-blue disabled:opacity-60"
                            title="Download"
                          >
                            {downloadingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-status-danger"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <GenerateReportModal
        open={Boolean(activeDefinition)}
        onClose={() => setActiveDefinition(null)}
        definition={activeDefinition}
        colleges={colleges}
        collegePrograms={collegePrograms}
        optionsCache={optionsCache}
        optionsLoading={optionsLoading}
        ensureOptions={ensureOptions}
        onGenerated={loadHistory}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={busy}
        title="Delete this report?"
        description={`"${deleteTarget?.title}" will be permanently removed from your report history.`}
        confirmLabel="Delete"
      />
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
          <FileBarChart2 size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Report Generation</h1>
          <p className="text-sm text-slate-500">Pick a report, set your filters, and download a branded PDF snapshot straight from the database</p>
        </div>
      </div>
      {children}
    </div>
  );
}
