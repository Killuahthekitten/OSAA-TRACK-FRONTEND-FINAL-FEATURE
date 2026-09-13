import { useEffect, useMemo } from "react";
import { AlertCircle, Award, Bell, CheckCircle2, GraduationCap, PenLine, Users } from "lucide-react";
import saaSeal from "../assets/saa-seal.png";
import { useDashboardSummary } from "../context/DashboardContext.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function Dashboard() {
  const { summary, state, refresh } = useDashboardSummary();
  const now = useMemo(() => new Date(), []);

  // Refetch every time the Home page is actually visited, not just once
  // per login — so the cards and activity feed never show stale numbers
  // after adding/deciding/deleting something in another module.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      {/* hero */}
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-9 sm:px-10 sm:py-11"
        style={{ backgroundImage: "linear-gradient(171deg, rgb(202,182,92) 0%, rgb(24,54,210) 50%, rgb(2,14,88) 100%)" }}
      >
        <div className="pointer-events-none absolute -top-24 right-[-40px] size-[380px] rounded-full bg-white/[0.05]" />
        <div className="pointer-events-none absolute -top-16 right-[80px] size-[220px] rounded-full bg-white/[0.03]" />
        <img
          src={saaSeal}
          alt=""
          className="pointer-events-none absolute -top-24 right-[-40px] size-[380px] rounded-full object-cover opacity-[0.14]"
        />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white sm:text-[30px]">
              Welcome back, Admin! 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-[15px]">
              Here&rsquo;s a quick overview of your important activities and updates. Everything you need is at
              your fingertips.
            </p>
          </div>
          <div className="text-left text-white/70 sm:text-right">
            <p className="font-sans text-2xl font-bold text-white sm:text-[32px]">{DAY_FORMAT.format(now)}</p>
            <p className="text-sm">{DATE_FORMAT.format(now)}</p>
          </div>
        </div>
      </div>

      {state === "loading" && <LoadingState label="Loading dashboard..." />}
      {state === "error" && <ErrorState message="Unable to load dashboard data." onRetry={refresh} />}

      {state === "ready" && summary && (
        <>
          {/* quick snaps */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={PenLine}
              iconClass="bg-status-indigo/10 text-status-indigo"
              title="Document Queue"
              to="/document-queue"
              metrics={[
                { label: "Pending SAA", value: `${summary.documentSignatureRelay.pendingSaa} Documents`, tone: "warning" },
                { label: "Approved", value: `${summary.documentSignatureRelay.approved} Documents`, tone: "success" },
              ]}
            />
            <StatCard
              icon={GraduationCap}
              iconClass="bg-status-success/10 text-status-success"
              title="Scholarships"
              to="/scholarships"
              metrics={[
                { label: "Active Scholarships", value: summary.scholarships.active, tone: "default" },
                { label: "New Applications", value: summary.scholarships.newApplications, tone: "warning" },
              ]}
            />
            <StatCard
              icon={Bell}
              iconClass="bg-status-warning/10 text-status-warning"
              title="Announcements"
              to="/announcements"
              metrics={[
                { label: "Drafts", value: summary.announcements.drafts, tone: "warning" },
                { label: "Published", value: summary.announcements.published, tone: "success" },
              ]}
            />
            <StatCard
              icon={Award}
              iconClass="bg-status-danger/10 text-status-danger"
              title="Achievement Management"
              to="/achievements"
              metrics={[
                { label: "Pending Validation", value: `${summary.achievements.pendingValidation} Achievements`, tone: "warning" },
                { label: "Approved Today", value: summary.achievements.approvedToday, tone: "success" },
              ]}
            />
            <StatCard
              icon={Users}
              iconClass="bg-status-info/10 text-status-info"
              title="User Management"
              to="/user-management"
              metrics={[
                { label: "Total Users", value: summary.userManagement.totalUsers, tone: "default" },
                { label: "Pending Approval", value: summary.userManagement.pendingApproval, tone: "warning" },
              ]}
            />
          </div>

          {/* activity feed */}
          <div className="rounded-xl2 border border-slate-200 bg-white p-6 shadow-card sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-semibold text-slate-800">
              <AlertCircle size={18} className="text-slate-400" />
              Activity Updates
            </h2>
            {summary.activity.length === 0 ? (
              <EmptyState title="All caught up" description="No pending items need your attention right now." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.activity.map((item) => {
                  const Icon = item.tone === "success" ? CheckCircle2 : AlertCircle;
                  const iconClass = item.tone === "success" ? "bg-status-success/10 text-status-success" : "bg-status-warning/10 text-status-warning";
                  return (
                    <li key={item.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl2 ${iconClass}`}>
                        <Icon size={18} />
                      </span>
                      <p className="pt-2 text-sm leading-relaxed text-slate-600">{item.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
