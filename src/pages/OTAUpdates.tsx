import { useState, useCallback, useEffect, useMemo } from "react";
import { showSuccess, showError } from "@/lib/toast";
import { devicesApi, commandsApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import { usePolling } from "@/hooks/usePolling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Download, RotateCcw, Info, Search, Monitor, CheckCircle2,
  XCircle, Clock, Loader2, GitBranch, ChevronDown,
} from "lucide-react";
import type { Device, DeviceCommand } from "@/types/api";

type VersionInfo = {
  commit: string;
  branch: string;
  last_commit_message: string;
  last_commit_date?: string;
  dirty: boolean;
};

export default function OTAUpdates() {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission("devices:update");

  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<Record<string, VersionInfo>>({});
  const [cmdResults, setCmdResults] = useState<Record<string, DeviceCommand>>({});

  // Bulk action state
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkBranch, setBulkBranch] = useState("");
  const [bulkCommit, setBulkCommit] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  // Rollback dialog
  const [rollbackDevice, setRollbackDevice] = useState<Device | null>(null);
  const [rollbackCommit, setRollbackCommit] = useState("");

  // Command history
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [cmdHistory, setCmdHistory] = useState<DeviceCommand[]>([]);

  const { deviceQueryParams } = useFilter();

  const fetchDevices = useCallback(async () => {
    const p = new URLSearchParams({ page: "1", page_size: "200" });
    if (deviceQueryParams) {
      new URLSearchParams(deviceQueryParams).forEach((v, k) => p.set(k, v));
    }
    const { data } = await devicesApi.list(p.toString());
    setDevices(data.items || []);
    setTotal(data.total || 0);
  }, [deviceQueryParams]);
  usePolling(fetchDevices, 10000);

  const filtered = useMemo(() => {
    if (!search) return devices;
    return devices.filter((d) => d.device_id.toLowerCase().includes(search.toLowerCase()));
  }, [devices, search]);

  const onlineDevices = useMemo(() => devices.filter((d) => d.status === "ONLINE"), [devices]);
  const selectedDevices = useMemo(() => filtered.filter((d) => selected.has(d.id)), [filtered, selected]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((d) => d.id)));
    }
  }

  // ─── Single device actions ───

  async function sendUpdate(device: Device, branch?: string, commit?: string) {
    setLoading((p) => ({ ...p, [device.id]: "update" }));
    try {
      const { data: cmd } = await commandsApi.updateDevice(device.id, branch, commit);
      setCmdResults((p) => ({ ...p, [device.id]: cmd }));
      showSuccess(`Update sent to ${device.device_id}`);
      pollCommand(device.id, cmd.id);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Update failed");
    } finally {
      setLoading((p) => { const n = { ...p }; delete n[device.id]; return n; });
    }
  }

  async function sendRollback(device: Device, commit?: string) {
    setLoading((p) => ({ ...p, [device.id]: "rollback" }));
    try {
      const { data: cmd } = await commandsApi.rollback(device.id, commit);
      setCmdResults((p) => ({ ...p, [device.id]: cmd }));
      showSuccess(`Rollback sent to ${device.device_id}`);
      pollCommand(device.id, cmd.id);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Rollback failed");
    } finally {
      setLoading((p) => { const n = { ...p }; delete n[device.id]; return n; });
    }
  }

  async function fetchVersion(device: Device) {
    setLoading((p) => ({ ...p, [device.id]: "version" }));
    try {
      const { data: cmd } = await commandsApi.version(device.id);
      setCmdResults((p) => ({ ...p, [device.id]: cmd }));
      // Poll for completion to get version result
      pollVersionCommand(device.id, cmd.id);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Version query failed");
      setLoading((p) => { const n = { ...p }; delete n[device.id]; return n; });
    }
  }

  async function pollCommand(deviceId: string, commandId: string) {
    for (const delay of [3000, 5000, 5000, 5000]) {
      await new Promise((r) => setTimeout(r, delay));
      try {
        const { data: cmd } = await commandsApi.status(commandId);
        setCmdResults((p) => ({ ...p, [deviceId]: cmd }));
        if (cmd.status === "COMPLETED" || cmd.status === "FAILED") {
          if (cmd.status === "COMPLETED") showSuccess(`Command completed on device`);
          if (cmd.status === "FAILED") showError(`Command failed: ${cmd.error_message || "Unknown error"}`);
          return;
        }
      } catch { /* keep polling */ }
    }
  }

  async function pollVersionCommand(deviceId: string, commandId: string) {
    for (const delay of [2000, 3000, 5000]) {
      await new Promise((r) => setTimeout(r, delay));
      try {
        const { data: cmd } = await commandsApi.status(commandId);
        setCmdResults((p) => ({ ...p, [deviceId]: cmd }));
        if (cmd.status === "COMPLETED" && cmd.result) {
          try {
            const v = JSON.parse(cmd.result) as VersionInfo;
            setVersions((p) => ({ ...p, [deviceId]: v }));
          } catch { /* ignore parse error */ }
          setLoading((p) => { const n = { ...p }; delete n[deviceId]; return n; });
          return;
        }
        if (cmd.status === "FAILED") {
          showError(`Version query failed: ${cmd.error_message || ""}`);
          setLoading((p) => { const n = { ...p }; delete n[deviceId]; return n; });
          return;
        }
      } catch { /* keep polling */ }
    }
    setLoading((p) => { const n = { ...p }; delete n[deviceId]; return n; });
  }

  // ─── Bulk actions ───

  async function handleBulkUpdate() {
    if (selectedDevices.length === 0) return;
    setBulkRunning(true);
    let success = 0;
    let failed = 0;
    for (const device of selectedDevices) {
      try {
        const { data: cmd } = await commandsApi.updateDevice(
          device.id,
          bulkBranch || undefined,
          bulkCommit || undefined,
        );
        setCmdResults((p) => ({ ...p, [device.id]: cmd }));
        success++;
      } catch {
        failed++;
      }
    }
    setBulkRunning(false);
    setShowBulkUpdate(false);
    setBulkBranch("");
    setBulkCommit("");
    setSelected(new Set());
    showSuccess(`Update sent: ${success} success, ${failed} failed`);
  }

  async function handleBulkVersion() {
    for (const device of selectedDevices) {
      fetchVersion(device);
    }
  }

  async function openHistory(deviceId: string) {
    setShowHistory(deviceId);
    try {
      const { data } = await commandsApi.history(deviceId, 30);
      setCmdHistory(data);
    } catch {
      setCmdHistory([]);
    }
  }

  function cmdStatusBadge(status: string) {
    const colors: Record<string, string> = {
      COMPLETED: "text-emerald-700 bg-emerald-50",
      FAILED: "text-red-700 bg-red-50",
      ACKNOWLEDGED: "text-blue-700 bg-blue-50",
      SENT: "text-amber-700 bg-amber-50",
      TIMEOUT: "text-slate-700 bg-slate-100",
    };
    return colors[status] || "text-slate-500 bg-slate-100";
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">OTA Updates</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Push code updates, rollback, and check versions on edge devices</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Devices", value: total, icon: Monitor, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Online", value: onlineDevices.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Selected", value: selected.size, icon: Download, color: "text-teal-600", bg: "bg-teal-50" },
          { label: "Versions Loaded", value: Object.keys(versions).length, icon: GitBranch, color: "text-violet-600", bg: "bg-violet-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}><Icon size={18} className={color} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className={`text-[22px] font-bold ${color} mt-0.5`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-4 h-10 w-72 card-shadow focus-within:border-teal-300 transition-all">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search devices..." className="bg-transparent text-[13px] outline-none w-full text-slate-600 placeholder:text-slate-400" />
        </div>

        {canUpdate && selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[12px] text-slate-500 font-medium">{selected.size} selected</span>
            <Button onClick={() => setShowBulkUpdate(true)} className="h-9 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-[12px] font-semibold gap-1.5 shadow-md shadow-teal-600/20">
              <Download size={14} /> Update Selected
            </Button>
            <Button onClick={handleBulkVersion} variant="outline" className="h-9 rounded-xl text-[12px] font-semibold gap-1.5 border-slate-200">
              <Info size={14} /> Check Versions
            </Button>
          </div>
        )}
        {selected.size === 0 && <span className="text-[12px] text-slate-400 ml-auto font-medium">{total} devices</span>}
      </div>

      {/* Device Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100">
              <TableHead className="w-10">
                <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} className="w-4 h-4 rounded accent-teal-600" />
              </TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Device</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Branch</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Commit</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Message</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Command</TableHead>
              <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => {
              const v = versions[d.id];
              const cmd = cmdResults[d.id];
              const isLoading = loading[d.id];

              return (
                <TableRow key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <TableCell>
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} className="w-4 h-4 rounded accent-teal-600" />
                  </TableCell>
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
                  <TableCell>
                    {v ? (
                      <div className="flex items-center gap-1.5">
                        <GitBranch size={12} className="text-violet-500" />
                        <span className="text-[12px] font-medium text-slate-700">{v.branch}</span>
                        {v.dirty && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">dirty</span>}
                      </div>
                    ) : <span className="text-[12px] text-slate-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {v ? <code className="text-[12px] font-mono text-teal-700 bg-teal-50 rounded px-1.5 py-0.5">{v.commit}</code> : <span className="text-[12px] text-slate-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {v ? <span className="text-[11px] text-slate-500 max-w-[200px] truncate block" title={v.last_commit_message}>{v.last_commit_message}</span> : <span className="text-[12px] text-slate-300">—</span>}
                  </TableCell>
                  <TableCell>
                    {cmd ? (
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-1 ${cmdStatusBadge(cmd.status)}`}>{cmd.status}</span>
                        <span className="text-[10px] text-slate-400">{cmd.command_type}</span>
                      </div>
                    ) : <span className="text-[12px] text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-0.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                      {isLoading ? (
                        <div className="flex items-center gap-1.5 px-2">
                          <Loader2 size={14} className="animate-spin text-teal-600" />
                          <span className="text-[11px] text-slate-400">{isLoading}...</span>
                        </div>
                      ) : (
                        <>
                          {canUpdate && (
                            <Button variant="ghost" size="icon" title="Update (git pull)" className="h-8 w-8 rounded-lg hover:bg-teal-50 hover:text-teal-600" onClick={() => sendUpdate(d)}>
                              <Download size={14} />
                            </Button>
                          )}
                          {canUpdate && (
                            <Button variant="ghost" size="icon" title="Rollback" className="h-8 w-8 rounded-lg hover:bg-amber-50 hover:text-amber-600" onClick={() => { setRollbackDevice(d); setRollbackCommit(""); }}>
                              <RotateCcw size={14} />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Check Version" className="h-8 w-8 rounded-lg hover:bg-violet-50 hover:text-violet-600" onClick={() => fetchVersion(d)}>
                            <Info size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" title="Command History" className="h-8 w-8 rounded-lg hover:bg-sky-50 hover:text-sky-600" onClick={() => openHistory(d.id)}>
                            <Clock size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><Monitor size={22} className="text-slate-300" /></div>
                  <p className="text-[13px] text-slate-400 font-medium">No devices found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Update Dialog */}
      <CrudDialog open={showBulkUpdate} onClose={() => setShowBulkUpdate(false)} title={`Update ${selectedDevices.length} Devices`}>
        <div className="space-y-5 mt-3">
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
            <p className="text-[12px] text-teal-700 font-medium">
              This will run <code className="font-mono bg-teal-100 px-1 rounded">git pull</code> + <code className="font-mono bg-teal-100 px-1 rounded">uv sync</code> + restart on {selectedDevices.length} device(s).
            </p>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Branch (optional)</Label>
            <Input value={bulkBranch} onChange={(e) => setBulkBranch(e.target.value)} placeholder="e.g. dev, main (uses device default if empty)" className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" />
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Commit (optional)</Label>
            <Input value={bulkCommit} onChange={(e) => setBulkCommit(e.target.value)} placeholder="e.g. abc1234 (uses latest if empty)" className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" />
          </div>
          <div className="bg-slate-50 rounded-xl p-3 max-h-32 overflow-auto">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Target Devices</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedDevices.map((d) => (
                <span key={d.id} className={`text-[11px] font-semibold rounded-lg px-2 py-1 ${d.status === "ONLINE" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                  {d.device_id}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowBulkUpdate(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button onClick={handleBulkUpdate} disabled={bulkRunning} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold shadow-md shadow-teal-600/20 gap-1.5">
              {bulkRunning ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Download size={14} /> Update All</>}
            </Button>
          </div>
        </div>
      </CrudDialog>

      {/* Rollback Dialog */}
      <CrudDialog open={!!rollbackDevice} onClose={() => setRollbackDevice(null)} title={`Rollback ${rollbackDevice?.device_id || ""}`}>
        <div className="space-y-5 mt-3">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[12px] text-amber-700 font-medium">
              This will revert the codebase to a previous commit and restart the service.
            </p>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Target Commit (optional)</Label>
            <Input value={rollbackCommit} onChange={(e) => setRollbackCommit(e.target.value)} placeholder="e.g. abc1234 (defaults to previous commit)" className="mt-2 h-10 rounded-xl text-[13px] border-slate-200" />
          </div>
          {versions[rollbackDevice?.id || ""] && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Version</p>
              <p className="text-[12px] text-slate-700">
                <code className="font-mono text-teal-700 bg-teal-50 rounded px-1.5 py-0.5">{versions[rollbackDevice!.id].commit}</code>
                {" on "}
                <span className="font-medium">{versions[rollbackDevice!.id].branch}</span>
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setRollbackDevice(null)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button onClick={() => { if (rollbackDevice) { sendRollback(rollbackDevice, rollbackCommit || undefined); setRollbackDevice(null); } }} className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold shadow-md shadow-amber-500/20 gap-1.5">
              <RotateCcw size={14} /> Rollback
            </Button>
          </div>
        </div>
      </CrudDialog>

      {/* Command History Dialog */}
      <CrudDialog open={!!showHistory} onClose={() => setShowHistory(null)} title="Command History">
        <div className="space-y-2 mt-3 max-h-96 overflow-auto">
          {cmdHistory.length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-8">No commands sent yet</p>
          ) : cmdHistory.map((c) => (
            <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-700">{c.command_type}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{new Date(c.sent_at).toLocaleString()}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-1 ${cmdStatusBadge(c.status)}`}>{c.status}</span>
              </div>
              {c.error_message && <p className="text-[11px] text-red-500 mt-1.5 bg-red-50 rounded-lg px-2 py-1">{c.error_message}</p>}
              {c.result && (() => {
                try {
                  const r = JSON.parse(c.result);
                  return (
                    <div className="mt-1.5 text-[11px] text-slate-500 bg-white rounded-lg px-2 py-1.5 border border-slate-100 font-mono">
                      {Object.entries(r).filter(([k]) => !["device_id", "command_id", "action", "timestamp"].includes(k)).map(([k, v]) => (
                        <div key={k}><span className="text-slate-400">{k}:</span> <span className="text-slate-700">{String(v)}</span></div>
                      ))}
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          ))}
        </div>
      </CrudDialog>
    </div>
  );
}
