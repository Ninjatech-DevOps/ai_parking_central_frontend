import { Skel, SkeletonShell } from "@/components/Skeleton";

/** Centered stat-card placeholder — matches Dashboard's StatCard (icon over value over label). */
function StatCardSkel() {
  return (
    <div className="bg-white rounded-2xl card-shadow p-4 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-xl bg-slate-100 mb-2" />
      <div className="w-12 h-6 rounded bg-slate-100 mb-2" />
      <div className="w-16 h-2.5 rounded bg-slate-100" />
    </div>
  );
}

/** Table placeholder that lives inside a titled card — first cell is a location (icon + name). */
function TableSkel({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div>
      {/* Column header strip */}
      <div className="h-11 bg-slate-50/80 border-b border-slate-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex items-center gap-4 px-6 py-4 border-b border-slate-50 ${i % 2 ? "bg-slate-25" : ""}`}>
          {/* Location cell: avatar + name */}
          <div className="flex items-center gap-3 shrink-0" style={{ width: 190 }}>
            <div className="w-9 h-9 rounded-xl bg-slate-100 shrink-0" />
            <div className="h-4 rounded bg-slate-100 flex-1" />
          </div>
          {/* Remaining value cells */}
          {Array.from({ length: cols - 1 }).map((_, j) => (
            <div key={j} className="h-4 rounded bg-slate-100 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton for Dashboard.tsx — greeting header + 12 stat cards + Camera Overview card + Parking Locations card. */
export default function DashboardSkeleton() {
  return (
    <SkeletonShell>
      <div className="w-full animate-pulse">
        {/* Header: date eyebrow + greeting + sub-line, refresh button on the right */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Skel className="w-24 h-3 mb-2" />
            <Skel className="w-64 h-8 mb-2" />
            <Skel className="w-48 h-4" />
          </div>
          <Skel className="w-28 h-9 rounded-xl" />
        </div>

        {/* Stat cards — 12, 5 per row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <StatCardSkel key={i} />
          ))}
        </div>

        {/* Camera Overview card */}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100">
            <Skel className="w-40 h-5 mb-2" />
            <Skel className="w-56 h-3" />
          </div>
          <TableSkel rows={5} cols={13} />
        </div>

        {/* Parking Locations card */}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-8">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <Skel className="w-40 h-5 mb-2" />
              <Skel className="w-24 h-3" />
            </div>
            <Skel className="w-20 h-4 rounded" />
          </div>
          {/* Summary strip — 4 centered stats */}
          <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-10 h-6 rounded bg-slate-100 mb-1.5" />
                <div className="w-16 h-2.5 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <TableSkel rows={4} cols={6} />
        </div>
      </div>
    </SkeletonShell>
  );
}
