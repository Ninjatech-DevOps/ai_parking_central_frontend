import type { ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

/** Pulsing "Live" pill — shown when a page is viewing an auto-refreshing (today) range. */
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      Live
    </span>
  );
}

/** Toolbar row: optional Search box on the left, a slot + compact Filters button on the right. */
export function FilterToolbar({
  search,
  onSearch,
  searchPlaceholder = "Search...",
  filterCount = 0,
  onOpen,
  children,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  filterCount?: number;
  onOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {onSearch && (
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3.5 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
            <Search size={15} className="text-slate-400" />
            <input
              value={search ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400"
            />
          </div>
        )}
        {children}
      </div>
      <button
        onClick={onOpen}
        className="flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white card-shadow text-[13px] font-semibold text-slate-600 hover:border-teal-300 transition-colors"
      >
        <SlidersHorizontal size={14} className="text-slate-400" />
        Filters
        {filterCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">{filterCount}</span>
        )}
      </button>
    </div>
  );
}

/** Inline "Filter" card: header + close, a responsive field grid, and a Clear/Apply footer. */
export function FilterPanel({
  open,
  onClose,
  onApply,
  onClear,
  children,
  applyLabel = "Apply Filters",
}: {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  children: ReactNode;
  applyLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="bg-white rounded-2xl card-shadow border border-slate-100 mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-[13px] font-semibold text-slate-700">Filter</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={onClear} className="text-[13px] font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 transition-colors">
            Clear Filters
          </button>
          <button onClick={onApply} className="text-[13px] font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl px-5 py-2.5 transition-colors">
            {applyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Labeled field wrapper used inside FilterPanel. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

/** Styled native <select> with a custom chevron (no overlapping native arrow). */
export function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-3 pr-9 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
      >
        {children}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

/** Styled datetime-local input matching the filter fields. */
export function FilterDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 text-[13px] text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
    />
  );
}
