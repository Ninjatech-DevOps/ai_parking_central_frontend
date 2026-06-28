import type { ReactNode } from "react";

/** Base shimmer atom — a single pulsing block. */
export function Skel({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-100 rounded ${className}`} />;
}

/** Standard page header: title + subtitle + optional right-aligned action button. */
export function SkeletonHeader({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skel className="w-44 h-7 mb-2" />
        <Skel className="w-64 h-4" />
      </div>
      {action && <Skel className="w-32 h-10 rounded-xl" />}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl card-shadow p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="w-8 h-4 rounded bg-slate-100" />
      </div>
      <div className="w-16 h-7 rounded bg-slate-100 mb-2" />
      <div className="w-24 h-4 rounded bg-slate-100" />
    </div>
  );
}

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-5 lg:grid-cols-5",
  7: "grid-cols-2 md:grid-cols-4 lg:grid-cols-7",
};

/** A row of stat cards. `cols` controls the grid; `count` the number of cards. */
export function SkeletonStatCards({ count = 4, cols = 4, className = "" }: { count?: number; cols?: number; className?: string }) {
  return (
    <div className={`grid ${GRID_COLS[cols] ?? "grid-cols-2 lg:grid-cols-4"} gap-4 mb-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Filter/search row: a search box + N select boxes. */
export function SkeletonFilterBar({ selects = 1, className = "" }: { selects?: number; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 mb-6 animate-pulse ${className}`}>
      <Skel className="w-72 h-10 rounded-xl" />
      {Array.from({ length: selects }).map((_, i) => (
        <Skel key={i} className="w-36 h-10 rounded-xl" />
      ))}
    </div>
  );
}

// Deterministic per-column widths so cells don't jitter on re-render.
const CELL_WIDTHS = [110, 80, 130, 90, 120, 70, 140, 100, 95, 115, 75];

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl card-shadow overflow-hidden animate-pulse">
      <div className="h-10 bg-slate-50 border-b border-slate-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-50">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 rounded bg-slate-100" style={{ width: `${CELL_WIDTHS[j % CELL_WIDTHS.length]}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Pagination bar placeholder. */
export function SkeletonPagination() {
  return (
    <div className="flex items-center justify-between mt-4 animate-pulse">
      <Skel className="w-40 h-4" />
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skel key={i} className="w-9 h-9 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Vertical bar chart placeholder (e.g. hourly / duration distributions). */
export function SkeletonChart({ bars = 12, className = "" }: { bars?: number; className?: string }) {
  const heights = [40, 65, 50, 80, 35, 70, 55, 90, 45, 75, 60, 85];
  return (
    <div className={`flex items-end gap-2 h-40 animate-pulse ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className="flex-1 bg-slate-100 rounded-t" style={{ height: `${heights[i % heights.length]}%` }} />
      ))}
    </div>
  );
}

/** Generic full-page skeleton (header + stat cards + table). */
export function SkeletonPage() {
  return (
    <div className="w-full animate-pulse">
      <SkeletonHeader />
      <SkeletonStatCards count={4} cols={4} />
      <SkeletonTable />
    </div>
  );
}

/** Light wrapper to constrain page-skeleton width consistently. */
export function SkeletonShell({ children }: { children: ReactNode }) {
  return <div className="w-full">{children}</div>;
}
