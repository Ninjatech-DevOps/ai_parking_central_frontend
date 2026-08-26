import { useState, useCallback, useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { vehicleMovementsApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Clock, AlertTriangle } from "lucide-react";
import { FilterToolbar, FilterPanel, FilterField, FilterSelect, FilterDateInput, LiveBadge } from "@/components/FilterPanel";
import type { VehicleMovement, VehicleMovementSummary } from "@/types/api";
import { SkeletonShell, SkeletonHeader, SkeletonTable, Skel } from "@/components/Skeleton";

function VehicleMovementsSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader action />
      <div className="grid grid-cols-3 gap-3 mb-6 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 p-4">
            <Skel className="w-16 h-3 mb-2" />
            <Skel className="w-14 h-7" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-pulse">
        <Skel className="w-72 h-10 rounded-xl" />
        <Skel className="w-28 h-10 rounded-xl" />
      </div>
      <SkeletonTable rows={8} cols={5} />
    </SkeletonShell>
  );
}

// Resolved server-side in IST — the browser must not compute these, or a viewer in
// another timezone silently requests a different day than the dropdown claims.
const QUICK_RANGES = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "Last 7 Days", key: "last_7_days" },
  { label: "Last 30 Days", key: "last_30_days" },
  { label: "This Month", key: "this_month" },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function typeLabel(t: VehicleMovement["vehicle_type"]) {
  return t === "CAR" ? "Car" : "Two Wheeler";
}

const PAGE_SIZE = 20;

export default function VehicleMovements() {
  const { areaId, locationId } = useFilter();
  const [records, setRecords] = useState<VehicleMovement[]>([]);
  const [summary, setSummary] = useState<VehicleMovementSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Applied filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickRange, setQuickRange] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Draft filters — copied onto the applied ones only when Apply is pressed
  const [draftRange, setDraftRange] = useState("today");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  function openFilters() {
    setDraftRange(quickRange); setDraftFrom(customFrom); setDraftTo(customTo);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setQuickRange(draftRange); setCustomFrom(draftFrom); setCustomTo(draftTo);
    setPage(1); setFiltersOpen(false);
  }
  function resetFilters() {
    setQuickRange("today"); setCustomFrom(""); setCustomTo("");
    setPage(1);
  }
  function clearDraft() {
    setDraftRange("today"); setDraftFrom(""); setDraftTo("");
    resetFilters();
  }

  function buildParams() {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(PAGE_SIZE));
    // An explicit range beats quick_range server-side, so only send one of them.
    if (customFrom || customTo) {
      if (customFrom) p.set("from_date", new Date(customFrom).toISOString());
      if (customTo) p.set("to_date", new Date(customTo).toISOString());
    } else if (quickRange) {
      p.set("quick_range", quickRange);
    }
    // Scope comes from the global header dropdowns.
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    return p.toString();
  }

  // One request: the list response carries the window totals in `summary`.
  const fetchData = useCallback(async () => {
    try {
      const { data } = await vehicleMovementsApi.list(buildParams());
      setRecords(data.items || []);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // A scoped-out user otherwise sees a bare empty table with no explanation.
      setError(status === 403
        ? "You don't have access to vehicle movement records for this location."
        : "Could not load vehicle movements.");
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, quickRange, customFrom, customTo, areaId, locationId]);

  usePolling(fetchData, 15000);
  // Panel filters reset the page in applyFilters(); this only covers the global
  // header scope, which can change without the panel being opened.
  useEffect(() => { setPage(1); }, [areaId, locationId]);

  const activeFilterCount =
    [customFrom, customTo].filter(Boolean).length +
    (quickRange !== "today" ? 1 : 0);

  if (loading && records.length === 0 && !error) return <VehicleMovementsSkeleton />;

  const q = search.trim().toLowerCase();
  const visibleRecords = q
    ? records.filter((r) =>
        (r.location_name || "").toLowerCase().includes(q) ||
        (r.camera_label || "").toLowerCase().includes(q))
    : records;

  const isLive = quickRange === "today" && !customFrom && !customTo;

  const cards = summary
    ? [
        { label: "In", value: summary.total_in, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
        { label: "Out", value: summary.total_out, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
        { label: "Net (still inside)", value: summary.net, border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
      ]
    : [];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-900">Vehicle In / Out</h1>
            {isLive && <LiveBadge />}
          </div>
          <p className="text-[13px] text-slate-400 mt-0.5">Vehicle movements — one row per entry or exit</p>
        </div>
      </div>

      {error ? (
        <div className="bg-white rounded-2xl card-shadow p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <p className="text-[15px] font-semibold text-slate-800 mb-1">Unable to show movements</p>
          <p className="text-[13px] text-slate-500">{error}</p>
        </div>
      ) : (
      <>
      {/* Summary cards — totals for the whole filtered window, not this page */}
      {summary === null ? (
        <div className="grid grid-cols-3 gap-3 mb-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-4">
              <Skel className="w-16 h-3 mb-2" />
              <Skel className="w-14 h-7" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {cards.map(({ label, value, border, bg, text }) => (
            <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
              <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <FilterToolbar search={search} onSearch={setSearch} searchPlaceholder="Search location or camera..." filterCount={activeFilterCount} onOpen={openFilters} />

      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} onApply={applyFilters} onClear={clearDraft}>
        <FilterField label="Quick Range">
          <FilterSelect value={draftFrom || draftTo ? "" : draftRange} onChange={(v) => { setDraftRange(v); setDraftFrom(""); setDraftTo(""); }}>
            <option value="" disabled>Custom range</option>
            {QUICK_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </FilterSelect>
        </FilterField>
        <FilterField label="From Date">
          <FilterDateInput value={draftFrom} onChange={(v) => { setDraftFrom(v); setDraftRange(""); }} />
        </FilterField>
        <FilterField label="To Date">
          <FilterDateInput value={draftTo} onChange={(v) => { setDraftTo(v); setDraftRange(""); }} />
        </FilterField>
      </FilterPanel>

      {/* Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-teal-500" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Direction</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                        <Clock size={24} className="text-slate-300" />
                      </div>
                      <p className="text-[14px] font-semibold">No vehicle movements found</p>
                      <p className="text-[12px] text-slate-400 mt-0.5">Adjust your filters or date range</p>
                    </div>
                  </td>
                </tr>
              ) : visibleRecords.map((r, idx) => (
                <tr key={r.id} className={`border-b border-b-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                  <td className="px-6 py-3">
                    <span className="text-[12px] font-semibold text-slate-700">{formatDate(r.recorded_at)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[12px] text-slate-500">{formatTime(r.recorded_at)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[12px] font-semibold text-slate-700">{r.location_name || "—"}</span>
                    {r.camera_label && <span className="block text-[11px] font-mono text-slate-400">{r.camera_label}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center text-[11px] font-bold rounded-full px-2.5 py-0.5 ${r.vehicle_type === "CAR" ? "text-blue-600 bg-blue-50" : "text-indigo-600 bg-indigo-50"}`}>
                      {typeLabel(r.vehicle_type)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1 ${r.direction === "IN" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}>
                      {r.direction === "IN" ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                      {r.direction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>
      </>
      )}
    </div>
  );
}
