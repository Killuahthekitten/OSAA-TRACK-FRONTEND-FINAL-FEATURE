import { AlertTriangle, Loader2 } from "lucide-react";
import Modal from "./Modal.jsx";

export default function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", danger = true, loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex items-start gap-3">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-100 text-status-danger" : "bg-amber-100 text-status-warning"}`}>
          <AlertTriangle size={18} />
        </div>
        <p className="pt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-70 ${
            danger ? "bg-status-danger hover:bg-red-700" : "bg-brand-blue hover:bg-blue-700"
          }`}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
