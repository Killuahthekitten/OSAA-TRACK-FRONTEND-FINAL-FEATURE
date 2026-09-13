// Shared color rotation for every chart in Analytics, drawn from the same
// palette used elsewhere in the app (brand blue/red, status colors, gold
// accent) so the panel feels like part of the same product, not a
// bolted-on library default.
export const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#dc2626", "#0ea5e9", "#4f46e5", "#f5c800", "#64748b"];

export function colorAt(i) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

export default function ChartCard({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <div className={`rounded-xl2 border border-slate-200 bg-white p-5 shadow-card sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
            <Icon size={17} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
