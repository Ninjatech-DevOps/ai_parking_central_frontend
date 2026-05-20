import { useState, useEffect } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { reportsApi, areasApi } from "@/services/api";
import SearchSelect from "@/components/SearchSelect";
import Pagination from "@/components/Pagination";
import {
  BarChart3, Car, Clock, Download, FileDown, ParkingSquare, Timer,
  AlertTriangle, Monitor, TrendingUp, Activity, Loader2,
} from "lucide-react";
import type { Area, Location } from "@/types/api";

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "\u2014";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

interface ReportData {
  summary: {
    total_sessions: number;
    active_sessions: number;
    completed_sessions: number;
    vehicle_sessions: number;
    obstructed_sessions: number;
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
  device_summary: { total: number; online: number; offline: number };
  alert_summary: { total: number; critical: number; high: number; medium: number; low: number; active: number; resolved: number };
  sessions: any[];
  total_sessions_in_period: number;
}

export default function Reports() {
  const { locations } = useFilter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    areasApi.list("page_size=500").then(({ data }) => setAreas(data.items)).catch(() => {});
  }, []);

  const filteredLocations = selectedArea
    ? locations.filter((l: any) => l.area_id === selectedArea)
    : locations;

  async function generateReport() {
    setLoading(true);
    setData(null);
    setPage(1);
    try {
      const params = new URLSearchParams();
      if (selectedArea) params.set("area_id", selectedArea);
      if (selectedLocation) params.set("location_id", selectedLocation);
      if (startDate) params.set("start_date", new Date(startDate).toISOString());
      if (endDate) params.set("end_date", new Date(endDate).toISOString());
      const { data: result } = await reportsApi.summary(params.toString());
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadCsv() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (selectedArea) params.set("area_id", selectedArea);
      if (selectedLocation) params.set("location_id", selectedLocation);
      if (startDate) params.set("start_date", new Date(startDate).toISOString());
      if (endDate) params.set("end_date", new Date(endDate).toISOString());
      const token = localStorage.getItem("access_token");
      const resp = await fetch(reportsApi.exportCsvUrl(params.toString()), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parking_report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  }

  const s = data?.summary;
  const hourlyMax = s ? Math.max(...s.hourly_distribution, 1) : 1;
  const durDist = s?.duration_distribution;
  const durMax = durDist ? Math.max(...Object.values(durDist), 1) : 1;
  const topSlotMax = s?.top_slots?.[0]?.count || 1;

  // Paginate sessions
  const sessions = data?.sessions || [];
  const totalPages = Math.ceil(sessions.length / pageSize);
  const pagedSessions = sessions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="w-full">
      {/* Print-only header (hidden on screen, shown in PDF) */}
      <div className="print-header hidden mb-6 pb-4" style={{ borderBottom: "2px solid #0d9488" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #0d9488, #0f766e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>P</span>
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-slate-900" style={{ margin: 0 }}>AI Parking &mdash; Analytics Report</h1>
              <div className="flex items-center gap-3 mt-1">
                {selectedArea && (
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 rounded px-2 py-0.5">
                    Area: {areas.find((a) => a.id === selectedArea)?.name}
                  </span>
                )}
                {selectedLocation && (
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 rounded px-2 py-0.5">
                    Location: {filteredLocations.find((l: Location) => l.id === selectedLocation)?.name}
                  </span>
                )}
                {startDate && (
                  <span className="text-[10px] text-slate-500">
                    From: {new Date(startDate).toLocaleDateString()}
                  </span>
                )}
                {endDate && (
                  <span className="text-[10px] text-slate-500">
                    To: {new Date(endDate).toLocaleDateString()}
                  </span>
                )}
                {!selectedArea && !selectedLocation && !startDate && !endDate && (
                  <span className="text-[10px] text-slate-400">All data &mdash; no filters applied</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-400">Generated</p>
            <p className="text-[10px] font-semibold text-slate-600">{new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900">Reports</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Generate comprehensive parking analytics</p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[12px] font-semibold transition-colors"
            >
              <FileDown size={14} />
              Download PDF
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={downloading}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold shadow-md shadow-teal-600/20 transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {downloading ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl card-shadow p-5 mb-6 no-print">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Area</label>
            <SearchSelect
              options={[{ value: "", label: "All Areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
              value={selectedArea}
              onValueChange={(v) => { setSelectedArea(v); setSelectedLocation(""); }}
              placeholder="All Areas"
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Location</label>
            <SearchSelect
              options={[{ value: "", label: "All Locations" }, ...filteredLocations.map((l: Location) => ({ value: l.id, label: l.name }))]}
              value={selectedLocation}
              onValueChange={setSelectedLocation}
              placeholder="All Locations"
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">From</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">To</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
            />
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className="h-9 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-2xl card-shadow flex flex-col items-center justify-center py-20 no-print">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[14px] font-semibold text-slate-600">Generating report...</p>
          <p className="text-[12px] text-slate-400 mt-1">Analyzing parking data</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && (
        <div className="bg-white rounded-2xl card-shadow flex flex-col items-center justify-center py-20 no-print">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <BarChart3 size={24} className="text-slate-300" />
          </div>
          <p className="text-[14px] font-semibold text-slate-500">Select filters and generate a report</p>
          <p className="text-[12px] text-slate-400 mt-1">Choose an area, location, or date range to get started</p>
        </div>
      )}

      {/* Report content */}
      {!loading && data && s && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Sessions" value={s.total_sessions} icon={Car} color="teal" />
            <StatCard label="Currently Parked" value={s.active_sessions} icon={ParkingSquare} color="red" />
            <StatCard label="Avg Duration" value={formatDuration(s.avg_duration_minutes)} icon={Clock} color="violet" />
            <StatCard label="Peak Hour" value={s.peak_hour !== null ? formatHour(s.peak_hour) : "\u2014"} sub={s.peak_hour !== null ? `${s.peak_hour_count} entries` : undefined} icon={TrendingUp} color="amber" />
            <StatCard label="Vehicles" value={s.vehicle_sessions} icon={Car} color="blue" />
            <StatCard label="Obstructed" value={s.obstructed_sessions} icon={AlertTriangle} color="orange" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-break-avoid">
            {/* Hourly Distribution */}
            <div className="bg-white rounded-2xl card-shadow p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-teal-600" />
                <h3 className="text-[13px] font-bold text-slate-800">Hourly Activity</h3>
              </div>
              <div className="flex items-end gap-[3px] h-[120px]">
                {s.hourly_distribution.map((count, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className={`w-full rounded-t transition-all ${count === Math.max(...s.hourly_distribution) && count > 0 ? "bg-teal-500" : "bg-teal-200 group-hover:bg-teal-400"}`}
                      style={{ height: `${Math.max((count / hourlyMax) * 100, count > 0 ? 4 : 0)}%`, minHeight: count > 0 ? 3 : 0 }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:flex items-center bg-slate-800 text-white text-[10px] font-medium rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {count} entries
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-[3px] mt-1.5">
                {s.hourly_distribution.map((_, i) => (
                  <div key={i} className="flex-1 text-center text-[8px] text-slate-400">
                    {i % 3 === 0 ? formatHour(i) : ""}
                  </div>
                ))}
              </div>
            </div>

            {/* Duration Distribution */}
            <div className="bg-white rounded-2xl card-shadow p-5">
              <div className="flex items-center gap-2 mb-4">
                <Timer size={14} className="text-violet-600" />
                <h3 className="text-[13px] font-bold text-slate-800">Duration Breakdown</h3>
              </div>
              <div className="space-y-3">
                {durDist && [
                  { key: "under_30m", label: "< 30 min", color: "bg-emerald-400" },
                  { key: "30m_to_1h", label: "30 min \u2013 1 hr", color: "bg-teal-400" },
                  { key: "1h_to_2h", label: "1 \u2013 2 hrs", color: "bg-blue-400" },
                  { key: "2h_to_8h", label: "2 \u2013 8 hrs", color: "bg-amber-400" },
                  { key: "over_8h", label: "> 8 hrs", color: "bg-red-400" },
                ].map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 w-[80px] shrink-0 text-right">{label}</span>
                    <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-lg transition-all flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max((durDist[key] / durMax) * 100, durDist[key] > 0 ? 8 : 0)}%` }}
                      >
                        {durDist[key] > 0 && <span className="text-[10px] font-bold text-white">{durDist[key]}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Second row: Top Slots + Device/Alert summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print-break-avoid">
            {/* Top Slots */}
            <div className="lg:col-span-2 bg-white rounded-2xl card-shadow p-5">
              <div className="flex items-center gap-2 mb-4">
                <ParkingSquare size={14} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-slate-800">Most Active Slots</h3>
                <span className="text-[10px] text-slate-400 ml-auto">{s.unique_slots} unique slots used</span>
              </div>
              {s.top_slots.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">No slot data</p>
              ) : (
                <div className="space-y-2">
                  {s.top_slots.map((slot, i) => (
                    <div key={slot.label} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 w-5 text-right">{i + 1}</span>
                      <span className="text-[12px] font-semibold text-slate-700 w-16 font-mono shrink-0">{slot.label}</span>
                      <div className="flex-1 h-5 bg-slate-50 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded transition-all"
                          style={{ width: `${(slot.count / topSlotMax) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 w-10 text-right">{slot.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Device + Alert cards */}
            <div className="space-y-5">
              <div className="bg-white rounded-2xl card-shadow p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Monitor size={14} className="text-slate-600" />
                  <h3 className="text-[13px] font-bold text-slate-800">Devices</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center flex-1">
                    <p className="text-[22px] font-bold text-slate-800">{data.device_summary.total}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Total</p>
                  </div>
                  <div className="w-px h-10 bg-slate-100" />
                  <div className="text-center flex-1">
                    <p className="text-[22px] font-bold text-emerald-600">{data.device_summary.online}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Online</p>
                  </div>
                  <div className="w-px h-10 bg-slate-100" />
                  <div className="text-center flex-1">
                    <p className="text-[22px] font-bold text-red-500">{data.device_summary.offline}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Offline</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl card-shadow p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <h3 className="text-[13px] font-bold text-slate-800">Alerts</h3>
                  <span className="text-[10px] text-slate-400 ml-auto">{data.alert_summary.total} total</span>
                </div>
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
              </div>
            </div>
          </div>

          {/* Extra stat row */}
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
                    {["#", "Slot", "Type", "Area", "Location", "Camera", "Entry", "Exit", "Duration", "Status"].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                {/* Screen: paginated rows */}
                <tbody className="print-hide">
                  {pagedSessions.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-[12px] text-slate-400">No sessions in this period</td></tr>
                  ) : pagedSessions.map((sess: any, i: number) => (
                    <SessionRow key={i} sess={sess} index={(page - 1) * pageSize + i + 1} />
                  ))}
                </tbody>
                {/* Print: ALL rows */}
                <tbody className="screen-hide">
                  {sessions.map((sess: any, i: number) => (
                    <SessionRow key={i} sess={sess} index={i + 1} />
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="border-t border-slate-100 px-4 py-3 no-print">
                <Pagination page={page} totalPages={totalPages} total={sessions.length} pageSize={pageSize} onPageChange={setPage} />
              </div>
            )}
          </div>

          {/* Print footer */}
          <div className="print-footer hidden mt-6 pt-4 border-t border-slate-200 text-center">
            <p className="text-[9px] text-slate-400">AI Parking Management System &mdash; Confidential Report &mdash; Generated {new Date().toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    teal: { bg: "bg-teal-50", text: "text-teal-600" },
    red: { bg: "bg-red-50", text: "text-red-600" },
    violet: { bg: "bg-violet-50", text: "text-violet-600" },
    amber: { bg: "bg-amber-50", text: "text-amber-600" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    orange: { bg: "bg-orange-50", text: "text-orange-600" },
  };
  const c = colorMap[color] || colorMap.teal;
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

function SessionRow({ sess, index }: { sess: any; index: number }) {
  const isObs = sess.event_type === "OBSTRUCTED";
  const statusLabel = sess.is_active ? (isObs ? "Blocked" : "Parked") : (isObs ? "Cleared" : "Completed");
  const statusCls = sess.is_active
    ? (isObs ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50")
    : "text-emerald-600 bg-emerald-50";
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors print-row">
      <td className="px-3 py-2 text-[10px] text-slate-400 tabular-nums">{index}</td>
      <td className="px-3 py-2 text-[11px] font-semibold text-slate-800 font-mono">{sess.slot_label}</td>
      <td className="px-3 py-2">
        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${isObs ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50"}`}>
          {isObs ? "Obstructed" : "Vehicle"}
        </span>
      </td>
      <td className="px-3 py-2 text-[10px] text-slate-500">{sess.area_name || "\u2014"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600">{sess.location_name || "\u2014"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-500 font-mono">{sess.camera_label || "\u2014"}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600 whitespace-nowrap">{formatTime(sess.entry_time)}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600 whitespace-nowrap">{formatTime(sess.exit_time)}</td>
      <td className="px-3 py-2 text-[10px] text-slate-600">{formatDuration(sess.duration_minutes)}</td>
      <td className="px-3 py-2">
        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${statusCls}`}>{statusLabel}</span>
      </td>
    </tr>
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
