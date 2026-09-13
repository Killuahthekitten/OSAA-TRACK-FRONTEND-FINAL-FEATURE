import { useMemo, useRef, useState, useEffect } from "react";
import { Pencil, Trash2, User, Network } from "lucide-react";
import ProtectedImage from "./ProtectedImage.jsx";
import EmptyState from "./EmptyState.jsx";
import { categoryToneClasses } from "./categoryTone.js";

// A position with no parent (or a parent that no longer exists) sits at
// the top of the chart — there can be more than one (e.g. a President
// and an Adviser can both be "highest" and render as separate trees).
function buildForest(officers) {
  const byId = new Map(officers.map((o) => [o.id, { ...o, children: [] }]));
  const roots = [];
  for (const o of byId.values()) {
    if (o.parent_officer_id && byId.has(o.parent_officer_id)) {
      byId.get(o.parent_officer_id).children.push(o);
    } else {
      roots.push(o);
    }
  }
  return roots;
}

function OfficerCard({ node, onEdit, onDelete }) {
  return (
    <div className="group relative flex w-40 flex-col items-center gap-1 rounded-xl2 border border-slate-200 bg-white p-3.5 text-center shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <ProtectedImage
        file={node.photo}
        alt={node.name}
        className="size-12 rounded-full border border-slate-100"
        fallback={
          <div className="flex size-12 items-center justify-center rounded-full bg-status-indigo/10 text-status-indigo">
            <User size={18} />
          </div>
        }
      />
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-slate-800">{node.name}</p>
      <p className="text-[11px] font-medium leading-tight text-brand-blue">{node.position}</p>
      {node.category && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryToneClasses(node.category)}`}>{node.category}</span>
      )}
      <div className="absolute -right-2 -top-2 hidden gap-1 group-hover:flex">
        <button
          type="button"
          onClick={() => onEdit(node)}
          title="Edit officer"
          className="flex size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-card hover:text-brand-blue"
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(node)}
          title="Delete officer"
          className="flex size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-card hover:text-status-danger"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// Renders one node's children as a connected row: a single line drops
// from the parent, fans out into a horizontal bar, then a line drops
// from that bar down to each child — the standard org-chart connector,
// drawn with plain borders instead of any diagramming library so it
// re-lays-out for free whenever the officer list changes.
function ChildrenRow({ nodes, onEdit, onDelete }) {
  if (!nodes || nodes.length === 0) return null;
  const multi = nodes.length > 1;
  return (
    <div className="relative flex justify-center pt-6 before:absolute before:left-1/2 before:top-0 before:h-6 before:border-l before:border-slate-300 before:content-['']">
      <ul className="flex items-start">
        {nodes.map((node, i) => {
          const isFirst = i === 0;
          const isLast = i === nodes.length - 1;
          const classes = ["relative px-3", multi ? "pt-6" : ""];
          if (multi && !isFirst) {
            classes.push(
              "before:absolute before:right-1/2 before:top-0 before:h-6 before:w-1/2 before:border-t before:border-slate-300 before:content-['']"
            );
            if (isLast) classes.push("before:border-r");
          }
          if (multi && !isLast) {
            classes.push(
              "after:absolute after:left-1/2 after:top-0 after:h-6 after:w-1/2 after:border-l after:border-t after:border-slate-300 after:content-['']"
            );
          }
          return (
            <li key={node.id} className={classes.filter(Boolean).join(" ")}>
              <OfficerNode node={node} onEdit={onEdit} onDelete={onDelete} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OfficerNode({ node, onEdit, onDelete }) {
  return (
    <div className="flex flex-col items-center">
      <OfficerCard node={node} onEdit={onEdit} onDelete={onDelete} />
      <ChildrenRow nodes={node.children} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

export default function HierarchyChart({ officers, onEdit, onDelete }) {
  const roots = useMemo(() => buildForest(officers || []), [officers]);
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollFades() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollFades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officers]);

  if (!officers || officers.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No officers added yet"
        description="Add the first officer below to start building this organization's chart."
      />
    );
  }

  return (
    <div className="relative rounded-xl2 bg-slate-50/70">
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-50/90 to-transparent" />
      )}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-50/90 to-transparent" />
      )}
      <div ref={scrollRef} onScroll={updateScrollFades} className="overflow-x-auto py-5">
        <div className="flex min-w-max justify-center gap-10 px-6">
          {roots.map((root) => (
            <OfficerNode key={root.id} node={root} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}
