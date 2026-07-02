import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  ParkingSquare, AlertTriangle, Car, Bike, Eye, Bug, Search, MapPin,
  ArrowDownToLine, ArrowUpFromLine, Loader2, Image as ImageIcon, ScanLine, Clock,
} from "lucide-react";
import { publicViewApi } from "@/services/api";
import Pagination from "@/components/Pagination";
import type { PublicViewResponse, ViewConfig, ParkingScan, AnprRecord, AnprSession, OccupancySummary } from "@/types/api";
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

/* ─── Parking History Tab (same UI as ParkingScanHistory) ─── */
function ParkingHistoryTab({ token, viewConfig }: { token: string; viewConfig: ViewConfig | null }) {
  const [scans, setScans] = useState<ParkingScan[]>([]);
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const pageSize = 20;
  const f = (field: string) => hasField(viewConfig, "parking_history", field);

  const dateFilter = (viewConfig as any)?.date_filter || "today";

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (dateFilter === "today") {
        // Show only 10 AM – 6 PM, sampled every 5 min
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
        p.set("start_date", todayStart.toISOString());
        p.set("end_date", todayEnd.toISOString());
        p.set("interval_minutes", "5");
      }
      const [scanRes, summaryRes] = await Promise.all([
        publicViewApi.parkingHistory(token, p.toString()),
        publicViewApi.occupancySummary(token),
      ]);
      const items = scanRes.data.items || [];
      setScans(items);
      setTotal(scanRes.data.total || 0);
      setTotalPages(scanRes.data.total_pages || 0);

      // For "today" filter: lock cards to 10AM-6PM window
      if (dateFilter === "today") {
        const s = summaryRes.data;
        if (items.length > 0 && page === 1) {
          // Use latest scan in the 10-6 window
          const latest = items[0];
          setSummary({
            ...s,
            car_occupied: latest.car_occupied,
            car_available: latest.car_available,
            car_total: latest.car_total,
            two_wheeler_occupied: latest.two_wheeler_occupied,
            two_wheeler_available: latest.two_wheeler_available,
            two_wheeler_total: latest.two_wheeler_total,
          });
        } else {
          // No scans yet (before 10AM or no data) — show 0 occupied, full available
          setSummary({
            ...s,
            car_occupied: 0,
            car_available: s.car_total,
            two_wheeler_occupied: 0,
            two_wheeler_available: s.two_wheeler_total,
          });
        }
      } else {
        setSummary(summaryRes.data);
      }
    } catch { /* */ }
    setLoading(false);
  }, [token, page]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);

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
            <div className="grid grid-cols-4 gap-3">
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

/* ─── ANPR History Tab (same UI as AnprHistory page) ─── */
function AnprHistoryTab({ token, viewConfig }: { token: string; viewConfig: ViewConfig | null }) {
  const [sessions, setSessions] = useState<AnprSession[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plateSearch, setPlateSearch] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const pageSize = 20;
  const f = (field: string) => hasField(viewConfig, "anpr_history", field);
  const dateFilter = (viewConfig as any)?.date_filter || "today";

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (dateFilter === "today") {
        // 10 AM – 6 PM only
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
        p.set("start_date", todayStart.toISOString());
        p.set("end_date", todayEnd.toISOString());
      }
      if (plateSearch) p.set("number_plate", plateSearch);

      const [sessRes, dashRes] = await Promise.all([
        publicViewApi.anprSessions(token, p.toString()),
        publicViewApi.anprDashboard(token).catch(() => ({ data: null })),
      ]);
      const items = sessRes.data.items || [];
      const totalCount = sessRes.data.total || 0;
      setSessions(items);
      setTotal(totalCount);
      setTotalPages(sessRes.data.total_pages || 0);

      // Fetch remaining pages to compute full In/Out counts for cards
      let allItems = [...items];
      const totalPages2 = sessRes.data.total_pages || 1;
      if (totalPages2 > 1) {
        const remaining = await Promise.all(
          Array.from({ length: totalPages2 - 1 }, (_, i) => {
            const pp = new URLSearchParams(p);
            pp.set("page", String(i + 2));
            return publicViewApi.anprSessions(token, pp.toString()).then(r => r.data.items || []).catch(() => []);
          })
        );
        allItems = allItems.concat(...remaining);
      }

      // Compute In/Out from session data within 10-6 window
      const dash = dashRes.data?.summary;
      if (dash) {
        if (dateFilter === "today" && allItems.length === 0) {
          setSummary({
            ...dash,
            car_in: 0, car_out: 0, car_available: dash.car_total,
            two_wheeler_in: 0, two_wheeler_out: 0, two_wheeler_available: dash.two_wheeler_total,
          });
        } else {
          const carIn = allItems.filter((s: any) => (s.vehicle_type === "CAR" || s.vehicle_type === "Car") && s.is_active).length;
          const carOut = allItems.filter((s: any) => (s.vehicle_type === "CAR" || s.vehicle_type === "Car") && !s.is_active).length;
          const twIn = allItems.filter((s: any) => (s.vehicle_type === "TWO_WHEELER" || s.vehicle_type === "Two Wheeler") && s.is_active).length;
          const twOut = allItems.filter((s: any) => (s.vehicle_type === "TWO_WHEELER" || s.vehicle_type === "Two Wheeler") && !s.is_active).length;
          setSummary({
            ...dash,
            car_in: carIn, car_out: carOut,
            car_available: Math.max(0, dash.car_total - (carIn - carOut)),
            two_wheeler_in: twIn, two_wheeler_out: twOut,
            two_wheeler_available: Math.max(0, dash.two_wheeler_total - (twIn - twOut)),
          });
        }
      } else {
        setSummary(null);
      }
    } catch { /* */ }
    setLoading(false);
  }, [token, page, plateSearch]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);
  useEffect(() => { setPage(1); }, [plateSearch]);

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

        {/* Cars + Two Wheeler summary (PDF style) */}
        {summary && (<>
          <div>
            <p className="text-[14px] font-bold text-slate-800 mb-2">Cars</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total cars", value: summary.car_total, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700" },
                { label: "In", value: summary.car_in ?? summary.car_occupied, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600" },
                { label: "Out", value: summary.car_out ?? 0, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
                { label: "Available", value: summary.car_available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
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
                { label: "In", value: summary.two_wheeler_in ?? summary.two_wheeler_occupied, border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600" },
                { label: "Out", value: summary.two_wheeler_out ?? 0, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
                { label: "Available", value: summary.two_wheeler_available, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
              ].map(({ label, value, border, bg, text }) => (
                <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">{label}</p>
                  <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
                </div>
              ))}
            </div>
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
