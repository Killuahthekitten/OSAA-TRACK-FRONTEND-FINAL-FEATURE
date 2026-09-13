import { useEffect, useRef, useState } from "react";
import { Network, Plus, ArrowLeft, Pencil, Trash2, Building2, School, Search, Users, Download } from "lucide-react";
import { api, ApiError, fetchProtectedFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import LogoUploadSquare from "../components/ui/LogoUploadSquare.jsx";
import PhotoUploadCircle from "../components/ui/PhotoUploadCircle.jsx";
import ProtectedImage from "../components/ui/ProtectedImage.jsx";
import HierarchyChart from "../components/ui/HierarchyChart.jsx";
import OrgDocumentsCard from "../components/ui/OrgDocumentsCard.jsx";
import Tooltip from "../components/ui/Tooltip.jsx";
import { categoryToneClasses } from "../components/ui/categoryTone.js";
import { inputClass, labelClass, selectClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";
import psuSealAsset from "../assets/psu-seal.png";

async function triggerChartDownload(orgId, orgName, handleSessionInvalidated) {
  try {
    const blob = await fetchProtectedFile(`/api/student-leaders/organizations/${orgId}/chart-pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(orgName || "organization").replace(/[\\/:*?"<>|]/g, "")} - Organizational Chart.pdf`;
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

// Per-organization accent color for the grid cards — cycled by list
// position so each card's icon reads as visually distinct at a glance,
// the way a real campus directory board would color-code its org tiles.
const ORG_ACCENTS = [
  { text: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  { text: "text-purple-600", border: "border-purple-200", bg: "bg-purple-50" },
  { text: "text-amber-600", border: "border-amber-200", bg: "bg-amber-50" },
  { text: "text-rose-600", border: "border-rose-200", bg: "bg-rose-50" },
  { text: "text-indigo-600", border: "border-indigo-200", bg: "bg-indigo-50" },
  { text: "text-pink-600", border: "border-pink-200", bg: "bg-pink-50" },
  { text: "text-emerald-600", border: "border-emerald-200", bg: "bg-emerald-50" },
  { text: "text-teal-600", border: "border-teal-200", bg: "bg-teal-50" },
];
function orgAccent(index) {
  return ORG_ACCENTS[index % ORG_ACCENTS.length];
}

// ── shared form helpers ──────────────────────────────────────────────
function emptyOrgForm() {
  return { name: "", collegeName: "", psuName: "Pangasinan State University", orgLogoFile: null, collegeLogoFile: null, psuLogoFile: null };
}
function orgToForm(org) {
  return {
    name: org.name || "",
    collegeName: org.college_name || "",
    psuName: org.psu_name || "Pangasinan State University",
    orgLogoFile: org.org_logo || null,
    collegeLogoFile: org.college_logo || null,
    psuLogoFile: org.psu_logo || null,
  };
}

function emptyOfficerForm() {
  return { name: "", position: "", category: "", parentOfficerId: "", photoFile: null };
}
function officerToForm(o) {
  return {
    name: o.name || "",
    position: o.position || "",
    category: o.category || "",
    parentOfficerId: o.parent_officer_id ? String(o.parent_officer_id) : "",
    photoFile: o.photo || null,
  };
}

// All officers currently reporting up to `rootId` (directly or through
// someone else) — used to keep the "position above" dropdown from
// offering a choice that would loop the chart back on itself.
function descendantIds(officers, rootId) {
  const ids = new Set();
  let frontier = [rootId];
  while (frontier.length > 0) {
    const next = officers.filter((o) => frontier.includes(o.parent_officer_id) && !ids.has(o.id));
    next.forEach((o) => ids.add(o.id));
    frontier = next.map((o) => o.id);
  }
  return ids;
}

// ── Organization add/edit modal (name + the 3 logos, kept separate from
// the officer form per the admin's request) ─────────────────────────────
function OrganizationFormModal({ open, onClose, initial, onSaved }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState(emptyOrgForm());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? orgToForm(initial) : emptyOrgForm());
      setError(null);
    }
  }, [open, initial]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Organization name is required.");
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      collegeName: form.collegeName.trim() || null,
      psuName: form.psuName.trim() || "Pangasinan State University",
      orgLogoFileId: form.orgLogoFile?.id || null,
      collegeLogoFileId: form.collegeLogoFile?.id || null,
      psuLogoFileId: form.psuLogoFile?.id || null,
    };
    try {
      if (initial) {
        await api.put(`/api/student-leaders/organizations/${initial.id}`, payload);
        notify("Organization updated.");
      } else {
        await api.post("/api/student-leaders/organizations", payload);
        notify("Organization added.");
      }
      onSaved();
      onClose();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Branding" : "Add Organization"} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex justify-center gap-6 rounded-xl bg-slate-50/60 py-5">
          <LogoUploadSquare
            label="Org Logo"
            value={form.orgLogoFile}
            onChange={(file) => setForm((f) => ({ ...f, orgLogoFile: file }))}
          />
          <LogoUploadSquare
            label="College Logo"
            value={form.collegeLogoFile}
            onChange={(file) => setForm((f) => ({ ...f, collegeLogoFile: file }))}
          />
          <LogoUploadSquare
            label="PSU Logo"
            value={form.psuLogoFile}
            onChange={(file) => setForm((f) => ({ ...f, psuLogoFile: file }))}
          />
        </div>

        <div>
          <label className={labelClass}>Name of the Organization</label>
          <input
            className={`${inputClass} mt-1`}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Society of Future IT Innovators (SFIT)"
          />
        </div>
        <div>
          <label className={labelClass}>Name of the College</label>
          <input
            className={`${inputClass} mt-1`}
            value={form.collegeName}
            onChange={(e) => setForm((f) => ({ ...f, collegeName: e.target.value }))}
            placeholder="e.g. College of Computing Sciences"
          />
        </div>
        <div>
          <label className={labelClass}>Name of the University</label>
          <input className={`${inputClass} mt-1`} value={form.psuName} onChange={(e) => setForm((f) => ({ ...f, psuName: e.target.value }))} />
          <p className="mt-1.5 text-xs text-slate-400">Leave the PSU logo blank above to use the standard PSU seal.</p>
        </div>

        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>{initial ? "Save Branding" : "Add Organization"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Officer add/edit modal ───────────────────────────────────────────
function OfficerFormModal({ open, onClose, initial, officers, onSaved, orgId }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState(emptyOfficerForm());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? officerToForm(initial) : emptyOfficerForm());
      setError(null);
    }
  }, [open, initial]);

  const excluded = initial ? new Set([initial.id, ...descendantIds(officers, initial.id)]) : new Set();
  const parentOptions = officers.filter((o) => !excluded.has(o.id));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.position.trim()) {
      setError("Name and position are required.");
      return;
    }
    setError(null);
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      position: form.position.trim(),
      category: form.category.trim() || null,
      parentOfficerId: form.parentOfficerId || null,
      photoFileId: form.photoFile?.id || null,
    };
    try {
      if (initial) {
        await api.put(`/api/student-leaders/officers/${initial.id}`, payload);
        notify("Officer updated.");
      } else {
        await api.post(`/api/student-leaders/organizations/${orgId}/officers`, payload);
        notify("Officer added.");
      }
      onSaved();
      onClose();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Officer" : "Add Officer"} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>Name</label>
          <input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
        </div>
        <div className="flex justify-center">
          <PhotoUploadCircle value={form.photoFile} onChange={(file) => setForm((f) => ({ ...f, photoFile: file }))} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Position</label>
            <input className={`${inputClass} mt-1`} value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder="e.g. President" />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <input className={`${inputClass} mt-1`} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Executive Board" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Position above (in the hierarchy)</label>
          <select className={`${selectClass} mt-1`} value={form.parentOfficerId} onChange={(e) => setForm((f) => ({ ...f, parentOfficerId: e.target.value }))}>
            <option value="">None — this is a top position</option>
            {parentOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.position} — {o.name}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>{initial ? "Save Changes" : "Add Officer"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Level 1: organization grid ───────────────────────────────────────
function OrganizationGrid({ onOpen }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const data = await api.get("/api/student-leaders/organizations");
      setItems(data.items);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh the list.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") return <LoadingState label="Loading organizations..." />;
  if (state === "error") return <ErrorState onRetry={load} />;

  const filtered = search.trim()
    ? items.filter((org) => `${org.name} ${org.college_name || ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">{items.length} recognized organization{items.length === 1 ? "" : "s"}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations..."
              className={`${inputClass} w-full pl-9 sm:w-64`}
            />
          </div>
          <button type="button" onClick={() => setFormOpen(true)} className={primaryButtonClass}>
            <Plus size={16} /> Add Organization
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Network} title="No organizations yet" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No organizations match your search" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((org, index) => {
            const accent = orgAccent(index);
            return (
              <button
                key={org.id}
                onClick={() => onOpen(org.id)}
                className="group flex flex-col items-center overflow-hidden rounded-xl2 border border-slate-200 bg-white text-center shadow-card transition hover:-translate-y-1 hover:border-status-indigo/30 hover:shadow-lg"
              >
                <div className="relative flex w-full justify-center pb-2 pt-7">
                  <ProtectedImage
                    file={org.org_logo}
                    alt={org.name}
                    className={`size-16 rounded-full border-2 ${accent.border} bg-white shadow-card`}
                    fallback={
                      <div className={`flex size-16 items-center justify-center rounded-full border-2 ${accent.border} ${accent.bg} ${accent.text}`}>
                        <Building2 size={26} />
                      </div>
                    }
                  />
                </div>
                <div className="flex w-full flex-1 flex-col items-center gap-1.5 px-4 pb-5 pt-2">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-800">{org.name}</p>
                  {org.college_name && <p className="line-clamp-1 text-[11px] text-slate-400">{org.college_name}</p>}
                  <span className={`mt-1 text-[11px] font-semibold ${org.officer_count > 0 ? accent.text : "text-slate-400"}`}>
                    {org.officer_count > 0 ? `${org.officer_count} officer${org.officer_count === 1 ? "" : "s"}` : "No officers posted yet"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <OrganizationFormModal open={formOpen} onClose={() => setFormOpen(false)} initial={null} onSaved={load} />
    </div>
  );
}

// ── Level 2: one organization's logos + hierarchy chart ─────────────
function LogoBlock({ file, name, fallback }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {file ? (
        <ProtectedImage file={file} alt={name} className="size-16 rounded-full border border-slate-100 sm:size-20" />
      ) : (
        fallback
      )}
      <p className="max-w-[140px] text-center text-xs font-medium text-slate-600">{name}</p>
    </div>
  );
}

// Directory table — a flat, tabular view of the same officer list the
// chart renders, useful for quick scanning/editing once an org has more
// than a handful of positions.
function parentName(officers, officer) {
  if (!officer.parent_officer_id) return null;
  const parent = officers.find((o) => o.id === officer.parent_officer_id);
  return parent ? parent.name : null;
}

function OfficerDirectoryTable({ officers, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-xl2 border border-slate-200 bg-white shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-5 py-3">Officer</th>
            <th className="px-5 py-3">Position</th>
            <th className="px-5 py-3">Category</th>
            <th className="px-5 py-3">Reports To</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {officers.map((o) => (
            <tr key={o.id} className="border-b border-slate-50 last:border-0">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <ProtectedImage
                    file={o.photo}
                    alt={o.name}
                    className="size-8 rounded-full border border-slate-100"
                    fallback={
                      <div className="flex size-8 items-center justify-center rounded-full bg-status-indigo/10 text-status-indigo">
                        <Users size={14} />
                      </div>
                    }
                  />
                  <span className="font-medium text-slate-700">{o.name}</span>
                </div>
              </td>
              <td className="px-5 py-3 text-slate-500">{o.position}</td>
              <td className="px-5 py-3">
                {o.category ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${categoryToneClasses(o.category)}`}>{o.category}</span>
                ) : (
                  <span className="text-slate-300">&mdash;</span>
                )}
              </td>
              <td className="px-5 py-3 text-slate-500">
                {parentName(officers, o) || <span className="italic text-slate-400">Top position</span>}
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-1">
                  <button onClick={() => onEdit(o)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-blue" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDelete(o)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-status-danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrganizationDetail({ orgId, onBack }) {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [org, setOrg] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [orgFormOpen, setOrgFormOpen] = useState(false);
  const [officerModal, setOfficerModal] = useState(null); // { officer: null|{...} }
  const [deleteOfficerTarget, setDeleteOfficerTarget] = useState(null);
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadingChart, setDownloadingChart] = useState(false);
  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const [orgData, officersData] = await Promise.all([
        api.get(`/api/student-leaders/organizations/${orgId}`),
        api.get(`/api/student-leaders/organizations/${orgId}/officers`),
      ]);
      setOrg(orgData);
      setOfficers(officersData.items);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh this organization.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function confirmDeleteOfficer() {
    setBusy(true);
    try {
      await api.del(`/api/student-leaders/officers/${deleteOfficerTarget.id}`);
      notify("Officer removed.");
      setDeleteOfficerTarget(null);
      load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Could not remove officer.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteOrg() {
    setBusy(true);
    try {
      await api.del(`/api/student-leaders/organizations/${orgId}`);
      notify("Organization deleted.");
      onBack();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Could not delete organization.", "error");
      setBusy(false);
    }
  }

  if (state === "loading") return <LoadingState label="Loading organization..." />;
  if (state === "error") return <ErrorState onRetry={load} />;
  if (!org) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to organizations
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOrgFormOpen(true)} className={secondaryButtonClass}>
            <Pencil size={14} /> Edit Branding
          </button>
          <button
            type="button"
            onClick={() => setDeleteOrgOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-status-danger transition hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* The 3 logos + names, centered at the top per spec */}
      <div className="flex flex-wrap items-start justify-center gap-8 rounded-2xl border border-slate-200 bg-white py-7 shadow-card sm:gap-12">
        <LogoBlock
          file={org.org_logo}
          name={org.name}
          fallback={
            <div className="flex size-16 items-center justify-center rounded-full bg-status-indigo/10 text-status-indigo sm:size-20">
              <Building2 size={28} />
            </div>
          }
        />
        <LogoBlock
          file={org.college_logo}
          name={org.college_name || "College"}
          fallback={
            <div className="flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 sm:size-20">
              <School size={28} />
            </div>
          }
        />
        {org.psu_logo ? (
          <LogoBlock file={org.psu_logo} name={org.psu_name} />
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <img src={psuSealAsset} alt={org.psu_name} className="size-16 rounded-full object-cover sm:size-20" />
            <p className="max-w-[140px] text-center text-xs font-medium text-slate-600">{org.psu_name}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold text-slate-800">Organizational Chart</h2>
          <div className="flex gap-2">
            <Tooltip text="Downloads this chart as a PDF you can keep or print.">
              <button
                type="button"
                onClick={async () => {
                  setDownloadingChart(true);
                  await triggerChartDownload(orgId, org.name, handleSessionInvalidated);
                  setDownloadingChart(false);
                }}
                disabled={downloadingChart}
                className={secondaryButtonClass}
              >
                <Download size={14} /> {downloadingChart ? "Preparing..." : "Download PDF"}
              </button>
            </Tooltip>
            <button type="button" onClick={() => setOfficerModal({ officer: null })} className={primaryButtonClass}>
              <Plus size={16} /> Add Officer
            </button>
          </div>
        </div>
        <HierarchyChart
          officers={officers}
          onEdit={(officer) => setOfficerModal({ officer })}
          onDelete={(officer) => setDeleteOfficerTarget(officer)}
        />
      </div>

      {officers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <h2 className="font-heading text-base font-semibold text-slate-800">Officer Directory</h2>
            <span className="text-xs text-slate-400">({officers.length})</span>
          </div>
          <OfficerDirectoryTable
            officers={officers}
            onEdit={(officer) => setOfficerModal({ officer })}
            onDelete={(officer) => setDeleteOfficerTarget(officer)}
          />
        </div>
      )}

      <OrgDocumentsCard orgId={orgId} />

      <OrganizationFormModal open={orgFormOpen} onClose={() => setOrgFormOpen(false)} initial={org} onSaved={load} />

      {officerModal && (
        <OfficerFormModal
          open={Boolean(officerModal)}
          onClose={() => setOfficerModal(null)}
          initial={officerModal.officer}
          officers={officers}
          orgId={orgId}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteOfficerTarget)}
        onClose={() => setDeleteOfficerTarget(null)}
        onConfirm={confirmDeleteOfficer}
        loading={busy}
        title="Remove officer?"
        description={`"${deleteOfficerTarget?.name}" will be removed from the chart. Any positions listed under them move up to the top level instead of being deleted.`}
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={deleteOrgOpen}
        onClose={() => setDeleteOrgOpen(false)}
        onConfirm={confirmDeleteOrg}
        loading={busy}
        title="Delete organization?"
        description={`"${org.name}" and its entire officer hierarchy will be permanently deleted.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

export default function StudentLeaders() {
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
          <Network size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Student Leaders Directory</h1>
          <p className="text-sm text-slate-500">Campus-wide officer &amp; adviser directory, with each organization's own hierarchy chart</p>
        </div>
      </div>

      {selectedOrgId ? (
        <OrganizationDetail orgId={selectedOrgId} onBack={() => setSelectedOrgId(null)} />
      ) : (
        <OrganizationGrid onOpen={setSelectedOrgId} />
      )}
    </div>
  );
}
