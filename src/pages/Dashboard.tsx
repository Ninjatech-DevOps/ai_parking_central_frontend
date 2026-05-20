import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import { devicesApi, alertsApi, locationsApi, camerasApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import CameraCanvas from "@/components/CameraCanvas";
import ParkingGrid from "@/components/ParkingGrid";
import CrudDialog from "@/components/CrudDialog";
import { Monitor, MapPin, ParkingSquare, AlertTriangle, Clock, TrendingUp, Wifi, WifiOff, Grid3X3, LayoutGrid, ArrowRight } from "lucide-react";
import type { Device, AlertEvent, CanvasResponse, CanvasCamera } from "@/types/api";

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { filterLabel, deviceQueryParams, queryParams, alertQueryParams } = useFilter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [totalDevices, setTotalDevices] = useState(0);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);
  const [totalSlots, setTotalSlots] = useState(0);

  // Canvas data — all locations with cameras
  const [canvasData, setCanvasData] = useState<CanvasResponse[]>([]);

  const fetchData = useCallback(async () => {
    const devParams = deviceQueryParams ? `page_size=200&${deviceQueryParams}` : "page_size=200";
    const locParams = queryParams ? `page_size=100&${queryParams}` : "page_size=100";
    const [d, a, l] = await Promise.all([
      devicesApi.list(devParams), alertsApi.list(alertQueryParams ? `page_size=50&${alertQueryParams}` : "page_size=50"),
      locationsApi.list(locParams),
    ]);
    setDevices(d.data.items || []); setTotalDevices(d.data.total || 0);
    setAlerts(a.data.items || []); setTotalAlerts(a.data.total || 0);
    setTotalLocations(l.data.total || 0);

    // Fetch canvas for each location — slot count derived from canvas
    const canvases = await Promise.all(
      (l.data.items || []).map((loc) => locationsApi.canvas(loc.id).then(({ data }) => data).catch(() => null))
    );
    const validCanvases = canvases.filter((c): c is CanvasResponse => c !== null && c.cameras.length > 0);
    setCanvasData(validCanvases);
    // Compute total slots from canvas data (accurate, filter-aware)
    setTotalSlots(validCanvases.reduce((sum, c) => sum + c.cameras.reduce((s2, cam) => s2 + cam.slots.length, 0), 0));
  }, [deviceQueryParams, queryParams, alertQueryParams]);
  usePolling(fetchData, 5000);

  const online = devices.filter((d) => d.status === "ONLINE").length;
  const offline = devices.filter((d) => d.status === "OFFLINE").length;

  return (
    <div className="w-full">
      <div className="mb-8">
        <p className="text-[12px] font-semibold text-teal-600 uppercase tracking-wider mb-1">{today}</p>
        <h1 className="text-[24px] font-bold text-slate-900">{getGreeting()}, {user?.name?.split(" ")[0]}</h1>
        <p className="text-slate-500 text-[14px] mt-0.5">
          Showing data for <span className="font-semibold text-slate-700">{filterLabel}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-8">
        {[
          { label: "Devices", value: totalDevices, icon: Monitor, color: "teal",
            extra: <div className="flex gap-2 mt-2"><span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><Wifi size={10} />{online}</span>{offline > 0 && <span className="flex items-center gap-1 text-[11px] text-red-500"><WifiOff size={10} />{offline}</span>}</div> },
          { label: "Locations", value: totalLocations, icon: MapPin, color: "violet" },
          { label: "Parking Slots", value: totalSlots, icon: ParkingSquare, color: "amber" },
          { label: "Active Alerts", value: totalAlerts, icon: AlertTriangle, color: "rose",
            extra: totalAlerts > 0 ? <p className="text-[11px] font-semibold text-red-600 mt-2">{alerts.filter((a) => a.severity === "CRITICAL").length} critical</p> : null },
        ].map(({ label, value, icon: Icon, color, extra }) => (
          <div key={label} className="bg-white rounded-2xl p-5 card-shadow transition-lift hover:card-shadow-hover cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                color === "teal" ? "bg-teal-50 text-teal-600" : color === "violet" ? "bg-violet-50 text-violet-600" : color === "amber" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
              }`}><Icon size={20} strokeWidth={1.8} /></div>
              <TrendingUp size={14} className="text-slate-300" />
            </div>
            <p className="text-[28px] font-bold text-slate-900 leading-none">{value}</p>
            <p className="text-[13px] text-slate-500 mt-1">{label}</p>
            {extra}
          </div>
        ))}
      </div>

      {/* Live Camera Views */}
      {canvasData.length > 0 && (
        <DashboardCameraSection canvasData={canvasData} />
      )}

      {/* Alerts + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5">
        <div className="col-span-1 lg:col-span-3 bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <div><h3 className="text-[15px] font-bold text-slate-900">Recent Alerts</h3><p className="text-[12px] text-slate-400 mt-0.5">{totalAlerts} total</p></div>
            <div className="flex items-center gap-2">
              {totalAlerts > 0 && <span className="text-[11px] font-bold text-red-600 bg-red-50 rounded-lg px-2.5 py-1">{alerts.filter((a) => a.severity === "CRITICAL").length} critical</span>}
              <button onClick={() => navigate("/alerts")} className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">View All <ArrowRight size={11} /></button>
            </div>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400"><div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><AlertTriangle size={22} className="text-slate-300" /></div><p className="text-[13px] font-medium">No active alerts</p></div>
          ) : alerts.slice(0, 5).map((a, i) => (
            <div key={a.id} className={`flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/50 transition-colors ${i < 4 ? "border-b border-slate-50" : ""}`}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.severity === "CRITICAL" ? "bg-red-500 animate-pulse" : a.severity === "HIGH" ? "bg-orange-400" : a.severity === "MEDIUM" ? "bg-amber-400" : "bg-teal-400"}`} />
              <p className="flex-1 text-[13px] text-slate-600 truncate">{a.message}</p>
              <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1.5 tabular-nums"><Clock size={11} />{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
        </div>

        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <div><h3 className="text-[15px] font-bold text-slate-900">Device Fleet</h3><p className="text-[12px] text-slate-400 mt-0.5">{online} online · {offline} offline</p></div>
            <button onClick={() => navigate("/devices")} className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">View All <ArrowRight size={11} /></button>
          </div>
          {devices.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400"><div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><Monitor size={22} className="text-slate-300" /></div><p className="text-[13px] font-medium">No devices</p></div>
          ) : devices.slice(0, 7).map((d, i) => (
            <div key={d.id} className={`flex items-center justify-between px-6 py-3 hover:bg-slate-50/50 transition-colors ${i < 6 ? "border-b border-slate-50" : ""}`}>
              <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${d.status === "ONLINE" ? "bg-emerald-400" : "bg-red-400"}`} /><span className="text-[13px] font-semibold text-slate-700">{d.device_id}</span></div>
              <span className={`text-[11px] font-bold uppercase tracking-wide ${d.status === "ONLINE" ? "text-emerald-600" : "text-red-500"}`}>{d.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function DashboardCameraSection({ canvasData }: { canvasData: CanvasResponse[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "canvas">("grid");
  const [selectedSlot, setSelectedSlot] = useState<{ cam: CanvasCamera; slotId: string; locName: string } | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  // "idle" = done, "loading" = fetching cached image, "refreshing" = capturing fresh from device
  const [snapshotStatus, setSnapshotStatus] = useState<"idle" | "loading" | "refreshing">("idle");

  const activeSlotCamRef = useRef<string | null>(null);

  async function handleSlotClick(slotId: string, cam: CanvasCamera, locName: string) {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    setSelectedSlot({ cam, slotId, locName });
    setSnapshotUrl(null);
    setSnapshotStatus("loading");
    activeSlotCamRef.current = cam.id;

    // 1. Show existing snapshot immediately (may be old, better than nothing)
    try {
      const url = await camerasApi.snapshotBlobUrl(cam.id);
      if (activeSlotCamRef.current !== cam.id) return;
      setSnapshotUrl(url);
    } catch { /* no snapshot yet */ }

    // 2. Trigger fresh capture in background, refresh after delay
    if (activeSlotCamRef.current !== cam.id) return;
    setSnapshotStatus("refreshing");
    camerasApi.captureSnapshot(cam.id).catch(() => {});
    for (const delay of [5000, 4000]) {
      await new Promise((r) => setTimeout(r, delay));
      if (activeSlotCamRef.current !== cam.id) return;
      try {
        const url = await camerasApi.snapshotBlobUrl(cam.id);
        if (activeSlotCamRef.current !== cam.id) return;
        setSnapshotUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch { /* ignore */ }
    }
    if (activeSlotCamRef.current === cam.id) setSnapshotStatus("idle");
  }

  // Build a highlighted camera for the canvas view (only the clicked slot highlighted)
  const highlightedCam = selectedSlot ? {
    ...selectedSlot.cam,
  } : null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900">Live Parking View</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {canvasData.reduce((s, c) => s + c.cameras.length, 0)} cameras across {canvasData.length} locations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all ${viewMode === "grid" ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <Grid3X3 size={13} /> Grid
            </button>
            <button
              onClick={() => setViewMode("canvas")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border-l border-slate-200 transition-all ${viewMode === "canvas" ? "bg-teal-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <LayoutGrid size={13} /> Canvas
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {canvasData.map((loc) =>
          loc.cameras.map((cam) => (
            <div key={cam.id}>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{loc.location_name}</p>
              {viewMode === "grid" ? (
                <ParkingGrid
                  slots={cam.slots.map((s) => ({ id: s.id, label: s.label, state: s.state }))}
                  cameraLabel={cam.position_label}
                  onSlotClick={(slot) => handleSlotClick(slot.id, cam, loc.location_name)}
                />
              ) : (
                <CameraCanvas camera={cam} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Slot detail dialog with canvas + snapshot */}
      <CrudDialog
        open={!!selectedSlot}
        onClose={() => { activeSlotCamRef.current = null; setSelectedSlot(null); if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); setSnapshotUrl(null); } setSnapshotStatus("idle"); }}
        title={`${selectedSlot?.locName} — ${selectedSlot?.cam.position_label}`}
        maxWidth="min(1024px, 95vw)"
      >
        {selectedSlot && highlightedCam && (
          <div className="mt-3">
            <div className="relative">
              <SlotDetailCanvas cam={highlightedCam} snapshotUrl={snapshotUrl} highlightSlotId={selectedSlot.slotId} />
              {snapshotStatus !== "idle" && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3">
                  <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <span className="text-[13px] font-semibold text-white block">
                      {snapshotStatus === "loading" ? "Fetching image from device…" : "Capturing fresh image from device…"}
                    </span>
                    <span className="text-[11px] text-slate-300">
                      {snapshotStatus === "loading" ? "Loading last captured snapshot" : "New snapshot will replace shortly"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* Slot info */}
            {(() => {
              const slot = highlightedCam.slots.find((s) => s.id === selectedSlot.slotId);
              if (!slot) return null;
              const sc = slot.state === "VEHICLE" ? "text-red-500" : slot.state === "OBSTRUCTED" ? "text-amber-500" : "text-emerald-500";
              return (
                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[14px] font-bold text-slate-800">{slot.label}</span>
                  <span className={`text-[12px] font-bold ${sc}`}>{slot.state}</span>
                </div>
              );
            })()}
          </div>
        )}
      </CrudDialog>
    </div>
  );
}


function SlotDetailCanvas({ cam, snapshotUrl, highlightSlotId }: { cam: CanvasCamera; snapshotUrl: string | null; highlightSlotId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerWidth = container.clientWidth;
    const frameW = cam.frame_width || 1920;
    const frameH = cam.frame_height || 1080;
    const aspect = frameH / frameW;
    const w = containerWidth;
    const h = Math.round(containerWidth * aspect);
    const scale = w / frameW;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Black background first, then image if available
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    const img = imgRef.current;
    if (img) {
      ctx.drawImage(img, 0, 0, w, h);
    }

    // Draw all slots
    for (const slot of cam.slots) {
      if (!slot.polygon_coords) continue;
      try {
        const pts: number[][] = JSON.parse(slot.polygon_coords);
        const isHighlighted = slot.id === highlightSlotId;

        ctx.beginPath();
        ctx.moveTo(pts[0][0] * scale, pts[0][1] * scale);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * scale, pts[i][1] * scale);
        ctx.closePath();

        if (isHighlighted) {
          ctx.fillStyle = slot.state === "VEHICLE" ? "rgba(239,68,68,0.4)" : slot.state === "OBSTRUCTED" ? "rgba(245,158,11,0.4)" : "rgba(34,197,94,0.4)";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
        } else {
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();

        // Label
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length * scale;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length * scale;
        ctx.font = isHighlighted ? "bold 14px Inter, sans-serif" : "11px Inter, sans-serif";
        ctx.fillStyle = isHighlighted ? "#ffffff" : "rgba(255,255,255,0.6)";
        ctx.textAlign = "center";
        ctx.fillText(slot.label, cx, cy + 4);
      } catch { /* ignore */ }
    }
  }, [cam, highlightSlotId]);

  // Draw on mount and resize
  useEffect(() => {
    drawCanvas();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => drawCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawCanvas]);

  // When snapshotUrl changes: clear old image or load new one
  useEffect(() => {
    if (!snapshotUrl) {
      imgRef.current = null;
      drawCanvas(); // redraw black canvas with polygons only
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = snapshotUrl;
    img.onload = () => {
      imgRef.current = img;
      drawCanvas();
    };
  }, [snapshotUrl, drawCanvas]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ borderRadius: 12, display: "block", width: "100%" }}
      />
    </div>
  );
}
