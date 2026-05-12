import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, total, pageSize, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-2 pt-4">
      <p className="text-[12px] text-slate-400">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={14} />
        </Button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p: number;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`h-8 w-8 rounded-lg text-[12px] font-semibold transition-colors ${
                p === page ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          );
        })}
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
