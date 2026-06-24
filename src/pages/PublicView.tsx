import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { ParkingSquare, AlertTriangle, Car, Bike, Eye, Bug } from "lucide-react";
import { publicViewApi } from "@/services/api";
import type { PublicViewResponse, CanvasCamera } from "@/types/api";

const IS_DEV = import.meta.env.DEV;

/** Overlay canvas that draws red stroke-only polygons on top of the camera image */
function CameraImageOverlay({ cam, showDebug }: { cam: CanvasCamera; showDebug: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const imgSrc = showDebug
    ? (cam.debug_frame_url || cam.clean_frame_url)
    : (cam.clean_frame_url || cam.debug_frame_url);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const container = containerRef.current;
    if (!canvas || !img || !container) return;

    // Don't draw polygons on debug frame — it already has them
    if (showDebug) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    if (!displayW || !displayH) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayW, displayH);

    const frameW = cam.frame_width || img.naturalWidth || 1920;
    const frameH = cam.frame_height || img.naturalHeight || 1080;
    const scaleX = displayW / frameW;
    const scaleY = displayH / frameH;

    for (const slot of cam.slots) {
      let points: number[][] = [];
      if (slot.polygon_coords) {
        try { points = JSON.parse(slot.polygon_coords); } catch { /* skip */ }
      }
      if (points.length === 0 && slot.pos_x1 != null && slot.pos_x2 != null) {
        points = [
          [slot.pos_x1!, slot.pos_y1!],
          [slot.pos_x2!, slot.pos_y1!],
          [slot.pos_x2!, slot.pos_y2!],
          [slot.pos_x1!, slot.pos_y2!],
        ];
      }
      if (points.length < 3) continue;

      const pts = points.map(([px, py]) => [px * scaleX, py * scaleY]);

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw slot label at centroid
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(slot.label, cx + 1, cy + 1);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(slot.label, cx, cy);
    }
  }, [cam, showDebug]);

  useEffect(() => {
    drawOverlay();
    window.addEventListener("resize", drawOverlay);
    return () => window.removeEventListener("resize", drawOverlay);
  }, [drawOverlay]);

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      {imgSrc ? (
        <>
          <img
            ref={imgRef}
            src={`${imgSrc}?t=${Date.now()}`}
            alt={cam.position_label}
            className="w-full h-full object-contain"
            onLoad={drawOverlay}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ objectFit: "contain" }}
          />
        </>
      ) : (
        <p className="text-slate-500 text-[12px]">No image available</p>
      )}
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

          {/* Overall car/2W summary */}
          <div className="hidden sm:flex items-center gap-4 text-[11px] font-semibold">
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1.5">
              <Car size={14} className="text-blue-500" />
              <span className="text-blue-600 font-bold">Cars</span>
              <span className="text-slate-500">Total <b>{totalCapCar}</b></span>
              <span className="text-red-500">Occupied <b>{totalOccCar}</b></span>
              <span className="text-emerald-600">Available <b>{totalAvailCar}</b></span>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-1.5">
              <Bike size={14} className="text-indigo-500" />
              <span className="text-indigo-600 font-bold">2W</span>
              <span className="text-slate-500">Total <b>{totalCap2w}</b></span>
              <span className="text-red-500">Occupied <b>{totalOcc2w}</b></span>
              <span className="text-emerald-600">Available <b>{totalAvail2w}</b></span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile summary */}
      <div className="sm:hidden px-4 pt-3 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl card-shadow p-2.5 flex items-center gap-2">
            <Car size={14} className="text-blue-500" />
            <span className="text-[11px] font-bold text-blue-600">Cars</span>
            <span className="text-[10px] text-slate-500 ml-auto">{totalOccCar}/{totalCapCar}</span>
            <span className="text-[10px] text-emerald-600">{totalAvailCar} avail</span>
          </div>
          <div className="bg-white rounded-xl card-shadow p-2.5 flex items-center gap-2">
            <Bike size={14} className="text-indigo-500" />
            <span className="text-[11px] font-bold text-indigo-600">2W</span>
            <span className="text-[10px] text-slate-500 ml-auto">{totalOcc2w}/{totalCap2w}</span>
            <span className="text-[10px] text-emerald-600">{totalAvail2w} avail</span>
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
                        <div className="w-4/5 bg-slate-900 relative">
                          <CameraImageOverlay cam={cam} showDebug={showDebug} />
                          {IS_DEV && (
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
                          )}
                        </div>

                        {/* Stats column */}
                        <div className="w-1/5 flex flex-col gap-3 p-4">
                          {/* Cars */}
                          <div className="bg-blue-50 rounded-xl p-4 flex-1 flex flex-col items-center justify-center">
                            <div className="flex items-center gap-2 mb-3">
                              <Car size={22} className="text-blue-500" />
                              <p className="text-[18px] text-blue-600 font-bold">Cars</p>
                            </div>
                            <div className="w-full space-y-1.5 text-center">
                              <p className="text-[15px] text-slate-500">Total <span className="font-bold text-slate-700 text-[18px]">{camCapCar}</span></p>
                              <p className="text-[15px] text-red-500">Occupied <span className="font-bold text-[18px]">{camOccCar}</span></p>
                              <p className="text-[15px] text-emerald-600">Available <span className="font-bold text-[18px]">{availCar}</span></p>
                            </div>
                          </div>
                          {/* 2-Wheelers */}
                          <div className="bg-indigo-50 rounded-xl p-4 flex-1 flex flex-col items-center justify-center">
                            <div className="flex items-center gap-2 mb-3">
                              <Bike size={22} className="text-indigo-500" />
                              <p className="text-[18px] text-indigo-600 font-bold">2-Wheeler</p>
                            </div>
                            <div className="w-full space-y-1.5 text-center">
                              <p className="text-[15px] text-slate-500">Total <span className="font-bold text-slate-700 text-[18px]">{camCap2w}</span></p>
                              <p className="text-[15px] text-red-500">Occupied <span className="font-bold text-[18px]">{camOcc2w}</span></p>
                              <p className="text-[15px] text-emerald-600">Available <span className="font-bold text-[18px]">{avail2w}</span></p>
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
