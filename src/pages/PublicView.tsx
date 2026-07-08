import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  ParkingSquare, AlertTriangle, Car, Bike, Eye, Bug, Search, MapPin,
  ArrowDownToLine, ArrowUpFromLine, Loader2, Image as ImageIcon, ScanLine, Clock,
} from "lucide-react";
import { publicViewApi } from "@/services/api";
import Pagination from "@/components/Pagination";
import type { PublicViewResponse, ViewConfig, ParkingScan, AnprRecord, AnprSession, OccupancySummary, AnprReport, ParkingReport } from "@/types/api";
import { Skel } from "@/components/Skeleton";

const PAGE_LABELS: Record<string, string> = {
  dashboard_parking: "AI Parking",
  dashboard_anpr: "ANPR Dashboard",
  parking_history: "AI Parking History",
  anpr_records: "ANPR Records",
  anpr_history: "ANPR History",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  // Round to nearest 5 minutes
  const min = d.getMinutes();
  const rounded = Math.round(min / 5) * 5;
  if (rounded === 60) { d.setHours(d.getHours() + 1); d.setMinutes(0); }
  else { d.setMinutes(rounded); }
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function hasField(vc: ViewConfig | null, page: string, field: string): boolean {
  if (!vc?.fields?.[page]) return true;
  return vc.fields[page].includes(field);
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function PublicViewSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Skel className="w-8 h-8 rounded-xl" />
          <div><Skel className="w-40 h-4 mb-1.5" /><Skel className="w-24 h-2.5" /></div>
        </div>
      </header>
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4 animate-pulse">
          <Skel className="h-28 rounded-2xl" /><Skel className="h-28 rounded-2xl" />
        </div>
      </div>
      <main className="px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl card-shadow overflow-hidden animate-pulse">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2"><Skel className="w-4 h-4 rounded" /><Skel className="w-28 h-3.5" /></div>
              <div className="flex"><div className="w-4/5 p-3"><Skel className="w-full h-56 rounded-lg" /></div><div className="w-1/5 flex flex-col gap-3 p-4"><Skel className="flex-1 rounded-xl" /><Skel className="flex-1 rounded-xl" /></div></div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ─── First-load skeleton for the report tabs (AI Parking + ANPR) ─── */
function ReportCardSkel() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <Skel className="w-16 h-3 mb-2" />
      <Skel className="w-14 h-7" />
    </div>
  );
}
function ReportTabSkeleton({ kpi = false }: { kpi?: boolean }) {
  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-4 animate-pulse">
        {/* Title */}
        <Skel className="w-56 h-7" />
        {/* KPI row (ANPR only) */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <ReportCardSkel key={i} />)}
          </div>
        )}
        {/* Cars */}
        <Skel className="w-24 h-4" />
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <ReportCardSkel key={i} />)}</div>
        {/* 2 Wheeler */}
        <Skel className="w-24 h-4" />
        <div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <ReportCardSkel key={i} />)}</div>
        {/* Charts 60/40 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white rounded-2xl card-shadow p-6">
            <Skel className="w-40 h-5 mb-6" />
            <Skel className="w-full h-[180px] rounded-xl" />
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl card-shadow p-6">
            <Skel className="w-32 h-5 mb-6" />
            <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skel key={i} className="w-full h-8 rounded-lg" />)}</div>
          </div>
        </div>
        {/* Table */}
        <Skel className="w-44 h-4" />
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="h-11 bg-slate-50 border-b border-slate-100" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3.5 border-b border-slate-50">
              <Skel className="w-12 h-12 rounded-lg shrink-0" />
              <Skel className="w-28 h-4" />
              <Skel className="w-16 h-4" />
              <Skel className="flex-1 h-4" />
              <Skel className="w-16 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard Parking Tab ─── */
function DashboardParkingTab({ data }: { data: PublicViewResponse }) {
  const [showDebug, setShowDebug] = useState(false);
  const allSlots = data.locations.flatMap((l) => l.cameras.flatMap((c) => c.slots));
  const totalCapCar = allSlots.reduce((s, sl) => s + (sl.capacity_car || 0), 0);
  const totalCap2w = allSlots.reduce((s, sl) => s + (sl.capacity_two_wheeler || 0), 0);
  const totalOccCar = allSlots.reduce((s, sl) => s + (sl.occupied_car || 0), 0);
  const totalOcc2w = allSlots.reduce((s, sl) => s + (sl.occupied_two_wheeler || 0), 0);
  const totalAvailCar = Math.max(0, totalCapCar - totalOccCar);
  const totalAvail2w = Math.max(0, totalCap2w - totalOcc2w);

  return (
    <>
      <div className="shrink-0 px-4 sm:px-6 py-3 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4">
          {/* Cars box */}
          <div className="bg-blue-50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-center gap-3 py-3 border-b border-blue-100">
              <Car size={32} className="text-blue-500" />
              <span className="text-[22px] font-bold text-blue-600">Cars</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-blue-100">
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Occupied</p><p className="text-[28px] font-bold text-red-500 leading-tight">{totalOccCar}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available</p><p className="text-[28px] font-bold text-emerald-600 leading-tight">{totalAvailCar}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</p><p className="text-[28px] font-bold text-blue-600 leading-tight">{totalCapCar}</p></div>
            </div>
          </div>
          {/* Two Wheeler box */}
          <div className="bg-indigo-50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-center gap-3 py-3 border-b border-indigo-100">
              <Bike size={32} className="text-indigo-500" />
              <span className="text-[22px] font-bold text-indigo-600">Two Wheeler</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-indigo-100">
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Occupied</p><p className="text-[28px] font-bold text-red-500 leading-tight">{totalOcc2w}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available</p><p className="text-[28px] font-bold text-emerald-600 leading-tight">{totalAvail2w}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</p><p className="text-[28px] font-bold text-indigo-600 leading-tight">{totalCap2w}</p></div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {data.locations.map((location) => (
            <section key={location.id}>
              {data.locations.length > 1 && <h2 className="text-[15px] font-bold text-slate-900 mb-3">{location.name}</h2>}
              <div className="space-y-4">
                {location.cameras.map((cam) => {
                  const camOccCar = cam.slots.reduce((s, sl) => s + (sl.occupied_car || 0), 0);
                  const camOcc2w = cam.slots.reduce((s, sl) => s + (sl.occupied_two_wheeler || 0), 0);
                  const camCapCar = cam.slots.reduce((s, sl) => s + (sl.capacity_car || 0), 0);
                  const camCap2w = cam.slots.reduce((s, sl) => s + (sl.capacity_two_wheeler || 0), 0);
                  const availCar = Math.max(0, camCapCar - camOccCar);
                  const avail2w = Math.max(0, camCap2w - camOcc2w);
                  return (
                    <div key={cam.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ParkingSquare size={14} className="text-teal-600" />
                          <h3 className="text-[13px] font-bold text-slate-900">{cam.position_label}</h3>
                          {location.name && <span className="text-[11px] text-slate-400 font-medium">{location.name}</span>}
                        </div>
                      </div>
                      <div className="flex" style={{ height: "calc(100vh - 180px)", maxHeight: 600 }}>
                        <div className="w-4/5 bg-slate-900 relative flex items-center justify-center">
                          {(() => {
                            const imgSrc = showDebug ? (cam.debug_frame_url || cam.clean_frame_url) : (cam.clean_frame_url || cam.debug_frame_url);
                            return imgSrc ? <img src={`${imgSrc}?t=${Date.now()}`} alt={cam.position_label} className="w-full h-full object-contain" /> : <p className="text-slate-500 text-[12px]">No image available</p>;
                          })()}
                          <button onClick={() => setShowDebug((v) => !v)} className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${showDebug ? "bg-amber-500 text-white" : "bg-white/80 text-slate-600 hover:bg-white"}`}>
                            {showDebug ? <Bug size={12} /> : <Eye size={12} />} {showDebug ? "Debug" : "Clean"}
                          </button>
                        </div>
                        <div className="w-1/5 flex flex-col gap-3 p-4">
                          {/* Cars stats */}
                          <div className="bg-blue-50/60 rounded-xl flex-1 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-center gap-2.5 py-3.5 border-b border-blue-100"><Car size={32} className="text-blue-500" /><p className="text-[22px] text-blue-600 font-bold">Cars</p></div>
                            <div className="flex border-b border-blue-100 bg-blue-50/80"><span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Status</span><span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Count</span></div>
                            <div className="flex border-b border-blue-50 py-3"><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Occupied</span><span className="flex-1 text-center text-[26px] font-bold text-red-500 leading-none">{camOccCar}</span></div>
                            <div className="flex border-b border-blue-50 py-3"><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Available</span><span className="flex-1 text-center text-[26px] font-bold text-emerald-600 leading-none">{availCar}</span></div>
                            <div className="flex py-3"><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Total</span><span className="flex-1 text-center text-[26px] font-bold text-blue-600 leading-none">{camCapCar}</span></div>
                          </div>
                          {/* 2W stats */}
                          <div className="bg-indigo-50/60 rounded-xl flex-1 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-center gap-2.5 py-3.5 border-b border-indigo-100"><Bike size={32} className="text-indigo-500" /><p className="text-[22px] text-indigo-600 font-bold">Two Wheeler</p></div>
                            <div className="flex border-b border-indigo-100 bg-indigo-50/80"><span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Status</span><span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Count</span></div>
                            <div className="flex border-b border-indigo-50 py-3"><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Occupied</span><span className="flex-1 text-center text-[26px] font-bold text-red-500 leading-none">{camOcc2w}</span></div>
                            <div className="flex border-b border-indigo-50 py-3"><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Available</span><span className="flex-1 text-center text-[26px] font-bold text-emerald-600 leading-none">{avail2w}</span></div>
                            <div className="flex py-3"><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Total</span><span className="flex-1 text-center text-[26px] font-bold text-indigo-600 leading-none">{camCap2w}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {data.locations.length === 0 && <div className="text-center py-16"><p className="text-[14px] text-slate-400">No parking data available for this link.</p></div>}
        </div>
      </main>
    </>
  );
}

/* ─── ANPR Dashboard Tab ─── */
function AnprDashboardTab({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try { const { data: d } = await publicViewApi.anprDashboard(token); setData(d); } catch { /* */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, [fetchData]);

  if (loading || !data) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-teal-500" /></div>;

  const s = data.summary;
  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-center gap-3 py-3 border-b border-blue-100"><Car size={32} className="text-blue-500" /><span className="text-[22px] font-bold text-blue-600">Cars</span></div>
            <div className="grid grid-cols-3 divide-x divide-blue-100">
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Occupied</p><p className="text-[28px] font-bold text-red-500 leading-tight">{s.car_occupied}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available</p><p className="text-[28px] font-bold text-emerald-600 leading-tight">{s.car_available}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</p><p className="text-[28px] font-bold text-blue-600 leading-tight">{s.car_total}</p></div>
            </div>
          </div>
          <div className="bg-indigo-50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-center gap-3 py-3 border-b border-indigo-100"><Bike size={32} className="text-indigo-500" /><span className="text-[22px] font-bold text-indigo-600">Two Wheeler</span></div>
            <div className="grid grid-cols-3 divide-x divide-indigo-100">
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Occupied</p><p className="text-[28px] font-bold text-red-500 leading-tight">{s.two_wheeler_occupied}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available</p><p className="text-[28px] font-bold text-emerald-600 leading-tight">{s.two_wheeler_available}</p></div>
              <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</p><p className="text-[28px] font-bold text-indigo-600 leading-tight">{s.two_wheeler_total}</p></div>
            </div>
          </div>
        </div>
        {data.locations?.length > 0 && (
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-[16px] font-bold text-slate-900">Locations</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Occupancy</th>
                </tr></thead>
                <tbody>
                  {data.locations.map((loc: any, idx: number) => (
                    <tr key={loc.location_id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                      <td className="px-6 py-3 text-[13px] font-semibold text-slate-800">{loc.location_name}</td>
                      <td className="px-3 py-3 text-center"><span className={`text-[16px] font-bold ${loc.car_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{loc.car_occupied}</span></td>
                      <td className="px-3 py-3 text-center text-[16px] font-bold text-emerald-600">{loc.car_available}</td>
                      <td className="px-3 py-3 text-center"><span className={`text-[16px] font-bold ${loc.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{loc.two_wheeler_occupied}</span></td>
                      <td className="px-3 py-3 text-center text-[16px] font-bold text-emerald-600">{loc.two_wheeler_available}</td>
                      <td className="px-3 py-3 text-center text-[12px] font-bold text-slate-500">{loc.occupancy_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── AI Parking report charts (mirror the PDF) ─── */
function hourLabel(h: number): string {
  if (h === 12) return "12pm";
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}
function hourLabelFull(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

/** Client-side fallback for the AI Parking report — mirrors the backend's
 *  build_parking_report so the chart/stats render even if the API omits `report`. */
function computeParkingReport(scans: ParkingScan[]): ParkingReport {
  const hourly: ParkingReport["hourly"] = [];
  for (let h = 10; h <= 18; h++) {
    let best: ParkingScan | null = null;
    let bestDiff = Infinity;
    for (const s of scans) {
      if (!s.recorded_at) continue;
      const d = new Date(s.recorded_at);
      const diff = Math.abs((d.getHours() * 60 + d.getMinutes()) - h * 60);
      if (diff < bestDiff && diff <= 30) { bestDiff = diff; best = s; }
    }
    hourly.push({
      hour: h,
      occ_car: best?.car_occupied ?? 0,
      tot_car: best?.car_total ?? 0,
      occ_bike: best?.two_wheeler_occupied ?? 0,
      tot_bike: best?.two_wheeler_total ?? 0,
    });
  }
  const hourlyOcc: Record<number, number> = {};
  hourly.forEach((d) => { hourlyOcc[d.hour] = d.occ_car + d.occ_bike; });
  let peakVal = 0, peakHour = -1;
  for (const [h, v] of Object.entries(hourlyOcc)) { if (v > peakVal) { peakVal = v; peakHour = Number(h); } }

  const allCar: number[] = [], all2w: number[] = [];
  let maxCars = 0, max2w = 0, peakPct = 0;
  for (const s of scans) {
    const carPct = s.car_total > 0 ? Math.min(100, Math.round((s.car_occupied / s.car_total) * 100)) : 0;
    const bikePct = s.two_wheeler_total > 0 ? Math.min(100, Math.round((s.two_wheeler_occupied / s.two_wheeler_total) * 100)) : 0;
    peakPct = Math.max(peakPct, carPct, bikePct);
    maxCars = Math.max(maxCars, s.car_occupied);
    max2w = Math.max(max2w, s.two_wheeler_occupied);
    if (s.car_total > 0) allCar.push(carPct);
    if (s.two_wheeler_total > 0) all2w.push(bikePct);
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return {
    hourly,
    stats: {
      peak_hour_label: peakVal > 0 ? hourLabelFull(peakHour) : "-",
      peak_hour_count: peakVal,
      peak_occupancy_pct: peakPct,
      avg_car_occ: avg(allCar),
      avg_2w_occ: avg(all2w),
      max_cars: maxCars,
      max_2w: max2w,
    },
  };
}

function HourlyOccupancyChart({ hourly }: { hourly: ParkingReport["hourly"] }) {
  const max = Math.max(1, ...hourly.map((h) => h.occ_car), ...hourly.map((h) => h.occ_bike));
  const hasData = hourly.some((h) => h.occ_car > 0 || h.occ_bike > 0);
  return (
    <div className="bg-white rounded-2xl card-shadow p-6 h-full">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-extrabold text-slate-900">Hourly Occupancy</h3>
          <div className="w-24 h-1 bg-teal-500 rounded-full mt-2" />
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="flex items-center gap-1 text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Car</span>
          <span className="flex items-center gap-1 text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> 2W</span>
        </div>
      </div>
      {!hasData ? (
        <p className="text-[13px] text-slate-400 text-center py-16">No occupancy in this window</p>
      ) : (<>
        <div className="flex items-end gap-3 h-[230px] border-b border-slate-100">
          {hourly.map((h, i) => (
            <div key={i} className="flex-1 flex items-end justify-center gap-[3px] h-full group relative">
              <div className="w-1/2 max-w-[22px] bg-blue-500 rounded-t transition-all" style={{ height: `${(h.occ_car / max) * 100}%`, minHeight: h.occ_car > 0 ? 4 : 0 }} />
              <div className="w-1/2 max-w-[22px] bg-indigo-500 rounded-t transition-all" style={{ height: `${(h.occ_bike / max) * 100}%`, minHeight: h.occ_bike > 0 ? 4 : 0 }} />
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap z-10">{hourLabel(h.hour)}: Car {h.occ_car} · 2W {h.occ_bike}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-2">
          {hourly.map((h, i) => <div key={i} className="flex-1 text-center text-[12px] font-medium text-slate-400">{hourLabel(h.hour)}</div>)}
        </div>
      </>)}
    </div>
  );
}

function OccupancySummaryStats({ stats }: { stats: ParkingReport["stats"] }) {
  const tiles = [
    { label: "Peak Hour", value: stats.peak_hour_label, sub: stats.peak_hour_count ? `${stats.peak_hour_count} occupied` : undefined, border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
    { label: "Peak Occupancy", value: `${stats.peak_occupancy_pct}%`, border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-700" },
    { label: "Avg Car Occ", value: `${stats.avg_car_occ}%`, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
    { label: "Avg 2W Occ", value: `${stats.avg_2w_occ}%`, border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700" },
    { label: "Max Cars", value: String(stats.max_cars), border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
    { label: "Max 2W", value: String(stats.max_2w), border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700" },
  ];
  return (
    <div className="bg-white rounded-2xl card-shadow p-6 h-full">
      <div className="mb-6">
        <h3 className="text-[16px] font-extrabold text-slate-900">Summary</h3>
        <div className="w-24 h-1 bg-teal-500 rounded-full mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-xl border ${t.border} ${t.bg} p-3`}>
            <p className="text-[10px] font-semibold text-slate-500 mb-1">{t.label}</p>
            <p className={`text-[22px] font-bold leading-none ${t.text}`}>{t.value}</p>
            {t.sub && <p className="text-[10px] text-slate-400 mt-1">{t.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Parking History Tab (same UI as ParkingScanHistory) ─── */
function ParkingHistoryTab({ token, viewConfig }: { token: string; viewConfig: ViewConfig | null }) {
  const [scans, setScans] = useState<ParkingScan[]>([]);
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  useEffect(() => {
    if (!previewImg) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewImg(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImg]);
  const pageSize = 20;
  const f = (field: string) => hasField(viewConfig, "parking_history", field);

  const dateFilter = (viewConfig as any)?.date_filter || "today";

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      const win = new URLSearchParams(); // window shared by the table + report (chart/stats)
      if (dateFilter === "today") {
        // Show only 10 AM – 6 PM, sampled every 5 min
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
        p.set("start_date", todayStart.toISOString());
        p.set("end_date", todayEnd.toISOString());
        p.set("interval_minutes", "5");
        win.set("start_date", todayStart.toISOString());
        win.set("end_date", todayEnd.toISOString());
      }
      const [scanRes, summaryRes] = await Promise.all([
        publicViewApi.parkingHistory(token, p.toString()),
        publicViewApi.occupancySummary(token, win.toString()),
      ]);
      const items = scanRes.data.items || [];
      setScans(items);
      setTotal(scanRes.data.total || 0);
      setTotalPages(scanRes.data.total_pages || 0);

      // Chart/stats report — from the API when present, else computed client-side
      // from the full window's scans (so the chart renders regardless of backend).
      let report = summaryRes.data.report;
      if (!report) {
        try {
          const allP = new URLSearchParams(win);
          allP.set("page_size", "100"); // endpoint caps at 100; 96 five-min samples cover 10 AM-6 PM
          if (dateFilter === "today") allP.set("interval_minutes", "5");
          const allRes = await publicViewApi.parkingHistory(token, allP.toString());
          report = computeParkingReport(allRes.data.items || []);
        } catch { /* leave report undefined */ }
      }

      const s = summaryRes.data;
      setSummary({ ...s, report });
    } catch { /* */ }
    setLoading(false);
  }, [token, page]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);

  if (loading && !summary) return <ReportTabSkeleton />;

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header: title + location + updated badge */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold text-slate-900">Parking Occupancy Report</h1>
            {summary?.location_name && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span className="text-[13px] text-slate-500">{summary.location_name}</span>
              </div>
            )}
          </div>
          {summary?.updated_at && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Updated {summary.updated_at}
            </span>
          )}
        </div>

        {/* Cars + Bikes summary cards (PDF style) */}
        {summary && (<>
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">Cars</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total cars", value: summary.car_total, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
                { label: "Occupied", value: summary.car_occupied, border: "border-red-200", bg: "bg-red-50", text: "text-red-500" },
                { label: "Available", value: summary.car_available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
                { label: "Occupancy", value: `${summary.car_total > 0 ? Math.min(100, Math.round((summary.car_occupied / summary.car_total) * 100)) : 0}%`, border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
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
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total 2W", value: summary.two_wheeler_total, border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700" },
                { label: "Occupied", value: summary.two_wheeler_occupied, border: "border-red-200", bg: "bg-red-50", text: "text-red-500" },
                { label: "Available", value: summary.two_wheeler_available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
                { label: "Occupancy", value: `${summary.two_wheeler_total > 0 ? Math.min(100, Math.round((summary.two_wheeler_occupied / summary.two_wheeler_total) * 100)) : 0}%`, border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
              ].map(({ label, value, border, bg, text }) => (
                <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
                  <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chart + stats, 60 / 40 — same as the PDF export */}
          {summary.report && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
              <div className="lg:col-span-3"><HourlyOccupancyChart hourly={summary.report.hourly} /></div>
              <div className="lg:col-span-2"><OccupancySummaryStats stats={summary.report.stats} /></div>
            </div>
          )}

          <p className="text-[14px] font-bold text-slate-700">Occupancy records ({total})</p>
        </>)}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden relative">
          {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal-500" /></div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50/80 border-b border-slate-100">
                {f("image") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Snapshot</th>}
                {f("date") && <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>}
                {f("car_occupied") && <th className="text-center px-3 py-3 text-[11px] font-bold text-red-400 uppercase tracking-wider">Car Occ</th>}
                {f("car_available") && <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Car Avail</th>}
                {f("car_total") && <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Total</th>}
                {f("2w_occupied") && <th className="text-center px-3 py-3 text-[11px] font-bold text-red-400 uppercase tracking-wider">2W Occ</th>}
                {f("2w_available") && <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">2W Avail</th>}
                {f("2w_total") && <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Total</th>}
              </tr></thead>
              <tbody>
                {scans.length === 0 && !loading ? (
                  <tr><td colSpan={11} className="text-center py-16 text-slate-400"><div className="flex flex-col items-center"><div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Clock size={24} className="text-slate-300" /></div><p className="text-[14px] font-semibold">No parking scans found</p></div></td></tr>
                ) : scans.map((s, idx) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                    {f("image") && <td className="px-4 py-3">{s.image_url ? <button onClick={() => setPreviewImg(s.image_url)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors"><img src={s.image_url} alt="" className="w-full h-full object-cover" /></button> : <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center"><ImageIcon size={14} className="text-slate-300" /></div>}</td>}
                    {f("date") && <td className="px-3 py-3"><p className="text-[12px] font-semibold text-slate-700">{formatDate(s.recorded_at)}</p><p className="text-[11px] text-slate-400">{formatTime(s.recorded_at)}</p></td>}
                    {f("car_occupied") && <td className="px-3 py-3 text-center"><span className={`text-[16px] font-bold ${s.car_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.car_occupied}</span></td>}
                    {f("car_available") && <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-emerald-600">{s.car_available}</span></td>}
                    {f("car_total") && <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-blue-700">{s.car_total}</span></td>}
                    {f("2w_occupied") && <td className="px-3 py-3 text-center"><span className={`text-[16px] font-bold ${s.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.two_wheeler_occupied}</span></td>}
                    {f("2w_available") && <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-emerald-600">{s.two_wheeler_available}</span></td>}
                    {f("2w_total") && <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-indigo-700">{s.two_wheeler_total}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} /></div>}
        </div>
      </div>
      {previewImg && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewImg(null)}><div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}><img src={previewImg} alt="Scan" className="rounded-xl shadow-2xl max-h-[85vh] object-contain" /></div></div>}
    </div>
  );
}

/* ─── ANPR Records Tab (same UI as AnprRecords page) ─── */
function AnprRecordsTab({ token, viewConfig }: { token: string; viewConfig: ViewConfig | null }) {
  const [records, setRecords] = useState<AnprRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plateSearch, setPlateSearch] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  useEffect(() => {
    if (!previewImg) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewImg(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImg]);
  const pageSize = 20;
  const f = (field: string) => hasField(viewConfig, "anpr_records", field);
  const dateFilter = (viewConfig as any)?.date_filter || "today";

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (dateFilter === "today") {
        const { start, end } = getTodayRange();
        p.set("start_date", start);
        p.set("end_date", end);
      }
      if (plateSearch) p.set("number_plate", plateSearch);
      const { data } = await publicViewApi.anprRecords(token, p.toString());
      setRecords(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 0);
    } catch { /* */ }
    setLoading(false);
  }, [token, page, plateSearch]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => { setPage(1); }, [plateSearch]);

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search plate..." value={plateSearch} onChange={(e) => setPlateSearch(e.target.value.toUpperCase())} className="w-full pl-9 pr-3 h-9 text-[12px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 card-shadow" />
        </div>
        <div className="bg-white rounded-2xl card-shadow overflow-hidden relative">
          {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal-500" /></div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50/80 border-b border-slate-100">
                {f("image") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>}
                {f("number_plate") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Number Plate</th>}
                {f("vehicle_type") && <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>}
                {f("direction") && <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Direction</th>}
                {f("date_time") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>}
                {f("gemini") && <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gemini</th>}
                {f("paddle") && <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Paddle</th>}
                {f("location") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>}
              </tr></thead>
              <tbody>
                {records.length === 0 && !loading ? (
                  <tr><td colSpan={8} className="text-center py-20 text-slate-400"><div className="flex flex-col items-center"><div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Search size={24} className="text-slate-300" /></div><p className="text-[14px] font-semibold">No records found</p></div></td></tr>
                ) : records.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                    {f("image") && <td className="px-4 py-3">{r.image_url ? <button onClick={() => setPreviewImg(r.image_url)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors"><img src={r.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></button> : <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center"><ImageIcon size={16} className="text-slate-300" /></div>}</td>}
                    {f("number_plate") && <td className="px-4 py-3"><span className={`text-[13px] font-bold ${r.number_plate === "N/A" ? "text-slate-400" : "text-teal-700"}`}>{r.number_plate || "N/A"}</span></td>}
                    {f("vehicle_type") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2 py-1 ${r.vehicle_type === "CAR" ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"}`}>{r.vehicle_type === "CAR" ? <Car size={12} /> : <Bike size={12} />} {r.vehicle_type === "CAR" ? "Car" : "2W"}</span></td>}
                    {f("direction") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1 ${r.direction === "IN" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}>{r.direction === "IN" ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />} {r.direction}</span></td>}
                    {f("date_time") && <td className="px-4 py-3"><div><p className="text-[12px] font-semibold text-slate-700">{formatDate(r.recorded_at)}</p><p className="text-[11px] text-slate-400">{formatTime(r.recorded_at)}</p></div></td>}
                    {f("gemini") && <td className="px-3 py-3"><span className={`text-[11px] font-mono ${r.gemini_result ? "text-slate-700" : "text-slate-300"}`}>{r.gemini_result || "—"}</span>{r.confidence_gemini != null && r.confidence_gemini > 0 && <span className="text-[9px] text-slate-400 ml-1">({(r.confidence_gemini * 100).toFixed(0)}%)</span>}</td>}
                    {f("paddle") && <td className="px-3 py-3"><span className={`text-[11px] font-mono ${r.paddle_result ? "text-slate-700" : "text-slate-300"}`}>{r.paddle_result || "—"}</span>{r.confidence_paddle != null && r.confidence_paddle > 0 && <span className="text-[9px] text-slate-400 ml-1">({(r.confidence_paddle * 100).toFixed(0)}%)</span>}</td>}
                    {f("location") && <td className="px-4 py-3"><span className="text-[12px] text-slate-600">{r.location_name || "—"}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="border-t border-slate-100 px-6 py-3"><Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} /></div>}
        </div>
      </div>
      {previewImg && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewImg(null)}><div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}><img src={previewImg} alt="ANPR capture" className="max-w-full max-h-[85vh] object-contain" /></div></div>}
    </div>
  );
}

/* ─── ANPR report charts (mirror the PDF) ─── */
function HourlyEntryChart({ chart }: { chart: AnprReport["analytics"]["chart"] }) {
  const max = Math.max(1, ...chart.in);
  return (
    <div className="bg-white rounded-2xl card-shadow p-6 h-full">
      <div className="mb-6">
        <h3 className="text-[16px] font-extrabold text-slate-900">Hourly Entry Pattern</h3>
        <div className="w-24 h-1 bg-teal-500 rounded-full mt-2" />
      </div>
      {chart.labels.length === 0 ? (
        <p className="text-[13px] text-slate-400 text-center py-16">No entries in this window</p>
      ) : (
        <div className="flex items-end gap-3 h-[180px] border-b border-slate-100">
          {chart.labels.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[11px] font-bold text-slate-600 mb-1">{chart.in[i] > 0 ? chart.in[i] : ""}</span>
              <div
                className="w-full max-w-[54px] bg-violet-500 rounded-lg transition-all"
                style={{ height: `${(chart.in[i] / max) * 100}%`, minHeight: chart.in[i] > 0 ? 6 : 0 }}
                title={`${label}: ${chart.in[i]} entries`}
              />
            </div>
          ))}
        </div>
      )}
      {chart.labels.length > 0 && (
        <div className="flex gap-3 mt-2">
          {chart.labels.map((label, i) => (
            <div key={i} className="flex-1 text-center text-[10px] font-medium text-slate-400">{label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function DurationBreakdownChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const colors = ["bg-emerald-400", "bg-teal-400", "bg-blue-400", "bg-amber-400", "bg-red-400"];
  return (
    <div className="bg-white rounded-2xl card-shadow p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-[16px] font-extrabold text-slate-900">Duration Breakdown</h3>
        <div className="w-24 h-1 bg-teal-500 rounded-full mt-2" />
      </div>
      {/* Rows spread to fill the card height (matches the taller chart beside it) */}
      <div className="flex-1 flex flex-col justify-between gap-4 py-1">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-[12px] text-slate-500 w-[72px] shrink-0 text-right">{d.label}</span>
            <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden">
              <div className={`h-full ${colors[i % colors.length]} rounded-lg transition-all`} style={{ width: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0)}%` }} />
            </div>
            <span className="text-[13px] font-bold text-slate-700 w-6 text-right shrink-0">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ANPR History Tab (same UI as AnprHistory page) ─── */
function AnprHistoryTab({ token, viewConfig }: { token: string; viewConfig: ViewConfig | null }) {
  const [sessions, setSessions] = useState<AnprSession[]>([]);
  const [report, setReport] = useState<AnprReport | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plateSearch, setPlateSearch] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  useEffect(() => {
    if (!previewImg) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewImg(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImg]);
  const pageSize = 20;
  const f = (field: string) => hasField(viewConfig, "anpr_history", field);
  const dateFilter = (viewConfig as any)?.date_filter || "today";

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      const win = new URLSearchParams(); // date window shared by the table + report
      if (dateFilter === "today") {
        // 10 AM – 6 PM only
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
        win.set("start_date", todayStart.toISOString());
        win.set("end_date", todayEnd.toISOString());
      }
      win.forEach((v, k) => p.set(k, v));
      if (plateSearch) p.set("number_plate", plateSearch);

      // Table = current page; report (cards + charts) = single windowed call.
      const [sessRes, dashRes] = await Promise.all([
        publicViewApi.anprSessions(token, p.toString()),
        publicViewApi.anprDashboard(token, win.toString()).catch(() => ({ data: null })),
      ]);
      setSessions(sessRes.data.items || []);
      setTotal(sessRes.data.total || 0);
      setTotalPages(sessRes.data.total_pages || 0);
      setReport(dashRes.data?.report || null);
    } catch { /* */ }
    setLoading(false);
  }, [token, page, plateSearch]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => { setPage(1); }, [plateSearch]);

  if (loading && sessions.length === 0) return <ReportTabSkeleton kpi />;

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header: title + updated badge */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold text-slate-900">ANPR Sessions Report</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Updated {new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
          </span>
        </div>

        {/* Report cards + charts (PDF style) */}
        {report && (<>
          {/* KPI row: Occupancy / Revenue / Accuracy */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Occupancy</p>
              <p className="text-[28px] font-bold leading-none text-teal-700">{report.summary.occupancy_pct}%</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Revenue</p>
              <p className="text-[28px] font-bold leading-none text-emerald-700">₹{report.summary.revenue}</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Accuracy</p>
              <p className="text-[28px] font-bold leading-none text-violet-700">{report.summary.accuracy_pct}%</p>
            </div>
          </div>

          {/* Cars */}
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">Cars</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total cars", value: report.summary.car.total, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
                { label: "In", value: report.summary.car.in, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600" },
                { label: "Out", value: report.summary.car.out, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
                { label: "Available", value: report.summary.car.available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
              ].map(({ label, value, border, bg, text }) => (
                <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
                  <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2 Wheeler */}
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">2 Wheeler</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total 2W", value: report.summary.bike.total, border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700" },
                { label: "In", value: report.summary.bike.in, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600" },
                { label: "Out", value: report.summary.bike.out, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
                { label: "Available", value: report.summary.bike.available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
              ].map(({ label, value, border, bg, text }) => (
                <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
                  <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Charts side by side, 60 / 40 — same as the PDF export */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
            <div className="lg:col-span-3"><HourlyEntryChart chart={report.analytics.chart} /></div>
            <div className="lg:col-span-2"><DurationBreakdownChart data={report.analytics.duration} /></div>
          </div>
        </>)}

        {/* Session records */}
        <p className="text-[14px] font-bold text-slate-700">Session records ({total})</p>
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search number plate..." value={plateSearch} onChange={(e) => setPlateSearch(e.target.value.toUpperCase())} className="w-full pl-9 pr-3 h-9 text-[12px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 card-shadow" />
        </div>
        <div className="bg-white rounded-2xl card-shadow overflow-hidden relative">
          {loading && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal-500" /></div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50/80 border-b border-slate-100">
                {f("image") && <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>}
                {f("number_plate") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Number Plate</th>}
                {f("vehicle_type") && <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>}
                {f("entry_time") && <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">In Time</th>}
                {f("exit_time") && <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Out Time</th>}
                {f("duration") && <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Duration</th>}
                <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Revenue</th>
                {f("status") && <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>}
                {f("location") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>}
              </tr></thead>
              <tbody>
                {sessions.length === 0 && !loading ? (
                  <tr><td colSpan={8} className="text-center py-20 text-slate-400"><div className="flex flex-col items-center"><div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Car size={24} className="text-slate-300" /></div><p className="text-[14px] font-semibold">No ANPR sessions found</p><p className="text-[12px] text-slate-400 mt-0.5">Adjust your filters or date range</p></div></td></tr>
                ) : sessions.map((s, idx) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                    {f("image") && <td className="px-6 py-3">{s.entry_image_url ? <button onClick={() => setPreviewImg(s.entry_image_url)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors"><img src={s.entry_image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></button> : <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center"><ImageIcon size={16} className="text-slate-300" /></div>}</td>}
                    {f("number_plate") && <td className="px-4 py-3"><span className={`text-[14px] font-bold font-mono tracking-wide ${s.number_plate === "N/A" ? "text-slate-400" : "text-teal-700"}`}>{s.number_plate}</span></td>}
                    {f("vehicle_type") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${s.vehicle_type === "CAR" ? "text-blue-700 bg-blue-50" : "text-indigo-700 bg-indigo-50"}`}>{s.vehicle_type === "CAR" ? <Car size={11} /> : <Bike size={11} />} {s.vehicle_type === "CAR" ? "Car" : "2W"}</span></td>}
                    {f("entry_time") && <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1.5"><ArrowDownToLine size={12} className="text-blue-400" /><div><p className="text-[13px] font-semibold text-slate-700">{formatDate(s.entry_time)}</p><p className="text-[12px] text-slate-500 font-medium">{formatTime(s.entry_time)}</p></div></div></td>}
                    {f("exit_time") && <td className="px-4 py-3 text-center">{s.exit_time ? <div className="flex items-center justify-center gap-1.5"><ArrowUpFromLine size={12} className="text-red-400" /><div><p className="text-[13px] font-semibold text-slate-700">{formatDate(s.exit_time)}</p><p className="text-[12px] text-slate-500 font-medium">{formatTime(s.exit_time)}</p></div></div> : <span className="text-[12px] text-slate-300">—</span>}</td>}
                    {f("duration") && <td className="px-3 py-3 text-center"><span className={`text-[12px] font-semibold ${s.duration_display ? "text-slate-700" : "text-teal-600"}`}>{s.duration_display || "Active"}</span></td>}
                    <td className="px-3 py-3 text-center"><span className={`text-[13px] font-bold ${s.revenue && s.revenue !== "-" ? "text-emerald-700" : "text-slate-300"}`}>{s.revenue && s.revenue !== "-" ? `₹${s.revenue}` : "—"}</span></td>
                    {f("status") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${s.is_active ? "text-teal-700 bg-teal-50" : "text-emerald-700 bg-emerald-50"}`}><span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? "bg-teal-500 animate-pulse" : "bg-emerald-500"}`} />{s.is_active ? "Parked" : "Completed"}</span></td>}
                    {f("location") && <td className="px-4 py-3"><span className="text-[13px] text-slate-600">{s.location_name || "—"}</span></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} /></div>
        </div>
      </div>
      {previewImg && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewImg(null)}><div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}><button onClick={() => setPreviewImg(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors"><span className="text-slate-600 text-[14px] font-bold">×</span></button><img src={previewImg} alt="Vehicle" className="rounded-xl shadow-2xl max-h-[85vh] object-contain" /></div></div>}
    </div>
  );
}

/* ─── Main Public View ─── */
export default function PublicView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("");

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const { data: resp } = await publicViewApi.get(token);
      setData(resp);
      setError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(err?.response?.status === 404 ? (detail || "This link is invalid or has expired.") : (detail || "Failed to load parking data."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Set initial tab once data loads
  useEffect(() => {
    if (data && !activeTab) {
      const pages = data.view_config?.pages;
      setActiveTab(pages && pages.length > 0 ? pages[0] : "dashboard_parking");
    }
  }, [data, activeTab]);

  // Poll only for dashboard_parking tab
  useEffect(() => {
    fetchData();
    if (activeTab === "dashboard_parking" || !activeTab) {
      const i = setInterval(fetchData, 5000);
      return () => clearInterval(i);
    }
  }, [fetchData, activeTab]);

  if (loading) return <PublicViewSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><AlertTriangle size={24} className="text-red-500" /></div>
          <h1 className="text-[18px] font-bold text-slate-900 mb-2">Link Unavailable</h1>
          <p className="text-[13px] text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const viewConfig = data.view_config;
  const enabledPages = viewConfig?.pages?.length ? viewConfig.pages : ["dashboard_parking"];
  const showTabs = enabledPages.length > 1;

  return (
    <div className="h-screen bg-[#f8f9fb] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-md shadow-teal-600/20">
              <ParkingSquare size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-[14px] font-bold text-slate-900 tracking-tight leading-none">{data.name || "Parking View"}</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-[0.1em] mt-0.5">Live Status</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      {showTabs && (
        <div className="bg-white border-b border-slate-100 shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-1 p-1 bg-white rounded-xl w-fit my-2 card-shadow">
              {enabledPages.map((pageKey) => (
                <button
                  key={pageKey}
                  type="button"
                  onClick={() => setActiveTab(pageKey)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
                    activeTab === pageKey
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {pageKey.includes("anpr") ? <ScanLine size={14} /> : <ParkingSquare size={14} />}
                  {PAGE_LABELS[pageKey] || pageKey}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "dashboard_parking" && <DashboardParkingTab data={data} />}
        {activeTab === "dashboard_anpr" && token && <AnprDashboardTab token={token} />}
        {activeTab === "parking_history" && token && <ParkingHistoryTab token={token} viewConfig={viewConfig} />}
        {activeTab === "anpr_records" && token && <AnprRecordsTab token={token} viewConfig={viewConfig} />}
        {activeTab === "anpr_history" && token && <AnprHistoryTab token={token} viewConfig={viewConfig} />}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center justify-between text-[11px] text-slate-400">
          <span>Auto-refreshes every {activeTab === "dashboard_parking" ? "5" : "15"} seconds</span>
          <span className="font-semibold">Powered by AI Parking</span>
        </div>
      </footer>
    </div>
  );
}
