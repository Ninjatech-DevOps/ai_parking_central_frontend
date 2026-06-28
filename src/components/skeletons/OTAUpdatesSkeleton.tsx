import { SkeletonShell, SkeletonHeader, SkeletonStatCards, SkeletonFilterBar, SkeletonTable } from "@/components/Skeleton";

export default function OTAUpdatesSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader action={false} />
      <SkeletonStatCards count={4} cols={4} />
      <SkeletonFilterBar selects={0} />
      <SkeletonTable rows={6} cols={8} />
    </SkeletonShell>
  );
}
