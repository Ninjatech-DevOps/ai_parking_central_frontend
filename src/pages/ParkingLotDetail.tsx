import { useState, useEffect, useCallback, type FormEvent } from "react";
import { showSuccess, showError } from "@/lib/toast";
import { useParams, Link } from "react-router-dom";
import { locationsApi, devicesApi, camerasApi, floorsApi, zonesApi, slotsApi } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import CameraCanvas from "@/components/CameraCanvas";
import {
  ArrowLeft, MapPin, Monitor, Camera, Eye, Plus, Pencil, Trash2,
  Layers, Grid3x3, ParkingSquare, ChevronDown, ChevronRight,
} from "lucide-react";
import type {
  Location, Device, Camera as CameraType, Floor, Zone, ParkingSlot,
  CanvasResponse, PaginatedResponse,
} from "@/types/api";

type Tab = "structure" | "devices" | "live" | "overview";

export default function ParkingLotDetail() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useState<Location | null>(null);
  const [tab, setTab] = useState<Tab>("structure");

  // Structure
  const [floors, setFloors] = useState<Floor[]>([]);
  const [zones, setZones] = useState<Record<string, Zone[]>>({});
  const [slots, setSlots] = useState<Record<string, ParkingSlot[]>>({});
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  // Devices + Cameras
  const [devices, setDevices] = useState<Device[]>([]);
  const [cameras, setCameras] = useState<Record<string, CameraType[]>>({});

  // Canvas
  const [canvas, setCanvas] = useState<CanvasResponse | null>(null);

  // CRUD dialogs
  const [showFloorForm, setShowFloorForm] = useState(false);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showCameraForm, setShowCameraForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formLevel, setFormLevel] = useState("0");
  const [formParentId, setFormParentId] = useState("");
  const [formDeviceId, setFormDeviceId] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string; type: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load location
  useEffect(() => {
    if (!id) return;
    locationsApi.get(id).then(({ data }) => setLocation(data));
  }, [id]);

  // Load floors
  const loadFloors = useCallback(async () => {
    if (!id) return;
    const { data } = await floorsApi.byLocation(id);
    setFloors(data.items);
    if (data.items.length > 0 && !expandedFloor) setExpandedFloor(data.items[0].id);
  }, [id]);
  useEffect(() => { loadFloors(); }, [loadFloors]);

  // Load zones when floor expanded
  useEffect(() => {
    if (!expandedFloor) return;
    zonesApi.byFloor(expandedFloor).then(({ data }) => {
      setZones((prev) => ({ ...prev, [expandedFloor]: data.items }));
      if (data.items.length > 0 && !expandedZone) setExpandedZone(data.items[0].id);
    });
  }, [expandedFloor]);

  // Load slots when zone expanded
  useEffect(() => {
    if (!expandedZone) return;
    slotsApi.list(`zone_id=${expandedZone}&page_size=200`).then(({ data }) => {
      setSlots((prev) => ({ ...prev, [expandedZone]: data.items }));
    });
  }, [expandedZone]);

  // Load ALL slots for this location (needed for camera assignment)
  useEffect(() => {
    if (floors.length === 0) return;
    floors.forEach((f) => {
      zonesApi.byFloor(f.id).then(({ data: zData }) => {
        setZones((prev) => ({ ...prev, [f.id]: zData.items }));
        zData.items.forEach((z) => {
          slotsApi.list(`zone_id=${z.id}&page_size=200`).then(({ data: sData }) => {
            setSlots((prev) => ({ ...prev, [z.id]: sData.items }));
          });
        });
      });
    });
  }, [floors]);

  // Load devices + cameras
  useEffect(() => {
    if (!id) return;
    devicesApi.list(`location_id=${id}&page_size=50`).then(({ data }) => {
      setDevices(data.items);
      data.items.forEach((d) => {
        camerasApi.byDevice(d.id).then(({ data: camData }) => {
          setCameras((prev) => ({ ...prev, [d.id]: camData.items }));
        });
      });
    });
  }, [id]);

  // Poll canvas
  const fetchCanvas = useCallback(async () => {
    if (!id) return;
    try { const { data } = await locationsApi.canvas(id); setCanvas(data); } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); }
  }, [id]);
  usePolling(fetchCanvas, 5000);

  // CRUD handlers
  async function handleFloorSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      if (editingId) await floorsApi.update(editingId, { label: formName, level_number: parseInt(formLevel), capacity: parseInt(formCapacity) || 0 });
      else await floorsApi.create({ location_id: id, label: formName, level_number: parseInt(formLevel), capacity: parseInt(formCapacity) || 0 });
      setShowFloorForm(false); loadFloors();
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setFormSaving(false); }
  }

  async function handleZoneSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      if (editingId) await zonesApi.update(editingId, { name: formName, capacity: parseInt(formCapacity) || 0 });
      else await zonesApi.create({ name: formName, floor_id: formParentId, capacity: parseInt(formCapacity) || 0 });
      setShowZoneForm(false);
      if (expandedFloor) zonesApi.byFloor(expandedFloor).then(({ data }) => setZones((p) => ({ ...p, [expandedFloor!]: data.items })));
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setFormSaving(false); }
  }

  async function handleSlotSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      if (editingId) await slotsApi.update(editingId, { label: formName });
      else await slotsApi.create({ label: formName, zone_id: formParentId });
      setShowSlotForm(false);
      if (expandedZone) slotsApi.list(`zone_id=${expandedZone}&page_size=200`).then(({ data }) => setSlots((p) => ({ ...p, [expandedZone!]: data.items })));
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setFormSaving(false); }
  }

  async function handleCameraSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      if (editingId) await camerasApi.update(editingId, { position_label: formName });
      else await camerasApi.create({ device_id: formDeviceId, position_label: formName });
      setShowCameraForm(false);
      camerasApi.byDevice(formDeviceId).then(({ data }) => setCameras((p) => ({ ...p, [formDeviceId]: data.items })));
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setFormSaving(false); }
  }

  async function handleDelete() {
    if (!deleting) return; setDeleteLoading(true);
    try {
      if (deleting.type === "floor") { await floorsApi.delete(deleting.id); loadFloors(); }
      else if (deleting.type === "zone") { await zonesApi.delete(deleting.id); if (expandedFloor) zonesApi.byFloor(expandedFloor).then(({ data }) => setZones((p) => ({ ...p, [expandedFloor!]: data.items }))); }
      else if (deleting.type === "slot") { await slotsApi.delete(deleting.id); if (expandedZone) slotsApi.list(`zone_id=${expandedZone}&page_size=200`).then(({ data }) => setSlots((p) => ({ ...p, [expandedZone!]: data.items }))); }
      else if (deleting.type === "camera") { await camerasApi.delete(deleting.id); }
      setDeleting(null);
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setDeleteLoading(false); }
  }

  function openAddFloor() { setEditingId(null); setFormName(""); setFormLevel("0"); setFormCapacity(""); setShowFloorForm(true); }
  function openEditFloor(f: Floor) { setEditingId(f.id); setFormName(f.label); setFormLevel(f.level_number.toString()); setFormCapacity(f.capacity.toString()); setShowFloorForm(true); }
  function openAddZone(floorId: string) { setEditingId(null); setFormParentId(floorId); setFormName(""); setFormCapacity(""); setShowZoneForm(true); }
  function openEditZone(z: Zone) { setEditingId(z.id); setFormName(z.name); setFormCapacity(z.capacity.toString()); setShowZoneForm(true); }
  function openAddSlot(zoneId: string) { setEditingId(null); setFormParentId(zoneId); setFormName(""); setShowSlotForm(true); }
  function openAddCamera(deviceId: string) { setEditingId(null); setFormDeviceId(deviceId); setFormName(""); setShowCameraForm(true); }

  if (!location) return <div className="p-8 text-slate-400">Loading...</div>;

  const totalSlots = canvas?.cameras.reduce((s, c) => s + c.slots.length, 0) || 0;
  const vehicleSlots = canvas?.cameras.reduce((s, c) => s + c.slots.filter((x) => x.state === "VEHICLE").length, 0) || 0;
  const emptySlots = canvas?.cameras.reduce((s, c) => s + c.slots.filter((x) => x.state === "EMPTY").length, 0) || 0;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "structure", label: "Structure", icon: Layers },
    { id: "devices", label: "Devices & Cameras", icon: Camera },
    { id: "live", label: "Live View", icon: Eye },
    { id: "overview", label: "Overview", icon: MapPin },
  ];

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/parking-lots"><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100"><ArrowLeft size={18} /></Button></Link>
        <div className="flex-1">
          <h1 className="text-[22px] font-bold text-slate-900">{location.name}</h1>
          <p className="text-[13px] text-slate-500">{location.address || "No address"} · {location.location_type}</p>
        </div>
        <div className="flex gap-3 text-center">
          {[
            { v: totalSlots, l: "Total", c: "text-slate-900" },
            { v: emptySlots, l: "Empty", c: "text-emerald-600" },
            { v: vehicleSlots, l: "Occupied", c: "text-red-600" },
          ].map(({ v, l, c }) => (
            <div key={l} className="bg-white rounded-xl card-shadow px-4 py-2">
              <p className={`text-[18px] font-bold ${c}`}>{v}</p>
              <p className="text-[10px] text-slate-400 font-medium">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 card-shadow w-fit">
        {tabs.map(({ id: t, label, icon: Icon }) => (
          <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${tab === t ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ─── Structure Tab ─── */}
      {tab === "structure" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-slate-900">Floors · Zones · Slots</h2>
            <Button onClick={openAddFloor} className="h-8 rounded-lg bg-teal-600 hover:bg-teal-700 text-[12px] font-semibold gap-1.5"><Plus size={14} /> Add Floor</Button>
          </div>

          {floors.length === 0 ? (
            <div className="bg-white rounded-2xl card-shadow p-12 text-center">
              <Layers size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-[13px] text-slate-400">No floors yet. Add your first floor.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {floors.map((floor) => {
                const isExpanded = expandedFloor === floor.id;
                const floorZones = zones[floor.id] || [];
                return (
                  <div key={floor.id} className="bg-white rounded-2xl card-shadow overflow-hidden">
                    {/* Floor header */}
                    <div className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpandedFloor(isExpanded ? null : floor.id)}>
                      {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                      <Layers size={16} className="text-teal-500" />
                      <span className="text-[13px] font-bold text-slate-800 flex-1">{floor.label}</span>
                      <span className="text-[11px] text-slate-400">Level {floor.level_number} · {floor.capacity} capacity</span>
                      <div className="flex gap-0.5 ml-3" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEditFloor(floor)}><Pencil size={12} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting({ id: floor.id, name: floor.label, type: "floor" })}><Trash2 size={12} /></Button>
                      </div>
                    </div>

                    {/* Zones */}
                    {isExpanded && (
                      <div className="border-t border-slate-50 px-5 py-3 bg-slate-50/30">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Zones</p>
                          <Button onClick={() => openAddZone(floor.id)} variant="ghost" className="h-7 rounded-lg text-[11px] font-semibold text-teal-600 hover:bg-teal-50 gap-1"><Plus size={12} /> Add Zone</Button>
                        </div>
                        {floorZones.length === 0 ? (
                          <p className="text-[12px] text-slate-400 py-4 text-center">No zones. Add one.</p>
                        ) : (
                          <div className="space-y-2">
                            {floorZones.map((zone) => {
                              const isZoneExpanded = expandedZone === zone.id;
                              const zoneSlots = slots[zone.id] || [];
                              return (
                                <div key={zone.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                  <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpandedZone(isZoneExpanded ? null : zone.id)}>
                                    {isZoneExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                    <Grid3x3 size={14} className="text-violet-500" />
                                    <span className="text-[12px] font-bold text-slate-700 flex-1">{zone.name}</span>
                                    <span className="text-[11px] text-slate-400">{zone.capacity} cap</span>
                                    <div className="flex gap-0.5 ml-2" onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-amber-50 hover:text-amber-600"><Pencil size={11} onClick={() => openEditZone(zone)} /></Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting({ id: zone.id, name: zone.name, type: "zone" })}><Trash2 size={11} /></Button>
                                    </div>
                                  </div>

                                  {/* Slots */}
                                  {isZoneExpanded && (
                                    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/20">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Slots</p>
                                        <Button onClick={() => openAddSlot(zone.id)} variant="ghost" className="h-6 rounded text-[10px] font-semibold text-teal-600 hover:bg-teal-50 gap-1"><Plus size={10} /> Add</Button>
                                      </div>
                                      {zoneSlots.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 py-3 text-center">No slots</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {zoneSlots.map((slot) => (
                                            <div key={slot.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium ${
                                              slot.state === "VEHICLE" ? "bg-red-50 border-red-200 text-red-700" :
                                              slot.state === "OBSTRUCTED" ? "bg-amber-50 border-amber-200 text-amber-700" :
                                              "bg-emerald-50 border-emerald-200 text-emerald-700"
                                            }`}>
                                              <ParkingSquare size={11} />
                                              {slot.label}
                                              <span className="text-[9px] opacity-70">{slot.state}</span>
                                              {slot.camera_id && <Camera size={9} className="opacity-50" />}
                                              <button onClick={() => setDeleting({ id: slot.id, name: slot.label, type: "slot" })} className="hover:text-red-600 opacity-40 hover:opacity-100"><Trash2 size={10} /></button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Devices & Cameras Tab ─── */}
      {tab === "devices" && (
        <div className="space-y-4">
          {devices.length === 0 ? (
            <div className="bg-white rounded-2xl card-shadow p-12 text-center">
              <Monitor size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-[13px] text-slate-400">No devices assigned to this parking lot</p>
            </div>
          ) : devices.map((d) => {
            const devCameras = cameras[d.id] || [];
            return (
              <div key={d.id} className="bg-white rounded-2xl card-shadow p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Monitor size={18} className="text-slate-500" /></div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-800">{d.device_id}</p>
                      <p className="text-[11px] text-slate-400">{d.ip_address || "No IP"} · {d.docker_image_version || "No version"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-bold uppercase tracking-wider rounded-lg px-2.5 py-1 ${d.status === "ONLINE" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>{d.status}</span>
                    <Button onClick={() => openAddCamera(d.id)} className="h-8 rounded-lg bg-teal-600 hover:bg-teal-700 text-[11px] font-semibold gap-1.5"><Plus size={12} /> Add Camera</Button>
                  </div>
                </div>

                {devCameras.length === 0 ? (
                  <p className="text-[12px] text-slate-400 bg-slate-50 rounded-xl p-4 text-center">No cameras. Click "Add Camera" to register one.</p>
                ) : (
                  <div className="space-y-3">
                    {devCameras.map((c) => {
                      // Get all slots across all zones for this location
                      const allSlots = Object.values(slots).flat();
                      const assignedSlots = allSlots.filter((s) => s.camera_id === c.id);
                      const unassignedSlots = allSlots.filter((s) => !s.camera_id);

                      return (
                        <div key={c.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Camera size={14} className="text-teal-500" />
                              <span className="text-[13px] font-bold text-slate-700">{c.position_label}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${c.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"}`} />
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting({ id: c.id, name: c.position_label, type: "camera" })}><Trash2 size={11} /></Button>
                            </div>
                          </div>

                          {/* Assigned slots */}
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Slots ({assignedSlots.length})</p>
                            {assignedSlots.length === 0 ? (
                              <p className="text-[11px] text-slate-400">No slots assigned</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {assignedSlots.map((s) => (
                                  <span key={s.id} className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-2 py-1 ${
                                    s.state === "VEHICLE" ? "bg-red-100 text-red-700" :
                                    s.state === "OBSTRUCTED" ? "bg-amber-100 text-amber-700" :
                                    "bg-emerald-100 text-emerald-700"
                                  }`}>
                                    {s.label}
                                    <button onClick={async () => {
                                      await slotsApi.update(s.id, { camera_id: null } as any);
                                      slotsApi.list(`zone_id=${s.zone_id}&page_size=200`).then(({ data: d2 }) => setSlots((p) => ({ ...p, [s.zone_id]: d2.items })));
                                      showSuccess(`${s.label} unassigned`);
                                    }} className="hover:text-red-900 ml-0.5">×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Assign unassigned slots */}
                          {unassignedSlots.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Unassigned Slots — click to assign</p>
                              <div className="flex flex-wrap gap-1.5">
                                {unassignedSlots.map((s) => (
                                  <button key={s.id} onClick={async () => {
                                    await slotsApi.update(s.id, { camera_id: c.id } as any);
                                    slotsApi.list(`zone_id=${s.zone_id}&page_size=200`).then(({ data: d2 }) => setSlots((p) => ({ ...p, [s.zone_id]: d2.items })));
                                    showSuccess(`${s.label} → ${c.position_label}`);
                                  }} className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-md px-2 py-1 hover:border-teal-300 hover:text-teal-600 transition-colors">
                                    + {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Live View Tab ─── */}
      {tab === "live" && (
        <div>
          {canvas && canvas.cameras.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {canvas.cameras.map((cam) => (
                <CameraCanvas key={cam.id} camera={cam} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl card-shadow p-16 text-center">
              <Camera size={40} className="text-slate-200 mx-auto mb-4" />
              <p className="text-[15px] font-semibold text-slate-700">No cameras with slot positions</p>
              <p className="text-[13px] text-slate-400 mt-1">Client needs to push slot config via the slot-config API</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Overview Tab ─── */}
      {tab === "overview" && (
        <div className="bg-white rounded-2xl card-shadow p-6">
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">Location Details</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: "Name", v: location.name },
              { l: "Type", v: location.location_type },
              { l: "Address", v: location.address || "Not set" },
              { l: "Capacity", v: `${location.total_capacity}` },
              { l: "Status", v: location.is_active ? "Active" : "Inactive" },
              { l: "Floors", v: `${floors.length}` },
              { l: "Devices", v: `${devices.length}` },
            ].map(({ l, v }) => (
              <div key={l}>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{l}</p>
                <p className="text-[13px] font-medium text-slate-700 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Dialogs ─── */}
      <CrudDialog open={showFloorForm} onClose={() => setShowFloorForm(false)} title={editingId ? "Edit Floor" : "Add Floor"}>
        <form onSubmit={handleFloorSubmit} className="space-y-4 mt-3">
          <div><Label className="text-[13px]">Floor Label</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ground, B1, Floor 1..." className="mt-1.5 h-9 rounded-lg text-[13px]" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-[13px]">Level Number</Label><Input type="number" value={formLevel} onChange={(e) => setFormLevel(e.target.value)} className="mt-1.5 h-9 rounded-lg text-[13px]" /></div>
            <div><Label className="text-[13px]">Capacity</Label><Input type="number" value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} className="mt-1.5 h-9 rounded-lg text-[13px]" /></div>
          </div>
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowFloorForm(false)} className="rounded-lg text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-lg bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold">{formSaving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <CrudDialog open={showZoneForm} onClose={() => setShowZoneForm(false)} title={editingId ? "Edit Zone" : "Add Zone"}>
        <form onSubmit={handleZoneSubmit} className="space-y-4 mt-3">
          <div><Label className="text-[13px]">Zone Name</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Zone A, Zone B..." className="mt-1.5 h-9 rounded-lg text-[13px]" required /></div>
          <div><Label className="text-[13px]">Capacity</Label><Input type="number" value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} className="mt-1.5 h-9 rounded-lg text-[13px]" /></div>
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowZoneForm(false)} className="rounded-lg text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-lg bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold">{formSaving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <CrudDialog open={showSlotForm} onClose={() => setShowSlotForm(false)} title="Add Slot">
        <form onSubmit={handleSlotSubmit} className="space-y-4 mt-3">
          <div><Label className="text-[13px]">Slot Label</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="A-01, B-05..." className="mt-1.5 h-9 rounded-lg text-[13px]" required /></div>
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowSlotForm(false)} className="rounded-lg text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-lg bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold">{formSaving ? "Saving..." : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <CrudDialog open={showCameraForm} onClose={() => setShowCameraForm(false)} title="Add Camera">
        <form onSubmit={handleCameraSubmit} className="space-y-4 mt-3">
          <div><Label className="text-[13px]">Camera Label</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="CAM-001-L, CAM-001-R..." className="mt-1.5 h-9 rounded-lg text-[13px]" required /></div>
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowCameraForm(false)} className="rounded-lg text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-lg bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold">{formSaving ? "Saving..." : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        title={`Delete ${deleting?.type || ""}`} description={`Remove "${deleting?.name}" permanently?`} loading={deleteLoading} />
    </div>
  );
}
