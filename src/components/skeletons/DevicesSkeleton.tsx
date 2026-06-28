import { SkeletonShell, SkeletonHeader, SkeletonStatCards, SkeletonFilterBar, SkeletonTable, SkeletonPagination } from "@/components/Skeleton";

export default function DevicesSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader />
      <SkeletonStatCards count={3} cols={3} />
      <SkeletonFilterBar selects={1} />
      <SkeletonTable rows={6} cols={6} />
      <SkeletonPagination />
    </SkeletonShell>
  );
}
