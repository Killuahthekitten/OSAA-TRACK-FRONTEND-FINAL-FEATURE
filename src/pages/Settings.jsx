import { useEffect, useState } from "react";
import { Settings as SettingsIcon, User, KeyRound, SlidersHorizontal, Mail, MessageCircle } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Tooltip from "../components/ui/Tooltip.jsx";
import { inputClass, labelClass, primaryButtonClass } from "../components/ui/formStyles.js";

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-1 flex items-center gap-2">
        <Icon size={18} className="text-status-indigo" />
        <h2 className="font-heading text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {description && <p className="mb-4 text-xs text-slate-500">{description}</p>}
      {children}
    </div>
  );
}

function ProfileSection() {
  const { admin, updateAdmin } = useAuth();
  const { notify } = useToast();
  const [displayName, setDisplayName] = useState(admin?.displayName || "");
  const [username, setUsername] = useState(admin?.username || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await api.put("/api/settings/profile", { displayName, username });
      updateAdmin({ displayName: data.admin.displayName, username: data.admin.username });
      notify("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard icon={User} title="Admin Profile" description="Your display name and login email, shown in the header and on generated reports.">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Display name</label>
            <input className={`${inputClass} mt-1`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Username / email</label>
            <input className={`${inputClass} mt-1`} value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end">
          <Tooltip text="Saves your display name and login email — you'll use the new email next time you sign in.">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </Tooltip>
        </div>
      </form>
    </SettingsCard>
  );
}

function PasswordSection() {
  const { notify } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/settings/password", { currentPassword, newPassword });
      notify("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard icon={KeyRound} title="Change Password" description="You'll stay signed in on this device after changing it.">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>Current password</label>
          <input type="password" className={`${inputClass} mt-1`} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>New password</label>
            <input type="password" className={`${inputClass} mt-1`} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input type="password" className={`${inputClass} mt-1`} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}
        <div className="flex justify-end">
          <Tooltip text="Updates your login password — at least 8 characters.">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? "Updating..." : "Update password"}
            </button>
          </Tooltip>
        </div>
      </form>
    </SettingsCard>
  );
}

function SystemPreferencesSection({ settings, onSaved }) {
  const { notify } = useToast();
  const [days, setDays] = useState(settings.documentQueueRevisionDays);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.put("/api/settings", { documentQueueRevisionDays: days });
      onSaved(data.settings);
      notify("System preferences updated.");
    } catch {
      notify("Could not update system preferences.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      icon={SlidersHorizontal}
      title="System Preferences"
      description="Controls a few behaviors elsewhere in the panel."
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Document Queue revision window (days)</label>
          <input
            type="number"
            min={1}
            max={30}
            className={`${inputClass} mt-1 w-32`}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            How long a requester has to re-upload after "Request Revision" before a ticket is considered overdue.
          </p>
        </div>
        <Tooltip text="Applies to every new revision request from now on — tickets already in a revision window keep their original deadline.">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? "Saving..." : "Save"}
          </button>
        </Tooltip>
      </form>
    </SettingsCard>
  );
}

function InfoSection({ email, chat }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <SettingsCard icon={Mail} title="Email Notifications">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${email.enabled ? "bg-status-success" : "bg-slate-300"}`} />
          <p className="text-sm text-slate-600">{email.enabled ? "Enabled" : "Not configured"}</p>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Announcement emails are sent via SMTP configured in <code className="rounded bg-slate-100 px-1 py-0.5">backend/.env</code>. This is a
          deployment-level setting, not editable from here, since it involves server credentials.
        </p>
      </SettingsCard>
      <SettingsCard icon={MessageCircle} title="SAA Chat">
        <p className="text-sm text-slate-600">Messages disappear automatically {chat.retentionHours} hours after being sent.</p>
        <p className="mt-2 text-[11px] text-slate-400">This keeps chat history short-lived by design — it isn't meant to be a permanent record.</p>
      </SettingsCard>
    </div>
  );
}

export default function SettingsPage() {
  const { handleSessionInvalidated } = useAuth();
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);

  async function load() {
    setState("loading");
    try {
      const result = await api.get("/api/settings");
      setData(result);
      setState("ready");
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") return <LoadingState label="Loading settings..." />;
  if (state === "error") return <ErrorState onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
          <SettingsIcon size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Settings</h1>
          <p className="text-sm text-slate-500">Your admin profile, password, and a few system-wide preferences</p>
        </div>
      </div>

      <ProfileSection />
      <PasswordSection />
      <SystemPreferencesSection settings={data.settings} onSaved={(settings) => setData((d) => ({ ...d, settings }))} />
      <InfoSection email={data.email} chat={data.chat} />
    </div>
  );
}
