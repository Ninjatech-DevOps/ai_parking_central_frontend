import { useState, useCallback, useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { anprRecordsApi, downloadFile } from "@/services/api";
import { showSuccess, showError } from "@/lib/toast";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import {
  Car, Bike, Download, FileSpreadsheet, FileText,
  Loader2, Image as ImageIcon, ArrowDownToLine, ArrowUpFromLine,
  Search,
} from "lucide-react";
import { FilterToolbar, FilterPanel, FilterField, FilterSelect, FilterDateInput, LiveBadge } from "@/components/FilterPanel";
import type { AnprRecord } from "@/types/api";
import { SkeletonShell, SkeletonHeader, SkeletonTable } from "@/components/Skeleton";

function RecordsSkeleton() {
  return (
    <SkeletonShell>
      <SkeletonHeader action />
      <SkeletonTable rows={8} cols={7} />
    </SkeletonShell>
  );
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

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

const PAGE_SIZE = 20;

export default function AnprRecords() {
  const { areaId, locationId } = useFilter();
  const [records, setRecords] = useState<AnprRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [plateSearch, setPlateSearch] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [datePreset, setDatePreset] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [draftPreset, setDraftPreset] = useState("today");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [draftType, setDraftType] = useState("");
  const [draftDirection, setDraftDirection] = useState("");

  // Image preview
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // Inline edit
  async function handleInlineUpdate(id: string, field: string, value: string) {
    try {
      await anprRecordsApi.update(id, { [field]: value });
      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
      showSuccess(`Updated ${field.replace("_", " ")}`);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Update failed");
    }
  }

  function buildParams() {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(PAGE_SIZE));

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
    if (directionFilter) p.set("direction", directionFilter);

    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);

    return p.toString();
  }

  const fetchData = useCallback(async () => {
    try {
      const { data } = await anprRecordsApi.list(buildParams());
      setRecords(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [page, datePreset, customFrom, customTo, plateSearch, vehicleType, directionFilter, areaId, locationId]);

  usePolling(fetchData, 15000);
  useEffect(() => { setPage(1); }, [datePreset, customFrom, customTo, vehicleType, directionFilter, areaId, locationId]);

  function applyFilters() {
    setDatePreset(draftPreset);
    setCustomFrom(draftFrom);
    setCustomTo(draftTo);
    setVehicleType(draftType);
    setDirectionFilter(draftDirection);
    setPage(1);
    setFiltersOpen(false);
  }

  function resetFilters() {
    setDraftPreset("today"); setDraftFrom(""); setDraftTo(""); setDraftType(""); setDraftDirection("");
    setDatePreset("today"); setCustomFrom(""); setCustomTo(""); setVehicleType(""); setDirectionFilter("");
    setPlateSearch("");
    setPage(1);
  }

  async function handleExport(type: "csv" | "excel" | "pdf") {
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
    if (vehicleType) p.set("vehicle_type", vehicleType);
    if (directionFilter) p.set("direction", directionFilter);
    if (locationId) p.set("location_id", locationId);
    else if (areaId) p.set("area_id", areaId);
    const ps = p.toString();
    const ext = type === "csv" ? "csv" : type === "excel" ? "xlsx" : "pdf";
    const url = type === "csv" ? anprRecordsApi.exportCsvUrl(ps) : type === "excel" ? anprRecordsApi.exportExcelUrl(ps) : anprRecordsApi.exportPdfUrl(ps);
    const ts = new Date().toISOString().slice(0, 10);
    downloadFile(url, `anpr_records_${ts}.${ext}`);
  }

  if (loading && records.length === 0) return <RecordsSkeleton />;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-tight">ANPR Records</h1>
            <LiveBadge />
          </div>
          <p className="text-[13px] text-slate-400 mt-0.5">All vehicle detections received from ANPR devices</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleExport("csv")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[12px] font-semibold hover:border-teal-300 hover:text-teal-700 transition-colors card-shadow">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => handleExport("excel")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[12px] font-semibold hover:border-teal-300 hover:text-teal-700 transition-colors card-shadow">
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button onClick={() => handleExport("pdf")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[12px] font-semibold hover:border-teal-300 hover:text-teal-700 transition-colors card-shadow">
            <FileText size={13} /> PDF
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search plate..."
            value={plateSearch}
            onChange={(e) => { setPlateSearch(e.target.value.toUpperCase()); setPage(1); }}
            className="w-full pl-9 pr-3 h-9 text-[12px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 card-shadow"
          />
        </div>
        <FilterToolbar filterCount={[vehicleType, directionFilter, customFrom, customTo].filter(Boolean).length + (datePreset !== "today" ? 1 : 0)} onOpen={() => setFiltersOpen(!filtersOpen)} />
      </div>

      {/* Filter Panel */}
      <FilterPanel open={filtersOpen} onClose={() => setFiltersOpen(false)} onApply={applyFilters} onClear={resetFilters}>
        <FilterField label="Quick Date">
          <div className="flex gap-1">
            {DATE_PRESETS.map((dp) => (
              <button
                key={dp.key}
                onClick={() => { setDraftPreset(dp.key); setDraftFrom(""); setDraftTo(""); }}
                className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                  draftPreset === dp.key && !draftFrom && !draftTo
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {dp.label}
              </button>
            ))}
          </div>
        </FilterField>
        <FilterField label="Type">
          <FilterSelect value={draftType} onChange={setDraftType}>
            <option value="">All</option>
            <option value="CAR">Car</option>
            <option value="TWO_WHEELER">Two Wheeler</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="Direction">
          <FilterSelect value={draftDirection} onChange={setDraftDirection}>
            <option value="">All</option>
            <option value="IN">Entry (IN)</option>
            <option value="OUT">Exit (OUT)</option>
          </FilterSelect>
        </FilterField>
        <FilterField label="From">
          <FilterDateInput value={draftFrom} onChange={(v) => { setDraftFrom(v); setDraftPreset(""); }} />
        </FilterField>
        <FilterField label="To">
          <FilterDateInput value={draftTo} onChange={(v) => { setDraftTo(v); setDraftPreset(""); }} />
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
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Number Plate</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Direction</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gemini</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paddle</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-slate-400">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                        <Search size={24} className="text-slate-300" />
                      </div>
                      <p className="text-[14px] font-semibold">No records found</p>
                      <p className="text-[12px] text-slate-400 mt-0.5">Records will appear as ANPR devices detect vehicles</p>
                    </div>
                  </td>
                </tr>
              ) : records.map((r, idx) => (
                <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                  {/* Image */}
                  <td className="px-4 py-3">
                    {r.image_url ? (
                      <button onClick={() => setPreviewImg(r.image_url)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors">
                        <img src={r.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center">
                        <ImageIcon size={16} className="text-slate-300" />
                      </div>
                    )}
                  </td>

                  {/* Number Plate — editable */}
                  <td className="px-4 py-3">
                    <input
                      defaultValue={r.number_plate || ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim().toUpperCase();
                        if (v && v !== r.number_plate) handleInlineUpdate(r.id, "number_plate", v);
                        else e.target.value = r.number_plate || "";
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className={`text-[13px] font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-28 ${r.number_plate === "N/A" ? "text-slate-400" : "text-teal-700"}`}
                    />
                  </td>

                  {/* Vehicle Type — editable */}
                  <td className="px-3 py-3 text-center">
                    <select
                      value={r.vehicle_type}
                      onChange={(e) => handleInlineUpdate(r.id, "vehicle_type", e.target.value)}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1 border-0 cursor-pointer appearance-none text-center ${
                        r.vehicle_type === "CAR" ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"
                      }`}
                    >
                      <option value="CAR">Car</option>
                      <option value="TWO_WHEELER">2W</option>
                    </select>
                  </td>

                  {/* Direction — editable */}
                  <td className="px-3 py-3 text-center">
                    <select
                      value={r.direction}
                      onChange={(e) => handleInlineUpdate(r.id, "direction", e.target.value)}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1 border-0 cursor-pointer appearance-none text-center ${
                        r.direction === "IN" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                      }`}
                    >
                      <option value="IN">IN</option>
                      <option value="OUT">OUT</option>
                    </select>
                  </td>

                  {/* Date & Time — editable */}
                  <td className="px-4 py-3">
                    <input
                      type="datetime-local"
                      defaultValue={r.recorded_at?.slice(0, 16)}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v && new Date(v).toISOString() !== r.recorded_at) {
                          handleInlineUpdate(r.id, "recorded_at", new Date(v).toISOString());
                        }
                      }}
                      className="text-[11px] text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-36"
                    />
                  </td>

                  {/* Gemini Result */}
                  <td className="px-3 py-3">
                    <span className={`text-[11px] font-mono ${r.gemini_result ? "text-slate-700" : "text-slate-300"}`}>
                      {r.gemini_result || "—"}
                    </span>
                    {r.confidence_gemini != null && r.confidence_gemini > 0 && (
                      <span className="text-[9px] text-slate-400 ml-1">({(r.confidence_gemini * 100).toFixed(0)}%)</span>
                    )}
                  </td>

                  {/* Paddle Result */}
                  <td className="px-3 py-3">
                    <span className={`text-[11px] font-mono ${r.paddle_result ? "text-slate-700" : "text-slate-300"}`}>
                      {r.paddle_result || "—"}
                    </span>
                    {r.confidence_paddle != null && r.confidence_paddle > 0 && (
                      <span className="text-[9px] text-slate-400 ml-1">({(r.confidence_paddle * 100).toFixed(0)}%)</span>
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-600">{r.location_name || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-6 py-3">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewImg(null)}>
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={previewImg} alt="ANPR capture" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
