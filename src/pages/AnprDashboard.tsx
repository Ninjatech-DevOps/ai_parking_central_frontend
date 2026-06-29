import { useState, useCallback } from "react";
import { useFilter } from "@/contexts/FilterContext";
import { anprDashboardApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import {
  Car, Bike, CircleCheck, MapPin, RefreshCw,
} from "lucide-react";
import type { AnprDashboardSummary, AnprDashboardLocation } from "@/types/api";
import AnprDashboardSkeleton from "@/components/skeletons/AnprDashboardSkeleton";

export default function AnprDashboard() {
  const { queryParams, filterLabel } = useFilter();
  const [summary, setSummary] = useState<AnprDashboardSummary | null>(null);
  const [locations, setLocations] = useState<AnprDashboardLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        anprDashboardApi.summary(queryParams),
        anprDashboardApi.locations(queryParams),
      ]);
      setSummary(s.data);
      setLocations(l.data.locations || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [queryParams]);

  usePolling(fetchData, 5000);

  if (loading && !summary) {
    return <AnprDashboardSkeleton />;
  }

  const s = summary || { car_total: 0, car_occupied: 0, car_available: 0, two_wheeler_total: 0, two_wheeler_occupied: 0, two_wheeler_available: 0, obstructions: 0 };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-500 text-[13px]">
            Showing data for <span className="font-semibold text-slate-700">{filterLabel}</span>
          </p>
        </div>
        <button
          onClick={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3.5 py-2 transition-colors card-shadow"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary Cards — Car & 2-Wheeler, in Occupied → Available → Total order */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Car Occupied" value={s.car_occupied} icon={Car} bg="bg-red-50" text="text-red-500" />
        <StatCard label="Car Available" value={s.car_available} icon={CircleCheck} bg="bg-emerald-50" text="text-emerald-600" />
        <StatCard label="Car Total" value={s.car_total} icon={Car} bg="bg-blue-50" text="text-blue-600" />
        <StatCard label="2W Occupied" value={s.two_wheeler_occupied} icon={Bike} bg="bg-red-50" text="text-red-500" />
        <StatCard label="2W Available" value={s.two_wheeler_available} icon={CircleCheck} bg="bg-emerald-50" text="text-emerald-600" />
        <StatCard label="2W Total" value={s.two_wheeler_total} icon={Bike} bg="bg-indigo-50" text="text-indigo-600" />
      </div>

      {/* Location-wise Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Location-wise Occupancy</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">{locations.length} locations</p>
          </div>
        </div>

        {locations.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
              <MapPin size={24} className="text-slate-300" />
            </div>
            <p className="text-[14px] font-semibold">No ANPR locations configured</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Configure car/2W slot totals in Parking Locations</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Total</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Total</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-amber-400 uppercase tracking-wider">Obstruct</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Occupancy</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc, idx) => (
                  <tr key={loc.location_id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                          <MapPin size={16} className="text-violet-500" />
                        </div>
                        <span className="text-[14px] font-semibold text-slate-800">{loc.location_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={`text-[18px] font-bold ${loc.car_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{loc.car_occupied}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="text-[18px] font-bold text-emerald-600">{loc.car_available}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="text-[18px] font-bold text-slate-800">{loc.car_total}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={`text-[18px] font-bold ${loc.two_wheeler_occupied > 0 ? "text-red-500" : "text-slate-300"}`}>{loc.two_wheeler_occupied}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="text-[18px] font-bold text-emerald-600">{loc.two_wheeler_available}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="text-[18px] font-bold text-slate-800">{loc.two_wheeler_total}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={`text-[18px] font-bold ${loc.obstructions > 0 ? "text-amber-500" : "text-slate-300"}`}>{loc.obstructions}</span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${loc.occupancy_pct >= 90 ? "bg-red-500" : loc.occupancy_pct >= 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                            style={{ width: `${loc.occupancy_pct}%` }}
                          />
                        </div>
                        <span className={`text-[12px] font-bold tabular-nums ${loc.occupancy_pct >= 90 ? "text-red-500" : loc.occupancy_pct >= 60 ? "text-amber-500" : "text-emerald-600"}`}>
                          {loc.occupancy_pct}%
                        </span>
                      </div>
                    </td>
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


function StatCard({ label, value, icon: Icon, bg, text }: { label: string; value: number | string; icon: React.ElementType; bg: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl card-shadow p-4 flex flex-col items-center text-center transition-lift hover:card-shadow-hover">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <Icon size={18} className={text} />
      </div>
      <p className={`text-[24px] font-extrabold leading-none ${text}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wider font-bold">{label}</p>
    </div>
  );
}
