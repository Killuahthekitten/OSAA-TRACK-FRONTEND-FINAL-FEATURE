// Deterministic color coding for an officer's free-text "category" field
// (e.g. "Executive Board", "Committee Head", "Member", "Adviser") — shared
// by the hierarchy chart cards and the officer directory table so the same
// category always reads as the same color across both views.

const KEYWORD_TONES = [
  { test: /adviser|advisor/i, tone: "sky" },
  { test: /executive/i, tone: "teal" },
  { test: /committee/i, tone: "rose" },
  { test: /judiciary|legislative/i, tone: "violet" },
  { test: /board/i, tone: "amber" },
  { test: /secretariat|secretary/i, tone: "cyan" },
  { test: /member/i, tone: "amber" },
];

// Fallback palette for anything that doesn't match a keyword above —
// picked by a stable hash of the category text so it's consistent for a
// given organization without needing to be pre-registered anywhere.
const FALLBACK_PALETTE = ["indigo", "fuchsia", "lime", "orange", "emerald", "cyan", "rose", "sky"];

const TONE_CLASSES = {
  sky: "bg-sky-100 text-sky-700",
  teal: "bg-teal-100 text-teal-700",
  rose: "bg-rose-100 text-rose-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-800",
  cyan: "bg-cyan-100 text-cyan-700",
  indigo: "bg-indigo-100 text-indigo-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  lime: "bg-lime-100 text-lime-800",
  orange: "bg-orange-100 text-orange-700",
  emerald: "bg-emerald-100 text-emerald-700",
  slate: "bg-slate-100 text-slate-600",
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function categoryToneClasses(category) {
  if (!category || !category.trim()) return TONE_CLASSES.slate;
  const trimmed = category.trim();
  const keyword = KEYWORD_TONES.find((k) => k.test.test(trimmed));
  if (keyword) return TONE_CLASSES[keyword.tone];
  const tone = FALLBACK_PALETTE[hashString(trimmed.toLowerCase()) % FALLBACK_PALETTE.length];
  return TONE_CLASSES[tone];
}
