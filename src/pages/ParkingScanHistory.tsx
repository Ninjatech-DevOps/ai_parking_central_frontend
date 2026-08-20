import { useState, useCallback, useEffect, useRef } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { parkingHistoryApi, camerasApi, downloadFile } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import {
  Download, FileSpreadsheet, FileText,
  X, Loader2, Image as ImageIcon, Clock, Pencil, Video,
} from "lucide-react";
import { FilterToolbar, FilterPanel, FilterField, FilterSelect, FilterDateInput, LiveBadge } from "@/components/FilterPanel";
import type { ParkingScan, OccupancySummary, Camera } from "@/types/api";
import { SkeletonShell, SkeletonHeader, SkeletonTable, Skel } from "@/components/Skeleton";

function ParkingScanHistorySkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader action />
      <div className="flex flex-wrap items-center gap-3 mb-6 animate-pulse">
        <Skel className="w-72 h-10 rounded-xl" />
        <Skel className="w-44 h-10 rounded-xl" />
        <Skel className="w-44 h-10 rounded-xl" />
      </div>
      <SkeletonTable rows={8} cols={12} />
    </SkeletonShell>
  );
}

const DATE_PRESETS = [
  { label: "Today", key: "today" },
  { label: "Yesterday", key: "yesterday" },
  { label: "This Week", key: "this_week" },
  { label: "This Month", key: "this_month" },
] as const;

const INTERVAL_OPTIONS = [
  { label: "All (30s)", value: 0 },
  { label: "1 min", value: 1 },
  { label: "2 min", value: 2 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
];

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

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  // Round to nearest 5 minutes
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

// ── Inline Editable Cell ──
function EditableCell({
  value,
  scanId,
  field,
  color,
  onSave,
}: {
  value: number;
  scanId: string;
  field: string;
  color: string;
  onSave: (id: string, field: string, val: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function commit() {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 0 || num === value) { setEditing(false); setDraft(String(value)); return; }
    setSaving(true);
    try {
      await onSave(scanId, field, num);
    } catch { setDraft(String(value)); }
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(String(value)); } }}
          onBlur={commit}
          className="w-14 text-center text-[14px] font-bold border border-teal-400 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-teal-300"
          disabled={saving}
        />
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`text-[16px] font-bold cursor-pointer hover:bg-slate-100 rounded-lg px-2 py-0.5 transition-colors group inline-flex items-center gap-1 ${color}`}
      title="Click to edit"
    >
      {value}
      <Pencil size={10} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </span>
  );
}

const PAGE_SIZE = 20;

export default function ParkingScanHistory() {
  const { areaId, locationId } = useFilter();
  const [scans, setScans] = useState<ParkingScan[]>([]);
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "excel" | "pdf" | null>(null);
  const [intervalMin, setIntervalMin] = useState(5); // default 5 min
  const _urlParams = new URLSearchParams(window.location.search);
  const showDelete = _urlParams.has("delete");
  const showEdit = _urlParams.has("edit");

  // Camera filter — cameras belong to a location, so the dropdown only fills
  // once a location is picked. Cleared whenever the location scope changes.
  const [cameraId, setCameraId] = useState("");
  const [cameras, setCameras] = useState<Camera[]>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
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

  const [draftPreset, setDraftPreset] = useState("today");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [draftCamera, setDraftCamera] = useState("");

  // Camera list for the active location. One request covers every device there.
  useEffect(() => {
    if (!locationId) { setCameras([]); setCameraId(""); setDraftCamera(""); return; }
    let cancelled = false;
    camerasApi.byLocation(locationId)
      .then(({ data }) => {
        if (cancelled) return;
        setCameras((data.items || []).filter((c) => c.module_type === "AI_PARKING"));
      })
      .catch(() => { if (!cancelled) setCameras([]); });
    // A camera from the previous location can't apply to this one.
    setCameraId(""); setDraftCamera("");
    return () => { cancelled = true; };
  }, [locationId]);

  function openFilters() {
    setDraftPreset(datePreset); setDraftFrom(customFrom); setDraftTo(customTo); setDraftCamera(cameraId); setFiltersOpen(true);
  }
  function applyFilters() {
    setDatePreset(draftPreset); setCustomFrom(draftFrom); setCustomTo(draftTo); setCameraId(draftCamera); setPage(1); setFiltersOpen(false);
  }
  function clearDraft() {
    setDraftPreset("today"); setDraftFrom(""); setDraftTo(""); setDraftCamera("");
    resetFilters();
  }

  function buildParams(forExport = false) {
    const p = new URLSearchParams();
    if (!forExport) {
      p.set("page", String(page));
      p.set("page_size", String(PAGE_SIZE));
    }
    if (intervalMin > 0) p.set("interval_minutes", String(intervalMin));
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

  const fetchData = useCallback(async () => {
    try {
      const { data } = await parkingHistoryApi.list(buildParams());
      setScans(data.items || []);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, datePreset, customFrom, customTo, areaId, locationId, cameraId, intervalMin]);

  usePolling(fetchData, 15000);

  // Current occupancy summary (latest scan per location, summed) — scope only,
  // so it ignores date/interval filters and stays "live". Same data as the PDF.
  // Camera IS included: without it the cards would total the whole location
  // while the rows below show a single camera.
  const fetchSummary = useCallback(async () => {
    const p = new URLSearchParams();
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    if (cameraId) p.set("camera_id", cameraId);
    try {
      const { data } = await parkingHistoryApi.occupancySummary(p.toString());
      setSummary(data);
    } catch { /* ignore */ }
  }, [areaId, locationId, cameraId]);

  usePolling(fetchSummary, 15000);
  useEffect(() => { setPage(1); }, [datePreset, customFrom, customTo, areaId, locationId, cameraId, intervalMin]);

  function resetFilters() {
    setDatePreset("today"); setCustomFrom(""); setCustomTo(""); setCameraId("");
    setPage(1);
  }

  const activeFilterCount = [customFrom, customTo, cameraId].filter(Boolean).length + (datePreset !== "today" ? 1 : 0);

  // Inline-edit a scan's count; persist to backend and update the row in place.
  async function handleCellSave(id: string, field: string, val: number | string) {
    const { data } = await parkingHistoryApi.update(id, { [field]: val });
    setScans((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }

  async function handleDelete(id: string) {
    try {
      await parkingHistoryApi.delete(id);
      setScans((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => t - 1);
    } catch { /* ignore */ }
  }

  async function handleExport(type: "csv" | "excel" | "pdf") {
    if (exporting) return;
    const ps = buildParams(true);
    const ext = type === "csv" ? "csv" : type === "excel" ? "xlsx" : "pdf";
    const url = type === "csv" ? parkingHistoryApi.exportCsvUrl(ps) : type === "excel" ? parkingHistoryApi.exportExcelUrl(ps) : parkingHistoryApi.exportPdfUrl(ps);

    // Build filename: LOCATION[_CAMERA]-FROM-TO-DATE.ext
    const camLabel = cameraId ? cameras.find((c) => c.id === cameraId)?.position_label : "";
    const loc = `${summary?.location_name || "All"}${camLabel ? `_${camLabel}` : ""}`
      .replace(/[^a-zA-Z0-9]+/g, "_").replace(/_+$/, "");
    const now = new Date();
    const fmtH = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", hour12: true }).replace(/\s/g, "").toUpperCase();
    const fmtD = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/\s/g, "");
    let fromLabel = "", toLabel = "";
    if (customFrom) { const f = new Date(customFrom); fromLabel = fmtH(f); toLabel = customTo ? fmtH(new Date(customTo)) : fmtH(now); }
    else if (datePreset === "today") { fromLabel = "12AM"; toLabel = fmtH(now); }
    else if (datePreset === "yesterday") { fromLabel = "12AM"; toLabel = "11PM"; }
    const datePart = fmtD(now);
    const filename = `${loc}${fromLabel ? `-${fromLabel}-${toLabel}` : ""}-${datePart}.${ext}`;

    setExporting(type);
    try {
      await downloadFile(url, filename);
    } catch { /* surfaced by axios interceptor */ }
    finally { setExporting(null); }
  }

  if (loading && scans.length === 0) return <ParkingScanHistorySkeleton />;

  const q = search.trim().toLowerCase();
  const visibleScans = q
    ? scans.filter((s) => (s.location_name || "").toLowerCase().includes(q) || (s.device_name || "").toLowerCase().includes(q) || (s.camera_label || "").toLowerCase().includes(q))
    : scans;

  const isLive = datePreset === "today" && !customFrom && !customTo;
  const activeCameraLabel = cameraId ? cameras.find((c) => c.id === cameraId)?.position_label : "";

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-900">AI Parking History</h1>
            {isLive && <LiveBadge />}
          </div>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Detection scan records — one row per scan cycle
            {activeCameraLabel && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5 align-middle">
                <Video size={10} /> {activeCameraLabel}
                <button onClick={() => setCameraId("")} className="hover:text-teal-900" title="Clear camera filter"><X size={10} /></button>
              </span>
            )}
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

      {/* Occupancy summary cards — grouped Cars / 2 Wheeler (Total / Occupied / Available / Occupancy) */}
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
      <FilterToolbar search={search} onSearch={setSearch} searchPlaceholder="Search location, device or camera..." filterCount={activeFilterCount} onOpen={openFilters} />

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
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Device</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Camera</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Occ</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Car Avail</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Car Total</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Occ</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">2W Avail</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">2W Total</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-red-400 uppercase tracking-wider">Obstructed</th>
                {showDelete && <th className="px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {visibleScans.length === 0 && !loading ? (
                <tr>
                  <td colSpan={13} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                        <Clock size={24} className="text-slate-300" />
                      </div>
                      <p className="text-[14px] font-semibold">No parking scans found</p>
                      <p className="text-[12px] text-slate-400 mt-0.5">Scans will appear as detection cycles run</p>
                    </div>
                  </td>
                </tr>
              ) : visibleScans.map((s, idx) => (
                <tr key={s.id} className={`border-b hover:bg-slate-50/60 transition-colors ${s.has_obstruction ? "border-l-4 border-l-red-500 bg-red-50/40 border-b-red-100" : `border-b-slate-50 ${idx % 2 === 0 ? "" : "bg-slate-25"}`}`}>
                  {showEdit ? (
                    <td className="px-6 py-3" colSpan={2}>
                      <input
                        type="datetime-local"
                        defaultValue={toLocalInput(s.recorded_at)}
                        onBlur={async (e) => {
                          const v = e.target.value;
                          if (v && new Date(v).toISOString() !== s.recorded_at) {
                            await handleCellSave(s.id, "recorded_at", new Date(v).toISOString());
                          }
                        }}
                        className="text-[12px] text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-40"
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-6 py-3">
                        <span className="text-[12px] font-semibold text-slate-700">{formatDate(s.recorded_at)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[12px] text-slate-500">{formatTime(s.recorded_at)}</span>
                      </td>
                    </>
                  )}
                  <td className="px-3 py-3">
                    {s.image_url ? (
                      <button onClick={() => setPreviewImg(s.image_url)} className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors">
                        <img src={s.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
                        <ImageIcon size={14} className="text-slate-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[12px] font-semibold text-slate-700">{s.location_name || "—"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[11px] font-mono text-slate-500">{s.device_name || "—"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[11px] font-mono text-slate-500">{s.camera_label || "—"}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {showEdit ? <EditableCell value={s.car_occupied} scanId={s.id} field="car_occupied" color={s.car_occupied > 0 ? "text-red-500" : "text-slate-300"} onSave={handleCellSave} /> : <span className={`text-[16px] font-bold ${s.car_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.car_occupied}</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {showEdit ? <EditableCell value={s.car_available} scanId={s.id} field="car_available" color="text-emerald-600" onSave={handleCellSave} /> : <span className="text-[16px] font-bold text-emerald-600">{s.car_available}</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {showEdit ? <EditableCell value={s.car_total} scanId={s.id} field="car_total" color="text-slate-800" onSave={handleCellSave} /> : <span className="text-[16px] font-bold text-slate-800">{s.car_total}</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {showEdit ? <EditableCell value={s.two_wheeler_occupied} scanId={s.id} field="two_wheeler_occupied" color={s.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"} onSave={handleCellSave} /> : <span className={`text-[16px] font-bold ${s.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.two_wheeler_occupied}</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {showEdit ? <EditableCell value={s.two_wheeler_available} scanId={s.id} field="two_wheeler_available" color="text-emerald-600" onSave={handleCellSave} /> : <span className="text-[16px] font-bold text-emerald-600">{s.two_wheeler_available}</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {showEdit ? <EditableCell value={s.two_wheeler_total} scanId={s.id} field="two_wheeler_total" color="text-slate-800" onSave={handleCellSave} /> : <span className="text-[16px] font-bold text-slate-800">{s.two_wheeler_total}</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {s.has_obstruction ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 rounded-full px-2.5 py-0.5">Yes</span>
                    ) : (
                      <span className="text-[12px] text-slate-300">No</span>
                    )}
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

      {/* Image Preview */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImg(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors">
              <X size={16} className="text-slate-600" />
            </button>
            <img src={previewImg} alt="Scan" className="rounded-xl shadow-2xl max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
