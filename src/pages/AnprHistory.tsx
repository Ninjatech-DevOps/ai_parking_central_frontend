import { useState, useCallback, useEffect, useRef } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { anprSessionsApi, anprDashboardApi, downloadFile } from "@/services/api";
import { showSuccess, showError } from "@/lib/toast";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import {
  Car, Bike, Download, FileSpreadsheet, FileText,
  X, Loader2, Image as ImageIcon, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import { FilterToolbar, FilterPanel, FilterField, FilterSelect, FilterDateInput, LiveBadge } from "@/components/FilterPanel";
import type { AnprSession, AnprReport } from "@/types/api";
import { Skel, SkeletonTable } from "@/components/Skeleton";

/** Tinted bordered summary card (label + big value). */
function ReportCard({ label, value, border, bg, text }: { label: string; value: number | string; border: string; bg: string; text: string }) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-4`}>
      <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
      <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
    </div>
  );
}

function ReportCardSkel() {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <Skel className="w-16 h-3 mb-2" />
      <Skel className="w-14 h-7" />
    </div>
  );
}

/** Client-side fallback for the ANPR report — mirrors the backend's build_anpr_report
 *  so the cards render even if the /anpr-sessions/report endpoint isn't available.
 *  Totals come from the ANPR dashboard summary; In/Out/Revenue from the window's sessions. */
function computeAnprReport(dash: { car_total?: number; two_wheeler_total?: number } | null, sessions: AnprSession[]): AnprReport {
  const carTotal = dash?.car_total ?? 0;
  const bikeTotal = dash?.two_wheeler_total ?? 0;
  let carIn = 0, carOut = 0, bikeIn = 0, bikeOut = 0, revenue = 0;
  for (const s of sessions) {
    const isCar = s.vehicle_type === "CAR";
    if (isCar) carIn++; else bikeIn++;
    if (s.exit_time) {
      if (isCar) carOut++; else bikeOut++;
      const hrs = Math.max(1, Math.ceil((new Date(s.exit_time).getTime() - new Date(s.entry_time).getTime()) / 3600000));
      revenue += hrs * 15; // Rs 15/hr, rounded up, min 1 hr — same rule as the backend
    }
  }
  const occupied = Math.max(0, carIn - carOut) + Math.max(0, bikeIn - bikeOut);
  const totalCap = carTotal + bikeTotal;
  return {
    summary: {
      car: { total: carTotal, in: carIn, out: carOut, available: Math.max(0, carTotal - (carIn - carOut)) },
      bike: { total: bikeTotal, in: bikeIn, out: bikeOut, available: Math.max(0, bikeTotal - (bikeIn - bikeOut)) },
      occupancy_pct: totalCap > 0 ? Math.round((occupied / totalCap) * 100) : 0,
      revenue: revenue.toLocaleString("en-IN"),
      accuracy_pct: 100,
    },
    analytics: { chart: { labels: [], in: [], out: [], granularity: "hour" }, duration: [] },
  };
}


const DATE_PRESETS = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "This Week", key: "this_week" },
  { label: "This Month", key: "this_month" },
] as const;

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

/** Convert UTC ISO string to local datetime-local input value (YYYY-MM-DDTHH:MM) */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const PAGE_SIZE = 20;

export default function AnprHistory() {
  const { areaId, locationId } = useFilter();
  const [sessions, setSessions] = useState<AnprSession[]>([]);
  const [report, setReport] = useState<AnprReport | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const reqRef = useRef(0);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exporting, setExporting] = useState<"csv" | "excel" | "pdf" | null>(null);
  const _urlParams = new URLSearchParams(window.location.search);
  const showDelete = _urlParams.has("delete");
  const showEdit = _urlParams.has("edit");

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [plateSearch, setPlateSearch] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [datePreset, setDatePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Draft (committed on Apply Filters)
  const [draftPreset, setDraftPreset] = useState("today");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [draftType, setDraftType] = useState("");
  const [draftStatus, setDraftStatus] = useState("");

  // Image preview
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // Close image preview on Escape key
  useEffect(() => {
    if (!previewImg) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewImg(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImg]);

  // Inline edit — use full response so duration_display recalculates on time changes
  async function handleInlineUpdate(id: string, field: string, value: string) {
    try {
      const { data } = await anprSessionsApi.update(id, { [field]: value });
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s));
      showSuccess(`Updated ${field.replace("_", " ")}`);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Update failed");
    }
  }

  function buildParams() {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(PAGE_SIZE));

    // Date range
    if (customFrom || customTo) {
      if (customFrom) p.set("start_date", new Date(customFrom).toISOString());
      if (customTo) p.set("end_date", new Date(customTo).toISOString());
    } else if (datePreset) {
      const { start, end } = getPresetDates(datePreset);
      if (start) p.set("start_date", start);
      if (end) p.set("end_date", end);
    }

    if (plateSearch) p.set("number_plate", plateSearch);
    if (vehicleType) p.set("vehicle_type", vehicleType);
    if (statusFilter === "active") p.set("is_active", "true");
    if (statusFilter === "completed") p.set("is_active", "false");

    // Area/Location filter
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);

    return p.toString();
  }

  const fetchData = useCallback(async () => {
    // Tag each request so a slow/out-of-order response can't overwrite a newer one.
    const reqId = ++reqRef.current;
    try {
      const [listRes, reportRes] = await Promise.all([
        anprSessionsApi.list(buildParams()),
        anprSessionsApi.report(buildParams()).catch(() => null),
      ]);
      // Report cards — from the API when available, else computed client-side
      // (dashboard totals + the window's sessions) so cards render regardless.
      let rep: AnprReport | null = reportRes?.data || null;
      if (!rep) {
        try {
          const allParams = new URLSearchParams(buildParams());
          allParams.set("page", "1");
          allParams.set("page_size", "100");
          const dashP = new URLSearchParams();
          if (locationId) dashP.set("location_id", locationId);
          else if (areaId) dashP.set("area_id", areaId);
          const [dashRes, allRes] = await Promise.all([
            anprDashboardApi.summary(dashP.toString()).catch(() => null),
            anprSessionsApi.list(allParams.toString()),
          ]);
          rep = computeAnprReport(dashRes?.data ?? null, allRes.data.items || []);
        } catch { rep = null; }
      }
      if (reqId !== reqRef.current) return;
      const data = listRes.data;
      setSessions(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
      setReport(rep);
      setErrored(false);
      setLoading(false);
    } catch {
      // Transient failure (e.g. backend still warming up): mark errored so we
      // keep the spinner and retry quickly instead of showing a false "no data".
      if (reqId !== reqRef.current) return;
      setErrored(true);
      setLoading(false);
    }
  }, [page, plateSearch, vehicleType, statusFilter, datePreset, customFrom, customTo, areaId, locationId]);

  usePolling(fetchData, 15000);

  // On a failed load, retry quickly so the user never has to reload manually.
  useEffect(() => {
    if (!errored) return;
    retryRef.current = setTimeout(() => { fetchData(); }, 2500);
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [errored, fetchData]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [plateSearch, vehicleType, statusFilter, datePreset, customFrom, customTo, areaId, locationId]);

  function openFilters() {
    setDraftPreset(datePreset); setDraftFrom(customFrom); setDraftTo(customTo); setDraftType(vehicleType); setDraftStatus(statusFilter);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setDatePreset(draftPreset); setCustomFrom(draftFrom); setCustomTo(draftTo); setVehicleType(draftType); setStatusFilter(draftStatus);
    setPage(1); setFiltersOpen(false);
  }
  function clearFilters() {
    setDraftPreset("today"); setDraftFrom(""); setDraftTo(""); setDraftType(""); setDraftStatus("");
    setDatePreset("today"); setCustomFrom(""); setCustomTo(""); setVehicleType(""); setStatusFilter(""); setPage(1);
  }

  const activeFilterCount = [vehicleType, statusFilter, customFrom, customTo].filter(Boolean).length + (datePreset !== "today" ? 1 : 0);
  const isLive = datePreset === "today" && !customFrom && !customTo;

  async function handleDelete(id: string) {
    try {
      await anprSessionsApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => t - 1);
    } catch { /* ignore */ }
  }

  async function handleExport(type: "csv" | "excel" | "pdf") {
    if (exporting) return;
    const p = new URLSearchParams();
    if (customFrom || customTo) {
      if (customFrom) p.set("start_date", new Date(customFrom).toISOString());
      if (customTo) p.set("end_date", new Date(customTo).toISOString());
    } else if (datePreset) {
      const { start, end } = getPresetDates(datePreset);
      if (start) p.set("start_date", start);
      if (end) p.set("end_date", end);
    }
    if (plateSearch) p.set("number_plate", plateSearch);
    if (statusFilter === "active") p.set("is_active", "true");
    if (statusFilter === "completed") p.set("is_active", "false");
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    const ps = p.toString();
    const ext = type === "csv" ? "csv" : type === "excel" ? "xlsx" : "pdf";
    const url = type === "csv" ? anprSessionsApi.exportCsvUrl(ps) : type === "excel" ? anprSessionsApi.exportExcelUrl(ps) : anprSessionsApi.exportPdfUrl(ps);
    const ts = new Date().toISOString().slice(0, 10);
    // Keep the button in a loading state until the file finishes downloading.
    setExporting(type);
    try {
      await downloadFile(url, `anpr_sessions_${ts}.${ext}`);
    } catch { /* surfaced by axios interceptor */ }
    finally { setExporting(null); }
  }

  const showSkeleton = sessions.length === 0 && (loading || errored);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-900">ANPR History</h1>
            {isLive && <LiveBadge />}
          </div>
          <p className="text-[13px] text-slate-400 mt-0.5">Vehicle entry/exit sessions via number plate recognition</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport("csv")} disabled={!!exporting} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3 py-2 transition-colors card-shadow disabled:opacity-60 disabled:cursor-not-allowed">
            {exporting === "csv" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {exporting === "csv" ? "Downloading..." : "CSV"}
          </button>
          <button onClick={() => handleExport("excel")} disabled={!!exporting} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3 py-2 transition-colors card-shadow disabled:opacity-60 disabled:cursor-not-allowed">
            {exporting === "excel" ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} {exporting === "excel" ? "Downloading..." : "Excel"}
          </button>
          <button onClick={() => handleExport("pdf")} disabled={!!exporting} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3 py-2 transition-colors card-shadow disabled:opacity-60 disabled:cursor-not-allowed">
            {exporting === "pdf" ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} {exporting === "pdf" ? "Downloading..." : "PDF"}
          </button>
        </div>
      </div>

      {/* Search (number plate) + Filters button */}
      <FilterToolbar
        search={plateSearch}
        onSearch={(v) => setPlateSearch(v.toUpperCase())}
        searchPlaceholder="Search number plate..."
        filterCount={activeFilterCount}
        onOpen={openFilters}
      />

      {/* Inline Filter panel */}
      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} onApply={applyFilters} onClear={clearFilters}>
        <FilterField label="Quick Range">
          <FilterSelect value={draftFrom || draftTo ? "" : draftPreset} onChange={(v) => { setDraftPreset(v); setDraftFrom(""); setDraftTo(""); }}>
            <option value="" disabled>Custom range</option>
            {DATE_PRESETS.map((dp) => <option key={dp.key} value={dp.key}>{dp.label}</option>)}
          </FilterSelect>
        </FilterField>
        <FilterField label="Type">
          <FilterSelect value={draftType} onChange={setDraftType}>
            <option value="">All</option>
            <option value="CAR">Car</option>
            <option value="TWO_WHEELER">2-Wheeler</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="Status">
          <FilterSelect value={draftStatus} onChange={setDraftStatus}>
            <option value="">All</option>
            <option value="active">Parked</option>
            <option value="completed">Done</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="From Date">
          <FilterDateInput value={draftFrom} onChange={(v) => { setDraftFrom(v); setDraftPreset(""); }} />
        </FilterField>
        <FilterField label="To Date">
          <FilterDateInput value={draftTo} onChange={(v) => { setDraftTo(v); setDraftPreset(""); }} />
        </FilterField>
      </FilterPanel>

      {/* Card skeleton on first load (header + search stay visible) */}
      {showSkeleton && (
        <div className="space-y-4 mb-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <ReportCardSkel key={i} />)}</div>
          {[0, 1].map((g) => (
            <div key={g}>
              <Skel className="w-24 h-4 mb-2" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <ReportCardSkel key={i} />)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Report cards — Occupancy / Revenue / Accuracy + Cars & 2 Wheeler (Total/In/Out/Available) */}
      {report && (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ReportCard label="Occupancy" value={`${report.summary.occupancy_pct}%`} border="border-teal-200" bg="bg-teal-50" text="text-teal-700" />
            <ReportCard label="Revenue" value={`₹${report.summary.revenue}`} border="border-emerald-200" bg="bg-emerald-50" text="text-emerald-700" />
            <ReportCard label="Accuracy" value={`${report.summary.accuracy_pct}%`} border="border-violet-200" bg="bg-violet-50" text="text-violet-700" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">Cars</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ReportCard label="Total cars" value={report.summary.car.total} border="border-blue-200" bg="bg-blue-50" text="text-blue-700" />
              <ReportCard label="In" value={report.summary.car.in} border="border-blue-200" bg="bg-blue-50" text="text-blue-600" />
              <ReportCard label="Out" value={report.summary.car.out} border="border-amber-200" bg="bg-amber-50" text="text-amber-600" />
              <ReportCard label="Available" value={report.summary.car.available} border="border-emerald-200" bg="bg-emerald-50" text="text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">2 Wheeler</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ReportCard label="Total 2W" value={report.summary.bike.total} border="border-indigo-200" bg="bg-indigo-50" text="text-indigo-700" />
              <ReportCard label="In" value={report.summary.bike.in} border="border-blue-200" bg="bg-blue-50" text="text-blue-600" />
              <ReportCard label="Out" value={report.summary.bike.out} border="border-amber-200" bg="bg-amber-50" text="text-amber-600" />
              <ReportCard label="Available" value={report.summary.bike.available} border="border-emerald-200" bg="bg-emerald-50" text="text-emerald-600" />
            </div>
          </div>
        </div>
      )}

      {/* Table — skeleton on first load / empty, real table otherwise */}
      {showSkeleton ? (
        <SkeletonTable rows={8} cols={8} />
      ) : (
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
                <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Number Plate</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">In Time</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Out Time</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                {showDelete && <th className="px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && !loading && !errored ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-slate-400">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                        <Car size={24} className="text-slate-300" />
                      </div>
                      <p className="text-[14px] font-semibold">No ANPR sessions found</p>
                      <p className="text-[12px] text-slate-400 mt-0.5">Adjust your filters or date range</p>
                    </div>
                  </td>
                </tr>
              ) : sessions.map((s, idx) => (
                <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                  <td className="px-6 py-3">
                    {s.entry_image_url ? (
                      <button
                        onClick={() => setPreviewImg(s.entry_image_url)}
                        className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors"
                      >
                        <img src={s.entry_image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center">
                        <ImageIcon size={16} className="text-slate-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {showEdit ? (
                      <input
                        defaultValue={s.number_plate || ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim().toUpperCase();
                          if (v && v !== s.number_plate) handleInlineUpdate(s.id, "number_plate", v);
                          else e.target.value = s.number_plate || "";
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className={`text-[14px] font-bold font-mono tracking-wide bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-32 ${s.number_plate === "N/A" ? "text-slate-400" : "text-teal-700"}`}
                      />
                    ) : (
                      <span className={`text-[14px] font-bold font-mono tracking-wide ${s.number_plate === "N/A" ? "text-slate-400" : "text-teal-700"}`}>{s.number_plate}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {showEdit ? (
                      <select
                        value={s.vehicle_type}
                        onChange={(e) => handleInlineUpdate(s.id, "vehicle_type", e.target.value)}
                        className={`text-[11px] font-bold rounded-lg px-2 py-1 border-0 cursor-pointer appearance-none text-center ${
                          s.vehicle_type === "CAR" ? "text-blue-700 bg-blue-50" : "text-indigo-700 bg-indigo-50"
                        }`}
                      >
                        <option value="CAR">Car</option>
                        <option value="TWO_WHEELER">2W</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${s.vehicle_type === "CAR" ? "text-blue-700 bg-blue-50" : "text-indigo-700 bg-indigo-50"}`}>
                        {s.vehicle_type === "CAR" ? <Car size={11} /> : <Bike size={11} />}
                        {s.vehicle_type === "CAR" ? "Car" : "2W"}
                      </span>
                    )}
                  </td>
                  {/* Entry Time */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <ArrowDownToLine size={12} className="text-blue-400" />
                      {showEdit ? (
                        <input
                          type="datetime-local"
                          defaultValue={toLocalInput(s.entry_time)}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v && new Date(v).toISOString() !== s.entry_time) {
                              handleInlineUpdate(s.id, "entry_time", new Date(v).toISOString());
                            }
                          }}
                          className="text-[11px] text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-36"
                        />
                      ) : (
                        <div>
                          <p className="text-[13px] font-semibold text-slate-700">{formatDate(s.entry_time)}</p>
                          <p className="text-[12px] text-slate-500 font-medium">{formatTime(s.entry_time)}</p>
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Exit Time */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <ArrowUpFromLine size={12} className={s.exit_time ? "text-red-400" : "text-slate-300"} />
                      {showEdit ? (
                        <input
                          type="datetime-local"
                          defaultValue={toLocalInput(s.exit_time)}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v) {
                              handleInlineUpdate(s.id, "exit_time", new Date(v).toISOString());
                            }
                          }}
                          placeholder="—"
                          className="text-[11px] text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-36"
                        />
                      ) : s.exit_time ? (
                        <div>
                          <p className="text-[13px] font-semibold text-slate-700">{formatDate(s.exit_time)}</p>
                          <p className="text-[12px] text-slate-500 font-medium">{formatTime(s.exit_time)}</p>
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[12px] font-semibold ${s.duration_display ? "text-slate-700" : "text-teal-600"}`}>
                      {s.duration_display || "Active"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${
                      s.is_active ? "text-teal-700 bg-teal-50" : "text-emerald-700 bg-emerald-50"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? "bg-teal-500 animate-pulse" : "bg-emerald-500"}`} />
                      {s.is_active ? "Parked" : "Completed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] text-slate-600">{s.location_name || "—"}</span>
                  </td>
                  {showDelete && (
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => handleDelete(s.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                        <X size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>
      )}

      {/* Image Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImg(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors">
              <X size={16} className="text-slate-600" />
            </button>
            <img src={previewImg} alt="Vehicle" className="rounded-xl shadow-2xl max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
