import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  ParkingSquare, AlertTriangle, Car, Bike, Eye, Bug, Search,
  ArrowDownToLine, ArrowUpFromLine, Loader2, Image as ImageIcon, ScanLine, Clock,
} from "lucide-react";
import { publicViewApi } from "@/services/api";
import Pagination from "@/components/Pagination";
import type { PublicViewResponse, ViewConfig, ParkingScan, AnprRecord, AnprSession, OccupancySummary } from "@/types/api";
import { Skel } from "@/components/Skeleton";

// ─── Page keys matching backend view_config.pages ───
const PAGE_LABELS: Record<string, string> = {
  dashboard_parking: "AI Parking",
  dashboard_anpr: "ANPR Dashboard",
  parking_history: "AI Parking History",
  anpr_records: "ANPR Records",
  anpr_history: "ANPR History",
};

// ─── Helpers ───
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function hasField(vc: ViewConfig | null, page: string, field: string): boolean {
  if (!vc?.fields?.[page]) return true; // no field config = show all
  return vc.fields[page].includes(field);
}

// ─── Skeleton ───
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
          <Skel className="h-28 rounded-2xl" />
          <Skel className="h-28 rounded-2xl" />
        </div>
      </div>
      <main className="px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl card-shadow overflow-hidden animate-pulse">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <Skel className="w-4 h-4 rounded" /><Skel className="w-28 h-3.5" />
              </div>
              <div className="flex">
                <div className="w-4/5 p-3"><Skel className="w-full h-56 rounded-lg" /></div>
                <div className="w-1/5 flex flex-col gap-3 p-4"><Skel className="flex-1 rounded-xl" /><Skel className="flex-1 rounded-xl" /></div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── Tab: Dashboard Parking (existing camera view) ───
function DashboardParkingTab({ data, viewConfig }: { data: PublicViewResponse; viewConfig: ViewConfig | null }) {
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
      {/* Summary */}
      <div className="shrink-0 px-4 sm:px-6 py-3 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4">
          <SummaryBox icon={Car} label="Cars" color="blue" occ={totalOccCar} avail={totalAvailCar} total={totalCapCar} />
          <SummaryBox icon={Bike} label="Two Wheeler" color="indigo" occ={totalOcc2w} avail={totalAvail2w} total={totalCap2w} />
        </div>
      </div>

      {/* Cameras */}
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
                  return (
                    <div key={cam.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                        <ParkingSquare size={14} className="text-teal-600" />
                        <h3 className="text-[13px] font-bold text-slate-900">{cam.position_label}</h3>
                        {location.name && <span className="text-[11px] text-slate-400 font-medium">{location.name}</span>}
                      </div>
                      <div className="flex" style={{ height: "calc(100vh - 180px)", maxHeight: 600 }}>
                        <div className="w-4/5 bg-slate-900 relative flex items-center justify-center">
                          {(() => {
                            const imgSrc = showDebug ? (cam.debug_frame_url || cam.clean_frame_url) : (cam.clean_frame_url || cam.debug_frame_url);
                            return imgSrc ? (
                              <img src={`${imgSrc}?t=${Date.now()}`} alt={cam.position_label} className="w-full h-full object-contain" />
                            ) : (
                              <p className="text-slate-500 text-[12px]">No image available</p>
                            );
                          })()}
                          <button onClick={() => setShowDebug((v) => !v)} className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${showDebug ? "bg-amber-500 text-white" : "bg-white/80 text-slate-600 hover:bg-white"}`}>
                            {showDebug ? <Bug size={12} /> : <Eye size={12} />} {showDebug ? "Debug" : "Clean"}
                          </button>
                        </div>
                        <div className="w-1/5 flex flex-col gap-3 p-4">
                          <StatsColumn label="Cars" icon={Car} color="blue" occ={camOccCar} avail={Math.max(0, camCapCar - camOccCar)} total={camCapCar} />
                          <StatsColumn label="Two Wheeler" icon={Bike} color="indigo" occ={camOcc2w} avail={Math.max(0, camCap2w - camOcc2w)} total={camCap2w} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {data.locations.length === 0 && <div className="text-center py-16"><p className="text-[14px] text-slate-400">No parking data available.</p></div>}
        </div>
      </main>
    </>
  );
}

function SummaryBox({ icon: Icon, label, color, occ, avail, total }: { icon: React.ElementType; label: string; color: string; occ: number; avail: number; total: number }) {
  return (
    <div className={`bg-${color}-50 rounded-2xl overflow-hidden`}>
      <div className={`flex items-center justify-center gap-3 py-3 border-b border-${color}-100`}>
        <Icon size={32} className={`text-${color}-500`} />
        <span className={`text-[22px] font-bold text-${color}-600`}>{label}</span>
      </div>
      <div className={`grid grid-cols-3 divide-x divide-${color}-100`}>
        <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Occupied</p><p className="text-[28px] font-bold text-red-500 leading-tight">{occ}</p></div>
        <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available</p><p className="text-[28px] font-bold text-emerald-600 leading-tight">{avail}</p></div>
        <div className="text-center py-3"><p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</p><p className={`text-[28px] font-bold text-${color}-600 leading-tight`}>{total}</p></div>
      </div>
    </div>
  );
}

function StatsColumn({ label, icon: Icon, color, occ, avail, total }: { label: string; icon: React.ElementType; color: string; occ: number; avail: number; total: number }) {
  return (
    <div className={`bg-${color}-50/60 rounded-xl flex-1 flex flex-col overflow-hidden`}>
      <div className={`flex items-center justify-center gap-2.5 py-3.5 border-b border-${color}-100`}>
        <Icon size={32} className={`text-${color}-500`} />
        <p className={`text-[22px] text-${color}-600 font-bold`}>{label}</p>
      </div>
      <div className={`flex border-b border-${color}-100 bg-${color}-50/80`}>
        <span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Status</span>
        <span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Count</span>
      </div>
      <div className={`flex border-b border-${color}-50 py-3`}><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Occupied</span><span className="flex-1 text-center text-[26px] font-bold text-red-500 leading-none">{occ}</span></div>
      <div className={`flex border-b border-${color}-50 py-3`}><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Available</span><span className="flex-1 text-center text-[26px] font-bold text-emerald-600 leading-none">{avail}</span></div>
      <div className="flex py-3"><span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Total</span><span className={`flex-1 text-center text-[26px] font-bold text-${color}-600 leading-none`}>{total}</span></div>
    </div>
  );
}

// ─── Tab: ANPR Dashboard ───
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
          <SummaryBox icon={Car} label="Cars" color="blue" occ={s.car_occupied} avail={s.car_available} total={s.car_total} />
          <SummaryBox icon={Bike} label="Two Wheeler" color="indigo" occ={s.two_wheeler_occupied} avail={s.two_wheeler_available} total={s.two_wheeler_total} />
        </div>
        {data.locations?.length > 0 && (
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100"><h2 className="text-[16px] font-bold text-slate-900">Locations</h2></div>
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
                  <tr key={loc.location_id} className={`border-b border-slate-50 ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                    <td className="px-6 py-3 text-[13px] font-semibold text-slate-800">{loc.location_name}</td>
                    <td className="px-3 py-3 text-center text-[16px] font-bold text-red-500">{loc.car_occupied}</td>
                    <td className="px-3 py-3 text-center text-[16px] font-bold text-emerald-600">{loc.car_available}</td>
                    <td className="px-3 py-3 text-center text-[16px] font-bold text-red-500">{loc.two_wheeler_occupied}</td>
                    <td className="px-3 py-3 text-center text-[16px] font-bold text-emerald-600">{loc.two_wheeler_available}</td>
                    <td className="px-3 py-3 text-center text-[12px] font-bold text-slate-500">{loc.occupancy_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Parking History ───
function ParkingHistoryTab({ token, viewConfig }: { token: string; viewConfig: ViewConfig | null }) {
  const [scans, setScans] = useState<ParkingScan[]>([]);
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;
  const f = (field: string) => hasField(viewConfig, "parking_history", field);

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      const [scanRes, summaryRes] = await Promise.all([
        publicViewApi.parkingHistory(token, p.toString()),
        publicViewApi.occupancySummary(token),
      ]);
      setScans(scanRes.data.items || []);
      setTotal(scanRes.data.total || 0);
      setTotalPages(scanRes.data.total_pages || 0);
      setSummary(summaryRes.data);
    } catch { /* */ }
    setLoading(false);
  }, [token, page]);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 15000); return () => clearInterval(i); }, [fetchData]);

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MiniStat label="Car Occ" value={summary.car_occupied} color="text-red-500" />
            <MiniStat label="Car Avail" value={summary.car_available} color="text-emerald-600" />
            <MiniStat label="Car Total" value={summary.car_total} color="text-blue-600" />
            <MiniStat label="2W Occ" value={summary.two_wheeler_occupied} color="text-red-500" />
            <MiniStat label="2W Avail" value={summary.two_wheeler_available} color="text-emerald-600" />
            <MiniStat label="2W Total" value={summary.two_wheeler_total} color="text-indigo-600" />
          </div>
        )}
        <div className="bg-white rounded-2xl card-shadow overflow-hidden relative">
          {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal-500" /></div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50/80 border-b border-slate-100">
                {f("date") && <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>}
                {f("time") && <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</th>}
                {f("image") && <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>}
                {f("location") && <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>}
                {f("device") && <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Device</th>}
                {f("car_occupied") && <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Occ</th>}
                {f("car_available") && <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Car Avail</th>}
                {f("car_total") && <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Car Total</th>}
                {f("2w_occupied") && <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Occ</th>}
                {f("2w_available") && <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">2W Avail</th>}
                {f("2w_total") && <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">2W Total</th>}
              </tr></thead>
              <tbody>
                {scans.length === 0 && !loading ? (
                  <tr><td colSpan={11} className="text-center py-16 text-slate-400"><Clock size={24} className="mx-auto mb-2 text-slate-300" /><p className="text-[14px] font-semibold">No scans found</p></td></tr>
                ) : scans.map((s, idx) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                    {f("date") && <td className="px-4 py-3 text-[12px] font-semibold text-slate-700">{formatDate(s.recorded_at)}</td>}
                    {f("time") && <td className="px-3 py-3 text-[12px] text-slate-500">{formatTime(s.recorded_at)}</td>}
                    {f("image") && <td className="px-3 py-3">{s.image_url ? <img src={s.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" /> : <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center"><ImageIcon size={14} className="text-slate-300" /></div>}</td>}
                    {f("location") && <td className="px-3 py-3 text-[12px] font-semibold text-slate-700">{s.location_name || "—"}</td>}
                    {f("device") && <td className="px-3 py-3 text-[11px] font-mono text-slate-500">{s.device_name || "—"}</td>}
                    {f("car_occupied") && <td className="px-3 py-3 text-center text-[16px] font-bold text-red-500">{s.car_occupied}</td>}
                    {f("car_available") && <td className="px-3 py-3 text-center text-[16px] font-bold text-emerald-600">{s.car_available}</td>}
                    {f("car_total") && <td className="px-3 py-3 text-center text-[16px] font-bold text-slate-800">{s.car_total}</td>}
                    {f("2w_occupied") && <td className="px-3 py-3 text-center text-[16px] font-bold text-red-500">{s.two_wheeler_occupied}</td>}
                    {f("2w_available") && <td className="px-3 py-3 text-center text-[16px] font-bold text-emerald-600">{s.two_wheeler_available}</td>}
                    {f("2w_total") && <td className="px-3 py-3 text-center text-[16px] font-bold text-slate-800">{s.two_wheeler_total}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} /></div>}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: ANPR Records ───
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

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
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
          {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal-500" /></div>}
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
                  <tr><td colSpan={8} className="text-center py-16 text-slate-400"><Search size={24} className="mx-auto mb-2 text-slate-300" /><p className="text-[14px] font-semibold">No records found</p></td></tr>
                ) : records.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                    {f("image") && <td className="px-4 py-3">{r.image_url ? <button onClick={() => setPreviewImg(r.image_url)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400"><img src={r.image_url} alt="" className="w-full h-full object-cover" /></button> : <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center"><ImageIcon size={16} className="text-slate-300" /></div>}</td>}
                    {f("number_plate") && <td className="px-4 py-3"><span className={`text-[13px] font-bold ${r.number_plate === "N/A" ? "text-slate-400" : "text-teal-700"}`}>{r.number_plate || "N/A"}</span></td>}
                    {f("vehicle_type") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2 py-1 ${r.vehicle_type === "CAR" ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"}`}>{r.vehicle_type === "CAR" ? <Car size={12} /> : <Bike size={12} />} {r.vehicle_type === "CAR" ? "Car" : "2W"}</span></td>}
                    {f("direction") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1 ${r.direction === "IN" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}>{r.direction === "IN" ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />} {r.direction}</span></td>}
                    {f("date_time") && <td className="px-4 py-3"><p className="text-[12px] font-semibold text-slate-700">{formatDate(r.recorded_at)}</p><p className="text-[11px] text-slate-400">{formatTime(r.recorded_at)}</p></td>}
                    {f("gemini") && <td className="px-3 py-3"><span className={`text-[11px] font-mono ${r.gemini_result ? "text-slate-700" : "text-slate-300"}`}>{r.gemini_result || "—"}</span></td>}
                    {f("paddle") && <td className="px-3 py-3"><span className={`text-[11px] font-mono ${r.paddle_result ? "text-slate-700" : "text-slate-300"}`}>{r.paddle_result || "—"}</span></td>}
                    {f("location") && <td className="px-4 py-3 text-[12px] text-slate-600">{r.location_name || "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} /></div>}
        </div>
      </div>
      {previewImg && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewImg(null)}><div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}><img src={previewImg} alt="ANPR capture" className="max-w-full max-h-[85vh] object-contain" /></div></div>}
    </div>
  );
}

// ─── Tab: ANPR History ───
function AnprHistoryTab({ token, viewConfig }: { token: string; viewConfig: ViewConfig | null }) {
  const [sessions, setSessions] = useState<AnprSession[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plateSearch, setPlateSearch] = useState("");
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const pageSize = 20;
  const f = (field: string) => hasField(viewConfig, "anpr_history", field);

  const fetchData = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (plateSearch) p.set("number_plate", plateSearch);
      const { data } = await publicViewApi.anprSessions(token, p.toString());
      setSessions(data.items || []);
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
          {loading && <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-teal-500" /></div>}
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
                  <tr><td colSpan={8} className="text-center py-16 text-slate-400"><Car size={24} className="mx-auto mb-2 text-slate-300" /><p className="text-[14px] font-semibold">No sessions found</p></td></tr>
                ) : sessions.map((s, idx) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${idx % 2 !== 0 ? "bg-slate-25" : ""}`}>
                    {f("image") && <td className="px-6 py-3">{s.entry_image_url ? <button onClick={() => setPreviewImg(s.entry_image_url)} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400"><img src={s.entry_image_url} alt="" className="w-full h-full object-cover" /></button> : <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center"><ImageIcon size={16} className="text-slate-300" /></div>}</td>}
                    {f("number_plate") && <td className="px-4 py-3"><span className={`text-[14px] font-bold font-mono tracking-wide ${s.number_plate === "N/A" ? "text-slate-400" : "text-teal-700"}`}>{s.number_plate}</span></td>}
                    {f("vehicle_type") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${s.vehicle_type === "CAR" ? "text-blue-700 bg-blue-50" : "text-indigo-700 bg-indigo-50"}`}>{s.vehicle_type === "CAR" ? <Car size={11} /> : <Bike size={11} />} {s.vehicle_type === "CAR" ? "Car" : "2W"}</span></td>}
                    {f("entry_time") && <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1.5"><ArrowDownToLine size={12} className="text-blue-400" /><div><p className="text-[13px] font-semibold text-slate-700">{formatDate(s.entry_time)}</p><p className="text-[12px] text-slate-500">{formatTime(s.entry_time)}</p></div></div></td>}
                    {f("exit_time") && <td className="px-4 py-3 text-center">{s.exit_time ? <div className="flex items-center justify-center gap-1.5"><ArrowUpFromLine size={12} className="text-red-400" /><div><p className="text-[13px] font-semibold text-slate-700">{formatDate(s.exit_time)}</p><p className="text-[12px] text-slate-500">{formatTime(s.exit_time)}</p></div></div> : <span className="text-[12px] text-slate-300">—</span>}</td>}
                    {f("duration") && <td className="px-3 py-3 text-center"><span className={`text-[12px] font-semibold ${s.duration_display ? "text-slate-700" : "text-teal-600"}`}>{s.duration_display || "Active"}</span></td>}
                    {f("status") && <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${s.is_active ? "text-teal-700 bg-teal-50" : "text-emerald-700 bg-emerald-50"}`}><span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? "bg-teal-500 animate-pulse" : "bg-emerald-500"}`} />{s.is_active ? "Parked" : "Completed"}</span></td>}
                    {f("location") && <td className="px-4 py-3 text-[13px] text-slate-600">{s.location_name || "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="px-6 pb-4"><Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} /></div>}
        </div>
      </div>
      {previewImg && <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={() => setPreviewImg(null)}><div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}><img src={previewImg} alt="Vehicle" className="rounded-xl shadow-2xl max-h-[85vh] object-contain" /></div></div>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl card-shadow p-3 text-center">
      <p className={`text-[20px] font-extrabold leading-none ${color}`}>{value}</p>
      <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider font-bold">{label}</p>
    </div>
  );
}

// ─── Main Public View Component ───
export default function PublicView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const { data: resp } = await publicViewApi.get(token);
      setData(resp);
      setError(null);
      // Set initial tab
      if (!activeTab) {
        const pages = resp.view_config?.pages;
        if (pages && pages.length > 0) {
          setActiveTab(pages[0]);
        } else {
          setActiveTab("dashboard_parking");
        }
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(err?.response?.status === 404 ? (detail || "This link is invalid or has expired.") : (detail || "Failed to load parking data."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Only poll the main view data for dashboard_parking tab
  useEffect(() => {
    fetchData();
    const interval = activeTab === "dashboard_parking" ? setInterval(fetchData, 5000) : null;
    return () => { if (interval) clearInterval(interval); };
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
            <div className="flex items-center gap-1 py-2">
              {enabledPages.map((pageKey) => (
                <button
                  key={pageKey}
                  onClick={() => setActiveTab(pageKey)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                    activeTab === pageKey ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {pageKey.includes("anpr") ? <ScanLine size={13} /> : <ParkingSquare size={13} />}
                  {PAGE_LABELS[pageKey] || pageKey}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "dashboard_parking" && <DashboardParkingTab data={data} viewConfig={viewConfig} />}
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
