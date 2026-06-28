import { SkeletonShell, SkeletonHeader, SkeletonStatCards, SkeletonFilterBar, SkeletonTable } from "@/components/Skeleton";

export default function ParkingLotsSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader />
      <SkeletonStatCards count={4} cols={4} />
      <SkeletonFilterBar selects={0} />
      <SkeletonTable rows={6} cols={7} />
    </SkeletonShell>
  );
}
