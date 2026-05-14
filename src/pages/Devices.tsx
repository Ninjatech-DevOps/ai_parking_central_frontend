import { useState, useCallback, useEffect, useMemo, type FormEvent } from "react";
import { showSuccess, showError } from "@/lib/toast";
import { devicesApi, commandsApi, locationsApi, floorsApi, zonesApi } from "@/services/api";
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
import { RotateCw, Camera, Eye, Plus, Pencil, Trash2, History, Search, Monitor } from "lucide-react";
import type { Device, Location, DeviceCommand, Floor, Zone } from "@/types/api";

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
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

  useEffect(() => { locationsApi.list("page_size=100").then(({ data }) => setLocations(data.items)); }, []);

  useEffect(() => {
    if (formLocationId) {
      floorsApi.byLocation(formLocationId).then(({ data }) => setFloors(data.items)).catch(() => setFloors([]));
    } else { setFloors([]); }
    setFormFloorId(""); setFormZoneId(""); setZones([]);
  }, [formLocationId]);

  useEffect(() => {
    if (formFloorId) {
      zonesApi.byFloor(formFloorId).then(({ data }) => setZones(data.items)).catch(() => setZones([]));
    } else { setZones([]); }
    setFormZoneId("");
  }, [formFloorId]);

  const { deviceQueryParams } = useFilter();

  const fetchDevices = useCallback(async () => {
    const p = new URLSearchParams({ page_size: "50" });
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (deviceQueryParams) p.set("city_id", new URLSearchParams(deviceQueryParams).get("city_id") || "");
    const { data } = await devicesApi.list(p.toString());
    setDevices(data.items); setTotal(data.total);
  }, [statusFilter, deviceQueryParams]);
  usePolling(fetchDevices, 10000);

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

  async function sendCmd(id: string, type: "restart" | "snapshot") {
    setCommandLoading(`${id}-${type}`);
    try {
      if (type === "restart") {
        await commandsApi.restart(id);
        showSuccess("Restart command sent");
      } else {
        setSnapshotLoading(true);
        setShowSnapshot(true);
        setSnapshotUrl(null);
        await commandsApi.snapshot(id);
        await new Promise((r) => setTimeout(r, 4000));
        await fetchSnapshot(id);
      }
    } catch (err: any) { showError(err?.response?.data?.detail || "Operation failed"); setSnapshotLoading(false); }
    finally { setCommandLoading(null); }
  }

  async function fetchSnapshot(id: string) {
    try {
      setSnapshotLoading(true);
      setShowSnapshot(true);
      const resp = await devicesApi.getSnapshot(id);
      const blob = new Blob([resp.data], { type: "image/jpeg" });
      setSnapshotUrl(URL.createObjectURL(blob));
    } catch { showError("No snapshot available"); setShowSnapshot(false); }
    finally { setSnapshotLoading(false); }
  }
  async function openHistory(id: string) { setShowHistory(id); setCmdHistory((await commandsApi.history(id)).data); }

  const filtered = useMemo(() => {
    if (!search) return devices;
    return devices.filter((d) => d.device_id.toLowerCase().includes(search.toLowerCase()));
  }, [devices, search]);

  return (
    <div className="max-w-[1360px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Devices</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage and monitor edge devices</p>
        </div>
        <Button onClick={openCreate} className="h-10 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[13px] font-semibold gap-2 shadow-md shadow-teal-600/20">
          <Plus size={16} /> Add Device
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search devices..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IP</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Docker</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Seen</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Monitor size={14} className="text-slate-500" /></div>
                    <span className="text-[13px] font-semibold text-slate-800">{d.device_id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-2.5 py-1 uppercase tracking-wide ${
                    d.status === "ONLINE" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${d.status === "ONLINE" ? "bg-emerald-500" : "bg-red-500"}`} />
                    {d.status}
                  </span>
                </TableCell>
                <TableCell className="text-[13px] text-slate-500 font-mono">{d.ip_address || "—"}</TableCell>
                <TableCell className="text-[13px] text-slate-500">{d.docker_image_version ? <code className="text-[12px] bg-slate-100 px-2 py-0.5 rounded-md font-mono">{d.docker_image_version}</code> : "—"}</TableCell>
                <TableCell className="text-[13px] text-slate-500 tabular-nums">{d.last_seen ? new Date(d.last_seen).toLocaleString() : "Never"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" title="Restart" className="h-8 w-8 rounded-lg hover:bg-teal-50 hover:text-teal-600" disabled={commandLoading === `${d.id}-restart`} onClick={() => sendCmd(d.id, "restart")}><RotateCw size={14} /></Button>
                    <Button variant="ghost" size="icon" title="Capture Snapshot" className="h-8 w-8 rounded-lg hover:bg-violet-50 hover:text-violet-600" disabled={commandLoading === `${d.id}-snapshot`} onClick={() => sendCmd(d.id, "snapshot")}><Camera size={14} /></Button>
                    <Button variant="ghost" size="icon" title="View Last Snapshot" className="h-8 w-8 rounded-lg hover:bg-sky-50 hover:text-sky-600" onClick={() => fetchSnapshot(d.id)}><Eye size={14} /></Button>
                    <Button variant="ghost" size="icon" title="History" className="h-8 w-8 rounded-lg" onClick={() => openHistory(d.id)}><History size={14} /></Button>
                    <Button variant="ghost" size="icon" title="Edit" className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => openEdit(d)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" title="Delete" className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(d)}><Trash2 size={14} /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-16"><div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><Monitor size={22} className="text-slate-300" /></div><p className="text-[13px] text-slate-400 font-medium">No devices found</p></TableCell></TableRow>}
          </TableBody>
        </Table>
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
          <div><Label className="text-[13px] font-semibold text-slate-700">IP Address</Label><Input value={formIp} onChange={(e) => setFormIp(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" /></div>
          <div><Label className="text-[13px] font-semibold text-slate-700">Docker Version</Label><Input value={formDockerVersion} onChange={(e) => setFormDockerVersion(e.target.value)} className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" /></div>
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

      <CrudDialog open={showSnapshot} onClose={() => { setShowSnapshot(false); if (snapshotUrl) { URL.revokeObjectURL(snapshotUrl); setSnapshotUrl(null); } }} title="Device Snapshot">
        <div className="mt-3">
          {snapshotLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[13px] text-slate-500">Capturing snapshot...</span>
            </div>
          ) : snapshotUrl ? (
            <div>
              <img src={snapshotUrl} alt="Device snapshot" className="w-full rounded-xl border border-slate-200" onError={() => { showError("Snapshot not available yet."); setShowSnapshot(false); }} />
              <p className="text-[11px] text-slate-400 mt-2 text-center">Captured at {new Date().toLocaleString()}</p>
            </div>
          ) : null}
        </div>
      </CrudDialog>
    </div>
  );
}
