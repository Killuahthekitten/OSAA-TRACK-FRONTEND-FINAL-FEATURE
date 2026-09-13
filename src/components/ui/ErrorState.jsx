import { AlertTriangle, RotateCw } from "lucide-react";

export default function ErrorState({ message = "Unable to load this right now.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl2 border border-red-200 bg-red-50 py-16 text-center">
      <AlertTriangle size={24} className="text-status-danger" />
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
        >
          <RotateCw size={13} />
          Try again
        </button>
      )}
    </div>
  );
}
