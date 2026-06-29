import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ParkingSquare, AlertTriangle, Car, Bike, Eye, Bug } from "lucide-react";
import { publicViewApi } from "@/services/api";
import type { PublicViewResponse } from "@/types/api";
import { Skel } from "@/components/Skeleton";

function PublicViewSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Compact public top bar */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Skel className="w-8 h-8 rounded-xl" />
          <div>
            <Skel className="w-40 h-4 mb-1.5" />
            <Skel className="w-24 h-2.5" />
          </div>
        </div>
      </header>

      {/* Summary boxes */}
      <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4 animate-pulse">
          <Skel className="h-28 rounded-2xl" />
          <Skel className="h-28 rounded-2xl" />
        </div>
      </div>

      {/* Camera card placeholders */}
      <main className="px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl card-shadow overflow-hidden animate-pulse">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                <Skel className="w-4 h-4 rounded" />
                <Skel className="w-28 h-3.5" />
              </div>
              <div className="flex">
                {/* Image rectangle */}
                <div className="w-4/5 p-3">
                  <Skel className="w-full h-56 rounded-lg" />
                </div>
                {/* Stats column */}
                <div className="w-1/5 flex flex-col gap-3 p-4">
                  <Skel className="flex-1 rounded-xl" />
                  <Skel className="flex-1 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}


export default function PublicView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

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
    return <PublicViewSkeleton />;
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

  // Compute overall car/2W totals from all camera slots
  const allSlots = data.locations.flatMap((l) => l.cameras.flatMap((c) => c.slots));
  const totalCapCar = allSlots.reduce((s, sl) => s + (sl.capacity_car || 0), 0);
  const totalCap2w = allSlots.reduce((s, sl) => s + (sl.capacity_two_wheeler || 0), 0);
  const totalOccCar = allSlots.reduce((s, sl) => s + (sl.occupied_car || 0), 0);
  const totalOcc2w = allSlots.reduce((s, sl) => s + (sl.occupied_two_wheeler || 0), 0);
  const totalAvailCar = Math.max(0, totalCapCar - totalOccCar);
  const totalAvail2w = Math.max(0, totalCap2w - totalOcc2w);

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
              <h1 className="text-[14px] font-bold text-slate-900 tracking-tight leading-none">
                {data.name || "Parking View"}
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-[0.1em] mt-0.5">
                Live Parking Status
              </p>
            </div>
          </div>

        </div>
      </header>

      {/* Overall summary — table-style stat boxes */}
      <div className="shrink-0 px-4 sm:px-6 py-3 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-4">
          {/* Cars box */}
          <div className="bg-blue-50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-center gap-3 py-3 border-b border-blue-100">
              <Car size={32} className="text-blue-500" />
              <span className="text-[22px] font-bold text-blue-600">Cars</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-blue-100">
              <div className="text-center py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Occupied</p>
                <p className="text-[28px] font-bold text-red-500 leading-tight">{totalOccCar}</p>
              </div>
              <div className="text-center py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available</p>
                <p className="text-[28px] font-bold text-emerald-600 leading-tight">{totalAvailCar}</p>
              </div>
              <div className="text-center py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</p>
                <p className="text-[28px] font-bold text-blue-600 leading-tight">{totalCapCar}</p>
              </div>
            </div>
          </div>
          {/* Two Wheeler box */}
          <div className="bg-indigo-50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-center gap-3 py-3 border-b border-indigo-100">
              <Bike size={32} className="text-indigo-500" />
              <span className="text-[22px] font-bold text-indigo-600">Two Wheeler</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-indigo-100">
              <div className="text-center py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Occupied</p>
                <p className="text-[28px] font-bold text-red-500 leading-tight">{totalOcc2w}</p>
              </div>
              <div className="text-center py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Available</p>
                <p className="text-[28px] font-bold text-emerald-600 leading-tight">{totalAvail2w}</p>
              </div>
              <div className="text-center py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total</p>
                <p className="text-[28px] font-bold text-indigo-600 leading-tight">{totalCap2w}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cameras — fill remaining screen */}
      <main className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {data.locations.map((location) => (
            <section key={location.id}>
              {data.locations.length > 1 && (
                <h2 className="text-[15px] font-bold text-slate-900 mb-3">{location.name}</h2>
              )}

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
                      {/* Camera header */}
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ParkingSquare size={14} className="text-teal-600" />
                          <h3 className="text-[13px] font-bold text-slate-900">{cam.position_label}</h3>
                          {location.name && (
                            <span className="text-[11px] text-slate-400 font-medium">{location.name}</span>
                          )}
                        </div>
                      </div>

                      {/* Image 80% + Stats 20% */}
                      <div className="flex" style={{ height: "calc(100vh - 180px)", maxHeight: 600 }}>
                        {/* Image — fixed height, no scroll */}
                        <div className="w-4/5 bg-slate-900 relative flex items-center justify-center">
                          {(() => {
                            const imgSrc = showDebug
                              ? (cam.debug_frame_url || cam.clean_frame_url)
                              : (cam.clean_frame_url || cam.debug_frame_url);
                            return imgSrc ? (
                              <img
                                src={`${imgSrc}?t=${Date.now()}`}
                                alt={cam.position_label}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <p className="text-slate-500 text-[12px]">No image available</p>
                            );
                          })()}
                          {/* Debug toggle — visible everywhere, hidden from public via showDebug state */}
                          <button
                              onClick={() => setShowDebug((v) => !v)}
                              className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                showDebug
                                  ? "bg-amber-500 text-white"
                                  : "bg-white/80 text-slate-600 hover:bg-white"
                              }`}
                            >
                              {showDebug ? <Bug size={12} /> : <Eye size={12} />}
                              {showDebug ? "Debug" : "Clean"}
                            </button>
                        </div>

                        {/* Stats column */}
                        <div className="w-1/5 flex flex-col gap-3 p-4">
                          {/* Cars table */}
                          <div className="bg-blue-50/60 rounded-xl flex-1 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-center gap-2.5 py-3.5 border-b border-blue-100">
                              <Car size={32} className="text-blue-500" />
                              <p className="text-[22px] text-blue-600 font-bold">Cars</p>
                            </div>
                            <div className="flex border-b border-blue-100 bg-blue-50/80">
                              <span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Status</span>
                              <span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Count</span>
                            </div>
                            <div className="flex border-b border-blue-50 py-3">
                              <span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Occupied</span>
                              <span className="flex-1 text-center text-[26px] font-bold text-red-500 leading-none">{camOccCar}</span>
                            </div>
                            <div className="flex border-b border-blue-50 py-3">
                              <span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Available</span>
                              <span className="flex-1 text-center text-[26px] font-bold text-emerald-600 leading-none">{availCar}</span>
                            </div>
                            <div className="flex py-3">
                              <span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Total</span>
                              <span className="flex-1 text-center text-[26px] font-bold text-blue-600 leading-none">{camCapCar}</span>
                            </div>
                          </div>
                          {/* 2-Wheelers table */}
                          <div className="bg-indigo-50/60 rounded-xl flex-1 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-center gap-2.5 py-3.5 border-b border-indigo-100">
                              <Bike size={32} className="text-indigo-500" />
                              <p className="text-[22px] text-indigo-600 font-bold">Two Wheeler</p>
                            </div>
                            <div className="flex border-b border-indigo-100 bg-indigo-50/80">
                              <span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Status</span>
                              <span className="flex-1 text-center text-[12px] font-semibold text-slate-500 py-1.5">Count</span>
                            </div>
                            <div className="flex border-b border-indigo-50 py-3">
                              <span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Occupied</span>
                              <span className="flex-1 text-center text-[26px] font-bold text-red-500 leading-none">{camOcc2w}</span>
                            </div>
                            <div className="flex border-b border-indigo-50 py-3">
                              <span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Available</span>
                              <span className="flex-1 text-center text-[26px] font-bold text-emerald-600 leading-none">{avail2w}</span>
                            </div>
                            <div className="flex py-3">
                              <span className="flex-1 text-center text-[15px] font-semibold text-slate-700">Total</span>
                              <span className="flex-1 text-center text-[26px] font-bold text-indigo-600 leading-none">{camCap2w}</span>
                            </div>
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
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center justify-between text-[11px] text-slate-400">
          <span>Auto-refreshes every 5 seconds</span>
          <span className="font-semibold">Powered by AI Parking</span>
        </div>
      </footer>
    </div>
  );
}
