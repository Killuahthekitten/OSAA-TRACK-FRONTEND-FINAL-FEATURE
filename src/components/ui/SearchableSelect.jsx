import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronDown, Loader2 } from "lucide-react";
import { inputClass } from "./formStyles.js";

/**
 * A searchable dropdown for filter fields with many options (e.g. "pick a
 * student" pickers in Report Generation) — a plain <select> gets unwieldy
 * once there are more than a couple dozen entries, so this adds a type-
 * to-filter text box over the same option list instead.
 *
 * @param {{value:string|number, label:string}[]} options
 * @param {string|number|null} value
 * @param {(value: string) => void} onChange
 */
export default function SearchableSelect({ options, value, onChange, placeholder, loading, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)) || null, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openDropdown() {
    if (disabled || loading) return;
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(option) {
    onChange(String(option.value));
    setOpen(false);
    setQuery("");
  }

  function clear(e) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled || loading}
        className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-slate-50`}
      >
        <span className={selected ? "truncate text-slate-800" : "truncate text-slate-400"}>
          {loading ? "Loading..." : selected ? selected.label : placeholder || "Search..."}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {loading && <Loader2 size={13} className="animate-spin text-slate-400" />}
          {selected && !loading && (
            <span onClick={clear} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Clear">
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className="text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder || "Type to search..."}
              className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-2.5 text-xs text-slate-400">No matches.</p>}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o)}
                className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  String(o.value) === String(value) ? "bg-brand-blue/5 font-medium text-brand-blue" : "text-slate-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
