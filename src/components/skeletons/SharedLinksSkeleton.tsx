import { SkeletonShell, SkeletonHeader, SkeletonStatCards, SkeletonFilterBar, SkeletonTable, SkeletonPagination } from "@/components/Skeleton";

export default function SharedLinksSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader />
      <SkeletonStatCards count={2} cols={2} />
      <SkeletonFilterBar selects={1} />
      <SkeletonTable rows={6} cols={6} />
      <SkeletonPagination />
    </SkeletonShell>
  );
}
