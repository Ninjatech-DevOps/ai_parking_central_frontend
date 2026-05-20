import { useState, useCallback, useEffect, useMemo, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { showSuccess, showError } from "@/lib/toast";
import { devicesApi, commandsApi, locationsApi, floorsApi, zonesApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import SearchSelect from "@/components/SearchSelect";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pagination from "@/components/Pagination";
import { RotateCw, Camera, Eye, Plus, Pencil, Trash2, History, Search, Monitor } from "lucide-react";
import type { Device, Location, DeviceCommand, Floor, Zone } from "@/types/api";

export default function Devices() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("devices:create");
  const canEdit = hasPermission("devices:edit");
  const canDelete = hasPermission("devices:delete");
  const canRestart = hasPermission("devices:restart");
  const canUpdate = hasPermission("devices:update");

  const [devices, setDevices] = useState<Device[]>([]);
  const navigate = useNavigate();
  const [total, setTotal] = useState(0);
  // Tick every second to keep heartbeat "ago" text live
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [commandLoading, setCommandLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [cmdHistory, setCmdHistory] = useState<DeviceCommand[]>([]);
  const [formDeviceId, setFormDeviceId] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formIp, setFormIp] = useState("");
  const [formDockerVersion, setFormDockerVersion] = useState("");
  const [formZoneId, setFormZoneId] = useState("");
  const [formFloorId, setFormFloorId] = useState("");
  const [floors, setFloors] = useState<Floor[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [formSaving, setFormSaving] = useState(false);

  const { deviceQueryParams, queryParams: filterParams, areas: globalAreas } = useFilter();
  useEffect(() => {
    const params = filterParams ? `page_size=100&${filterParams}` : "page_size=100";
    locationsApi.list(params).then(({ data }) => setLocations(data.items || []));
  }, [filterParams]);

  useEffect(() => {
    if (formLocationId) {
      floorsApi.byLocation(formLocationId).then(({ data }) => setFloors(data.items || [])).catch(() => setFloors([]));
    } else { setFloors([]); }
    setFormFloorId(""); setFormZoneId(""); setZones([]);
  }, [formLocationId]);

  useEffect(() => {
    if (formFloorId) {
      zonesApi.byFloor(formFloorId).then(({ data }) => setZones(data.items || [])).catch(() => setZones([]));
    } else { setZones([]); }
    setFormZoneId("");
  }, [formFloorId]);


  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [totalPages, setTotalPages] = useState(0);

  const fetchDevices = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (deviceQueryParams) {
      new URLSearchParams(deviceQueryParams).forEach((v, k) => p.set(k, v));
    }
    const { data } = await devicesApi.list(p.toString());
    setDevices(data.items || []); setTotal(data.total || 0); setTotalPages(data.total_pages || 0);
  }, [statusFilter, deviceQueryParams, page]);
  usePolling(fetchDevices, 10000);

  useEffect(() => { setPage(1); }, [statusFilter, deviceQueryParams]);

  function openCreate() { setEditing(null); setFormDeviceId(""); setFormLocationId(""); setFormFloorId(""); setFormZoneId(""); setFormIp(""); setFormDockerVersion(""); setShowForm(true); }
  function openEdit(d: Device) { setEditing(d); setFormDeviceId(d.device_id); setFormLocationId(d.location_id); setFormFloorId(""); setFormZoneId(d.zone_id || ""); setFormIp(d.ip_address || ""); setFormDockerVersion(d.docker_image_version || ""); setShowForm(true); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setFormSaving(true);
    try {
      const p = { device_id: formDeviceId, location_id: formLocationId, zone_id: formZoneId || null, ip_address: formIp || null, docker_image_version: formDockerVersion || null };
      editing ? await devicesApi.update(editing.id, p) : await devicesApi.create(p);
      setShowForm(false); showSuccess(editing ? "Updated" : "Created"); fetchDevices();
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setFormSaving(false); }
  }
  async function handleDelete() { if (!deleting) return; setDeleteLoading(true); try { await devicesApi.delete(deleting.id); setDeleting(null); showSuccess("Deleted"); fetchDevices(); } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); } finally { setDeleteLoading(false); } }
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);

  const activeSnapshotRef = useRef<string | null>(null);

  async function sendCmd(id: string, type: "restart" | "snapshot") {
    setCommandLoading(`${id}-${type}`);
    try {
      if (type === "restart") {
        await commandsApi.restart(id);
        showSuccess("Restart command sent");
      } else {
        // Show dialog + clear old image
        if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
        setSnapshotUrl(null);
        setShowSnapshot(true);
        setSnapshotLoading(true);
        activeSnapshotRef.current = id;

        // 1. Show existing snapshot immediately (may be old)
        try {
          const resp = await devicesApi.getSnapshot(id);
          if (activeSnapshotRef.current !== id) return;
          setSnapshotUrl(URL.createObjectURL(new Blob([resp.data], { type: "image/jpeg" })));
        } catch { /* no snapshot yet */ }

        // 2. Trigger fresh capture + poll for new image
        setSnapshotLoading(true);
        await commandsApi.snapshot(id);
        for (const delay of [5000, 4000]) {
          await new Promise((r) => setTimeout(r, delay));
          if (activeSnapshotRef.current !== id) return;
          try {
            const resp = await devicesApi.getSnapshot(id);
            if (activeSnapshotRef.current !== id) return;
            setSnapshotUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(new Blob([resp.data], { type: "image/jpeg" }));
            });
          } catch { /* keep trying */ }
        }
        if (activeSnapshotRef.current === id) setSnapshotLoading(false);
      }
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); setSnapshotLoading(false); }
    finally { setCommandLoading(null); }
  }

  async function fetchSnapshot(id: string) {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    setSnapshotUrl(null);
    setShowSnapshot(true);
    setSnapshotLoading(true);
    activeSnapshotRef.current = id;
    try {
      const resp = await devicesApi.getSnapshot(id);
      if (activeSnapshotRef.current !== id) return;
      setSnapshotUrl(URL.createObjectURL(new Blob([resp.data], { type: "image/jpeg" })));
    } catch { showError("No snapshot available"); setShowSnapshot(false); }
    finally { setSnapshotLoading(false); }
  }
  async function openHistory(id: string) { setShowHistory(id); setCmdHistory((await commandsApi.history(id)).data); }

  const filtered = useMemo(() => {
    if (!search) return devices;
    return devices.filter((d) => d.device_id.toLowerCase().includes(search.toLowerCase()));
  }, [devices, search]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Devices</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage and monitor edge devices</p>
        </div>
        {canCreate && <Button onClick={openCreate} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20">
          <Plus size={16} /> Add Device
        </Button>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {(() => {
          const online = devices.filter((d) => d.status === "ONLINE").length;
          const offline = devices.filter((d) => d.status === "OFFLINE").length;
          return [
            { label: "Total Devices", value: total, icon: Monitor, color: "text-slate-600", bg: "bg-slate-50" },
            { label: "Online", value: online, icon: Monitor, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Offline", value: offline, icon: Monitor, color: "text-red-600", bg: "bg-red-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}><Icon size={18} className={color} /></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className={`text-[22px] font-bold ${color} mt-0.5`}>{value}</p>
              </div>
            </div>
          ));
        })()}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search devices..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-36 h-10 rounded-xl border-slate-200 bg-white text-[13px] card-shadow"><span className="text-slate-600">{statusFilter === "all" ? "All Status" : statusFilter}</span></SelectTrigger>
          <SelectContent className="rounded-xl"><SelectItem value="all">All Status</SelectItem><SelectItem value="ONLINE">Online</SelectItem><SelectItem value="OFFLINE">Offline</SelectItem></SelectContent>
        </Select>
        <span className="text-[12px] text-slate-400 ml-auto font-medium">{total} devices</span>
      </div>

      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Device</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Parking Lot</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Area</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Heartbeat</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell>
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/devices/${d.id}`)}>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Monitor size={14} className="text-slate-500" /></div>
                    <span className="text-[13px] font-semibold text-teal-700 hover:underline">{d.device_id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {(() => { const loc = locations.find((l) => l.id === d.location_id); return loc ? <span className="text-[13px] text-slate-700 font-medium">{loc.name}</span> : <span className="text-[12px] text-slate-300">—</span>; })()}
                </TableCell>
                <TableCell>
                  {(() => { const loc = locations.find((l) => l.id === d.location_id); const area = loc ? globalAreas.find((a) => a.id === loc.area_id) : null; return area ? <span className="text-[12px] text-slate-500">{area.name}</span> : <span className="text-[12px] text-slate-300">—</span>; })()}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 uppercase tracking-wide ${
                    d.status === "ONLINE" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${d.status === "ONLINE" ? "bg-emerald-500" : "bg-red-500"}`} />
                    {d.status}
                  </span>
                </TableCell>
                <TableCell>
                  {d.last_seen ? (() => {
                    const ago = Math.floor((Date.now() - new Date(d.last_seen).getTime()) / 1000);
                    if (d.status === "OFFLINE") {
                      return (
                        <div>
                          <span className="text-[12px] font-semibold text-red-500">Offline</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">Last seen {new Date(d.last_seen).toLocaleString()}</p>
                        </div>
                      );
                    }
                    const text = ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.floor(ago / 60)}m ago` : ago < 86400 ? `${Math.floor(ago / 3600)}h ago` : `${Math.floor(ago / 86400)}d ago`;
                    return (
                      <div>
                        <span className={`text-[12px] font-semibold ${ago < 120 ? "text-emerald-600" : "text-amber-500"}`}>{text}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(d.last_seen).toLocaleString()}</p>
                      </div>
                    );
                  })() : <span className="text-[12px] text-slate-300">Never</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    {canRestart && <Button variant="ghost" size="icon" title="Restart" className="h-8 w-8 rounded-lg hover:bg-teal-50 hover:text-teal-600" disabled={commandLoading === `${d.id}-restart`} onClick={() => sendCmd(d.id, "restart")}><RotateCw size={14} /></Button>}
                    {canUpdate && <Button variant="ghost" size="icon" title="Capture Snapshot" className="h-8 w-8 rounded-lg hover:bg-violet-50 hover:text-violet-600" disabled={commandLoading === `${d.id}-snapshot`} onClick={() => sendCmd(d.id, "snapshot")}><Camera size={14} /></Button>}
                    <Button variant="ghost" size="icon" title="View Last Snapshot" className="h-8 w-8 rounded-lg hover:bg-sky-50 hover:text-sky-600" onClick={() => fetchSnapshot(d.id)}><Eye size={14} /></Button>
                    <Button variant="ghost" size="icon" title="History" className="h-8 w-8 rounded-lg" onClick={() => openHistory(d.id)}><History size={14} /></Button>
                    {canEdit && <Button variant="ghost" size="icon" title="Edit" className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(d)}><Pencil size={14} /></Button>}
                    {canDelete && <Button variant="ghost" size="icon" title="Delete" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(d)}><Trash2 size={14} /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-16"><div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><Monitor size={22} className="text-slate-300" /></div><p className="text-[13px] text-slate-400 font-medium">No devices found</p></TableCell></TableRow>}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        )}
      </div>

      <CrudDialog open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Device" : "Add Device"}>
        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          <div><Label className="text-[13px] font-semibold text-slate-700">Device ID</Label><Input value={formDeviceId} onChange={(e) => setFormDeviceId(e.target.value)} disabled={!!editing} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" required /></div>
          <div><Label className="text-[13px] font-semibold text-slate-700">Location</Label>
            <div className="mt-2"><SearchSelect value={formLocationId} onValueChange={setFormLocationId}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              placeholder="Select location" searchPlaceholder="Search location..." className="w-full h-10" /></div>
          </div>
          {floors.length > 0 && (
            <div><Label className="text-[13px] font-semibold text-slate-700">Floor</Label>
              <div className="mt-2"><SearchSelect value={formFloorId} onValueChange={setFormFloorId}
                options={floors.map((f) => ({ value: f.id, label: f.label }))}
                placeholder="Select floor" searchPlaceholder="Search floor..." className="w-full h-10" /></div>
            </div>
          )}
          {zones.length > 0 && (
            <div><Label className="text-[13px] font-semibold text-slate-700">Zone</Label>
              <div className="mt-2"><SearchSelect value={formZoneId} onValueChange={setFormZoneId}
                options={zones.map((z) => ({ value: z.id, label: z.name }))}
                placeholder="Select zone" searchPlaceholder="Search zone..." className="w-full h-10" /></div>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={formSaving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold shadow-md shadow-teal-600/20">{formSaving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Device" description={`Remove ${deleting?.device_id} permanently?`} loading={deleteLoading} />
      <CrudDialog open={!!showHistory} onClose={() => setShowHistory(null)} title="Command History">
        <div className="space-y-2 mt-3 max-h-72 overflow-auto">
          {cmdHistory.length === 0 ? <p className="text-[13px] text-slate-400 text-center py-8">No commands sent yet</p> : cmdHistory.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div><p className="text-[13px] font-semibold text-slate-700">{c.command_type}</p><p className="text-[11px] text-slate-400 mt-0.5">{new Date(c.sent_at).toLocaleString()}</p></div>
              <span className={`text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-1 ${c.status === "COMPLETED" ? "text-emerald-700 bg-emerald-50" : c.status === "FAILED" ? "text-red-700 bg-red-50" : "text-slate-500 bg-slate-100"}`}>{c.status}</span>
            </div>
          ))}
        </div>
      </CrudDialog>

      <CrudDialog open={showSnapshot} onClose={() => { setShowSnapshot(false); activeSnapshotRef.current = null; if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); setSnapshotUrl(null); } }} title="Device Snapshot">
        <div className="mt-3">
          {snapshotUrl ? (
            <div className="relative">
              {snapshotLoading && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] text-white font-medium">Refreshing...</span>
                </div>
              )}
              <img src={snapshotUrl} alt="Device snapshot" className="w-full rounded-xl border border-slate-200" onError={() => { showError("Snapshot not available yet."); setShowSnapshot(false); }} />
              <p className="text-[11px] text-slate-400 mt-2 text-center">Captured at {new Date().toLocaleString()}</p>
            </div>
          ) : snapshotLoading ? (
            <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl py-20">
              <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[14px] font-semibold text-white">Loading snapshot...</p>
              <p className="text-[12px] text-slate-400 mt-1">Waiting for device to respond</p>
            </div>
          ) : null}
        </div>
      </CrudDialog>
    </div>
  );
}
