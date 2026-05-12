export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl card-shadow p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="w-8 h-4 rounded bg-slate-100" />
      </div>
      <div className="w-16 h-7 rounded bg-slate-100 mb-2" />
      <div className="w-24 h-4 rounded bg-slate-100" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl card-shadow overflow-hidden animate-pulse">
      <div className="h-10 bg-slate-50 border-b border-slate-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-50">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 rounded bg-slate-100" style={{ width: `${60 + Math.random() * 80}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="max-w-[1360px] animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div><div className="w-48 h-7 rounded bg-slate-100 mb-2" /><div className="w-64 h-4 rounded bg-slate-100" /></div>
        <div className="w-32 h-10 rounded-xl bg-slate-100" />
      </div>
      <div className="grid grid-cols-4 gap-5 mb-8">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
      <SkeletonTable />
    </div>
  );
}
