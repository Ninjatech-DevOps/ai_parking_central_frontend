import { Skel, SkeletonStatCards, SkeletonTable, SkeletonShell } from "@/components/Skeleton";

/** Skeleton for AnprDashboard.tsx — header + 7 grouped stat cards + location-wise table. */
export default function AnprDashboardSkeleton() {
  return (
    <SkeletonShell>
      <div className="w-full animate-pulse">
        {/* Header (sub-line + refresh) */}
        <div className="flex items-center justify-between mb-6">
          <Skel className="w-64 h-4" />
          <Skel className="w-28 h-9 rounded-xl" />
        </div>

        {/* Summary cards — 6 total (Car / 2W), 3 per row */}
        <SkeletonStatCards count={6} cols={3} className="!mb-8" />

        {/* Location-wise table */}
        <SkeletonTable rows={6} cols={9} />
      </div>
    </SkeletonShell>
  );
}
