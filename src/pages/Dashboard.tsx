import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import { devicesApi, locationsApi, camerasApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import CrudDialog from "@/components/CrudDialog";
import {
  MapPin, ParkingSquare, Wifi, WifiOff,
  RefreshCw, Camera, CircleCheck, Car, Ban, Bike,
  Eye, Image as ImageIcon, Loader2,
} from "lucide-react";
import type { Device, Location, CanvasResponse, CanvasCamera } from "@/types/api";

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { filterLabel, deviceQueryParams, queryParams, locationId, areaId, areas } = useFilter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [canvasData, setCanvasData] = useState<CanvasResponse[]>([]);

  // Snapshot dialog state
  const [snapshotCam, setSnapshotCam] = useState<{ cam: CanvasCamera; locName: string } | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const fetchData = useCallback(async () => {
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
    setCanvasData(canvases.filter((c): c is CanvasResponse => c !== null && c.cameras.length > 0));
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
  const slotsObstructed = allSlots.filter((s) => s.state === "OBSTRUCTED").length;
  const slotsAvailable = totalSlots - slotsOccupied - slotsObstructed;
  const availCar = Math.max(0, totalCapCar - occCar);
  const avail2w = Math.max(0, totalCap2w - occ2w);

  // Flatten cameras with location info for table
  const cameraRows = canvasData.flatMap((loc) =>
    loc.cameras.map((cam) => {
      const total = cam.slots.reduce((sum, s) => sum + ((s.capacity_car || 0) + (s.capacity_two_wheeler || 0) || 1), 0);
      const occupied = cam.slots.reduce((sum, s) => sum + (s.occupied_car || 0) + (s.occupied_two_wheeler || 0), 0);
      const obstructed = cam.slots.filter((s) => s.state === "OBSTRUCTED").length;
      const available = total - occupied - obstructed;
      const mismatched = cam.slots.filter((s) => s.is_mismatched).length;
      const capCar = cam.slots.reduce((s, sl) => s + (sl.capacity_car || 0), 0);
      const cap2w = cam.slots.reduce((s, sl) => s + (sl.capacity_two_wheeler || 0), 0);
      const occCar = cam.slots.reduce((s, sl) => s + (sl.occupied_car || 0), 0);
      const occ2w = cam.slots.reduce((s, sl) => s + (sl.occupied_two_wheeler || 0), 0);
      return { cam, locName: loc.location_name, locId: loc.location_id, total, available, occupied, obstructed, mismatched, capCar, cap2w, occCar, occ2w };
    })
  );

  async function handleSnapshot(cam: CanvasCamera, locName: string) {
    setSnapshotCam({ cam, locName });
    setSnapshotUrl(null);
    setSnapshotLoading(true);
    try {
      const url = await camerasApi.snapshotBlobUrl(cam.id);
      setSnapshotUrl(url);
    } catch {
      setSnapshotUrl(null);
    }
    setSnapshotLoading(false);
  }

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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-3 mb-8">
        <StatCard label="Locations" value={locationsList.length} icon={MapPin} bg="bg-violet-50" text="text-violet-600" />
        <StatCard label="Cameras" value={totalCameras} icon={Camera} bg="bg-blue-50" text="text-blue-600" />
        <StatCard label="Total Capacity" value={totalSlots} icon={ParkingSquare} bg="bg-slate-100" text="text-slate-600" />
        <StatCard label="Available" value={slotsAvailable} icon={CircleCheck} bg="bg-emerald-50" text="text-emerald-600" />
        <StatCard label="Occupied" value={slotsOccupied} icon={Car} bg="bg-red-50" text="text-red-500" />
        <StatCard label="Cars" value={`${occCar}/${totalCapCar}`} icon={Car} bg="bg-blue-50" text="text-blue-600" />
        <StatCard label="Cars Free" value={availCar} icon={CircleCheck} bg="bg-blue-50" text="text-blue-500" />
        <StatCard label="2-Wheelers" value={`${occ2w}/${totalCap2w}`} icon={Bike} bg="bg-indigo-50" text="text-indigo-600" />
        <StatCard label="2W Free" value={avail2w} icon={CircleCheck} bg="bg-indigo-50" text="text-indigo-500" />
        <StatCard label="Obstructed" value={slotsObstructed} icon={Ban} bg="bg-amber-50" text="text-amber-600" />
      </div>

      {/* Camera Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Camera Overview</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">{cameraRows.length} cameras across {canvasData.length} locations</p>
          </div>
        </div>
        {cameraRows.length === 0 ? (
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
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Occupied</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-blue-400 uppercase tracking-wider">Cars</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2W</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Obstructed</th>
                  <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cameraRows.map(({ cam, locName, total, available, occupied, obstructed, capCar, cap2w, occCar, occ2w }, idx) => {
                  const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                  return (
                    <tr key={cam.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                            <MapPin size={16} className="text-violet-500" />
                          </div>
                          <span className="text-[14px] font-semibold text-slate-800">{locName}</span>
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
                        <span className="text-[18px] font-bold text-slate-800">{total}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[18px] font-bold text-emerald-600">{available}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[18px] font-bold text-red-500">{occupied}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[14px] font-bold ${occCar > 0 ? "text-blue-600" : "text-slate-300"}`}>{occCar}/{capCar}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`text-[14px] font-bold ${occ2w > 0 ? "text-indigo-600" : "text-slate-300"}`}>{occ2w}/{cap2w}</span>
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
                          <button
                            onClick={() => handleSnapshot(cam, locName)}
                            title="Get latest image"
                            className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 flex items-center justify-center transition-colors group"
                          >
                            <ImageIcon size={15} className="text-teal-600 group-hover:text-teal-700" />
                          </button>
                          <button
                            onClick={() => navigate(`/parking-lots`)}
                            title="View slots"
                            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors group"
                          >
                            <Eye size={15} className="text-slate-500 group-hover:text-slate-700" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-6 py-4" colSpan={2}>
                    <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Totals</span>
                  </td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-slate-800">{totalSlots}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-emerald-600">{slotsAvailable}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[20px] font-extrabold text-red-500">{slotsOccupied}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[16px] font-extrabold text-blue-600">{occCar}/{totalCapCar}</span></td>
                  <td className="px-3 py-4 text-center"><span className="text-[16px] font-extrabold text-indigo-600">{occ2w}/{totalCap2w}</span></td>
                  <td className="px-3 py-4 text-center"><span className={`text-[20px] font-extrabold ${slotsObstructed > 0 ? "text-amber-500" : "text-slate-300"}`}>{slotsObstructed}</span></td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-[13px] font-bold text-slate-500">
                      {totalSlots > 0 ? `${Math.round((slotsOccupied / totalSlots) * 100)}% occupied` : "--"}
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
            <p className="text-[12px] text-slate-400 mt-0.5">{locationsList.length} locations</p>
          </div>
          <button onClick={() => navigate("/parking-lots")} className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">Manage <Eye size={11} /></button>
        </div>
        {locationsList.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
              <MapPin size={24} className="text-slate-300" />
            </div>
            <p className="text-[14px] font-semibold">No parking locations found</p>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              {[
                { label: "Total Locations", value: locationsList.length, color: "text-slate-700" },
                { label: "Active", value: locationsList.filter((l) => l.is_active).length, color: "text-emerald-600" },
                { label: "Inactive", value: locationsList.filter((l) => !l.is_active).length, color: "text-red-500" },
                { label: "Total Capacity", value: locationsList.reduce((s, l) => s + (l.total_capacity || 0), 0), color: "text-violet-600" },
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
                    <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Capacity</th>
                    <th className="text-center px-3 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locationsList.map((loc, idx) => (
                    <tr key={loc.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-25"}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                            <MapPin size={16} className="text-violet-500" />
                          </div>
                          <span className="text-[14px] font-semibold text-slate-800">{loc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[13px] text-slate-500">{areas.find((a) => a.id === loc.area_id)?.name || "—"}</td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-lg px-2.5 py-1 uppercase tracking-wide">{loc.location_type}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className="text-[18px] font-bold text-slate-800">{loc.total_capacity}</span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 ${loc.is_active ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${loc.is_active ? "bg-emerald-500" : "bg-red-500"}`} />
                          {loc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => navigate(`/parking-lots/${loc.id}`)}
                          title="View details"
                          className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 flex items-center justify-center transition-colors group mx-auto"
                        >
                          <Eye size={15} className="text-teal-600 group-hover:text-teal-700" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
            <div className="flex items-center gap-3 mb-3 px-1">
              <span className="text-[12px] font-semibold text-slate-500">{snapshotCam.cam.slots.reduce((sum, s) => sum + ((s.capacity_car || 0) + (s.capacity_two_wheeler || 0) || 1), 0)} capacity</span>
              <span className="text-[12px] font-semibold text-emerald-600">{snapshotCam.cam.slots.reduce((sum, s) => sum + ((s.capacity_car || 0) + (s.capacity_two_wheeler || 0) || 1), 0) - snapshotCam.cam.slots.reduce((sum, s) => sum + (s.occupied_car || 0) + (s.occupied_two_wheeler || 0), 0)} available</span>
              <span className="text-[12px] font-semibold text-red-500">{snapshotCam.cam.slots.reduce((sum, s) => sum + (s.occupied_car || 0) + (s.occupied_two_wheeler || 0), 0)} occupied</span>
            </div>
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
