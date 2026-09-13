import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const TONE_TEXT = {
  default: "text-slate-800",
  warning: "text-status-warning",
  success: "text-status-success",
  danger: "text-status-danger",
};

export default function StatCard({ icon: Icon, iconClass, title, metrics, to }) {
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between rounded-xl2 border border-slate-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
    >
      <div>
        <div className={`mb-4 flex size-11 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={22} strokeWidth={2} />
        </div>
        <h3 className="font-heading text-[15px] font-semibold text-slate-800">{title}</h3>

        <dl className="mt-4 space-y-2.5">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-slate-500">{m.label}</dt>
              <dd className={`text-lg font-bold tabular-nums ${TONE_TEXT[m.tone || "default"]}`}>{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs font-semibold text-brand-blue">
        View details
        <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
