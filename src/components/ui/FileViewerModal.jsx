import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import Modal from "./Modal.jsx";
import FilePreviewBody from "./FilePreviewBody.jsx";
import { fetchProtectedFile } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Modal wrapper around FilePreviewBody, with a download action. Used by
 * Document Repository, Announcements, Scholarships, and Achievements.
 * `viewUrl` / `downloadUrl` are relative API paths (e.g.
 * "/api/uploads/12/view") — the base URL and auth header are added by
 * fetchProtectedFile, which also routes an expired/superseded session
 * back through the app's normal login redirect instead of a silent fail.
 */
export default function FileViewerModal({ open, onClose, fileName, viewUrl, downloadUrl }) {
  const { handleSessionInvalidated } = useAuth();
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await fetchProtectedFile(downloadUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      handleSessionInvalidated(err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={fileName || "File"} maxWidth="max-w-3xl">
      <div className="space-y-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
          </button>
        </div>
        {open && <FilePreviewBody fileName={fileName} viewUrl={viewUrl} />}
      </div>
    </Modal>
  );
}
