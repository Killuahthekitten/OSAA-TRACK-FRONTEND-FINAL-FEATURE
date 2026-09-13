import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { PDFDocument } from "pdf-lib";
import { PenLine, Upload, Loader2, Save, RotateCw } from "lucide-react";
import Modal from "./Modal.jsx";
import { api, getToken, fetchProtectedFile } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { primaryButtonClass, secondaryButtonClass } from "./formStyles.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getExt(name = "") {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "";
}
const IMAGE_EXTS = ["png", "jpg", "jpeg"];

/**
 * Signing is intentionally narrow: the admin can only drop their signature
 * image onto the page and save — there is no text tool, no drawing, no way
 * to alter the underlying document. The original upload is never touched;
 * saving creates a brand-new file (embedded via pdf-lib for PDFs, composited
 * on a canvas for images) and that new file is what gets attached as the
 * ticket's "signed" copy.
 */
export default function SignDocumentModal({ open, onClose, signEndpoint, file, onSaved, title = "Add E-Signature" }) {
  const { handleSessionInvalidated } = useAuth();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [loadState, setLoadState] = useState("loading");
  const [baseInfo, setBaseInfo] = useState(null); // { type, displayScale, pageWidth, pageHeight, pdfBytes, naturalWidth, naturalHeight, imgEl }
  const [sigImg, setSigImg] = useState(null); // HTMLImageElement
  const [sigDataUrl, setSigDataUrl] = useState(null);
  const [sigPos, setSigPos] = useState(null); // {x, y} top-left, canvas px
  const [sigWidth, setSigWidth] = useState(140);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const ext = getExt(file?.original_name);
  const isPdf = ext === "pdf";
  const isImage = IMAGE_EXTS.includes(ext);
  const sigHeight = sigImg ? sigWidth * (sigImg.height / sigImg.width) : 0;

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setLoadState("loading");
    setSigDataUrl(null);
    setSigImg(null);
    setSigPos(null);
    setError(null);

    async function load() {
      try {
        const blob = await fetchProtectedFile(`/api/uploads/${file.id}/view`);

        if (isPdf) {
          const arrayBuffer = await blob.arrayBuffer();
          const pdfBytesForLib = arrayBuffer.slice(0); // pdf-lib needs its own copy later
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const page = await pdf.getPage(1);
          const unscaled = page.getViewport({ scale: 1 });
          const displayScale = Math.min(680 / unscaled.width, 1.4);
          const viewport = page.getViewport({ scale: displayScale });
          const canvas = canvasRef.current;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          if (cancelled) return;
          setBaseInfo({ type: "pdf", displayScale, pageWidth: unscaled.width, pageHeight: unscaled.height, pdfBytes: pdfBytesForLib });
          setLoadState("ready");
        } else if (isImage) {
          const imgUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            const displayScale = Math.min(680 / img.width, 1);
            const canvas = canvasRef.current;
            canvas.width = img.width * displayScale;
            canvas.height = img.height * displayScale;
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            setBaseInfo({ type: "image", displayScale, naturalWidth: img.width, naturalHeight: img.height, imgEl: img });
            setLoadState("ready");
          };
          img.src = imgUrl;
        } else {
          setLoadState("unsupported");
        }
      } catch (err) {
        if (cancelled) return;
        // A session that expired, or got superseded by another login,
        // is the actual cause behind this "sometimes fails to load" —
        // send the admin back to login with a clear reason instead of a
        // dead-end "couldn't load" state inside the sign modal.
        if (handleSessionInvalidated(err)) return;
        setLoadState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file, isPdf, isImage, reloadTick]);

  function handleSignatureUpload(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        setSigImg(img);
        setSigDataUrl(dataUrl);
        setSigPos(null);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  }

  function handleCanvasClick(e) {
    if (!sigImg) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - sigWidth / 2;
    const y = e.clientY - rect.top - sigHeight / 2;
    setSigPos({ x: Math.max(0, x), y: Math.max(0, y) });
  }

  async function handleSave() {
    if (!sigImg || !sigPos) {
      setError("Upload your signature, then click on the document to place it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let outputBlob;
      let outputName;

      if (baseInfo.type === "pdf") {
        const pdfDoc = await PDFDocument.load(baseInfo.pdfBytes);
        const pngBytes = await (await fetch(sigDataUrl)).arrayBuffer();
        const pngImage = await pdfDoc.embedPng(pngBytes);
        const page = pdfDoc.getPages()[0];
        const scale = baseInfo.displayScale;
        const pdfW = sigWidth / scale;
        const pdfH = sigHeight / scale;
        const pdfX = sigPos.x / scale;
        const pdfY = baseInfo.pageHeight - sigPos.y / scale - pdfH;
        page.drawImage(pngImage, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });
        const outBytes = await pdfDoc.save();
        outputBlob = new Blob([outBytes], { type: "application/pdf" });
        outputName = file.original_name.replace(/\.pdf$/i, "") + "-signed.pdf";
      } else {
        // Composite at natural resolution so the signed copy isn't blurry.
        const naturalScale = baseInfo.naturalWidth / canvasRef.current.width;
        const out = document.createElement("canvas");
        out.width = baseInfo.naturalWidth;
        out.height = baseInfo.naturalHeight;
        const ctx = out.getContext("2d");
        ctx.drawImage(baseInfo.imgEl, 0, 0);
        ctx.drawImage(
          sigImg,
          sigPos.x * naturalScale,
          sigPos.y * naturalScale,
          sigWidth * naturalScale,
          sigHeight * naturalScale
        );
        outputBlob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
        outputName = file.original_name.replace(/\.(png|jpe?g)$/i, "") + "-signed.png";
      }

      const fd = new FormData();
      fd.append("file", outputBlob, outputName);
      const uploadRes = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploaded.message || "Could not save the signed copy.");

      const resp = await api.post(signEndpoint, { fileId: uploaded.id });
      onSaved(resp);
    } catch (err) {
      setError(err.message || "Could not save the signed document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
          <PenLine size={14} className="mt-0.5 shrink-0" />
          <p>Upload your signature image, then click anywhere on the document to place it. This only adds your signature on top — nothing else about the document can be changed here. The original stays on file; saving creates a separate signed copy.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} className={secondaryButtonClass}>
            <Upload size={14} /> {sigImg ? "Replace Signature" : "Upload Signature (PNG)"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleSignatureUpload} />
          {sigImg && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Size</span>
              <input type="range" min="60" max="320" value={sigWidth} onChange={(e) => setSigWidth(Number(e.target.value))} className="w-28" />
            </div>
          )}
          {sigImg && !sigPos && <span className="text-xs italic text-slate-400">Click the document to place it</span>}
        </div>

        <div className="flex justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
          {loadState === "loading" && (
            <div className="flex h-80 w-full items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={24} /></div>
          )}
          {loadState === "error" && (
            <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-sm text-slate-400">
              <p>Couldn&rsquo;t load this document.</p>
              <button
                type="button"
                onClick={() => setReloadTick((n) => n + 1)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                <RotateCw size={13} /> Retry
              </button>
            </div>
          )}
          {loadState === "unsupported" && (
            <div className="flex h-40 w-full flex-col items-center justify-center gap-1 text-center text-sm text-slate-400">
              <p>Signing isn&rsquo;t available for .{ext} files.</p>
              <p className="text-xs">Download it, sign it, and re-upload if needed.</p>
            </div>
          )}
          <div className="relative inline-block" style={{ display: loadState === "ready" ? "inline-block" : "none" }}>
            <canvas ref={canvasRef} onClick={handleCanvasClick} className="cursor-crosshair rounded shadow-sm" />
            {sigImg && sigPos && (
              <img
                src={sigDataUrl}
                alt="signature"
                className="pointer-events-none absolute"
                style={{ left: sigPos.x, top: sigPos.y, width: sigWidth, height: sigHeight }}
              />
            )}
          </div>
        </div>

        {error && <p className="text-xs font-medium text-status-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || !sigPos} className={primaryButtonClass}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Signed Copy
          </button>
        </div>
      </div>
    </Modal>
  );
}
