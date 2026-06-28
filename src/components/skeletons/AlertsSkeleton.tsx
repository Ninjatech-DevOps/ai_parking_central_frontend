import { SkeletonShell, SkeletonHeader, SkeletonStatCards, SkeletonFilterBar, SkeletonTable, SkeletonPagination } from "@/components/Skeleton";

export default function AlertsSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader />
      <SkeletonStatCards count={4} cols={4} />
      <SkeletonFilterBar selects={1} />
      <SkeletonTable rows={6} cols={5} />
      <SkeletonPagination />
    </SkeletonShell>
  );
}
