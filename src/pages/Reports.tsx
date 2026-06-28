import { useState, useEffect, useCallback, useMemo } from "react";
import { useFilter } from "@/contexts/FilterContext";
import {
  reportsApi, areasApi, anprSessionsApi, locationsApi, downloadFile,
} from "@/services/api";
import SearchSelect from "@/components/SearchSelect";
import { FilterToolbar, FilterPanel, FilterField, FilterSelect, FilterDateInput } from "@/components/FilterPanel";
import Pagination from "@/components/Pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart3, Car, Bike, Clock, Download, FileDown, FileSpreadsheet, FileText,
  ParkingSquare, Timer, AlertTriangle, Monitor, TrendingUp, Activity, Loader2,
  Flame, MapPin, CircleCheck, Ban, ShieldAlert, ScanLine, ArrowDownToLine,
  ArrowUpFromLine, LogIn, Hash, ListChecks, ChevronDown,
} from "lucide-react";
import type {
  Area, Location, OccupancyAnalysisResponse, AnprSession,
  AnprDashboardSummary, AnprDashboardLocation,
} from "@/types/api";
import { SkeletonShell, SkeletonStatCards, SkeletonChart, SkeletonTable, Skel } from "@/components/Skeleton";
// STATIC MOCK — swap point: replace these with reportsApi / anprSessionsApi / anprDashboardApi for live data.
import { getReportData, getAnprSessions, getAnprSummary, getAnprLocations, getOccupancyAnalysis } from "@/lib/reportsMock";

// ─────────────────────────────────────────────────────────────
// Date helpers (presets — default "today")
// ─────────────────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "This Week", key: "this_week" },
  { label: "This Month", key: "this_month" },
] as const;

function getPresetRange(key: string): { start: string; end: string } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(todayStart.getTime() + 86400000);
  switch (key) {
    case "today":
      return { start: todayStart.toISOString(), end: dayEnd.toISOString() };
    case "yesterday": {
      const y = new Date(todayStart.getTime() - 86400000);
      return { start: y.toISOString(), end: todayStart.toISOString() };
    }
    case "this_week": {
      const d = todayStart.getDay();
      const mon = new Date(todayStart.getTime() - (d === 0 ? 6 : d - 1) * 86400000);
      return { start: mon.toISOString(), end: dayEnd.toISOString() };
    }
    case "this_month": {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: ms.toISOString(), end: dayEnd.toISOString() };
    }
    default:
      return { start: "", end: "" };
  }
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}
function formatHourShort(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}
function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface ReportData {
  summary: {
    total_sessions: number;
    active_sessions: number;
    completed_sessions: number;
    vehicle_sessions: number;
    obstructed_sessions: number;
    car_sessions: number;
    two_wheeler_sessions: number;
    avg_duration_minutes: number | null;
    max_duration_minutes: number | null;
    min_duration_minutes: number | null;
    peak_hour: number | null;
    peak_hour_count: number;
    hourly_distribution: number[];
    duration_distribution: Record<string, number>;
    top_slots: { label: string; count: number }[];
    unique_slots: number;
  };
  slot_counts: { total: number; available: number; occupied: number; obstructed: number };
  device_summary: { total: number; online: number; offline: number };
  alert_summary: { total: number; critical: number; high: number; medium: number; low: number; active: number; resolved: number };
  sessions: any[];
  total_sessions_in_period: number;
}

interface AnprAnalytics {
  totalEntries: number;
  exits: number;
  inside: number;
  cars: number;
  twoWheelers: number;
  uniquePlates: number;
  avgDuration: number | null;
  maxDuration: number | null;
  hourly: number[];
  peakHour: number | null;
  peakCount: number;
  topPlates: { label: string; count: number }[];
  topLocations: { label: string; count: number }[];
}

function aggregateAnpr(sessions: AnprSession[]): AnprAnalytics {
  const completed = sessions.filter((s) => s.exit_time);
  const durations = completed
    .map((s) => (new Date(s.exit_time as string).getTime() - new Date(s.entry_time).getTime()) / 60000)
    .filter((d) => d >= 0);
  const hourly = Array(24).fill(0);
  sessions.forEach((s) => { hourly[new Date(s.entry_time).getHours()]++; });
  let peakHour: number | null = null, peakCount = 0;
  hourly.forEach((c, h) => { if (c > peakCount) { peakCount = c; peakHour = h; } });

  const plateCounts: Record<string, number> = {};
  const locCounts: Record<string, number> = {};
  sessions.forEach((s) => {
    plateCounts[s.number_plate] = (plateCounts[s.number_plate] || 0) + 1;
    const n = s.location_name || "Unknown";
    locCounts[n] = (locCounts[n] || 0) + 1;
  });
  const toSorted = (rec: Record<string, number>) =>
    Object.entries(rec).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  return {
    totalEntries: sessions.length,
    exits: completed.length,
    inside: sessions.filter((s) => s.is_active || !s.exit_time).length,
    cars: sessions.filter((s) => s.vehicle_type === "CAR").length,
    twoWheelers: sessions.filter((s) => s.vehicle_type === "TWO_WHEELER").length,
    uniquePlates: new Set(sessions.map((s) => s.number_plate)).size,
    avgDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    maxDuration: durations.length ? Math.max(...durations) : null,
    hourly,
    peakHour,
    peakCount,
    topPlates: toSorted(plateCounts),
    topLocations: toSorted(locCounts),
  };
}

type Tab = "overview" | "parking" | "anpr" | "occupancy";

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export default function Reports() {
  const { locations } = useFilter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  // Date range (preset-driven, defaults to today; custom overrides preset)
  const [datePreset, setDatePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Applied filters (mirrors Parking History: camera / status / type / duration)
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [durationUnit, setDurationUnit] = useState<"min" | "hr">("min");

  // Filter panel (draft → Apply)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState("today");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [draftArea, setDraftArea] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftCamera, setDraftCamera] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftEventType, setDraftEventType] = useState("");
  const [draftMinDuration, setDraftMinDuration] = useState("");
  const [draftMaxDuration, setDraftMaxDuration] = useState("");
  const [draftDurationUnit, setDraftDurationUnit] = useState<"min" | "hr">("min");
  const [draftSlotType, setDraftSlotType] = useState("");
  const [draftThreshold, setDraftThreshold] = useState(80);
  const [cameraOptions, setCameraOptions] = useState<{ value: string; label: string }[]>([]);

  const [tab, setTab] = useState<Tab>("overview");
  const [exportOpen, setExportOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Parking + ANPR report data
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [anprSessions, setAnprSessions] = useState<AnprSession[]>([]);
  const [anprSummary, setAnprSummary] = useState<AnprDashboardSummary | null>(null);
  const [anprLocations, setAnprLocations] = useState<AnprDashboardLocation[]>([]);
  const [page, setPage] = useState(1);
  const [anprPage, setAnprPage] = useState(1);
  const pageSize = 15;

  // Occupancy (lazy, has extra controls)
  const [occLoading, setOccLoading] = useState(false);
  const [occData, setOccData] = useState<OccupancyAnalysisResponse | null>(null);
  const [occSlotType, setOccSlotType] = useState("");
  const [occThreshold, setOccThreshold] = useState(80);
  const [occRequested, setOccRequested] = useState(false);

  useEffect(() => {
    areasApi.list("page_size=500").then(({ data }) => setAreas(data.items || [])).catch(() => {});
  }, []);

  const filteredLocations = selectedArea
    ? locations.filter((l: any) => l.area_id === selectedArea)
    : locations;
  const draftFilteredLocations = draftArea
    ? locations.filter((l: any) => l.area_id === draftArea)
    : locations;

  // Build camera options with location context (same approach as Parking History)
  useEffect(() => {
    if (draftLocation) {
      locationsApi.canvas(draftLocation)
        .then(({ data }) => setCameraOptions((data.cameras || []).map((c) => ({ value: c.id, label: c.position_label }))))
        .catch(() => setCameraOptions([]));
    } else if (draftFilteredLocations.length > 0) {
      Promise.all(
        draftFilteredLocations.map((loc: Location) =>
          locationsApi.canvas(loc.id)
            .then(({ data }) => (data.cameras || []).map((c) => ({ value: c.id, label: `${c.position_label} (${loc.name})` })))
            .catch(() => [] as { value: string; label: string }[])
        )
      ).then((results) => setCameraOptions(results.flat()));
    } else {
      setCameraOptions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLocation, draftArea, locations]);

  // When blocked/cleared is selected, the Type filter is implied (disabled)
  const typeFilterDisabled = draftStatus === "blocked" || draftStatus === "cleared";

  function openFilters() {
    setDraftPreset(datePreset); setDraftFrom(customFrom); setDraftTo(customTo);
    setDraftArea(selectedArea); setDraftLocation(selectedLocation); setDraftCamera(selectedCamera);
    setDraftStatus(selectedStatus); setDraftEventType(selectedEventType);
    setDraftMinDuration(minDuration); setDraftMaxDuration(maxDuration); setDraftDurationUnit(durationUnit);
    setDraftSlotType(occSlotType); setDraftThreshold(occThreshold);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setDatePreset(draftPreset); setCustomFrom(draftFrom); setCustomTo(draftTo);
    setSelectedArea(draftArea); setSelectedLocation(draftLocation); setSelectedCamera(draftCamera);
    setSelectedStatus(draftStatus); setSelectedEventType(draftEventType);
    setMinDuration(draftMinDuration); setMaxDuration(draftMaxDuration); setDurationUnit(draftDurationUnit);
    setOccSlotType(draftSlotType); setOccThreshold(draftThreshold);
    setFiltersOpen(false);
  }
  function clearFilters() {
    setDraftPreset("today"); setDraftFrom(""); setDraftTo(""); setDraftArea(""); setDraftLocation(""); setDraftCamera("");
    setDraftStatus(""); setDraftEventType(""); setDraftMinDuration(""); setDraftMaxDuration(""); setDraftDurationUnit("min");
    setDraftSlotType(""); setDraftThreshold(80);
    setDatePreset("today"); setCustomFrom(""); setCustomTo(""); setSelectedArea(""); setSelectedLocation(""); setSelectedCamera("");
    setSelectedStatus(""); setSelectedEventType(""); setMinDuration(""); setMaxDuration(""); setDurationUnit("min");
    setOccSlotType(""); setOccThreshold(80);
  }
  const activeFilterCount = [
    selectedArea, selectedLocation, selectedCamera, selectedStatus, selectedEventType,
    minDuration || maxDuration, customFrom, customTo, occSlotType,
  ].filter(Boolean).length + (datePreset !== "today" ? 1 : 0) + (occThreshold !== 80 ? 1 : 0);

  // Resolve the active date range from preset / custom inputs
  const range = useMemo(() => {
    if (customFrom || customTo) {
      return {
        start: customFrom ? new Date(customFrom).toISOString() : "",
        end: customTo ? new Date(customTo).toISOString() : "",
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (selectedArea) p.set("area_id", selectedArea);
    if (selectedLocation) p.set("location_id", selectedLocation);
    if (selectedCamera) p.set("camera_id", selectedCamera);
    // Status / type — same combined mapping as Parking History
    if (selectedStatus === "blocked") {
      p.set("status", "parked"); p.set("event_type", "OBSTRUCTED");
    } else if (selectedStatus === "cleared") {
      p.set("status", "completed"); p.set("event_type", "OBSTRUCTED");
    } else {
      if (selectedStatus) p.set("status", selectedStatus);
      if (selectedEventType) p.set("event_type", selectedEventType);
    }
    const mult = durationUnit === "hr" ? 60 : 1;
    if (minDuration) p.set("min_duration", String(Number(minDuration) * mult));
    if (maxDuration) p.set("max_duration", String(Number(maxDuration) * mult));
    if (range.start) p.set("start_date", range.start);
    if (range.end) p.set("end_date", range.end);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  }, [selectedArea, selectedLocation, selectedCamera, selectedStatus, selectedEventType, minDuration, maxDuration, durationUnit, range]);

  // ─── Generate the combined report (parking + ANPR) ───
  // STATIC MOCK — swap point: this loads static data from reportsMock. For live
  // data, restore the Promise.allSettled([reportsApi.summary, anprSessionsApi.list,
  // anprDashboardApi.summary, anprDashboardApi.locations]) calls using buildParams().
  const generate = useCallback(async () => {
    setLoading(true);
    setPage(1);
    setAnprPage(1);
    setOccRequested(false);
    setOccData(null);
    await new Promise((r) => setTimeout(r, 350)); // brief skeleton for realism
    setData(getReportData());
    setAnprSessions(getAnprSessions());
    setAnprSummary(getAnprSummary());
    setAnprLocations(getAnprLocations());
    setLoading(false);
  }, []);

  // Auto-generate on mount and whenever preset / area / location changes.
  // (Custom dates apply via the explicit "Apply" button to avoid firing on every keystroke.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { generate(); }, [datePreset, selectedArea, selectedLocation, selectedCamera, selectedStatus, selectedEventType, minDuration, maxDuration, durationUnit, occSlotType, occThreshold, customFrom, customTo]);

  // ─── Occupancy analysis (lazy: when tab opened or controls applied) ───
  // STATIC MOCK — swap point: loads static occupancy data. For live data, restore
  // reportsApi.occupancyAnalysis(buildParams({ threshold, slot_type })).
  const analyzeOccupancy = useCallback(async () => {
    if (!range.start || !range.end) return;
    setOccLoading(true);
    setOccData(null);
    setOccRequested(true);
    await new Promise((r) => setTimeout(r, 350));
    setOccData(getOccupancyAnalysis(occThreshold, occSlotType));
    setOccLoading(false);
  }, [range, occThreshold, occSlotType]);

  useEffect(() => {
    if (tab === "occupancy" && !occRequested && !occLoading) analyzeOccupancy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, occRequested]);

  // ─── Exports (CSV/Excel managed by backend; PDF via print) ───
  async function doDownload(url: string, filename: string) {
    setDownloading(true);
    try {
      await downloadFile(url, filename);
    } catch { /* surfaced by axios interceptor */ }
    finally { setDownloading(false); setExportOpen(false); }
  }

  function handleExport(format: "csv" | "excel" | "pdf") {
    if (format === "pdf") { setExportOpen(false); window.print(); return; }
    const ts = new Date().toISOString().slice(0, 10);
    if (tab === "anpr") {
      const p = buildParams();
      const url = format === "csv" ? anprSessionsApi.exportCsvUrl(p) : anprSessionsApi.exportExcelUrl(p);
      doDownload(url, `anpr_report_${ts}.${format === "csv" ? "csv" : "xlsx"}`);
    } else if (tab === "occupancy") {
      const p = buildParams({ threshold: String(occThreshold), ...(occSlotType ? { slot_type: occSlotType } : {}) });
      const url = format === "csv" ? reportsApi.occupancyExportCsvUrl(p) : reportsApi.occupancyExportExcelUrl(p);
      doDownload(url, `occupancy_analysis_${ts}.${format === "csv" ? "csv" : "xlsx"}`);
    } else {
      const p = buildParams();
      const url = format === "csv" ? reportsApi.exportCsvUrl(p) : reportsApi.exportExcelUrl(p);
      doDownload(url, `parking_report_${ts}.${format === "csv" ? "csv" : "xlsx"}`);
    }
  }

  // ─── Derived ───
  const s = data?.summary;
  const anpr = useMemo(() => aggregateAnpr(anprSessions), [anprSessions]);
  const sessions = data?.sessions || [];
  const totalPages = Math.ceil(sessions.length / pageSize);
  const pagedSessions = sessions.slice((page - 1) * pageSize, page * pageSize);
  const anprTotalPages = Math.ceil(anprSessions.length / pageSize);
  const pagedAnpr = anprSessions.slice((anprPage - 1) * pageSize, anprPage * pageSize);

  const rangeLabel = (() => {
    if (customFrom || customTo) return `${customFrom ? new Date(customFrom).toLocaleString() : "…"} → ${customTo ? new Date(customTo).toLocaleString() : "…"}`;
    return DATE_PRESETS.find((d) => d.key === datePreset)?.label || "Today";
  })();

  return (
    <div className="w-full">
      {/* Print-only header */}
      <div className="print-header hidden mb-6 pb-4" style={{ borderBottom: "2px solid #0d9488" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900" style={{ margin: 0 }}>AI Parking &amp; ANPR &mdash; Analytics Report</h1>
            <p className="text-[10px] text-slate-500 mt-1">
              {rangeLabel}
              {selectedArea && ` · Area: ${areas.find((a) => a.id === selectedArea)?.name}`}
              {selectedLocation && ` · Location: ${filteredLocations.find((l: Location) => l.id === selectedLocation)?.name}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400">Generated</p>
            <p className="text-[10px] font-semibold text-slate-600">{new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 no-print">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900">Reports &amp; Analytics</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Unified AI Parking &amp; ANPR insights · <span className="font-semibold text-slate-500">{rangeLabel}</span></p>
        </div>
        <Popover open={exportOpen} onOpenChange={setExportOpen}>
          <PopoverTrigger>
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold shadow-md shadow-teal-600/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export
              <ChevronDown size={13} className="opacity-80" />
            </div>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1.5 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5">
              {tab === "anpr" ? "ANPR" : tab === "occupancy" ? "Occupancy" : "Parking"} export
            </p>
            <ExportItem icon={FileText} label="Export CSV" onClick={() => handleExport("csv")} />
            <ExportItem icon={FileSpreadsheet} label="Export Excel" onClick={() => handleExport("excel")} />
            <ExportItem icon={FileDown} label="Download PDF" onClick={() => handleExport("pdf")} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Filters button + inline panel (draft → Apply) */}
      <div className="no-print">
        <FilterToolbar filterCount={activeFilterCount} onOpen={openFilters} />
        <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} onApply={applyFilters} onClear={clearFilters}>
          <FilterField label="Quick Range">
            <FilterSelect value={draftFrom || draftTo ? "" : draftPreset} onChange={(v) => { setDraftPreset(v); setDraftFrom(""); setDraftTo(""); }}>
              <option value="" disabled>Custom range</option>
              {DATE_PRESETS.map((dp) => <option key={dp.key} value={dp.key}>{dp.label}</option>)}
            </FilterSelect>
          </FilterField>
          <FilterField label="Area">
            <SearchSelect
              options={[{ value: "", label: "All Areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
              value={draftArea}
              onValueChange={(v) => { setDraftArea(v); setDraftLocation(""); }}
              placeholder="All Areas"
              className="w-full h-10"
            />
          </FilterField>
          <FilterField label="Location">
            <SearchSelect
              options={[{ value: "", label: "All Locations" }, ...draftFilteredLocations.map((l: Location) => ({ value: l.id, label: l.name }))]}
              value={draftLocation}
              onValueChange={(v) => { setDraftLocation(v); setDraftCamera(""); }}
              placeholder="All Locations"
              className="w-full h-10"
            />
          </FilterField>
          <FilterField label="Camera">
            <SearchSelect
              options={[{ value: "", label: "All Cameras" }, ...cameraOptions]}
              value={draftCamera}
              onValueChange={setDraftCamera}
              placeholder="All Cameras"
              className="w-full h-10"
            />
          </FilterField>
          <FilterField label="Status">
            <SearchSelect
              options={[
                { value: "", label: "All Statuses" },
                { value: "parked", label: "Parked" },
                { value: "completed", label: "Completed" },
                { value: "blocked", label: "Blocked" },
                { value: "cleared", label: "Cleared" },
              ]}
              value={draftStatus}
              onValueChange={setDraftStatus}
              placeholder="All Statuses"
              className="w-full h-10"
            />
          </FilterField>
          <FilterField label="Type">
            <SearchSelect
              options={[
                { value: "", label: "All Types" },
                { value: "VEHICLE", label: "Vehicle" },
                { value: "OBSTRUCTED", label: "Obstructed" },
              ]}
              value={typeFilterDisabled ? "" : draftEventType}
              onValueChange={setDraftEventType}
              placeholder={typeFilterDisabled ? "Set by status" : "All Types"}
              className={`w-full h-10 ${typeFilterDisabled ? "opacity-40 pointer-events-none" : ""}`}
            />
          </FilterField>
          <FilterField label="Duration">
            <div className="flex items-center h-10 rounded-lg border border-slate-200 bg-white overflow-hidden">
              <input
                type="number" min="0" value={draftMinDuration}
                onChange={(e) => setDraftMinDuration(e.target.value)}
                placeholder="Min"
                className="flex-1 min-w-0 h-full px-2 text-[12px] text-slate-700 text-center focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-300 shrink-0">to</span>
              <input
                type="number" min="0" value={draftMaxDuration}
                onChange={(e) => setDraftMaxDuration(e.target.value)}
                placeholder="Max"
                className="flex-1 min-w-0 h-full px-2 text-[12px] text-slate-700 text-center focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <select
                value={draftDurationUnit}
                onChange={(e) => setDraftDurationUnit(e.target.value as "min" | "hr")}
                className="h-full border-l border-slate-200 px-1.5 text-[11px] text-slate-500 bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="min">min</option>
                <option value="hr">hrs</option>
              </select>
            </div>
          </FilterField>
          <FilterField label="Slot Type">
            <FilterSelect value={draftSlotType} onChange={setDraftSlotType}>
              <option value="">All Types</option>
              <option value="CAR">Car</option>
              <option value="TWO_WHEELER">Two Wheeler</option>
              <option value="GENERAL">General</option>
            </FilterSelect>
          </FilterField>
          <FilterField label="Threshold % (peak occupancy)">
            <input
              type="number" min={1} max={100} value={draftThreshold}
              onChange={(e) => setDraftThreshold(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </FilterField>
          <FilterField label="From Date">
            <FilterDateInput value={draftFrom} onChange={(v) => { setDraftFrom(v); setDraftPreset(""); }} />
          </FilterField>
          <FilterField label="To Date">
            <FilterDateInput value={draftTo} onChange={(v) => { setDraftTo(v); setDraftPreset(""); }} />
          </FilterField>
        </FilterPanel>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 no-print bg-slate-100 rounded-xl p-1 w-fit">
        {([
          { id: "overview", label: "Overview", icon: ListChecks },
          { id: "parking", label: "AI Parking", icon: ParkingSquare },
          { id: "anpr", label: "ANPR", icon: ScanLine },
          { id: "occupancy", label: "Peak Occupancy", icon: Flame },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
              tab === t.id ? "bg-white text-slate-800 card-shadow" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="no-print"><ReportsSkeleton /></div>}

      {!loading && (
        <>
          {tab === "overview" && <OverviewTab data={data} s={s} anpr={anpr} anprSummary={anprSummary} rangeLabel={rangeLabel} />}
          {tab === "parking" && <ParkingTab data={data} s={s} page={page} setPage={setPage} totalPages={totalPages} pagedSessions={pagedSessions} sessions={sessions} pageSize={pageSize} />}
          {tab === "anpr" && <AnprTab anpr={anpr} anprSummary={anprSummary} anprLocations={anprLocations} sessions={anprSessions} pagedAnpr={pagedAnpr} anprPage={anprPage} setAnprPage={setAnprPage} anprTotalPages={anprTotalPages} pageSize={pageSize} />}
          {tab === "occupancy" && (
            <OccupancyTab
              threshold={occThreshold} slotType={occSlotType}
              loading={occLoading} data={occData} onAnalyze={analyzeOccupancy}
            />
          )}
        </>
      )}

      {/* Print footer */}
      <div className="print-footer hidden mt-6 pt-4 border-t border-slate-200 text-center">
        <p className="text-[9px] text-slate-400">AI Parking &amp; ANPR Management System &mdash; Confidential Report &mdash; Generated {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═════════════════════════════════════════════════════════════
function OverviewTab({ data, s, anpr, anprSummary, rangeLabel }: {
  data: ReportData | null; s: ReportData["summary"] | undefined; anpr: AnprAnalytics;
  anprSummary: AnprDashboardSummary | null; rangeLabel: string;
}) {
  const slot = data?.slot_counts;
  return (
    <div className="space-y-5">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi icon={Activity} accent="teal" label="Parking Sessions" value={s?.total_sessions ?? 0} sub={`${s?.active_sessions ?? 0} active`} />
        <Kpi icon={ParkingSquare} accent="blue" label="Slots Available" value={slot?.available ?? 0} sub={`of ${slot?.total ?? 0}`} />
        <Kpi icon={LogIn} accent="violet" label="ANPR Entries" value={anpr.totalEntries} sub={`${anpr.exits} exits`} />
        <Kpi icon={Car} accent="indigo" label="Vehicles Inside" value={anpr.inside} sub="ANPR live" />
        <Kpi icon={Clock} accent="amber" label="Avg Park Time" value={formatDuration(s?.avg_duration_minutes ?? null)} sub="per session" />
        <Kpi icon={ShieldAlert} accent="orange" label="Obstructions" value={(s?.obstructed_sessions ?? 0)} sub="parking events" />
        <Kpi icon={AlertTriangle} accent="red" label="Active Alerts" value={data?.alert_summary.active ?? 0} sub={`${data?.alert_summary.total ?? 0} total`} />
      </div>

      {/* Two system snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-break-avoid">
        {/* AI Parking snapshot */}
        <SectionCard icon={ParkingSquare} iconColor="text-teal-600" title="AI Parking — Live Slots">
          {slot ? (
            <>
              <SplitBar segments={[
                { label: "Available", value: slot.available, color: "bg-emerald-400" },
                { label: "Occupied", value: slot.occupied, color: "bg-red-400" },
                { label: "Obstructed", value: slot.obstructed, color: "bg-amber-400" },
              ]} />
              <div className="grid grid-cols-4 gap-2 mt-4">
                <MiniMetric label="Total" value={slot.total} />
                <MiniMetric label="Available" value={slot.available} color="text-emerald-600" />
                <MiniMetric label="Occupied" value={slot.occupied} color="text-red-500" />
                <MiniMetric label="Obstructed" value={slot.obstructed} color="text-amber-600" />
              </div>
            </>
          ) : <Empty text="No parking slot data" />}
        </SectionCard>

        {/* ANPR snapshot */}
        <SectionCard icon={ScanLine} iconColor="text-violet-600" title="ANPR — Live Occupancy">
          {anprSummary ? (
            <div className="grid grid-cols-2 gap-4">
              <VehicleBlock icon={Car} label="Car" occupied={anprSummary.car_occupied} available={anprSummary.car_available} total={anprSummary.car_total} accent="text-blue-600" />
              <VehicleBlock icon={Bike} label="2-Wheeler" occupied={anprSummary.two_wheeler_occupied} available={anprSummary.two_wheeler_available} total={anprSummary.two_wheeler_total} accent="text-indigo-600" />
            </div>
          ) : <Empty text="No ANPR occupancy data" />}
        </SectionCard>
      </div>

      {/* Highlights strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Peak Parking Hour" value={s?.peak_hour != null ? formatHour(s.peak_hour) : "—"} />
        <MiniStat label="Peak ANPR Hour" value={anpr.peakHour != null ? formatHour(anpr.peakHour) : "—"} />
        <MiniStat label="Unique Plates" value={anpr.uniquePlates} />
        <MiniStat label="Devices Online" value={data ? `${data.device_summary.online}/${data.device_summary.total}` : "—"} />
      </div>

      {/* Coverage panel */}
      <CoveragePanel rangeLabel={rangeLabel} />
    </div>
  );
}

function CoveragePanel({ rangeLabel }: { rangeLabel: string }) {
  const parking = [
    "Live slot status — total, available, occupied, obstructed",
    "Session stats — total, active, completed, car vs 2-wheeler",
    "Duration analytics — average, shortest, longest, distribution buckets",
    "Hourly activity pattern (24h)",
    "Most active parking slots",
    "Device health — online / offline",
    "Alert breakdown — by severity & status",
    "Peak occupancy heatmap by zone (Occupancy tab)",
  ];
  const anpr = [
    "Entries, exits & vehicles currently inside",
    "Vehicle split — car vs 2-wheeler",
    "Unique number plates detected",
    "Duration analytics — average & longest stay",
    "Hourly entry pattern (24h)",
    "Top frequently-seen number plates",
    "Busiest locations by traffic",
    "Live occupancy + per-location breakdown & session log",
  ];
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl card-shadow p-5 print-break-avoid">
      <div className="flex items-center gap-2 mb-1">
        <ListChecks size={15} className="text-teal-600" />
        <h3 className="text-[13px] font-bold text-slate-800">What this report covers</h3>
        <span className="text-[10px] text-slate-400 ml-auto">Period: {rangeLabel}</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">Every metric below is included across the AI Parking and ANPR tabs and in CSV / Excel / PDF exports.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CoverageColumn icon={ParkingSquare} color="text-teal-600" chip="bg-teal-50 text-teal-700" title="AI Parking" items={parking} />
        <CoverageColumn icon={ScanLine} color="text-violet-600" chip="bg-violet-50 text-violet-700" title="ANPR" items={anpr} />
      </div>
    </div>
  );
}

function CoverageColumn({ icon: Icon, color, chip, title, items }: { icon: React.ElementType; color: string; chip: string; title: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={14} className={color} />
        <span className="text-[12px] font-bold text-slate-700">{title}</span>
        <span className={`text-[9px] font-bold rounded-full px-2 py-0.5 ${chip}`}>{items.length} sections</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[11.5px] text-slate-600">
            <CircleCheck size={13} className="text-emerald-500 mt-0.5 shrink-0" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// AI PARKING TAB
// ═════════════════════════════════════════════════════════════
function ParkingTab({ data, s, page, setPage, totalPages, pagedSessions, sessions, pageSize }: {
  data: ReportData | null; s: ReportData["summary"] | undefined;
  page: number; setPage: (n: number) => void; totalPages: number;
  pagedSessions: any[]; sessions: any[]; pageSize: number;
}) {
  if (!data || !s) return <Empty text="No parking data for this period" boxed />;
  const durDist = s.duration_distribution;
  const durMax = durDist ? Math.max(...Object.values(durDist), 1) : 1;

  return (
    <div className="space-y-5">
      {data.slot_counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Slots" value={data.slot_counts.total} icon={ParkingSquare} color="slate" />
          <StatCard label="Available" value={data.slot_counts.available} icon={CircleCheck} color="teal" />
          <StatCard label="Occupied" value={data.slot_counts.occupied} icon={Car} color="red" />
          <StatCard label="Obstructed" value={data.slot_counts.obstructed} icon={Ban} color="orange" />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total Sessions" value={s.total_sessions} icon={Activity} color="teal" />
        <StatCard label="Currently Parked" value={s.active_sessions} icon={ParkingSquare} color="red" />
        <StatCard label="Avg Duration" value={formatDuration(s.avg_duration_minutes)} icon={Clock} color="violet" />
        <StatCard label="Peak Hour" value={s.peak_hour !== null ? `${formatHour(s.peak_hour)}` : "—"} sub={s.peak_hour !== null ? `${s.peak_hour_count} entries` : undefined} icon={TrendingUp} color="amber" />
        <StatCard label="Vehicles" value={s.vehicle_sessions} icon={Car} color="blue" />
        <StatCard label="Obstructed" value={s.obstructed_sessions} icon={ShieldAlert} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-break-avoid">
        <SectionCard icon={Activity} iconColor="text-teal-600" title="Hourly Activity">
          <HourlyBars data={s.hourly_distribution} strong="bg-teal-500" soft="bg-teal-200 group-hover:bg-teal-400" />
        </SectionCard>

        <SectionCard icon={Timer} iconColor="text-violet-600" title="Duration Breakdown">
          <div className="space-y-3">
            {durDist && [
              { key: "under_30m", label: "< 30 min", color: "bg-emerald-400" },
              { key: "30m_to_1h", label: "30 min – 1 hr", color: "bg-teal-400" },
              { key: "1h_to_2h", label: "1 – 2 hrs", color: "bg-blue-400" },
              { key: "2h_to_8h", label: "2 – 8 hrs", color: "bg-amber-400" },
              { key: "over_8h", label: "> 8 hrs", color: "bg-red-400" },
            ].map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500 w-[80px] shrink-0 text-right">{label}</span>
                <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden">
                  <div className={`h-full ${color} rounded-lg transition-all flex items-center justify-end pr-2`}
                    style={{ width: `${Math.max((durDist[key] / durMax) * 100, durDist[key] > 0 ? 8 : 0)}%` }}>
                    {durDist[key] > 0 && <span className="text-[10px] font-bold text-white">{durDist[key]}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print-break-avoid">
        <div className="lg:col-span-2">
          <SectionCard icon={ParkingSquare} iconColor="text-blue-600" title="Most Active Slots" right={`${s.unique_slots} unique slots used`}>
            {s.top_slots.length === 0 ? <Empty text="No slot data" /> : (
              <BarList items={s.top_slots} color="bg-blue-400" mono />
            )}
          </SectionCard>
        </div>
        <div className="space-y-5">
          <SectionCard icon={Monitor} iconColor="text-slate-600" title="Devices">
            <div className="flex items-center gap-4">
              <ThreeStat a={data.device_summary.total} aLabel="Total" b={data.device_summary.online} bLabel="Online" bColor="text-emerald-600" c={data.device_summary.offline} cLabel="Offline" cColor="text-red-500" />
            </div>
          </SectionCard>
          <SectionCard icon={AlertTriangle} iconColor="text-amber-600" title="Alerts" right={`${data.alert_summary.total} total`}>
            <div className="flex items-center gap-2">
              {[
                { label: "Critical", value: data.alert_summary.critical, color: "bg-red-500" },
                { label: "High", value: data.alert_summary.high, color: "bg-orange-400" },
                { label: "Medium", value: data.alert_summary.medium, color: "bg-amber-400" },
                { label: "Active", value: data.alert_summary.active, color: "bg-red-400" },
                { label: "Resolved", value: data.alert_summary.resolved, color: "bg-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex-1 text-center">
                  <div className={`w-full h-1.5 rounded-full ${color} mb-1.5`} style={{ opacity: value > 0 ? 1 : 0.15 }} />
                  <p className="text-[13px] font-bold text-slate-800">{value}</p>
                  <p className="text-[9px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Completed" value={s.completed_sessions} />
        <MiniStat label="Shortest Stay" value={formatDuration(s.min_duration_minutes)} />
        <MiniStat label="Longest Stay" value={formatDuration(s.max_duration_minutes)} />
        <MiniStat label="Unique Slots" value={s.unique_slots} />
      </div>

      {/* Sessions table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden print-break-before">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-[13px] font-bold text-slate-800">Parking Sessions</h3>
          <span className="text-[11px] text-slate-400">{data.total_sessions_in_period} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full print-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["#", "Slot", "Type", "Vehicle", "Area", "Location", "Camera", "Entry", "Exit", "Duration", "Status"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="print-hide">
              {pagedSessions.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-[12px] text-slate-400">No sessions in this period</td></tr>
              ) : pagedSessions.map((sess: any, i: number) => (
                <SessionRow key={i} sess={sess} index={(page - 1) * pageSize + i + 1} />
              ))}
            </tbody>
            <tbody className="screen-hide">
              {sessions.map((sess: any, i: number) => <SessionRow key={i} sess={sess} index={i + 1} />)}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3 no-print">
            <Pagination page={page} totalPages={totalPages} total={sessions.length} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ANPR TAB
// ═════════════════════════════════════════════════════════════
function AnprTab({ anpr, anprSummary, anprLocations, sessions, pagedAnpr, anprPage, setAnprPage, anprTotalPages, pageSize }: {
  anpr: AnprAnalytics; anprSummary: AnprDashboardSummary | null; anprLocations: AnprDashboardLocation[];
  sessions: AnprSession[]; pagedAnpr: AnprSession[]; anprPage: number; setAnprPage: (n: number) => void;
  anprTotalPages: number; pageSize: number;
}) {
  const vehicleTotal = anpr.cars + anpr.twoWheelers || 1;
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Kpi icon={ArrowDownToLine} accent="violet" label="Entries" value={anpr.totalEntries} />
        <Kpi icon={ArrowUpFromLine} accent="blue" label="Exits" value={anpr.exits} />
        <Kpi icon={Car} accent="indigo" label="Inside Now" value={anpr.inside} />
        <Kpi icon={Hash} accent="teal" label="Unique Plates" value={anpr.uniquePlates} />
        <Kpi icon={Car} accent="blue" label="Cars" value={anpr.cars} />
        <Kpi icon={Bike} accent="indigo" label="2-Wheelers" value={anpr.twoWheelers} />
        <Kpi icon={Clock} accent="amber" label="Avg Duration" value={formatDuration(anpr.avgDuration)} />
        <Kpi icon={Timer} accent="orange" label="Longest" value={formatDuration(anpr.maxDuration)} />
      </div>

      {/* Vehicle split + hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-break-avoid">
        <SectionCard icon={Car} iconColor="text-violet-600" title="Vehicle Type Split">
          <SplitBar segments={[
            { label: "Cars", value: anpr.cars, color: "bg-blue-400" },
            { label: "2-Wheelers", value: anpr.twoWheelers, color: "bg-indigo-400" },
          ]} />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl bg-blue-50 p-3 text-center">
              <p className="text-[20px] font-bold text-blue-600 leading-none">{Math.round((anpr.cars / vehicleTotal) * 100)}%</p>
              <p className="text-[10px] text-slate-500 mt-1">{anpr.cars} cars</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-3 text-center">
              <p className="text-[20px] font-bold text-indigo-600 leading-none">{Math.round((anpr.twoWheelers / vehicleTotal) * 100)}%</p>
              <p className="text-[10px] text-slate-500 mt-1">{anpr.twoWheelers} two-wheelers</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Activity} iconColor="text-violet-600" title="Hourly Entry Pattern" right={anpr.peakHour != null ? `Peak ${formatHour(anpr.peakHour)}` : undefined}>
          <HourlyBars data={anpr.hourly} strong="bg-violet-500" soft="bg-violet-200 group-hover:bg-violet-400" />
        </SectionCard>
      </div>

      {/* Top plates + busiest locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-break-avoid">
        <SectionCard icon={Hash} iconColor="text-violet-600" title="Top Frequent Plates">
          {anpr.topPlates.length === 0 ? <Empty text="No plate data" /> : <BarList items={anpr.topPlates} color="bg-violet-400" mono />}
        </SectionCard>
        <SectionCard icon={MapPin} iconColor="text-teal-600" title="Busiest Locations">
          {anpr.topLocations.length === 0 ? <Empty text="No location data" /> : <BarList items={anpr.topLocations} color="bg-teal-400" />}
        </SectionCard>
      </div>

      {/* Live occupancy + per-location */}
      {anprSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Car Occupied" value={anprSummary.car_occupied} icon={Car} color="red" />
          <StatCard label="Car Available" value={anprSummary.car_available} icon={CircleCheck} color="teal" />
          <StatCard label="2W Occupied" value={anprSummary.two_wheeler_occupied} icon={Bike} color="red" />
          <StatCard label="2W Available" value={anprSummary.two_wheeler_available} icon={CircleCheck} color="teal" />
        </div>
      )}

      {anprLocations.length > 0 && (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden print-break-avoid">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <MapPin size={14} className="text-teal-600" />
            <h3 className="text-[13px] font-bold text-slate-800">Per-Location Occupancy</h3>
            <span className="text-[10px] text-slate-400 ml-auto">{anprLocations.length} locations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["Location", "Car (Occ/Tot)", "2W (Occ/Tot)", "Obstructions", "Occupancy", "Availability"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anprLocations.map((l) => (
                  <tr key={l.location_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-700">{l.location_name}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600">{l.car_occupied}/{l.car_total}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600">{l.two_wheeler_occupied}/{l.two_wheeler_total}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-600">{l.obstructions}</td>
                    <td className="px-4 py-2.5"><span className="text-[11px] font-bold text-red-600">{l.occupancy_pct}%</span></td>
                    <td className="px-4 py-2.5"><span className="text-[11px] font-bold text-emerald-600">{l.availability_pct}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sessions table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden print-break-before">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-[13px] font-bold text-slate-800">ANPR Sessions</h3>
          <span className="text-[11px] text-slate-400">{sessions.length} in period</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full print-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["#", "Number Plate", "Type", "Location", "Entry", "Exit", "Duration", "Status"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="print-hide">
              {pagedAnpr.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[12px] text-slate-400">No ANPR sessions in this period</td></tr>
              ) : pagedAnpr.map((sess, i) => <AnprSessionRow key={sess.id} sess={sess} index={(anprPage - 1) * pageSize + i + 1} />)}
            </tbody>
            <tbody className="screen-hide">
              {sessions.map((sess, i) => <AnprSessionRow key={sess.id} sess={sess} index={i + 1} />)}
            </tbody>
          </table>
        </div>
        {anprTotalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3 no-print">
            <Pagination page={anprPage} totalPages={anprTotalPages} total={sessions.length} pageSize={pageSize} onPageChange={setAnprPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function AnprSessionRow({ sess, index }: { sess: AnprSession; index: number }) {
  const dur = sess.exit_time
    ? (new Date(sess.exit_time).getTime() - new Date(sess.entry_time).getTime()) / 60000
    : null;
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors print-row">
      <td className="px-3 py-2 text-[10px] text-slate-400 tabular-nums">{index}</td>
      <td className="px-3 py-2 text-[11px] font-bold text-slate-800 font-mono">{sess.number_plate}</td>
      <td className="px-3 py-2">
        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${sess.vehicle_type === "CAR" ? "text-blue-600 bg-blue-50" : "text-indigo-600 bg-indigo-50"}`}>
          {sess.vehicle_type === "CAR" ? "Car" : "2-Wheeler"}
        </span>
      </td>
      <td className="px-3 py-2 text-[10px] text-slate-600">{sess.location_name || "—"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600 whitespace-nowrap">{formatTime(sess.entry_time)}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600 whitespace-nowrap">{formatTime(sess.exit_time)}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600">{sess.duration_display || formatDuration(dur)}</td>
      <td className="px-3 py-2">
        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${sess.is_active || !sess.exit_time ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50"}`}>
          {sess.is_active || !sess.exit_time ? "Inside" : "Exited"}
        </span>
      </td>
    </tr>
  );
}

// ═════════════════════════════════════════════════════════════
// PEAK OCCUPANCY TAB
// ═════════════════════════════════════════════════════════════
function occupancyColor(pct: number, threshold: number): string {
  if (pct >= 95) return "bg-red-500 text-white";
  if (pct >= threshold) return "bg-teal-600 text-white";
  if (pct >= threshold * 0.75) return "bg-teal-400 text-white";
  if (pct >= 30) return "bg-teal-200 text-slate-700";
  if (pct > 0) return "bg-teal-50 text-slate-600";
  return "bg-slate-50 text-slate-300";
}

function OccupancyTab({ threshold, slotType, loading, data, onAnalyze }: {
  threshold: number; slotType: string;
  loading: boolean; data: OccupancyAnalysisResponse | null; onAnalyze: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Controls — Slot Type & Threshold now live in the Filters panel */}
      <div className="bg-white rounded-2xl card-shadow p-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onAnalyze} disabled={loading}
            className="h-9 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Flame size={14} />}
            {loading ? "Analyzing..." : "Re-analyze"}
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 rounded-lg px-2.5 h-8">
            Slot type: <span className="text-slate-700">{slotType ? slotType.replace("_", " ") : "All"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 rounded-lg px-2.5 h-8">
            Threshold: <span className="text-slate-700">{threshold}%</span>
          </span>
          <span className="text-[11px] text-slate-400">Adjust these in the <b className="font-semibold text-slate-500">Filters</b> panel above.</span>
        </div>
      </div>

      {loading && <OccupancySkeleton />}

      {!loading && !data && <Empty text="Select a date range and analyze to find which zones are busiest and when" boxed icon={Flame} />}

      {!loading && data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Avg Occupancy" value={`${data.global_avg_occupancy_pct}%`} icon={ParkingSquare} color="teal" />
            <StatCard label="Hotspot Zones" value={data.hotspot_zones.length} icon={Flame} color="red" sub={`above ${data.threshold}%`} />
            <StatCard label="Peak Hour" value={data.global_peak_hour !== null ? formatHour(data.global_peak_hour) : "—"} icon={TrendingUp} color="amber" />
            <StatCard label="Mismatch Rate" value={`${data.global_avg_mismatch_pct}%`} icon={AlertTriangle} color="orange" />
          </div>

          {data.zones.length > 0 ? (
            <div className="bg-white rounded-2xl card-shadow overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
                <MapPin size={14} className="text-teal-600" />
                <h3 className="text-[13px] font-bold text-slate-800">Occupancy Heatmap</h3>
                <span className="text-[10px] text-slate-400 ml-auto">{data.zones.length} zones analyzed</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 min-w-[180px]">Zone</th>
                      <th className="px-1 py-2 text-[10px] font-bold text-slate-400 text-center min-w-[30px]">Avg</th>
                      {Array.from({ length: 24 }, (_, h) => (
                        <th key={h} className="px-0 py-2 text-[9px] font-bold text-slate-400 text-center min-w-[32px]">{formatHourShort(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.zones.map((zone) => (
                      <tr key={zone.zone_id} className="border-b border-slate-50 hover:bg-slate-50/30">
                        <td className="px-3 py-1.5 sticky left-0 bg-white">
                          <div className="text-[11px] font-semibold text-slate-800">{zone.zone_name}</div>
                          <div className="text-[9px] text-slate-400">{zone.location_name}{zone.floor_label ? ` · ${zone.floor_label}` : ""} · {zone.total_slots} slots</div>
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <span className={`inline-block text-[10px] font-bold rounded px-1.5 py-0.5 ${occupancyColor(zone.avg_occupancy_pct, data.threshold)}`}>
                            {zone.avg_occupancy_pct}%
                          </span>
                        </td>
                        {zone.hourly_breakdown.map((hb) => (
                          <td key={hb.hour} className="px-0 py-1.5 text-center group relative">
                            <span className={`inline-block w-[28px] text-[9px] font-semibold rounded py-0.5 ${occupancyColor(hb.occupancy_pct, data.threshold)}`}>
                              {hb.occupancy_pct > 0 ? Math.round(hb.occupancy_pct) : "·"}
                            </span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-20 shadow-lg">
                              <div className="font-semibold">{zone.zone_name}, {formatHourShort(hb.hour)}</div>
                              <div>{hb.occupancy_pct}% occupied ({hb.occupied_slots}/{hb.total_slots} slots)</div>
                              {hb.mismatch_pct > 0 && <div className="text-amber-300">{hb.mismatch_pct}% mismatched</div>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 px-5 py-2 border-t border-slate-100">
                <span className="text-[9px] text-slate-400 font-semibold">Legend:</span>
                {[
                  { label: "0%", cls: "bg-slate-50" },
                  { label: "<30%", cls: "bg-teal-50" },
                  { label: `${Math.round(threshold * 0.75)}%`, cls: "bg-teal-200" },
                  { label: `${threshold}%`, cls: "bg-teal-400" },
                  { label: `>${threshold}%`, cls: "bg-teal-600" },
                  { label: ">95%", cls: "bg-red-500" },
                ].map(({ label, cls }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded ${cls}`} />
                    <span className="text-[9px] text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <Empty text="No zones found for the selected filters" boxed />}

          {data.zones.some((z) => z.peak_periods.length > 0) && (
            <SectionCard icon={TrendingUp} iconColor="text-teal-600" title="Peak Occupancy Insights">
              <div className="space-y-2">
                {data.zones.filter((z) => z.peak_periods.length > 0).map((zone) => (
                  <div key={zone.zone_id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${zone.avg_occupancy_pct >= 95 ? "bg-red-500" : zone.avg_occupancy_pct >= threshold ? "bg-amber-400" : "bg-teal-400"}`} />
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-slate-800">{zone.insight}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {zone.peak_periods.map((p, i) => (
                          <span key={i} className="text-[10px] font-medium text-teal-700 bg-teal-50 rounded px-2 py-0.5">
                            {p.label}: {p.avg_occupancy_pct}%
                            {p.avg_mismatch_pct > 5 && <span className="text-amber-600 ml-1">({p.avg_mismatch_pct}% mismatch)</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Shared building blocks
// ═════════════════════════════════════════════════════════════
const ACCENTS: Record<string, { bg: string; text: string; bar: string }> = {
  teal: { bg: "bg-teal-50", text: "text-teal-600", bar: "from-teal-500 to-teal-600" },
  red: { bg: "bg-red-50", text: "text-red-600", bar: "from-red-400 to-red-500" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", bar: "from-violet-500 to-violet-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", bar: "from-amber-400 to-amber-500" },
  blue: { bg: "bg-blue-50", text: "text-blue-600", bar: "from-blue-400 to-blue-500" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", bar: "from-indigo-400 to-indigo-500" },
  orange: { bg: "bg-orange-50", text: "text-orange-600", bar: "from-orange-400 to-orange-500" },
  slate: { bg: "bg-slate-100", text: "text-slate-600", bar: "from-slate-400 to-slate-500" },
};

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: React.ElementType; label: string; value: string | number; sub?: string; accent: string }) {
  const c = ACCENTS[accent] || ACCENTS.teal;
  return (
    <div className="bg-white rounded-2xl card-shadow p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${c.bar}`} />
      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
        <Icon size={15} className={c.text} />
      </div>
      <p className="text-[20px] font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wider font-semibold">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  const c = ACCENTS[color] || ACCENTS.teal;
  return (
    <div className="bg-white rounded-2xl card-shadow p-4">
      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
        <Icon size={15} className={c.text} />
      </div>
      <p className="text-[20px] font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({ icon: Icon, iconColor, title, right, children }: { icon: React.ElementType; iconColor: string; title: string; right?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl card-shadow p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} className={iconColor} />
        <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
        {right && <span className="text-[10px] text-slate-400 ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  );
}

function HourlyBars({ data, strong, soft }: { data: number[]; strong: string; soft: string }) {
  const max = Math.max(...data, 1);
  return (
    <>
      <div className="flex items-end gap-[3px] h-[120px]">
        {data.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div className={`w-full rounded-t transition-all ${count === max && count > 0 ? strong : soft}`}
              style={{ height: `${Math.max((count / max) * 100, count > 0 ? 4 : 0)}%`, minHeight: count > 0 ? 3 : 0 }} />
            <div className="absolute bottom-full mb-1 hidden group-hover:flex items-center bg-slate-800 text-white text-[10px] font-medium rounded px-1.5 py-0.5 whitespace-nowrap z-10">
              {formatHour(i)}: {count}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {data.map((_, i) => (
          <div key={i} className="flex-1 text-center text-[7px] text-slate-400">{i % 3 === 0 ? formatHour(i) : ""}</div>
        ))}
      </div>
    </>
  );
}

function BarList({ items, color, mono }: { items: { label: string; count: number }[]; color: string; mono?: boolean }) {
  const max = items[0]?.count || 1;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400 w-5 text-right">{i + 1}</span>
          <span className={`text-[12px] font-semibold text-slate-700 w-28 truncate shrink-0 ${mono ? "font-mono" : ""}`}>{it.label}</span>
          <div className="flex-1 h-5 bg-slate-50 rounded overflow-hidden">
            <div className={`h-full ${color} rounded transition-all`} style={{ width: `${(it.count / max) * 100}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-slate-600 w-10 text-right">{it.count}</span>
        </div>
      ))}
    </div>
  );
}

function SplitBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div>
      <div className="flex h-7 rounded-lg overflow-hidden bg-slate-50">
        {segments.map((seg) => (
          <div key={seg.label} className={`${seg.color} transition-all`} style={{ width: `${(seg.value / total) * 100}%` }} title={`${seg.label}: ${seg.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${seg.color}`} />
            <span className="text-[11px] text-slate-500">{seg.label} <span className="font-bold text-slate-700">{seg.value}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleBlock({ icon: Icon, label, occupied, available, total, accent }: { icon: React.ElementType; label: string; occupied: number; available: number; total: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={14} className={accent} />
        <span className="text-[12px] font-bold text-slate-700">{label}</span>
        <span className="text-[10px] text-slate-400 ml-auto">{total} total</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-center flex-1">
          <p className="text-[18px] font-bold text-red-500 leading-none">{occupied}</p>
          <p className="text-[9px] text-slate-400 mt-1">Occupied</p>
        </div>
        <div className="w-px h-8 bg-slate-100" />
        <div className="text-center flex-1">
          <p className="text-[18px] font-bold text-emerald-600 leading-none">{available}</p>
          <p className="text-[9px] text-slate-400 mt-1">Available</p>
        </div>
      </div>
    </div>
  );
}

function ThreeStat({ a, aLabel, b, bLabel, bColor, c, cLabel, cColor }: { a: number; aLabel: string; b: number; bLabel: string; bColor: string; c: number; cLabel: string; cColor: string }) {
  return (
    <>
      <div className="text-center flex-1">
        <p className="text-[22px] font-bold text-slate-800">{a}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{aLabel}</p>
      </div>
      <div className="w-px h-10 bg-slate-100" />
      <div className="text-center flex-1">
        <p className={`text-[22px] font-bold ${bColor}`}>{b}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{bLabel}</p>
      </div>
      <div className="w-px h-10 bg-slate-100" />
      <div className="text-center flex-1">
        <p className={`text-[22px] font-bold ${cColor}`}>{c}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{cLabel}</p>
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl card-shadow px-4 py-3 flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-[14px] font-bold text-slate-800">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value, color = "text-slate-800" }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-[18px] font-bold leading-none ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function ExportItem({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
      <Icon size={14} className="text-slate-400" />
      {label}
    </button>
  );
}

function Empty({ text, boxed, icon: Icon = BarChart3 }: { text: string; boxed?: boolean; icon?: React.ElementType }) {
  if (boxed) {
    return (
      <div className="bg-white rounded-2xl card-shadow flex flex-col items-center justify-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
          <Icon size={24} className="text-slate-300" />
        </div>
        <p className="text-[14px] font-semibold text-slate-500">{text}</p>
      </div>
    );
  }
  return <p className="text-[12px] text-slate-400 text-center py-6">{text}</p>;
}

function SessionRow({ sess, index }: { sess: any; index: number }) {
  const isObs = sess.event_type === "OBSTRUCTED";
  const statusLabel = sess.is_active ? (isObs ? "Blocked" : "Parked") : (isObs ? "Cleared" : "Completed");
  const statusCls = sess.is_active ? (isObs ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50") : "text-emerald-600 bg-emerald-50";
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors print-row">
      <td className="px-3 py-2 text-[10px] text-slate-400 tabular-nums">{index}</td>
      <td className="px-3 py-2 text-[11px] font-semibold text-slate-800 font-mono">{sess.slot_label}</td>
      <td className="px-3 py-2">
        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${isObs ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50"}`}>
          {isObs ? "Obstructed" : "Vehicle"}
        </span>
      </td>
      <td className="px-3 py-2 text-[10px] text-slate-500">{sess.detected_vehicle_type === "TWO_WHEELER" ? "2-Wheeler" : sess.detected_vehicle_type === "CAR" ? "Car" : "—"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-500">{sess.area_name || "—"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600">{sess.location_name || "—"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-500 font-mono">{sess.camera_label || "—"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600 whitespace-nowrap">{formatTime(sess.entry_time)}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600 whitespace-nowrap">{formatTime(sess.exit_time)}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600">{formatDuration(sess.duration_minutes)}</td>
      <td className="px-3 py-2"><span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${statusCls}`}>{statusLabel}</span></td>
    </tr>
  );
}

function ReportsSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonStatCards count={7} cols={7} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl card-shadow p-5"><Skel className="w-32 h-4 mb-4" /><SkeletonChart bars={24} /></div>
        <div className="bg-white rounded-2xl card-shadow p-5"><Skel className="w-32 h-4 mb-4" /><SkeletonChart bars={5} /></div>
      </div>
      <SkeletonTable rows={8} cols={11} />
    </SkeletonShell>
  );
}

// Skeleton for the Peak Occupancy results (4 stat cards + zone × 24h heatmap).
function OccupancySkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards count={4} cols={4} />
      <div className="bg-white rounded-2xl card-shadow overflow-hidden animate-pulse">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <Skel className="w-44 h-4" />
          <Skel className="w-24 h-3 ml-auto" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex items-center gap-2">
              <Skel className="w-44 h-9 rounded shrink-0" />
              <Skel className="w-9 h-6 rounded shrink-0" />
              <div className="flex gap-1 flex-1">
                {Array.from({ length: 24 }).map((_, c) => (
                  <Skel key={c} className="flex-1 h-6 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
