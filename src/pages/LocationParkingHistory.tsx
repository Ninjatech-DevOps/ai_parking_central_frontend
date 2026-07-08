import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { parkingHistoryApi, locationsApi } from "@/services/api";
import { useFilter } from "@/contexts/FilterContext";
import { usePolling } from "@/hooks/usePolling";
import Pagination from "@/components/Pagination";
import { ArrowLeft, Image as ImageIcon, Clock, X } from "lucide-react";
import { LiveBadge } from "@/components/FilterPanel";
import type { ParkingScan, OccupancySummary, Location } from "@/types/api";
import { SkeletonShell, SkeletonHeader, SkeletonTable, Skel } from "@/components/Skeleton";

// Single-location Parking History — scoped entirely by the :id in the URL path.
// It never reads or writes the global FilterContext location, so it can't affect
// the shared /parking-history screen or any other page.

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
    default:
      return { start: "", end: "" };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  const rounded = Math.round(d.getMinutes() / 5) * 5;
  if (rounded === 60) { d.setHours(d.getHours() + 1); d.setMinutes(0); } else { d.setMinutes(rounded); }
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const PAGE_SIZE = 20;

function CardSkel() {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <Skel className="w-16 h-3 mb-2" />
      <Skel className="w-14 h-7" />
    </div>
  );
}

export default function LocationParkingHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { areas } = useFilter(); // read-only, for the area name label

  const [location, setLocation] = useState<Location | null>(null);
  const [scans, setScans] = useState<ParkingScan[]>([]);
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState("today");
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // Location details for the header (name / area / type).
  useEffect(() => {
    if (!id) return;
    locationsApi.get(id).then(({ data }) => setLocation(data)).catch(() => {});
  }, [id]);

  // Close image preview on Escape.
  useEffect(() => {
    if (!previewImg) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewImg(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewImg]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(PAGE_SIZE));
    p.set("interval_minutes", "5");
    const { start, end } = getPresetDates(datePreset);
    if (start) p.set("start_date", start);
    if (end) p.set("end_date", end);
    if (id) p.set("location_id", id);
    return p.toString();
  }, [id, page, datePreset]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [listRes, sumRes] = await Promise.all([
        parkingHistoryApi.list(buildParams()),
        parkingHistoryApi.occupancySummary(`location_id=${id}`).catch(() => null),
      ]);
      setScans(listRes.data.items || []);
      setTotal(listRes.data.total || 0);
      setTotalPages(listRes.data.total_pages || 0);
      if (sumRes) setSummary(sumRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id, buildParams]);

  usePolling(fetchData, 15000);
  useEffect(() => { setPage(1); }, [datePreset]);

  const areaName = location ? (areas.find((a) => a.id === location.area_id)?.name || "") : "";
  const subtitle = [areaName, location?.location_type].filter(Boolean).join(" · ");
  const showSkeleton = loading && scans.length === 0;

  if (loading && !location && scans.length === 0) {
    return (
      <SkeletonShell>
        <SkeletonHeader action={false} />
        <div className="space-y-4 mb-6 animate-pulse">
          {[0, 1].map((g) => (
            <div key={g}>
              <Skel className="w-24 h-4 mb-2" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <CardSkel key={i} />)}</div>
            </div>
          ))}
        </div>
        <SkeletonTable rows={8} cols={9} />
      </SkeletonShell>
    );
  }

  return (
    <div className="w-full">
      {/* Header: back + location name */}
      <div className="flex items-start gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shrink-0 mt-0.5 card-shadow"
          title="Back"
        >
          <ArrowLeft size={16} className="text-slate-600" />
        </button>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-900">{location?.name || "Location"}</h1>
            {datePreset === "today" && <LiveBadge />}
          </div>
          <p className="text-[13px] text-slate-400 mt-0.5">{subtitle ? `${subtitle} · ` : ""}Parking History</p>
        </div>
      </div>

      {/* Date range */}
      <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 mb-6">
        {DATE_PRESETS.map((dp) => (
          <button
            key={dp.key}
            onClick={() => setDatePreset(dp.key)}
            className={`px-3.5 h-9 rounded-lg text-[12px] font-semibold transition-colors ${datePreset === dp.key ? "bg-white text-teal-600 card-shadow" : "text-slate-500 hover:text-slate-700"}`}
          >
            {dp.label}
          </button>
        ))}
      </div>

      {/* Occupancy summary cards — grouped Cars / 2 Wheeler */}
      {showSkeleton ? (
        <div className="space-y-4 mb-6 animate-pulse">
          {[0, 1].map((g) => (
            <div key={g}>
              <Skel className="w-24 h-4 mb-2" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <CardSkel key={i} />)}</div>
            </div>
          ))}
        </div>
      ) : summary && (
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

      {/* Records table */}
      <p className="text-[14px] font-bold text-slate-700 mb-3">Occupancy records ({total})</p>
      {showSkeleton ? (
        <SkeletonTable rows={8} cols={9} />
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Image</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-red-400 uppercase tracking-wider">Car Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Car Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Total</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-red-400 uppercase tracking-wider">2W Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">2W Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Total</th>
                </tr>
              </thead>
              <tbody>
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-400">
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Clock size={24} className="text-slate-300" /></div>
                        <p className="text-[14px] font-semibold">No parking scans found</p>
                        <p className="text-[12px] text-slate-400 mt-0.5">Scans will appear as detection cycles run</p>
                      </div>
                    </td>
                  </tr>
                ) : scans.map((s, idx) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                    <td className="px-6 py-3"><span className="text-[12px] font-semibold text-slate-700">{formatDate(s.recorded_at)}</span></td>
                    <td className="px-3 py-3"><span className="text-[12px] text-slate-500">{formatTime(s.recorded_at)}</span></td>
                    <td className="px-3 py-3">
                      {s.image_url ? (
                        <button onClick={() => setPreviewImg(s.image_url)} className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-colors">
                          <img src={s.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center"><ImageIcon size={14} className="text-slate-300" /></div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center"><span className={`text-[16px] font-bold ${s.car_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.car_occupied}</span></td>
                    <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-emerald-600">{s.car_available}</span></td>
                    <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-blue-700">{s.car_total}</span></td>
                    <td className="px-3 py-3 text-center"><span className={`text-[16px] font-bold ${s.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{s.two_wheeler_occupied}</span></td>
                    <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-emerald-600">{s.two_wheeler_available}</span></td>
                    <td className="px-3 py-3 text-center"><span className="text-[16px] font-bold text-indigo-700">{s.two_wheeler_total}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-6 pb-4">
              <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      {/* Image preview */}
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
