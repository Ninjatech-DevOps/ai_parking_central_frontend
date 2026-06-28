import { Skel, SkeletonStatCards, SkeletonTable, SkeletonShell } from "@/components/Skeleton";

/** Skeleton for Dashboard.tsx — greeting header + tab bar + 10 stat cards + camera table + locations grid. */
export default function DashboardSkeleton() {
  return (
    <SkeletonShell>
      <div className="w-full animate-pulse">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Skel className="w-28 h-3 mb-2" />
            <Skel className="w-56 h-7 mb-2" />
            <Skel className="w-64 h-4" />
          </div>
          <Skel className="w-28 h-9 rounded-xl" />
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 bg-white rounded-xl card-shadow p-1 w-fit">
          <Skel className="w-32 h-9 rounded-lg" />
          <Skel className="w-24 h-9 rounded-lg" />
        </div>

        {/* Stat cards (10) */}
        <SkeletonStatCards count={10} cols={5} className="!mb-8" />

        {/* Camera table */}
        <div className="mb-8">
          <SkeletonTable rows={6} cols={8} />
        </div>

        {/* Parking locations table */}
        <div className="mb-8">
          <SkeletonTable rows={5} cols={6} />
        </div>
      </div>
    </SkeletonShell>
  );
}
