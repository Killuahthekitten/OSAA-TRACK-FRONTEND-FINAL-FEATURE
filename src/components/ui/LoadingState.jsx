import { Loader2 } from "lucide-react";

export default function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl2 border border-slate-200 bg-white py-16 text-slate-500 shadow-card">
      <Loader2 size={26} className="animate-spin text-brand-blue" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
