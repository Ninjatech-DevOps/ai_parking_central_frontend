import { Skel, SkeletonShell } from "@/components/Skeleton";

/** Skeleton for DeviceDetail.tsx — back-link header + camera chip strip + snapshot canvas + slots sidebar. */
export default function DeviceDetailSkeleton() {
  return (
    <SkeletonShell>
      <div className="w-full animate-pulse">
        {/* Header: back button + device icon/title + status badge */}
        <div className="flex items-center gap-4 mb-6">
          <Skel className="h-9 w-9 rounded-xl" />
          <div className="flex items-center gap-3 flex-1">
            <Skel className="w-10 h-10 rounded-xl" />
            <div>
              <Skel className="w-40 h-5 mb-2" />
              <Skel className="w-52 h-3" />
            </div>
          </div>
          <Skel className="w-20 h-7 rounded-lg" />
        </div>

        {/* Camera chip strip */}
        <div className="flex items-center gap-2 mb-4">
          <Skel className="w-28 h-9 rounded-xl" />
          <Skel className="w-28 h-9 rounded-xl" />
          <Skel className="w-32 h-9 rounded-xl" />
        </div>

        {/* Content: snapshot canvas + slots sidebar */}
        <div className="flex gap-5">
          {/* Left: canvas area */}
          <div className="flex-1 min-w-0">
            {/* camera info bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skel className="w-24 h-4" />
                <Skel className="w-14 h-4 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skel className="w-24 h-8 rounded-lg" />
                <Skel className="w-20 h-8 rounded-lg" />
              </div>
            </div>
            {/* mode toggle */}
            <div className="mb-3">
              <Skel className="w-48 h-8 rounded-xl" />
            </div>
            {/* snapshot rectangle */}
            <Skel className="w-full aspect-video rounded-xl" />
          </div>

          {/* Right: slots sidebar */}
          <div className="w-[240px] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <Skel className="w-20 h-4" />
              <Skel className="w-24 h-6 rounded-lg" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Skel className="w-20 h-4" />
                    <Skel className="w-8 h-3" />
                  </div>
                  <Skel className="w-full h-6 rounded-md mb-2" />
                  <div className="flex gap-2 mb-2">
                    <Skel className="flex-1 h-8 rounded-md" />
                    <Skel className="flex-1 h-8 rounded-md" />
                  </div>
                  <div className="flex gap-1.5">
                    <Skel className="flex-1 h-7 rounded-lg" />
                    <Skel className="w-7 h-7 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonShell>
  );
}
