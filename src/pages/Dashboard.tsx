import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import { devicesApi, locationsApi, sharedLinksApi, anprSessionsApi, vehicleMovementsApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import CrudDialog from "@/components/CrudDialog";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import {
  MapPin, ParkingSquare,
  RefreshCw, Camera, CircleCheck, Car, Ban, Bike,
  Eye, Image as ImageIcon, Loader2, ArrowDownToLine, ArrowUpFromLine,
  ArrowLeftRight, ChevronRight,
} from "lucide-react";
import type { Device, Location, CanvasResponse, CanvasCamera, SharedLink, AnprReport, VehicleMovementSummary } from "@/types/api";
import RequirePermission from "@/components/RequirePermission";

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

// Locations whose cameras are hidden from the AI Parking "Camera Overview" table
// (e.g. ANPR-only entry/exit gates that don't have parking slots).
const HIDDEN_CAMERA_LOCATIONS = ["Prahaladnagar MLP"];

// Normalize a location name for matching (lowercase, strip spaces/punctuation).
const normLoc = (v?: string | null) => (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Force specific locations to a fixed share-link token (overrides the auto lookup).
// Key = normalized location name, value = share token.
const LOCATION_LINK_OVERRIDES: Record<string, string> = {
  opengroundprahaladnagar: "SYb0FEYDb_Sfrbj_foHAZQ", // Open Ground - Prahaladnagar
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { filterLabel, deviceQueryParams, queryParams, locationId, areaId, areas } = useFilter();

  // Clicking a location opens *that location's own* public share link in a new tab.
  // LOCATION-scoped links store their location id(s) in `camera_ids` (see SharedLinks
  // page create logic). We match by id first (robust to array / JSON / CSV shapes,
  // and scope_id), then fall back to matching the link name to the location name.
  // If nothing matches, fall back to the internal single-location Parking History page.
  async function openLocationHistory(locId: string, locName?: string) {
    // Fixed override for specific locations (e.g. Open Ground → its current share link).
    const override = locName ? LOCATION_LINK_OVERRIDES[normLoc(locName)] : undefined;
    if (override) {
      window.open(`${window.location.origin}/view/${override}`, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { data } = await sharedLinksApi.list("is_active=true&page_size=500");
      const links = (data.items || []).filter((l) => l.is_active && l.scope_type === "LOCATION");
      const parseIds = (l: SharedLink): string[] => {
        const raw = l.camera_ids as unknown;
        if (Array.isArray(raw)) return raw as string[];
        const s = String(raw || "").trim();
        if (s.startsWith("[")) { try { return JSON.parse(s) as string[]; } catch { /* not JSON */ } }
        return s.split(",").map((x) => x.trim()).filter(Boolean);
      };
      const norm = (v?: string | null) => (v || "").trim().toLowerCase();
      // A location can have several active links (old + new). Match by id, scope_id,
      // or name, then pick the MOST RECENTLY CREATED so a fresh link supersedes old ones.
      const matches = links.filter(
        (l) => parseIds(l).includes(locId) || l.scope_id === locId || (locName ? norm(l.name) === norm(locName) : false),
      );
      const link = matches.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];
      if (link?.token) {
        window.open(`${window.location.origin}/view/${link.token}`, "_blank", "noopener,noreferrer");
        return;
      }
    } catch { /* fall through to the internal page */ }
    navigate(`/parking-history/location/${locId}`);
  }

  const [devices, setDevices] = useState<Device[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [canvasData, setCanvasData] = useState<CanvasResponse[]>([]);
  // ANPR (Prahaladnagar MLP) aggregate — 2nd data source for the Camera Overview.
  const [anprReport, setAnprReport] = useState<AnprReport | null>(null);
  const [flowSummary, setFlowSummary] = useState<VehicleMovementSummary | null>(null);
  const [mlpLocation, setMlpLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  // Snapshot dialog state
  const [snapshotCam, setSnapshotCam] = useState<{ cam: CanvasCamera; locName: string } | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const devParams = deviceQueryParams ? `page_size=200&${deviceQueryParams}` : "page_size=200";
      // Locations API doesn't accept location_id — use area_id filter when available
      const locParams = (() => {
        const p = new URLSearchParams({ page_size: "100" });
        if (areaId) p.set("area_id", areaId);
        else if (queryParams) return `page_size=100&${queryParams}`;
        return p.toString();
      })();
      const [d, l] = await Promise.all([
        devicesApi.list(devParams),
        locationsApi.list(locParams),
      ]);
      setDevices(d.data.items || []);

      // When a specific location is selected, only use that one
      const locationsForCanvas = locationId
        ? (l.data.items || []).filter((loc) => loc.id === locationId)
        : (l.data.items || []);
      setLocationsList(locationsForCanvas);

      const canvases = await Promise.all(
        locationsForCanvas.map((loc) => locationsApi.canvas(loc.id).then(({ data }) => data).catch(() => null))
      );
      const validCanvases = canvases.filter((c): c is CanvasResponse => c !== null && c.cameras.length > 0);
      setCanvasData(validCanvases);
      // Only show locations that have AI Parking canvas data (cameras with slots)
      const canvasLocationIds = new Set(validCanvases.map((c) => c.location_id));
      setLocationsList(locationsForCanvas.filter((loc) => canvasLocationIds.has(loc.id)));

      // 2nd Camera-Overview data source: the ANPR (Prahaladnagar MLP) aggregate,
      // using the same "today" window as the MLP History cards so the counts match.
      setMlpLocation((l.data.items || []).find((loc) => HIDDEN_CAMERA_LOCATIONS.includes(loc.name)) || null);
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const reportParams = `start_date=${dayStart.toISOString()}&end_date=${new Date(dayStart.getTime() + 86400000).toISOString()}`;
      try {
        const { data: report } = await anprSessionsApi.report(reportParams);
        setAnprReport(report);
      } catch { setAnprReport(null); }

      // 3rd source: the Vehicle In / Out module — today's entry/exit totals.
      // quick_range is resolved server-side in IST; page_size=1 because only the
      // `summary` block is wanted here, not the rows.
      const flowParams = new URLSearchParams({ quick_range: "today", page: "1", page_size: "1" });
      if (locationId) flowParams.set("location_id", locationId);
      else if (areaId) flowParams.set("area_id", areaId);
      try {
        const { data: flow } = await vehicleMovementsApi.list(flowParams.toString());
        setFlowSummary(flow.summary);
      } catch { setFlowSummary(null); }
    } finally {
      setLoading(false);
    }
  }, [deviceQueryParams, queryParams, locationId, areaId]);
  usePolling(fetchData, 5000);

  const online = devices.filter((d) => d.status === "ONLINE").length;
  const offline = devices.filter((d) => d.status === "OFFLINE").length;
  const totalCameras = canvasData.reduce((sum, c) => sum + c.cameras.length, 0);
  const allSlots = canvasData.flatMap((c) => c.cameras.flatMap((cam) => cam.slots));
  const totalSlots = allSlots.reduce((sum, s) => sum + ((s.capacity_car || 0) + (s.capacity_two_wheeler || 0) || 1), 0);
  const totalCapCar = allSlots.reduce((sum, s) => sum + (s.capacity_car || 0), 0);
  const totalCap2w = allSlots.reduce((sum, s) => sum + (s.capacity_two_wheeler || 0), 0);
  const occCar = allSlots.reduce((sum, s) => sum + (s.occupied_car || 0), 0);
  const occ2w = allSlots.reduce((sum, s) => sum + (s.occupied_two_wheeler || 0), 0);
  const slotsOccupied = occCar + occ2w;
  const slotsObstructed = allSlots.filter((s) => s.state === "OBSTRUCTED" || s.has_obstruction).length;
  const slotsAvailable = Math.max(0, totalSlots - slotsOccupied - slotsObstructed);
  const availCar = Math.max(0, totalCapCar - occCar);
  const avail2w = Math.max(0, totalCap2w - occ2w);

  // Location-scoped visibility:
  //  • "All" (no location selected) → show both AI Parking and Prahaladnagar MLP.
  //  • a specific AI Parking location → show only AI Parking (hide MLP).
  //  • Prahaladnagar MLP selected     → show only MLP (hide AI Parking).
  const mlpSelected = !!locationId && !!mlpLocation && locationId === mlpLocation.id;
  const showAnpr = !locationId || mlpSelected;
  const showAiParking = !locationId || !mlpSelected;

  // Flatten cameras with location info for table
  const cameraRows = canvasData.flatMap((loc) =>
    loc.cameras.map((cam) => {
      const total = cam.slots.reduce((sum, s) => sum + ((s.capacity_car || 0) + (s.capacity_two_wheeler || 0) || 1), 0);
      const occupied = cam.slots.reduce((sum, s) => sum + (s.occupied_car || 0) + (s.occupied_two_wheeler || 0), 0);
      const obstructed = cam.slots.filter((s) => s.state === "OBSTRUCTED" || s.has_obstruction).length;
      const available = Math.max(0, total - occupied - obstructed);
      const mismatched = cam.slots.filter((s) => s.is_mismatched).length;
      const capCar = cam.slots.reduce((s, sl) => s + (sl.capacity_car || 0), 0);
      const cap2w = cam.slots.reduce((s, sl) => s + (sl.capacity_two_wheeler || 0), 0);
      const occCar = cam.slots.reduce((s, sl) => s + (sl.occupied_car || 0), 0);
      const occ2w = cam.slots.reduce((s, sl) => s + (sl.occupied_two_wheeler || 0), 0);
      return { cam, locName: loc.location_name, locId: loc.location_id, total, available, occupied, obstructed, mismatched, capCar, cap2w, occCar, occ2w };
    })
  ).filter((r) => showAiParking && !HIDDEN_CAMERA_LOCATIONS.includes(r.locName));

  // Locations shown in the "Parking Locations" section (hidden ANPR-only locations excluded).
  const visibleLocations = locationsList.filter((l) => showAiParking && !HIDDEN_CAMERA_LOCATIONS.includes(l.name));

  // ANPR (Prahaladnagar MLP) aggregate row for the Camera Overview + Parking Locations.
  const mlp = anprReport && showAnpr
    ? {
        name: mlpLocation?.name || HIDDEN_CAMERA_LOCATIONS[0],
        locId: mlpLocation?.id,
        type: mlpLocation?.location_type || "Commercial",
        areaName: areas.find((a) => a.id === mlpLocation?.area_id)?.name || "—",
        car: anprReport.summary.car,
        bike: anprReport.summary.bike,
        occupancyPct: anprReport.summary.occupancy_pct,
        capacity: anprReport.summary.car.total + anprReport.summary.bike.total,
      }
    : null;

  // ANPR (Prahaladnagar MLP) occupancy = IN − OUT (vehicles still inside).
  // Available / Total come straight from the ANPR report.
  const anprCarOcc = mlp ? Math.max(0, mlp.car.in - mlp.car.out) : 0;
  const anpr2wOcc = mlp ? Math.max(0, mlp.bike.in - mlp.bike.out) : 0;
  const anprCarAvail = mlp ? mlp.car.available : 0;
  const anpr2wAvail = mlp ? mlp.bike.available : 0;
  const anprCarTotal = mlp ? mlp.car.total : 0;
  const anpr2wTotal = mlp ? mlp.bike.total : 0;

  // Vehicle In / Out module — today's entry and exit totals. `net` comes straight
  // from the API and may be negative, which is meaningful; don't clamp it.
  const flowIn = flowSummary?.total_in ?? 0;
  const flowOut = flowSummary?.total_out ?? 0;
  const flowNet = flowSummary?.net ?? 0;

  // KPI cards / Totals row = AI Parking (slots) + ANPR/MLP (IN−OUT) combined.
  const kpiCarOcc = occCar + anprCarOcc;
  const kpiCarAvail = availCar + anprCarAvail;
  const kpiCarTotal = totalCapCar + anprCarTotal;
  const kpi2wOcc = occ2w + anpr2wOcc;
  const kpi2wAvail = avail2w + anpr2wAvail;
  const kpi2wTotal = totalCap2w + anpr2wTotal;
  const kpiOccupied = slotsOccupied + anprCarOcc + anpr2wOcc;
  const kpiAvailable = slotsAvailable + anprCarAvail + anpr2wAvail;
  const kpiTotalCapacity = totalSlots + anprCarTotal + anpr2wTotal;


  // `loading` is true only during the first fetch (refreshes use `refreshing`), so this
  // keeps the skeleton up for the whole initial load — including while canvas data is still
  // arriving after the locations list has been populated.
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[12px] font-semibold text-teal-600 uppercase tracking-wider mb-1">{today}</p>
          <h1 className="text-[24px] font-bold text-slate-900">{getGreeting()}, {user?.name?.split(" ")[0]}</h1>
          <p className="text-slate-500 text-[14px] mt-0.5">
            Showing data for <span className="font-semibold text-slate-700">{filterLabel}</span>
          </p>
        </div>
        <button onClick={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl px-3.5 py-2 transition-colors card-shadow">
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Locations" value={locationsList.length} icon={MapPin} bg="bg-violet-50" text="text-violet-600" />
        <StatCard label="Cameras" value={totalCameras} icon={Camera} bg="bg-blue-50" text="text-blue-600" />
        <StatCard label="Occupied" value={kpiOccupied} icon={Car} bg="bg-red-50" text="text-red-500" />
        <StatCard label="Available" value={kpiAvailable} icon={CircleCheck} bg="bg-emerald-50" text="text-emerald-600" />
        <StatCard label="Total Capacity" value={kpiTotalCapacity} icon={ParkingSquare} bg="bg-slate-100" text="text-slate-600" />
        <StatCard label="Car Occupied" value={kpiCarOcc} icon={Car} bg="bg-red-50" text="text-red-500" />
        <StatCard label="Car Available" value={kpiCarAvail} icon={CircleCheck} bg="bg-emerald-50" text="text-emerald-600" />
        <StatCard label="Car Total" value={kpiCarTotal} icon={Car} bg="bg-blue-50" text="text-blue-600" />
        <StatCard label="2W Occupied" value={kpi2wOcc} icon={Bike} bg="bg-red-50" text="text-red-500" />
        <StatCard label="2W Available" value={kpi2wAvail} icon={CircleCheck} bg="bg-emerald-50" text="text-emerald-600" />
        <StatCard label="2W Total" value={kpi2wTotal} icon={Bike} bg="bg-indigo-50" text="text-indigo-600" />
        <StatCard label="Obstructed" value={slotsObstructed} icon={Ban} bg="bg-amber-50" text="text-amber-600" />
      </div>

      {/* Vehicle In / Out — its own band so it reads as a separate module, not
          another slot metric. The whole card opens the full screen. */}
      <RequirePermission permission="vehicle_movements:view">
      <button
        onClick={() => navigate("/vehicle-movements")}
        className="w-full text-left bg-white rounded-2xl card-shadow p-5 mb-8 border border-slate-100 hover:border-teal-200 transition-lift hover:card-shadow-hover group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <ArrowLeftRight size={16} className="text-teal-600" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-800">Vehicle In / Out</p>
              <p className="text-[11px] text-slate-400">Today's entries and exits</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-slate-400 group-hover:text-teal-600 transition-colors">
            View details <ChevronRight size={14} />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "In", value: flowIn, icon: ArrowDownToLine, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-600" },
            { label: "Out", value: flowOut, icon: ArrowUpFromLine, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-600" },
            { label: "Still Inside", value: flowNet, icon: Car, border: "border-teal-200", bg: "bg-teal-50", text: "text-teal-700" },
          ].map(({ label, value, icon: Icon, border, bg, text }) => (
            <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} className={text} />
                <p className="text-[11px] font-semibold text-slate-500">{label}</p>
              </div>
              <p className={`text-[28px] font-bold leading-none ${text}`}>{value}</p>
            </div>
          ))}
        </div>
      </button>
      </RequirePermission>

      {/* Camera Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Camera Overview</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">{cameraRows.length} cameras across {canvasData.length} locations</p>
          </div>
        </div>
        {cameraRows.length === 0 && !mlp ? (
          <div className="flex flex-col items-center py-20 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
              <Camera size={24} className="text-slate-300" />
            </div>
            <p className="text-[14px] font-semibold">No cameras found</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Cameras will appear once devices are configured</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Camera</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Car Total</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Occ</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Avail</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W Total</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Obstructed</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cameraRows.map(({ cam, locName, locId, total, available, occupied, obstructed, capCar, cap2w, occCar, occ2w }, idx) => {
                  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                  // Prefer the clean latest frame (ROI only, no vehicle boxes).
                  const frameUrl = cam.latest_frame_url || cam.clean_frame_url || cam.debug_frame_url;
                  return (
                    <tr key={cam.id} className={`border-b hover:bg-slate-50/60 transition-colors ${obstructed > 0 ? "border-l-4 border-l-red-500 bg-red-50/40 border-b-red-100" : `border-b-slate-50 ${idx % 2 === 0 ? "" : "bg-slate-25"}`}`}>
                      <td className="px-6 py-4">
                        <div onClick={() => openLocationHistory(locId, locName)} title={`View ${locName} parking history`} className="flex items-center gap-3 cursor-pointer group w-fit">
                          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                            <MapPin size={16} className="text-violet-500" />
                          </div>
                          <span className="text-[14px] font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">{locName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <Camera size={13} className="text-blue-500" />
                          </div>
                          <span className="text-[14px] font-semibold text-slate-700">{cam.position_label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[18px] font-bold ${occCar > 0 ? "text-red-500" : "text-slate-300"}`}>{occCar}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[18px] font-bold text-emerald-600">{Math.max(0, capCar - occCar)}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[18px] font-bold text-slate-800">{capCar}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[18px] font-bold ${occ2w > 0 ? "text-red-500" : "text-slate-300"}`}>{occ2w}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[18px] font-bold text-emerald-600">{Math.max(0, cap2w - occ2w)}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[18px] font-bold text-slate-800">{cap2w}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[18px] font-bold ${obstructed > 0 ? "text-amber-500" : "text-slate-300"}`}>{obstructed}</span>
                      </td>
                      {/* <td className="px-3 py-4 text-center">
                        <span className={`text-[18px] font-bold ${mismatched > 0 ? "text-blue-500" : "text-slate-300"}`}>{mismatched}</span>
                      </td> */}
                      <td className="px-3 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${occupancyPct >= 90 ? "bg-red-500" : occupancyPct >= 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                              style={{ width: `${occupancyPct}%` }}
                            />
                          </div>
                          <span className={`text-[12px] font-bold tabular-nums ${occupancyPct >= 90 ? "text-red-500" : occupancyPct >= 60 ? "text-amber-500" : "text-emerald-600"}`}>
                            {occupancyPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Latest-image button — hidden for now (only the view icon is shown)
                          <button
                            onClick={(e) => { e.stopPropagation(); setSnapshotCam({ cam, locName }); setSnapshotUrl(frameUrl ? `${frameUrl}${frameUrl.includes("?") ? "&" : "?"}t=${Date.now()}` : null); setSnapshotLoading(false); }}
                            title="Latest image"
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors group ${frameUrl ? "bg-teal-50 hover:bg-teal-100" : "bg-slate-50 cursor-not-allowed"}`}
                            disabled={!frameUrl}
                          >
                            <ImageIcon size={15} className={frameUrl ? "text-teal-600 group-hover:text-teal-700" : "text-slate-300"} />
                          </button>
                          */}
                          {frameUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSnapshotCam({ cam, locName }); setSnapshotUrl(`${frameUrl}${frameUrl.includes("?") ? "&" : "?"}t=${Date.now()}`); setSnapshotLoading(false); }}
                              title="View image"
                              className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors group"
                            >
                              <Eye size={15} className="text-red-500 group-hover:text-red-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* ANPR (Prahaladnagar MLP) aggregate row — data from the ANPR report API */}
                {mlp && (
                  <tr className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${cameraRows.length % 2 === 0 ? "" : "bg-slate-25"}`}>
                    <td className="px-6 py-4">
                      <div onClick={() => mlp.locId && openLocationHistory(mlp.locId, mlp.name)} title={`View ${mlp.name} history`} className="flex items-center gap-3 cursor-pointer group w-fit">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                          <MapPin size={16} className="text-violet-500" />
                        </div>
                        <span className="text-[14px] font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">{mlp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <Camera size={13} className="text-blue-500" />
                        </div>
                        <span className="text-[14px] font-semibold text-slate-700">In / Out</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center"><span className={`text-[18px] font-bold ${anprCarOcc > 0 ? "text-red-500" : "text-slate-300"}`} title="In − Out">{anprCarOcc}</span></td>
                    <td className="px-3 py-4 text-center"><span className="text-[18px] font-bold text-emerald-600">{mlp.car.available}</span></td>
                    <td className="px-3 py-4 text-center"><span className="text-[18px] font-bold text-slate-800">{mlp.car.total}</span></td>
                    <td className="px-3 py-4 text-center"><span className={`text-[18px] font-bold ${anpr2wOcc > 0 ? "text-red-500" : "text-slate-300"}`} title="In − Out">{anpr2wOcc}</span></td>
                    <td className="px-3 py-4 text-center"><span className="text-[18px] font-bold text-emerald-600">{mlp.bike.available}</span></td>
                    <td className="px-3 py-4 text-center"><span className="text-[18px] font-bold text-slate-800">{mlp.bike.total}</span></td>
                    <td className="px-3 py-4 text-center"><span className="text-[14px] font-bold text-slate-300">—</span></td>
                    <td className="px-3 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${mlp.occupancyPct >= 90 ? "bg-red-500" : mlp.occupancyPct >= 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                            style={{ width: `${mlp.occupancyPct}%` }}
                          />
                        </div>
                        <span className={`text-[12px] font-bold tabular-nums ${mlp.occupancyPct >= 90 ? "text-red-500" : mlp.occupancyPct >= 60 ? "text-amber-500" : "text-emerald-600"}`}>
                          {mlp.occupancyPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4" />
                  </tr>
                )}
                {/* Totals row */}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-6 py-4" colSpan={2}>
                    <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Totals</span>
                  </td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-red-500">{kpiCarOcc}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-emerald-600">{kpiCarAvail}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-slate-800">{kpiCarTotal}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-red-500">{kpi2wOcc}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-emerald-600">{kpi2wAvail}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-slate-800">{kpi2wTotal}</span></td>
                  <td className="px-3 py-4 text-center"><span className={`text-[20px] font-extrabold ${slotsObstructed > 0 ? "text-amber-500" : "text-slate-300"}`}>{slotsObstructed}</span></td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[13px] font-bold text-slate-500">
                      {kpiTotalCapacity > 0 ? `${Math.round((kpiOccupied / kpiTotalCapacity) * 100)}% occupied` : "--"}
                    </span>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parking Locations */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Parking Locations</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">{visibleLocations.length + (mlp ? 1 : 0)} locations</p>
          </div>
          <button onClick={() => navigate("/parking-lots")} className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">Manage <Eye size={11} /></button>
        </div>
        {visibleLocations.length === 0 && !mlp ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
              <MapPin size={24} className="text-slate-300" />
            </div>
            <p className="text-[14px] font-semibold">No parking locations found</p>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              {[
                { label: "Total Locations", value: visibleLocations.length + (mlp ? 1 : 0), color: "text-slate-700" },
                { label: "Active", value: visibleLocations.filter((l) => l.is_active).length + (mlp ? 1 : 0), color: "text-emerald-600" },
                { label: "Inactive", value: visibleLocations.filter((l) => !l.is_active).length, color: "text-red-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-[22px] font-extrabold ${color}`}>{value}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {/* Locations table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Area</th>
                    <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLocations.map((loc, idx) => (
                    <tr key={loc.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                      <td className="px-6 py-4">
                        <div onClick={() => openLocationHistory(loc.id, loc.name)} title={`View ${loc.name} parking history`} className="flex items-center gap-3 cursor-pointer group w-fit">
                          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                            <MapPin size={16} className="text-violet-500" />
                          </div>
                          <span className="text-[14px] font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">{loc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[13px] text-slate-500">{areas.find((a) => a.id === loc.area_id)?.name || "—"}</td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1 uppercase tracking-wide">{loc.location_type}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${loc.is_active ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${loc.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                          {loc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/parking-lots/${loc.id}`); }}
                          title="View details"
                          className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 flex items-center justify-center transition-colors group mx-auto"
                        >
                          <Eye size={15} className="text-teal-600 group-hover:text-teal-700" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* ANPR (Prahaladnagar MLP) location row — capacity/data from the ANPR report API */}
                  {mlp && (
                    <tr className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${visibleLocations.length % 2 === 0 ? "" : "bg-slate-25"}`}>
                      <td className="px-6 py-4">
                        <div onClick={() => mlp.locId && openLocationHistory(mlp.locId, mlp.name)} title={`View ${mlp.name} history`} className="flex items-center gap-3 cursor-pointer group w-fit">
                          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                            <MapPin size={16} className="text-violet-500" />
                          </div>
                          <span className="text-[14px] font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">{mlp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[13px] text-slate-500">{mlp.areaName}</td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1 uppercase tracking-wide">{mlp.type}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 text-emerald-700 bg-emerald-50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {mlp.locId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/parking-lots/${mlp.locId}`); }}
                            title="View details"
                            className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 flex items-center justify-center transition-colors group mx-auto"
                          >
                            <Eye size={15} className="text-teal-600 group-hover:text-teal-700" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Alerts + Devices — hidden for now
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
      */}

      {/* Snapshot Dialog */}
      <CrudDialog
        open={!!snapshotCam}
        onClose={() => { setSnapshotCam(null); setSnapshotUrl(null); }}
        title={snapshotCam ? `${snapshotCam.locName} — ${snapshotCam.cam.position_label}` : ""}
        maxWidth="min(560px, 95vw)"
      >
        {snapshotCam && (
          <div className="mt-3">
            {(() => {
              const s = snapshotCam.cam.slots;
              const capCar = s.reduce((sum, sl) => sum + (sl.capacity_car || 0), 0);
              const cap2w = s.reduce((sum, sl) => sum + (sl.capacity_two_wheeler || 0), 0);
              const oCar = s.reduce((sum, sl) => sum + (sl.occupied_car || 0), 0);
              const o2w = s.reduce((sum, sl) => sum + (sl.occupied_two_wheeler || 0), 0);
              const aCar = Math.max(0, capCar - oCar);
              const a2w = Math.max(0, cap2w - o2w);
              return (
                <div className="grid grid-cols-2 gap-2 mb-3 px-1">
                  <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                    <Car size={16} className="text-blue-500" />
                    <span className="text-[12px] font-bold text-blue-600">Cars</span>
                    <span className="text-[11px] text-red-500 ml-auto">Occupied <b>{oCar}</b></span>
                    <span className="text-[11px] text-emerald-600">Available <b>{aCar}</b></span>
                    <span className="text-[11px] text-slate-500">Total <b>{capCar}</b></span>
                  </div>
                  <div className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                    <Bike size={16} className="text-indigo-500" />
                    <span className="text-[12px] font-bold text-indigo-600">2W</span>
                    <span className="text-[11px] text-red-500 ml-auto">Occupied <b>{o2w}</b></span>
                    <span className="text-[11px] text-emerald-600">Available <b>{a2w}</b></span>
                    <span className="text-[11px] text-slate-500">Total <b>{cap2w}</b></span>
                  </div>
                </div>
              );
            })()}
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              {snapshotLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-teal-500" />
                </div>
              ) : snapshotUrl ? (
                <img src={snapshotUrl} alt="Camera snapshot" className="w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Camera size={28} className="text-slate-200 mb-2" />
                  <p className="text-[13px]">Snapshot unavailable</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Device may be offline</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CrudDialog>
      </>
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
