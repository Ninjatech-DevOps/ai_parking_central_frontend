import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ParkingSquare, AlertTriangle, CircleDot } from "lucide-react";
import { publicViewApi } from "@/services/api";
import type { PublicViewResponse } from "@/types/api";

export default function PublicView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const { data: resp } = await publicViewApi.get(token);
      setData(resp);
      setError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 404) {
        setError(detail || "This link is invalid or has expired.");
      } else {
        setError(detail || "Failed to load parking data.");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-600/20 animate-pulse">
            <ParkingSquare size={24} className="text-white" />
          </div>
          <p className="text-[14px] text-slate-500 font-medium">Loading parking data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h1 className="text-[18px] font-bold text-slate-900 mb-2">Link Unavailable</h1>
          <p className="text-[13px] text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { total_summary: ts } = data;

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-md shadow-teal-600/20">
              <ParkingSquare size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-[14px] font-bold text-slate-900 tracking-tight leading-none">
                {data.name || "Parking View"}
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-[0.1em] mt-0.5">
                Live Parking Status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Summary badges */}
            <div className="hidden sm:flex items-center gap-3 text-[12px] font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <CircleDot size={13} className="text-slate-400" /> Total {ts.total}
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Available {ts.available}
              </span>
              <span className="flex items-center gap-1.5 text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Occupied {ts.occupied}
              </span>
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Obstructed {ts.obstructed}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile summary */}
      <div className="sm:hidden px-4 pt-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl card-shadow p-2.5 text-center">
            <p className="text-[18px] font-bold text-slate-900">{ts.total}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Total</p>
          </div>
          <div className="bg-white rounded-xl card-shadow p-2.5 text-center">
            <p className="text-[18px] font-bold text-emerald-600">{ts.available}</p>
            <p className="text-[9px] text-emerald-500 font-bold uppercase">Free</p>
          </div>
          <div className="bg-white rounded-xl card-shadow p-2.5 text-center">
            <p className="text-[18px] font-bold text-red-600">{ts.occupied}</p>
            <p className="text-[9px] text-red-500 font-bold uppercase">Occupied</p>
          </div>
          <div className="bg-white rounded-xl card-shadow p-2.5 text-center">
            <p className="text-[18px] font-bold text-amber-600">{ts.obstructed}</p>
            <p className="text-[9px] text-amber-500 font-bold uppercase">Blocked</p>
          </div>
        </div>
      </div>

      {/* Locations + Cameras */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 flex-1 w-full">
        {data.locations.map((location) => (
          <section key={location.id}>
            {data.locations.length > 1 && (
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900">{location.name}</h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    {location.summary.total} slots &middot; {location.summary.available} available
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-emerald-700 bg-emerald-50">
                    {location.summary.available} Free
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-red-700 bg-red-50">
                    {location.summary.occupied} Occupied
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-amber-700 bg-amber-50">
                    {location.summary.obstructed} Blocked
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-6">
                {location.cameras.map((cam) => {
                  const camOccCar = cam.slots.reduce((s, sl) => s + (sl.occupied_car || 0), 0);
                  const camOcc2w = cam.slots.reduce((s, sl) => s + (sl.occupied_two_wheeler || 0), 0);
                  const camCapCar = cam.slots.reduce((s, sl) => s + (sl.capacity_car || 0), 0);
                  const camCap2w = cam.slots.reduce((s, sl) => s + (sl.capacity_two_wheeler || 0), 0);
                  const availCar = camCapCar - camOccCar;
                  const avail2w = camCap2w - camOcc2w;

                  return (
                    <div key={cam.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                      {/* Camera header */}
                      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ParkingSquare size={16} className="text-teal-600" />
                          <h3 className="text-[14px] font-bold text-slate-900">{cam.position_label}</h3>
                          {location.name && (
                            <span className="text-[11px] text-slate-400 font-medium">{location.name}</span>
                          )}
                        </div>
                      </div>

                      {/* Image 80% + Stats 20% */}
                      <div className="flex">
                        {/* Detection image */}
                        <div className="w-4/5">
                          {cam.debug_frame_url ? (
                            <div className="bg-slate-900 h-full flex items-center justify-center">
                              <img
                                src={cam.debug_frame_url}
                                alt={`${cam.position_label} detection`}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="bg-slate-900 flex items-center justify-center h-full min-h-[300px]">
                              <p className="text-slate-500 text-[12px]">No detection image available</p>
                            </div>
                          )}
                        </div>

                        {/* Stats column */}
                        <div className="w-1/5 flex flex-col gap-2 p-3">
                          <div className="bg-slate-50 rounded-xl p-3 text-center flex-1 flex flex-col items-center justify-center">
                            <p className="text-[28px] font-bold text-red-600 leading-tight">{camOccCar}<span className="text-[14px] text-slate-400">/{camCapCar}</span></p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Cars</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-3 text-center flex-1 flex flex-col items-center justify-center">
                            <p className="text-[28px] font-bold text-emerald-600 leading-tight">{availCar}</p>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase mt-1">Available Cars</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3 text-center flex-1 flex flex-col items-center justify-center">
                            <p className="text-[28px] font-bold text-blue-600 leading-tight">{camOcc2w}<span className="text-[14px] text-slate-400">/{camCap2w}</span></p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">2-Wheelers</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-3 text-center flex-1 flex flex-col items-center justify-center">
                            <p className="text-[28px] font-bold text-emerald-600 leading-tight">{avail2w}</p>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase mt-1">Available 2W</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
          </section>
        ))}

        {data.locations.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-slate-400">No parking data available for this link.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between text-[11px] text-slate-400">
          <span>Auto-refreshes every 5 seconds</span>
          <span className="font-semibold">Powered by AI Parking</span>
        </div>
      </footer>
    </div>
  );
}
