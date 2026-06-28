import { SkeletonShell, SkeletonHeader, SkeletonTable } from "@/components/Skeleton";

export default function RolesSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader />
      <SkeletonTable rows={6} cols={5} />
    </SkeletonShell>
  );
}
