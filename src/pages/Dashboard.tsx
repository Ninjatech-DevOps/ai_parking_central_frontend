import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import { devicesApi, alertsApi, locationsApi, slotEventsApi } from "@/services/api";
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
  const { filterLabel, deviceQueryParams, queryParams, alertQueryParams, locationId } = useFilter();

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

    // When a specific location is selected, only fetch canvas for that one;
    // otherwise fetch for all listed locations (the list endpoint doesn't support location_id filter)
    const locationsForCanvas = locationId
      ? (l.data.items || []).filter((loc) => loc.id === locationId)
      : (l.data.items || []);

    const canvases = await Promise.all(
      locationsForCanvas.map((loc) => locationsApi.canvas(loc.id).then(({ data }) => data).catch(() => null))
    );
    const validCanvases = canvases.filter((c): c is CanvasResponse => c !== null && c.cameras.length > 0);
    setCanvasData(validCanvases);
    // Compute total slots from canvas data (accurate, filter-aware)
    setTotalSlots(validCanvases.reduce((sum, c) => sum + c.cameras.reduce((s2, cam) => s2 + cam.slots.length, 0), 0));
  }, [deviceQueryParams, queryParams, alertQueryParams, locationId]);
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
  const [slotImageUrl, setSlotImageUrl] = useState<string | null>(null);
  const [slotImageLoading, setSlotImageLoading] = useState(false);

  async function handleSlotClick(slotId: string, cam: CanvasCamera, locName: string) {
    setSelectedSlot({ cam, slotId, locName });
    setSlotImageUrl(null);
    setSlotImageLoading(true);

    try {
      const { data } = await slotEventsApi.bySlot(slotId, "limit=1");
      const events = Array.isArray(data) ? data : [];
      const latest = events.find((e: { image_url?: string | null }) => e.image_url);
      if (latest?.image_url) {
        setSlotImageUrl(latest.image_url);
      }
    } catch { /* no events */ }
    setSlotImageLoading(false);
  }

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
                  slots={cam.slots.map((s) => ({ id: s.id, label: s.label, state: s.state, slot_type: s.slot_type, detected_vehicle_type: s.detected_vehicle_type }))}
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

      {/* Slot detail dialog — cropped slot image */}
      <CrudDialog
        open={!!selectedSlot}
        onClose={() => { setSelectedSlot(null); setSlotImageUrl(null); }}
        title={`${selectedSlot?.locName} — ${selectedSlot?.cam.position_label}`}
        maxWidth="min(480px, 95vw)"
      >
        {selectedSlot && (() => {
          const slot = selectedSlot.cam.slots.find((s) => s.id === selectedSlot.slotId);
          if (!slot) return null;
          const sc = slot.state === "VEHICLE" ? "text-red-500" : slot.state === "OBSTRUCTED" ? "text-amber-500" : "text-emerald-500";
          const bg = slot.state === "VEHICLE" ? "bg-red-50" : slot.state === "OBSTRUCTED" ? "bg-amber-50" : "bg-emerald-50";
          return (
            <div className="mt-3">
              {/* Slot info */}
              <div className="flex items-center justify-between px-1 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-slate-800">{slot.label}</span>
                  {slot.slot_type && slot.slot_type !== "GENERAL" && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
                      {slot.slot_type === "TWO_WHEELER" ? "2-Wheeler" : "Car"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {slot.state === "VEHICLE" && slot.detected_vehicle_type && (
                    <span className="text-[10px] font-semibold text-blue-500 bg-blue-50 rounded px-1.5 py-0.5">
                      {slot.detected_vehicle_type === "TWO_WHEELER" ? "2-Wheeler" : "Car"}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${bg} ${sc}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${slot.state === "VEHICLE" ? "bg-red-500" : slot.state === "OBSTRUCTED" ? "bg-amber-500" : "bg-emerald-500"}`} />
                    {slot.state}
                  </span>
                </div>
              </div>
              {/* Cropped slot image */}
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                {slotImageLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : slotImageUrl ? (
                  <img src={slotImageUrl} alt={slot.label} className="w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <ParkingSquare size={28} className="text-slate-200 mb-2" />
                    <p className="text-[13px]">No image available</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">Image will appear after next detection</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </CrudDialog>
    </div>
  );
}


