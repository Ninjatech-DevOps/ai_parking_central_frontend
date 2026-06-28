import { SkeletonShell, SkeletonHeader, SkeletonStatCards, SkeletonFilterBar, SkeletonTable } from "@/components/Skeleton";

export default function LocationManagementSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader />
      <SkeletonStatCards count={3} cols={3} />
      <SkeletonFilterBar selects={0} />
      <SkeletonTable rows={6} cols={2} />
    </SkeletonShell>
  );
}
