import { Skel, SkeletonShell } from "@/components/Skeleton";

/** Skeleton for ParkingLotDetail.tsx — header w/ inline stats + tab bar + floor/zone accordion rows + canvas area. */
export default function ParkingLotDetailSkeleton() {
  return (
    <SkeletonShell>
      <div className="w-full animate-pulse">
        {/* Header: back button + title + inline stat cards */}
        <div className="flex items-center gap-3 mb-6">
          <Skel className="h-9 w-9 rounded-xl" />
          <div className="flex-1">
            <Skel className="w-48 h-6 mb-2" />
            <Skel className="w-64 h-4" />
          </div>
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skel key={i} className="w-20 h-12 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 card-shadow w-fit">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skel key={i} className="w-28 h-9 rounded-lg" />
          ))}
        </div>

        {/* Section header + action */}
        <div className="flex items-center justify-between mb-4">
          <Skel className="w-48 h-5" />
          <Skel className="w-28 h-8 rounded-lg" />
        </div>

        {/* Floor/zone accordion rows */}
        <div className="space-y-2 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl card-shadow p-5">
              <div className="flex items-center gap-3">
                <Skel className="w-4 h-4" />
                <Skel className="w-4 h-4" />
                <Skel className="w-40 h-4 flex-1" />
                <Skel className="w-32 h-3" />
              </div>
            </div>
          ))}
        </div>

        {/* Canvas / live area */}
        <Skel className="w-full h-72 rounded-2xl" />
      </div>
    </SkeletonShell>
  );
}
