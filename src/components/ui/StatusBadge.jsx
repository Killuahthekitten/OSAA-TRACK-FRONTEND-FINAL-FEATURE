const TONE_CLASSES = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
  neutral: "bg-slate-100 text-slate-600",
};

const STATUS_TONE = {
  active: "success",
  published: "success",
  approved: "success",
  approved_for_signing: "success",
  approved_for_esigning: "info",
  pending: "warning",
  draft: "neutral",
  revision_requested: "warning",
  rejected: "danger",
  expired: "danger",
  inactive: "neutral",
};

const STATUS_LABEL = {
  approved_for_signing: "Approved (Physical)",
  approved_for_esigning: "Approved (E-Signature)",
};

function toLabel(status) {
  if (STATUS_LABEL[status]) return STATUS_LABEL[status];
  return status
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || "neutral";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
      {toLabel(status)}
    </span>
  );
}
