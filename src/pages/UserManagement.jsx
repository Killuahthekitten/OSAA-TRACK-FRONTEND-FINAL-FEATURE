import { useEffect, useRef, useState } from "react";
import { Users, Search, CheckCircle2, Power, Trash2, Plus, Pencil } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDashboardSummary } from "../context/DashboardContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import Modal from "../components/ui/Modal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { inputClass, selectClass, labelClass, primaryButtonClass, secondaryButtonClass } from "../components/ui/formStyles.js";

const TYPES = [{ v: "", l: "All types" }, { v: "student", l: "Students" }, { v: "alumni", l: "Alumni" }, { v: "staff", l: "Staff" }, { v: "offices", l: "Offices" }];
const TYPE_OPTIONS = ["student", "alumni", "staff", "offices"];
const STATUSES = [{ v: "", l: "All statuses" }, { v: "active", l: "Active" }, { v: "pending", l: "Pending" }, { v: "inactive", l: "Inactive" }];
const ACCESS_HINT = {
  student: "Will be able to sign in to the Student panel once it exists.",
  alumni: "Will be able to sign in to the Alumni panel once it exists.",
  staff: "Will be able to sign in to the Staff panel once it exists.",
  offices: "Will be able to sign in to the Office panel once it exists.",
};

function emptyForm() {
  return { code: "", name: "", email: "", type: "student", department: "", status: "active", password: "" };
}

export default function UserManagement() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useDashboardSummary();

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Only the very first load shows the full loading skeleton. Every load
  // after that (filter changes, or a refresh after create/update/delete)
  // is silent — the table stays mounted with its old rows while the new
  // ones come in, so the page never collapses to a spinner and jumps the
  // admin's scroll position back to the top.
  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      const data = await api.get(`/api/user-management?${params.toString()}`);
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
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, status]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }
  function openEdit(u) {
    setEditing(u);
    setForm({ code: u.code || "", name: u.name, email: u.email || "", type: u.type, department: u.department || "", status: u.status, password: "" });
    setError(null);
    setModalOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!editing && (!form.password || form.password.length < 4)) {
      setError("Set a password of at least 4 characters — this is what the user will sign in with.");
      return;
    }
    setSaving(true);
    try {
      if (editing) await api.put(`/api/user-management/${editing.id}`, form);
      else await api.post("/api/user-management", form);
      notify(editing ? "User updated." : "User created.");
      setModalOpen(false);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function verify(u) {
    try {
      await api.patch(`/api/user-management/${u.id}/verify`);
      notify(`${u.name} verified and activated.`);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  async function toggleActive(u) {
    try {
      await api.patch(`/api/user-management/${u.id}/${u.status === "active" ? "deactivate" : "activate"}`);
      notify(u.status === "active" ? "User deactivated." : "User activated.");
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Action failed.", "error");
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/api/user-management/${deleteTarget.id}`);
      notify("User deleted.");
      setDeleteTarget(null);
      load();
      refreshSummary();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Delete failed.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-info/10 text-status-info">
            <Users size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">User Management</h1>
            <p className="text-sm text-slate-500">Master directory of students, alumni, staff, and offices</p>
          </div>
        </div>
        <button onClick={openCreate} className={primaryButtonClass}><Plus size={16} /> New User</button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or code..." className={`${inputClass} pl-9`} />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${selectClass} sm:w-40`}>
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} sm:w-40`}>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>

      {state === "loading" && <LoadingState label="Loading users..." />}
      {state === "error" && <ErrorState onRetry={load} />}
      {state === "ready" && items.length === 0 && <EmptyState icon={Users} title="No matching users" />}
      {state === "ready" && items.length > 0 && (
        <div className="overflow-x-auto rounded-xl2 border border-slate-200 bg-white shadow-card">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 text-slate-700">{u.name} <span className="text-xs text-slate-400">{u.code}</span></td>
                  <td className="px-5 py-3 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3 capitalize text-slate-500">{u.type}</td>
                  <td className="px-5 py-3 text-slate-500">{u.department || "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit"><Pencil size={14} /></button>
                      {u.status === "pending" && (
                        <button onClick={() => verify(u)} className="flex size-8 items-center justify-center rounded-lg text-status-success hover:bg-emerald-50" title="Verify"><CheckCircle2 size={15} /></button>
                      )}
                      {u.status !== "pending" && (
                        <button onClick={() => toggleActive(u)} className="flex size-8 items-center justify-center rounded-lg text-status-warning hover:bg-amber-50" title="Toggle active"><Power size={15} /></button>
                      )}
                      <button onClick={() => setDeleteTarget(u)} className="flex size-8 items-center justify-center rounded-lg text-status-danger hover:bg-red-50" title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit User" : "New User"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Full name</label><input className={`${inputClass} mt-1`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label className={labelClass}>ID / code</label><input className={`${inputClass} mt-1`} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. 24-LN-0182" /></div>
          </div>
          <div><label className={labelClass}>Email</label><input type="email" className={`${inputClass} mt-1`} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div>
            <label className={labelClass}>Type &mdash; determines panel access</label>
            <select className={`${selectClass} mt-1`} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">{ACCESS_HINT[form.type]}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Department</label><input className={`${inputClass} mt-1`} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} /></div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={`${selectClass} mt-1`} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>{editing ? "New password (leave blank to keep current)" : "Password"}</label>
            <input type="text" className={`${inputClass} mt-1`} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={editing ? "••••••••" : "Set their login password"} />
            <p className="mt-1 text-[11px] text-slate-400">This is what they'll use to sign in once their panel exists — there's no self-service sign-up.</p>
          </div>
          {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className={secondaryButtonClass}>Cancel</button>
            <button type="submit" disabled={saving} className={primaryButtonClass}>{editing ? "Save Changes" : "Create User"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete user?" description={`"${deleteTarget?.name}" will be permanently removed from the system.`} confirmLabel="Delete" />
    </div>
  );
}
