import { useEffect, useRef, useState } from "react";
import {
  BarChart3, Users, Megaphone, Rss, FolderOpen, FileCheck2,
  GraduationCap, Trophy, Briefcase, Send, UserCircle2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import ChartCard, { colorAt } from "../components/ui/ChartCard.jsx";

const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  labelStyle: { fontWeight: 600, color: "#1e293b" },
};

function hasData(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.some((d) => d.value > 0);
}

function NoData() {
  return <div className="flex h-[220px] items-center justify-center text-xs text-slate-400">No data yet</div>;
}

function DistBar({ data, height = 220 }) {
  if (!hasData(data)) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={0} angle={data.length > 4 ? -20 : 0} textAnchor={data.length > 4 ? "end" : "middle"} height={data.length > 4 ? 46 : 24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DistPie({ data, height = 220 }) {
  if (!hasData(data)) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Timeline({ data, color = "#2563eb", height = 220 }) {
  if (!data || data.length === 0) return <NoData />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval={4} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Section({ icon, title, children }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-heading text-sm font-bold text-slate-700">{title}</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

export default function Analytics() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState("loading");
  const [data, setData] = useState(null);
  const loadedOnce = useRef(false);

  async function load() {
    if (!loadedOnce.current) setState("loading");
    try {
      const result = await api.get("/api/analytics");
      setData(result);
      setState("ready");
      loadedOnce.current = true;
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) notify("Could not refresh analytics.", "error");
      else setState("error");
    }
  }

  useEffect(() => {
    // Every visit re-queries the database directly (see analyticsRepo.js) —
    // there's nothing cached to go stale after an add/edit/delete elsewhere.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
          <BarChart3 size={22} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Analytics</h1>
          <p className="text-sm text-slate-500">A live snapshot of every module, straight from the database</p>
        </div>
      </div>

      {state === "loading" && <LoadingState label="Crunching the numbers..." />}
      {state === "error" && <ErrorState onRetry={load} />}

      {state === "ready" && data && (
        <div className="space-y-8">
          <Section icon={<Users size={16} className="text-slate-400" />} title="User Management">
            <ChartCard title="Accounts by Type" subtitle="Student / Alumni / Staff / Offices">
              <DistBar data={data.userManagement.byType} />
            </ChartCard>
            <ChartCard title="Account Status" subtitle="Active, pending, inactive">
              <DistPie data={data.userManagement.byStatus} />
            </ChartCard>
          </Section>

          <Section icon={<Megaphone size={16} className="text-slate-400" />} title="Announcements">
            <ChartCard title="Announcements by Status" subtitle="Draft, published, archived">
              <DistPie data={data.announcements.byStatus} />
            </ChartCard>
            <ChartCard title="Announcements by Priority" subtitle="Normal vs. urgent">
              <DistBar data={data.announcements.byPriority} />
            </ChartCard>
          </Section>

          <Section icon={<Rss size={16} className="text-slate-400" />} title="Campus Feed">
            <ChartCard title="Posts Published (Last 30 Days)" subtitle="Daily post count" className="lg:col-span-2">
              <Timeline data={data.campusFeed.postsTimeline} color={colorAt(2)} />
            </ChartCard>
          </Section>

          <Section icon={<FileCheck2 size={16} className="text-slate-400" />} title="Document Queue">
            <ChartCard title="Tickets by Status" subtitle="Pending, approved, rejected, and more">
              <DistPie data={data.documentQueue.byStatus} />
            </ChartCard>
            <ChartCard title="Requests Submitted (Last 30 Days)" subtitle="Daily ticket volume">
              <Timeline data={data.documentQueue.requestsTimeline} color={colorAt(3)} />
            </ChartCard>
          </Section>

          <Section icon={<FolderOpen size={16} className="text-slate-400" />} title="Document Repository">
            <ChartCard title="Files per Folder" subtitle="Active files in each folder" className="lg:col-span-2">
              <DistBar data={data.documentRepository.filesByFolder} />
            </ChartCard>
          </Section>

          <Section icon={<GraduationCap size={16} className="text-slate-400" />} title="Scholarships">
            <ChartCard title="Scholarships by Status" subtitle="Active vs. closed postings">
              <DistPie data={data.scholarships.byStatus} />
            </ChartCard>
            <ChartCard title="Applicants by Status" subtitle="Pending, accepted, rejected">
              <DistBar data={data.scholarships.applicantsByStatus} />
            </ChartCard>
          </Section>

          <Section icon={<Trophy size={16} className="text-slate-400" />} title="Achievement Management">
            <ChartCard title="Submissions by Status" subtitle="Pending, approved, rejected">
              <DistPie data={data.achievements.byStatus} />
            </ChartCard>
            <ChartCard title="Achievements by College" subtitle="Where submissions are coming from">
              <DistBar data={data.achievements.byCollege} />
            </ChartCard>
          </Section>

          <Section icon={<Briefcase size={16} className="text-slate-400" />} title="Job Postings">
            <ChartCard title="Postings by Status" subtitle="Active vs. inactive">
              <DistPie data={data.jobPostings.byStatus} />
            </ChartCard>
            <ChartCard title="Postings by Industry" subtitle="Where openings are concentrated">
              <DistBar data={data.jobPostings.byIndustry} />
            </ChartCard>
          </Section>

          <Section icon={<Send size={16} className="text-slate-400" />} title="Student Endorsement">
            <ChartCard title="Endorsements by Direction" subtitle="Inbound vs. outbound">
              <DistPie data={data.studentEndorsement.byDirection} />
            </ChartCard>
            <ChartCard title="Endorsements by Status" subtitle="Pending, acknowledged, resolved">
              <DistBar data={data.studentEndorsement.byStatus} />
            </ChartCard>
          </Section>

          <Section icon={<UserCircle2 size={16} className="text-slate-400" />} title="Alumni Profiles">
            <ChartCard title="Employment Status" subtitle="Employed vs. unemployed alumni">
              <DistPie data={data.alumniProfiles.byEmploymentStatus} />
            </ChartCard>
            <ChartCard title="Alumni by Program" subtitle="Top programs by profile count">
              <DistBar data={data.alumniProfiles.byProgram} />
            </ChartCard>
          </Section>
        </div>
      )}
    </div>
  );
}
