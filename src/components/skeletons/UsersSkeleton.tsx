import { SkeletonShell, SkeletonHeader, SkeletonStatCards, SkeletonFilterBar, SkeletonTable, SkeletonPagination } from "@/components/Skeleton";

export default function UsersSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader />
      <SkeletonStatCards count={3} cols={3} />
      <SkeletonFilterBar selects={0} />
      <SkeletonTable rows={6} cols={5} />
      <SkeletonPagination />
    </SkeletonShell>
  );
}
