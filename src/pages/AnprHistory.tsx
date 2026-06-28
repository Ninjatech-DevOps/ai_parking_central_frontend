import { useState, useCallback, useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { anprSessionsApi, downloadFile } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import {
  Search, Calendar, Car, Bike, Clock, Download, FileSpreadsheet, FileText,
  SlidersHorizontal, X, Loader2, Image as ImageIcon, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";
import type { AnprSession } from "@/types/api";

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
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilters, setShowFilters] = useState(true);
  const [plateSearch, setPlateSearch] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [datePreset, setDatePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Image preview
  const [previewImg, setPreviewImg] = useState<string | null>(null);

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
    try {
      const { data } = await anprSessionsApi.list(buildParams());
      setSessions(data.items || []);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, plateSearch, vehicleType, statusFilter, datePreset, customFrom, customTo, areaId, locationId]);

  usePolling(fetchData, 15000);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [plateSearch, vehicleType, statusFilter, datePreset, customFrom, customTo, areaId, locationId]);

  function resetFilters() {
    setPlateSearch(""); setVehicleType(""); setStatusFilter("");
    setDatePreset("today"); setCustomFrom(""); setCustomTo("");
    setPage(1);
  }

  const activeFilterCount = [plateSearch, vehicleType, statusFilter, customFrom, customTo].filter(Boolean).length + (datePreset !== "today" ? 1 : 0);

  function handleExport(type: "csv" | "excel" | "pdf") {
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
    downloadFile(url, `anpr_sessions_${ts}.${ext}`);
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">ANPR History</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">Vehicle entry/exit sessions via number plate recognition</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport("csv")} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3 py-2 transition-colors card-shadow">
            <Download size={12} /> CSV
          </button>
          <button onClick={() => handleExport("excel")} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3 py-2 transition-colors card-shadow">
            <FileSpreadsheet size={12} /> Excel
          </button>
          <button onClick={() => handleExport("pdf")} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3 py-2 transition-colors card-shadow">
            <FileText size={12} /> PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl card-shadow mb-6 overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-slate-400" />
            <span className="text-[13px] font-semibold text-slate-700">Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button onClick={(e) => { e.stopPropagation(); resetFilters(); }} className="text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1">
                <X size={11} /> Reset
              </button>
            )}
          </div>
        </button>

        <div className={`grid transition-all duration-300 ${showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <div className="px-5 pb-4 pt-1 flex flex-wrap items-end gap-3">
              {/* Date Presets */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Quick Date</label>
                <div className="flex gap-1">
                  {DATE_PRESETS.map((dp) => (
                    <button
                      key={dp.key}
                      onClick={() => { setDatePreset(dp.key); setCustomFrom(""); setCustomTo(""); }}
                      className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                        datePreset === dp.key && !customFrom && !customTo
                          ? "bg-teal-600 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {dp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number Plate Search */}
              <div className="w-36">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Number Plate</label>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={plateSearch}
                    onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
                    className="w-full pl-8 pr-2 h-8 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                  />
                </div>
              </div>

              {/* Vehicle Type */}
              <div className="w-24">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full h-8 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                >
                  <option value="">All</option>
                  <option value="CAR">Car</option>
                  <option value="TWO_WHEELER">2W</option>
                </select>
              </div>

              {/* Status */}
              <div className="w-28">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-8 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                >
                  <option value="">All</option>
                  <option value="active">Parked</option>
                  <option value="completed">Done</option>
                </select>
              </div>

              {/* Custom From */}
              <div className="w-44">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">From</label>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); setDatePreset(""); }}
                  className="w-full h-8 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              </div>

              {/* Custom To */}
              <div className="w-44">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">To</label>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => { setCustomTo(e.target.value); setDatePreset(""); }}
                  className="w-full h-8 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
                <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Number Plate</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">In Time</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Out Time</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && !loading ? (
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
                    <span className="text-[14px] font-bold text-teal-700 tracking-wide font-mono">{s.number_plate}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${
                      s.vehicle_type === "CAR" ? "text-blue-700 bg-blue-50" : "text-indigo-700 bg-indigo-50"
                    }`}>
                      {s.vehicle_type === "CAR" ? <Car size={11} /> : <Bike size={11} />}
                      {s.vehicle_type === "CAR" ? "Car" : "2W"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <ArrowDownToLine size={12} className="text-blue-400" />
                      <div>
                        <p className="text-[13px] font-semibold text-slate-700">{formatDate(s.entry_time)}</p>
                        <p className="text-[12px] text-slate-500 font-medium">{formatTime(s.entry_time)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.exit_time ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <ArrowUpFromLine size={12} className="text-red-400" />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-700">{formatDate(s.exit_time)}</p>
                          <p className="text-[12px] text-slate-500 font-medium">{formatTime(s.exit_time)}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[12px] text-slate-300">—</span>
                    )}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

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
