import { useId, useState } from "react";

/**
 * A small hover tooltip for important action buttons — shows a short
 * explanation of what the button does. Kept deliberately lightweight (no
 * portal/positioning library): the tooltip is absolutely positioned
 * relative to its wrapper and only ever needs to sit above or below a
 * button, which every call site here can guarantee has room for.
 *
 * Usage: wrap a single button/element —
 *   <Tooltip text="Opens the e-signature toolkit...">
 *     <button ...>Approve for E-Signing</button>
 *   </Tooltip>
 *
 * Only meant for genuinely important/high-stakes actions (per spec) — not
 * every button in the app, so it stays useful instead of noisy.
 */
export default function Tooltip({ text, children, side = "top", className = "" }) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  if (!text) return children;

  const sideClasses =
    side === "bottom"
      ? "top-full mt-2"
      : side === "left"
      ? "right-full top-1/2 mr-2 -translate-y-1/2"
      : side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : "bottom-full mb-2"; // top (default)

  const arrowClasses =
    side === "bottom"
      ? "-top-1 left-1/2 -translate-x-1/2"
      : side === "left"
      ? "right-[-3px] top-1/2 -translate-y-1/2"
      : side === "right"
      ? "left-[-3px] top-1/2 -translate-y-1/2"
      : "top-full left-1/2 -translate-x-1/2"; // top (default)

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute z-50 w-max max-w-[220px] whitespace-normal rounded-lg bg-slate-900 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white shadow-lg transition-opacity duration-150 ${sideClasses} ${
          visible ? "opacity-95" : "opacity-0"
        } left-1/2 -translate-x-1/2`}
      >
        {text}
        <span className={`absolute size-1.5 rotate-45 bg-slate-900 ${arrowClasses}`} />
      </span>
    </span>
  );
}
