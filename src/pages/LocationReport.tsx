import { useState, useCallback, useEffect, useMemo } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { parkingHistoryApi, camerasApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import CrudDialog from "@/components/CrudDialog";
import {
  Loader2, Clock, Image as ImageIcon, Video, ExternalLink, Eye,
} from "lucide-react";
import { FilterToolbar, FilterPanel, FilterField, FilterSelect, FilterDateInput, LiveBadge } from "@/components/FilterPanel";
import type { ParkingScan, OccupancySummary, Camera } from "@/types/api";
import { DEFAULT_DATE_RANGE, isDefaultDateRange } from "@/lib/utils";
import { SkeletonShell, SkeletonHeader, SkeletonTable, Skel } from "@/components/Skeleton";

function LocationReportSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader action />
      <div className="space-y-4 mb-6 animate-pulse">
        {[0, 1].map((g) => (
          <div key={g}>
            <Skel className="w-24 h-4 mb-2" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-100 p-4">
                  <Skel className="w-16 h-3 mb-2" />
                  <Skel className="w-14 h-7" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-pulse">
        <Skel className="w-72 h-10 rounded-xl" />
        <Skel className="w-28 h-10 rounded-xl" />
      </div>
      <SkeletonTable rows={8} cols={11} />
    </SkeletonShell>
  );
}

const DATE_PRESETS = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "This Week", key: "this_week" },
  { label: "This Month", key: "this_month" },
] as const;

// No "All (30s)" here: raw scans from different cameras practically never land in
// the same slot, so the rows would barely combine. 60 min is also excluded — the
// server buckets on minute-of-hour in the DB's zone, and only widths that divide
// the IST/UTC 30-minute offset line up with a UTC floor.
const INTERVAL_OPTIONS = [
  { label: "1 min", value: 1 },
  { label: "2 min", value: 2 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
];

const PAGE_SIZE = 20;
const FETCH_PAGE_SIZE = 100;
/** Guard against walking a huge range; the UI says so rather than truncating quietly. */
const MAX_PAGES = 20;

function getPresetDates(key: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "today":
      return { start: todayStart.toISOString(), end: new Date(todayStart.getTime() + 86400000).toISOString() };
    case "yesterday": {
      const y = new Date(todayStart.getTime() - 86400000);
      return { start: y.toISOString(), end: todayStart.toISOString() };
    }
    case "this_week": {
      const d = todayStart.getDay();
      const mon = new Date(todayStart.getTime() - (d === 0 ? 6 : d - 1) * 86400000);
      return { start: mon.toISOString(), end: new Date(todayStart.getTime() + 86400000).toISOString() };
    }
    case "this_month": {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: ms.toISOString(), end: new Date(todayStart.getTime() + 86400000).toISOString() };
    }
    default: return { start: "", end: "" };
  }
}

function formatDate(iso: string | number) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
/**
 * Identical to Parking History's formatTime — rounds to the nearest 5 minutes so
 * the same reading reads the same on both screens. Display only: the grouping key
 * still floors, which is what actually decides which slot a scan belongs to.
 */
function formatTime(iso: string | number) {
  const d = new Date(iso);
  const min = d.getMinutes();
  const rounded = Math.round(min / 5) * 5;
  if (rounded === 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  } else {
    d.setMinutes(rounded);
  }
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** One location at one time slot: every camera's scan in that slot, summed. */
interface LocationSlotRow {
  key: string;
  location_id: string;
  location_name: string;
  /** Floored boundary — decides which scans belong together. Never displayed. */
  slotStart: number;
  /** Latest scan in the slot — what the UI shows, so the label matches the camera
   *  rows inside and matches Parking History for the same reading. */
  labelAt: number;
  car_occupied: number;
  car_available: number;
  car_total: number;
  two_wheeler_occupied: number;
  two_wheeler_available: number;
  two_wheeler_total: number;
  scans: ParkingScan[];
}

/**
 * Group camera scans into one row per location per time slot.
 *
 * The slot is recomputed here because the API returns each camera's REAL
 * recorded_at — `interval_minutes` thins the rows per camera but never aligns
 * timestamps across cameras. Flooring (not rounding) in UTC is what makes two
 * cameras scanned seconds apart land in the same slot.
 *
 * Summing across cameras is safe: cameras cover disjoint slot sets, so their
 * totals do not double-count.
 */
function groupByLocationSlot(scans: ParkingScan[], intervalMin: number): LocationSlotRow[] {
  const slotMs = Math.max(1, intervalMin) * 60_000;
  const groups = new Map<string, LocationSlotRow>();

  for (const s of scans) {
    const slotStart = Math.floor(new Date(s.recorded_at).getTime() / slotMs) * slotMs;
    const key = `${s.location_id}|${slotStart}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        key,
        location_id: s.location_id,
        location_name: s.location_name || "—",
        slotStart,
        labelAt: 0,
        car_occupied: 0, car_available: 0, car_total: 0,
        two_wheeler_occupied: 0, two_wheeler_available: 0, two_wheeler_total: 0,
        scans: [],
      };
      groups.set(key, row);
    }
    row.car_occupied += s.car_occupied;
    row.car_available += s.car_available;
    row.car_total += s.car_total;
    row.two_wheeler_occupied += s.two_wheeler_occupied;
    row.two_wheeler_available += s.two_wheeler_available;
    row.two_wheeler_total += s.two_wheeler_total;
    row.labelAt = Math.max(row.labelAt, new Date(s.recorded_at).getTime());
    row.scans.push(s);
  }

  return Array.from(groups.values()).sort((a, b) => b.slotStart - a.slotStart);
}

export default function LocationReport() {
  const { areaId, locationId } = useFilter();
  const [scans, setScans] = useState<ParkingScan[]>([]);
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [intervalMin, setIntervalMin] = useState(5);
  const [quickView, setQuickView] = useState<LocationSlotRow | null>(null);

  const [cameraId, setCameraId] = useState("");
  const [cameras, setCameras] = useState<Camera[]>([]);

  // Applied filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState<string>(DEFAULT_DATE_RANGE.from);
  const [customTo, setCustomTo] = useState<string>(DEFAULT_DATE_RANGE.to);

  // Draft filters — copied onto the applied ones only when Apply is pressed
  const [draftPreset, setDraftPreset] = useState("today");
  const [draftFrom, setDraftFrom] = useState<string>(DEFAULT_DATE_RANGE.from);
  const [draftTo, setDraftTo] = useState<string>(DEFAULT_DATE_RANGE.to);
  const [draftCamera, setDraftCamera] = useState("");

  // Cameras for the active location. One request covers every device there.
  useEffect(() => {
    if (!locationId) { setCameras([]); setCameraId(""); setDraftCamera(""); return; }
    let cancelled = false;
    camerasApi.byLocation(locationId)
      .then(({ data }) => {
        if (cancelled) return;
        setCameras((data.items || []).filter((c) => c.module_type === "AI_PARKING"));
      })
      .catch(() => { if (!cancelled) setCameras([]); });
    setCameraId(""); setDraftCamera("");
    return () => { cancelled = true; };
  }, [locationId]);

  function openFilters() {
    setDraftPreset(datePreset); setDraftFrom(customFrom); setDraftTo(customTo); setDraftCamera(cameraId);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setDatePreset(draftPreset); setCustomFrom(draftFrom); setCustomTo(draftTo); setCameraId(draftCamera);
    setPage(1); setFiltersOpen(false);
  }
  function resetFilters() {
    setDatePreset("today");
    setCustomFrom(DEFAULT_DATE_RANGE.from); setCustomTo(DEFAULT_DATE_RANGE.to);
    setCameraId("");
    setPage(1);
  }
  function clearDraft() {
    setDraftPreset("today");
    setDraftFrom(DEFAULT_DATE_RANGE.from); setDraftTo(DEFAULT_DATE_RANGE.to);
    setDraftCamera("");
    resetFilters();
  }

  function buildParams(pageNum: number) {
    const p = new URLSearchParams();
    p.set("page", String(pageNum));
    p.set("page_size", String(FETCH_PAGE_SIZE));
    p.set("interval_minutes", String(intervalMin));
    if (customFrom || customTo) {
      if (customFrom) p.set("start_date", new Date(customFrom).toISOString());
      if (customTo) p.set("end_date", new Date(customTo).toISOString());
    } else if (datePreset) {
      const { start, end } = getPresetDates(datePreset);
      if (start) p.set("start_date", start);
      if (end) p.set("end_date", end);
    }
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    if (cameraId) p.set("camera_id", cameraId);
    return p.toString();
  }

  // Walk every page for the chosen range. Grouping needs the whole range: a slot
  // split across a page boundary would otherwise show a partial total.
  const fetchAll = useCallback(async () => {
    try {
      const all: ParkingScan[] = [];
      let pageNum = 1;
      let pages = 1;
      do {
        const { data } = await parkingHistoryApi.list(buildParams(pageNum));
        all.push(...(data.items || []));
        pages = data.total_pages || 1;
        pageNum++;
      } while (pageNum <= pages && pageNum <= MAX_PAGES);
      setScans(all);
    } catch { /* surfaced by the axios interceptor */ }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, customFrom, customTo, areaId, locationId, cameraId, intervalMin]);

  const isLive = datePreset === "today" && isDefaultDateRange(customFrom, customTo);

  // Poll only while looking at today. Re-walking every page every 15s for a
  // historical range would be pure waste.
  usePolling(fetchAll, isLive ? 15000 : 3_600_000);

  const fetchSummary = useCallback(async () => {
    const p = new URLSearchParams();
    if (customFrom || customTo) {
      if (customFrom) p.set("start_date", new Date(customFrom).toISOString());
      if (customTo) p.set("end_date", new Date(customTo).toISOString());
    } else if (datePreset && datePreset !== "today") {
      const { start, end } = getPresetDates(datePreset);
      if (start) p.set("start_date", start);
      if (end) p.set("end_date", end);
    }
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    if (cameraId) p.set("camera_id", cameraId);
    try {
      const { data } = await parkingHistoryApi.occupancySummary(p.toString());
      setSummary(data);
    } catch { /* ignore */ }
  }, [datePreset, customFrom, customTo, areaId, locationId, cameraId]);

  usePolling(fetchSummary, 15000);
  useEffect(() => { setPage(1); }, [datePreset, customFrom, customTo, areaId, locationId, cameraId, intervalMin]);

  const activeFilterCount =
    (isDefaultDateRange(customFrom, customTo) ? 0 : [customFrom, customTo].filter(Boolean).length) +
    (cameraId ? 1 : 0) +
    (datePreset !== "today" ? 1 : 0);

  const allRows = useMemo(() => groupByLocationSlot(scans, intervalMin), [scans, intervalMin]);

  const q = search.trim().toLowerCase();
  const filteredRows = q ? allRows.filter((r) => r.location_name.toLowerCase().includes(q)) : allRows;

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading && scans.length === 0) return <LocationReportSkeleton />;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-900">Location Report</h1>
            {isLive && <LiveBadge />}
          </div>
          <p className="text-[13px] text-slate-400 mt-0.5">
            One row per location per time slot — every camera at that location combined
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Interval selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 card-shadow">
            <Clock size={12} className="text-slate-400" />
            <select
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
              className="text-[11px] font-semibold text-slate-600 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Occupancy summary cards — grouped Cars / 2 Wheeler */}
      {summary === null ? (
        <div className="space-y-4 mb-6 animate-pulse">
          {[0, 1].map((g) => (
            <div key={g}>
              <Skel className="w-24 h-4 mb-2" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 p-4">
                    <Skel className="w-16 h-3 mb-2" />
                    <Skel className="w-14 h-7" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">Cars</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total cars", value: summary.car_total, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
                { label: "Occupied", value: summary.car_occupied, border: "border-red-200", bg: "bg-red-50", text: "text-red-500" },
                { label: "Available", value: summary.car_available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
                { label: "Occupancy", value: `${summary.car_total > 0 ? Math.round((summary.car_occupied / summary.car_total) * 100) : 0}%`, border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
              ].map(({ label, value, border, bg, text }) => (
                <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
                  <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">2 Wheeler</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total 2W", value: summary.two_wheeler_total, border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700" },
                { label: "Occupied", value: summary.two_wheeler_occupied, border: "border-red-200", bg: "bg-red-50", text: "text-red-500" },
                { label: "Available", value: summary.two_wheeler_available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
                { label: "Occupancy", value: `${summary.two_wheeler_total > 0 ? Math.round((summary.two_wheeler_occupied / summary.two_wheeler_total) * 100) : 0}%`, border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
              ].map(({ label, value, border, bg, text }) => (
                <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
                  <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <FilterToolbar search={search} onSearch={setSearch} searchPlaceholder="Search location..." filterCount={activeFilterCount} onOpen={openFilters} />

      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} onApply={applyFilters} onClear={clearDraft}>
        <FilterField label="Quick Range">
          <FilterSelect value={draftFrom || draftTo ? "" : draftPreset} onChange={(v) => { setDraftPreset(v); setDraftFrom(""); setDraftTo(""); }}>
            <option value="" disabled>Custom range</option>
            {DATE_PRESETS.map((dp) => <option key={dp.key} value={dp.key}>{dp.label}</option>)}
          </FilterSelect>
        </FilterField>
        <FilterField label="From Date">
          <FilterDateInput value={draftFrom} onChange={(v) => { setDraftFrom(v); setDraftPreset(""); }} />
        </FilterField>
        <FilterField label="To Date">
          <FilterDateInput value={draftTo} onChange={(v) => { setDraftTo(v); setDraftPreset(""); }} />
        </FilterField>
        <FilterField label="Camera">
          {locationId ? (
            <FilterSelect value={draftCamera} onChange={setDraftCamera}>
              <option value="">All cameras</option>
              {cameras.map((c) => <option key={c.id} value={c.id}>{c.position_label}</option>)}
            </FilterSelect>
          ) : (
            <p className="text-[12px] text-slate-400 py-2">Select a location first to filter by camera.</p>
          )}
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
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cameras</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Occ</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Car Avail</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Car Total</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Occ</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">2W Avail</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">2W Total</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-12">View</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                        <Clock size={24} className="text-slate-300" />
                      </div>
                      <p className="text-[14px] font-semibold">No readings found</p>
                      <p className="text-[12px] text-slate-400 mt-0.5">Adjust your filters or date range</p>
                    </div>
                  </td>
                </tr>
              ) : visibleRows.map((r, idx) => (
                <tr
                  key={r.key}
                  onClick={() => setQuickView(r)}
                  title="View each camera for this time"
                  className={`border-b border-b-slate-50 hover:bg-teal-50/40 transition-colors cursor-pointer ${idx % 2 === 0 ? "" : "bg-slate-25"}`}
                >
                  <td className="px-6 py-3">
                    <span className="text-[12px] font-semibold text-slate-700">{formatDate(r.labelAt)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[12px] text-slate-500">{formatTime(r.labelAt)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[12px] font-semibold text-slate-700">{r.location_name}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 rounded-full px-2.5 py-0.5">
                      <Video size={10} className="text-slate-400" />{r.scans.length}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[16px] font-bold ${r.car_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{r.car_occupied}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-[16px] font-bold text-emerald-600">{r.car_available}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-[16px] font-bold text-slate-800">{r.car_total}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[16px] font-bold ${r.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{r.two_wheeler_occupied}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-[16px] font-bold text-emerald-600">{r.two_wheeler_available}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-[16px] font-bold text-slate-800">{r.two_wheeler_total}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuickView(r); }}
                      className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                      title="View each camera for this time"
                      aria-label={`View each camera for ${r.location_name} at ${formatTime(r.labelAt)}`}
                    >
                      <Eye size={14} />
                    </button>
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

      {/* Quick view — the individual camera readings behind one row's totals */}
      <CrudDialog
        open={quickView !== null}
        onClose={() => setQuickView(null)}
        title={quickView ? `${quickView.location_name} — ${formatDate(quickView.labelAt)}, ${formatTime(quickView.labelAt)}` : ""}
        maxWidth="min(1100px, 96vw)"
      >
        {quickView && (
          <div>
            <p className="text-[12px] text-slate-400 mb-3">
              {quickView.scans.length} camera{quickView.scans.length === 1 ? "" : "s"} reported in this slot. The
              totals above are these rows added together.
            </p>
            <div className="max-h-[70vh] overflow-y-auto overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Camera</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Occ</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Car Avail</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Car Total</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Occ</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">2W Avail</th>
                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">2W Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quickView.scans.map((s) => (
                    <tr key={s.id} className="border-b border-b-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5">
                        {s.image_url ? (
                          // Opens in a new tab rather than a nested overlay — a second
                          // layer inside the dialog is not reliably on top.
                          <a
                            href={s.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors"
                            title="Open full image in a new tab"
                          >
                            <img src={s.image_url} alt={`${s.camera_label || "Camera"} snapshot`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ExternalLink size={12} className="text-white" />
                            </span>
                          </a>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
                            <ImageIcon size={14} className="text-slate-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><span className="text-[11px] font-mono text-slate-600">{s.camera_label || "—"}</span></td>
                      <td className="px-3 py-2.5"><span className="text-[11px] text-slate-500">{formatTime(s.recorded_at)}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className={`text-[14px] font-bold ${s.car_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.car_occupied}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-emerald-600">{s.car_available}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-slate-800">{s.car_total}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className={`text-[14px] font-bold ${s.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.two_wheeler_occupied}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-emerald-600">{s.two_wheeler_available}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-slate-800">{s.two_wheeler_total}</span></td>
                    </tr>
                  ))}
                  {/* Totals row — must match the parent row exactly */}
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-4 py-2.5" colSpan={3}>
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Total</span>
                    </td>
                    <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-red-500">{quickView.car_occupied}</span></td>
                    <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-emerald-600">{quickView.car_available}</span></td>
                    <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-slate-800">{quickView.car_total}</span></td>
                    <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-red-500">{quickView.two_wheeler_occupied}</span></td>
                    <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-emerald-600">{quickView.two_wheeler_available}</span></td>
                    <td className="px-3 py-2.5 text-center"><span className="text-[14px] font-bold text-slate-800">{quickView.two_wheeler_total}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CrudDialog>
    </div>
  );
}
