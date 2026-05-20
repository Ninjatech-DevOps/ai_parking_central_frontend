import { useState, useCallback, useEffect, useRef, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { showSuccess, showError } from "@/lib/toast";
import { devicesApi, camerasApi, slotsApi, commandsApi } from "@/services/api";
import PolygonDrawer, { type SlotData } from "@/components/PolygonDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  ArrowLeft, Plus, Camera as CamIcon, Trash2, Crosshair, Eye, PenTool, Square, Pentagon,
  RefreshCw, Monitor, Wifi, WifiOff,
} from "lucide-react";
import type { Device, Camera, ParkingSlot } from "@/types/api";

/** Increment trailing number in a label: "B11" → "B12", "A-01" → "A-02", "Slot 5" → "Slot 6" */
function incrementLabel(label: string): string {
  const match = label.match(/^(.*?)(\d+)$/);
  if (!match) return label;
  const [, prefix, numStr] = match;
  const next = String(Number(numStr) + 1).padStart(numStr.length, "0");
  return prefix + next;
}

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);

  // Camera form
  const [showCamForm, setShowCamForm] = useState(false);
  const [camLabel, setCamLabel] = useState("");
  const [camSource, setCamSource] = useState("0");
  const [camType, setCamType] = useState("USB");
  const [camSaving, setCamSaving] = useState(false);
  const [deletingCam, setDeletingCam] = useState<Camera | null>(null);

  // Slot drawing
  const [drawMode, setDrawMode] = useState(false);
  const [shapeMode, setShapeMode] = useState<"rectangle" | "polygon">("rectangle");
  const [nextLabel, setNextLabel] = useState("A-01");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState<ParkingSlot | null>(null);

  // Fetch device
  const fetchDevice = useCallback(async () => {
    if (!id) return;
    const { data } = await devicesApi.get(id);
    setDevice(data);
  }, [id]);

  // Tracks which camera ID is currently active — stale responses are discarded
  const activeCameraIdRef = useRef<string | null>(null);

  // Fetch cameras — optionally auto-select a specific camera or the first one
  const fetchCameras = useCallback(async (autoSelectId?: string) => {
    if (!id) return;
    const { data } = await camerasApi.byDevice(id);
    const camItems = data.items || [];
    setCameras(camItems);
    if (autoSelectId) {
      const target = camItems.find((c: Camera) => c.id === autoSelectId);
      if (target) setSelectedCamera(target);
    } else if (camItems.length > 0 && !activeCameraIdRef.current) {
      setSelectedCamera(camItems[0]);
    }
  }, [id]);

  // Fetch slots — only applies result if camera is still the active one
  async function fetchSlotsForCamera(cameraId: string, autoLabel = true) {
    const { data } = await slotsApi.list(`camera_id=${cameraId}&page_size=100`);
    if (activeCameraIdRef.current !== cameraId) return; // stale — discard
    const slotItems = data.items || [];
    setSlots(slotItems);
    if (autoLabel) {
      const count = slotItems.length;
      setNextLabel(`${String.fromCharCode(65 + Math.floor(count / 10))}-${String(count % 10 + 1).padStart(2, "0")}`);
    }
  }

  // Load snapshot — only applies result if camera is still the active one
  async function loadSnapshot(cameraId: string) {
    try {
      const url = await camerasApi.snapshotBlobUrl(cameraId);
      if (activeCameraIdRef.current !== cameraId) return; // stale — discard
      setSnapshotUrl(url);
    } catch {
      if (activeCameraIdRef.current === cameraId) setSnapshotUrl(null);
    }
  }

  useEffect(() => { fetchDevice(); fetchCameras(); }, [fetchDevice, fetchCameras]);

  // Poll slots for the active camera
  useEffect(() => {
    const interval = setInterval(() => {
      const camId = activeCameraIdRef.current;
      if (camId) fetchSlotsForCamera(camId, false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // When camera changes: stamp the ref, clear old data, fetch fresh
  useEffect(() => {
    if (!selectedCamera) {
      activeCameraIdRef.current = null;
      setSnapshotUrl(null);
      setSlots([]);
      return;
    }
    activeCameraIdRef.current = selectedCamera.id;
    setSlots([]);
    setSnapshotUrl(null);
    fetchSlotsForCamera(selectedCamera.id);
    loadSnapshot(selectedCamera.id);
  }, [selectedCamera?.id]);

  // Capture snapshot — send command, show loading, fetch fresh image
  async function handleCaptureSnapshot() {
    if (!selectedCamera) return;
    const camId = selectedCamera.id;
    setSnapshotLoading(true);

    try {
      await camerasApi.captureSnapshot(camId);
      showSuccess("Capture command sent, waiting for new image...");

      // Wait then fetch fresh, keep old image visible during wait
      for (const delay of [5000, 4000]) {
        await new Promise((r) => setTimeout(r, delay));
        if (activeCameraIdRef.current !== camId) return;
        try {
          const url = await camerasApi.snapshotBlobUrl(camId);
          if (activeCameraIdRef.current !== camId) return;
          setSnapshotUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          // Refresh camera dims
          const { data } = await camerasApi.byDevice(id!);
          const refreshedCams = data.items || [];
          setCameras(refreshedCams);
          const updated = refreshedCams.find((c: Camera) => c.id === camId);
          if (updated) setSelectedCamera(updated);
        } catch { /* keep trying */ }
      }
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Snapshot failed");
    } finally {
      setSnapshotLoading(false);
    }
  }

  // Camera CRUD
  async function handleCreateCamera(e: FormEvent) {
    e.preventDefault();
    setCamSaving(true);
    try {
      const { data: newCam } = await camerasApi.create({
        device_id: id,
        position_label: camLabel,
        source: camSource,
        camera_type: camType,
      });
      setShowCamForm(false);
      showSuccess("Camera created");
      await fetchCameras(newCam.id);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed");
    } finally {
      setCamSaving(false);
    }
  }

  async function handleDeleteCamera() {
    if (!deletingCam) return;
    try {
      await camerasApi.delete(deletingCam.id);
      setDeletingCam(null);
      if (selectedCamera?.id === deletingCam.id) setSelectedCamera(null);
      showSuccess("Camera deleted");
      fetchCameras();
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed");
    }
  }

  // Slot CRUD via polygon drawing
  async function handlePolygonComplete(polygon: number[][]) {
    if (!selectedCamera || !device) return;
    const createdLabel = nextLabel;
    try {
      await slotsApi.create({
        label: createdLabel,
        zone_id: device.zone_id,
        camera_id: selectedCamera.id,
        polygon_coords: JSON.stringify(polygon),
      });
      showSuccess(`Slot ${createdLabel} created`);
      // Auto-increment: "B11" → "B12", "A-01" → "A-02", "Slot 5" → "Slot 6"
      setNextLabel(incrementLabel(createdLabel));
      fetchSlotsForCamera(selectedCamera.id, false);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to create slot");
    }
  }

  async function handleDeleteSlot() {
    if (!deletingSlot) return;
    try {
      await slotsApi.delete(deletingSlot.id);
      setDeletingSlot(null);
      showSuccess("Slot deleted");
      if (selectedCamera) fetchSlotsForCamera(selectedCamera.id, false);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed");
    }
  }

  const [calibrating, setCalibrating] = useState<string | null>(null);

  async function handleCalibrate(slot: ParkingSlot) {
    if (!selectedCamera) return;
    setCalibrating(slot.id);
    try {
      const { data } = await camerasApi.calibrateSlot(selectedCamera.id, slot.id);
      showSuccess(`Calibrating ${slot.label}...`);
      const cmdId = data.command_id;
      if (!cmdId) { setCalibrating(null); return; }

      // Poll for completion (max 15s)
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const { data: cmd } = await commandsApi.status(cmdId);
          if (cmd.status === "COMPLETED") { showSuccess(`${slot.label} calibrated successfully`); setCalibrating(null); return; }
          if (cmd.status === "FAILED") { showError(`Calibration failed: ${cmd.error_message || "unknown error"}`); setCalibrating(null); return; }
        } catch { /* keep polling */ }
      }
      showError("Calibration timed out — check device logs");
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Calibration failed");
    } finally {
      setCalibrating(null);
    }
  }

  // Map slots to PolygonDrawer format
  const drawerSlots: SlotData[] = slots.map((s) => ({
    id: s.id,
    label: s.label,
    polygon_coords: s.polygon_coords,
    state: s.state,
  }));

  const isOnline = device?.status === "ONLINE";
  const vehicle = slots.filter((s) => s.state === "VEHICLE").length;
  const empty = slots.filter((s) => s.state === "EMPTY").length;
  const obstructed = slots.filter((s) => s.state === "OBSTRUCTED").length;

  if (!device) return null;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/devices")} className="h-9 w-9 rounded-xl">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Monitor size={18} className="text-slate-500" />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-slate-900">{device.device_id}</h1>
              <p className="text-[12px] text-slate-400 mt-0.5">Last seen: {device.last_seen ? new Date(device.last_seen).toLocaleString() : "Never"}</p>
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-lg px-3 py-1.5 ${isOnline ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {device.status}
        </span>
      </div>

      {/* Camera Tabs + Add */}
      <div className="flex items-center gap-2 mb-4">
        {cameras.map((cam) => (
          <button
            key={cam.id}
            onClick={() => { setSelectedCamera(cam); setDrawMode(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              selectedCamera?.id === cam.id
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                : "bg-white text-slate-600 border border-slate-200 hover:border-teal-300 card-shadow"
            }`}
          >
            <CamIcon size={14} />
            {cam.position_label}
          </button>
        ))}
        <Button
          onClick={() => { setCamLabel(""); setCamSource("0"); setCamType("USB"); setShowCamForm(true); }}
          variant="ghost"
          className="h-9 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-teal-400 hover:text-teal-600 text-[12px] gap-1.5"
        >
          <Plus size={14} /> Add Camera
        </Button>
      </div>

      {/* Selected Camera Content */}
      {selectedCamera ? (
        <div className="flex gap-5">
          {/* Left: Canvas */}
          <div className="flex-1 min-w-0">
            {/* Camera info bar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-slate-700">{selectedCamera.position_label}</span>
                <span className="text-[11px] text-slate-400">
                  {selectedCamera.source || "—"} / {selectedCamera.camera_type || "USB"}
                  {selectedCamera.frame_width ? ` / ${selectedCamera.frame_width}x${selectedCamera.frame_height}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost" size="sm"
                  className="h-8 rounded-lg text-[11px] gap-1.5 hover:bg-violet-50 hover:text-violet-600"
                  onClick={handleCaptureSnapshot}
                  disabled={snapshotLoading}
                >
                  <CamIcon size={12} /> {snapshotLoading ? "Capturing..." : "Snapshot"}
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-8 rounded-lg text-[11px] gap-1.5 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setDeletingCam(selectedCamera)}
                >
                  <Trash2 size={12} /> Delete
                </Button>
              </div>
            </div>

            {/* Mode Toggle */}
            {snapshotUrl && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex rounded-xl overflow-hidden border border-slate-200">
                    <button
                      onClick={() => setDrawMode(false)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all ${!drawMode ? "bg-teal-600 text-white" : "bg-white text-slate-500"}`}
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      onClick={() => setDrawMode(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border-l border-slate-200 transition-all ${drawMode ? "bg-teal-600 text-white" : "bg-white text-slate-500"}`}
                    >
                      <PenTool size={12} /> Draw
                    </button>
                  </div>
                  {drawMode && (
                    <>
                      <div className="flex rounded-lg overflow-hidden border border-slate-200">
                        <button onClick={() => setShapeMode("rectangle")} className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold ${shapeMode === "rectangle" ? "bg-teal-600 text-white" : "bg-white text-slate-500"}`}>
                          <Square size={11} /> Rect
                        </button>
                        <button onClick={() => setShapeMode("polygon")} className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border-l border-slate-200 ${shapeMode === "polygon" ? "bg-teal-600 text-white" : "bg-white text-slate-500"}`}>
                          <Pentagon size={11} /> Poly
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium">Label:</span>
                        <Input value={nextLabel} onChange={(e) => setNextLabel(e.target.value)} className="w-20 h-7 text-[12px] rounded-lg" />
                      </div>
                    </>
                  )}
                </div>
                {drawMode && (
                  <span className="text-[11px] text-teal-600 font-medium">
                    {shapeMode === "rectangle" ? "Click two corners." : "Click to draw. Click near start to close. ESC to cancel."}
                  </span>
                )}
              </div>
            )}

            {/* Polygon Drawer or placeholder */}
            {snapshotUrl ? (
              <PolygonDrawer
                imageUrl={snapshotUrl}
                existingSlots={drawerSlots}
                onComplete={drawMode ? handlePolygonComplete : undefined}
                onSlotClick={!drawMode ? (s) => setDeletingSlot(slots.find((sl) => sl.id === s.id) || null) : undefined}
                drawingEnabled={drawMode}
                drawingMode={shapeMode}
              />
            ) : snapshotLoading ? (
              <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl py-20">
                <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[14px] font-semibold text-white">Loading new image...</p>
                <p className="text-[12px] text-slate-400 mt-1">Waiting for edge device to capture and upload</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 py-20">
                <CamIcon size={32} className="text-slate-300 mb-3" />
                <p className="text-[14px] font-semibold text-slate-500">No snapshot available</p>
                <p className="text-[12px] text-slate-400 mt-1">Click "Snapshot" above to capture a reference image</p>
              </div>
            )}

            {/* Legend */}
            {slots.length > 0 && (
              <div className="mt-3 flex gap-5 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/30 border border-green-500" /> Empty: {empty}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500" /> Vehicle: {vehicle}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500" /> Obstructed: {obstructed}</span>
              </div>
            )}
          </div>

          {/* Right: Slots Sidebar */}
          <div className="w-[240px] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-slate-900">Slots ({slots.length})</h2>
              {slots.length > 0 && (
                <span className={`text-[10px] font-bold rounded-lg px-2 py-1 ${vehicle > 0 ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50"}`}>
                  {vehicle}/{slots.length} occupied
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 max-h-[550px] overflow-y-auto pr-1">
              {slots.map((s) => {
                const sc = s.state === "VEHICLE"
                  ? { bg: "bg-red-50", border: "border-red-200", color: "text-red-600" }
                  : s.state === "OBSTRUCTED"
                  ? { bg: "bg-amber-50", border: "border-amber-200", color: "text-amber-600" }
                  : { bg: "bg-emerald-50", border: "border-emerald-200", color: "text-emerald-600" };
                return (
                  <div key={s.id} className={`rounded-xl border ${sc.border} ${sc.bg} p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-bold text-slate-800">{s.label}</span>
                      <span className={`text-[10px] font-bold ${sc.color}`}>{s.state}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost" size="sm"
                        className="flex-1 h-7 text-[10px] rounded-lg bg-white/60 hover:bg-white"
                        onClick={() => handleCalibrate(s)}
                        disabled={calibrating === s.id}
                      >
                        <Crosshair size={10} className="mr-1" /> {calibrating === s.id ? "Calibrating..." : "Calibrate"}
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 rounded-lg bg-white/60 hover:bg-red-100 hover:text-red-600"
                        onClick={() => setDeletingSlot(s)}
                      >
                        <Trash2 size={10} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {slots.length === 0 && (
                <p className="text-[12px] text-slate-400 text-center py-12">
                  {snapshotUrl ? "Switch to Draw mode to create slots" : "Capture a snapshot first"}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow p-16 text-center">
          <Monitor size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-500">No cameras configured</p>
          <p className="text-[12px] text-slate-400 mt-1 mb-4">Add a camera to start monitoring</p>
          <Button
            onClick={() => { setCamLabel(""); setCamSource("0"); setCamType("USB"); setShowCamForm(true); }}
            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold gap-2"
          >
            <Plus size={14} /> Add Camera
          </Button>
        </div>
      )}

      {/* Add Camera Dialog */}
      <CrudDialog open={showCamForm} onClose={() => setShowCamForm(false)} title="Add Camera">
        <form onSubmit={handleCreateCamera} className="space-y-4 mt-3">
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Label</Label>
            <Input value={camLabel} onChange={(e) => setCamLabel(e.target.value)} placeholder="cam-1" className="mt-2 h-10 rounded-xl text-[13px]" required />
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Source</Label>
            <Input value={camSource} onChange={(e) => setCamSource(e.target.value)} placeholder="0, rtsp://..., csi://0" className="mt-2 h-10 rounded-xl text-[13px]" required />
            <p className="text-[11px] text-slate-400 mt-1">USB: device index (0, 1). RTSP: full URL. CSI: camera index.</p>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Type</Label>
            <div className="mt-2">
              <Select value={camType} onValueChange={setCamType}>
                <SelectTrigger className="h-10 rounded-xl text-[13px]"><span>{camType}</span></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="USB">USB</SelectItem>
                  <SelectItem value="RTSP">RTSP</SelectItem>
                  <SelectItem value="CSI">CSI (RPi Camera)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setShowCamForm(false)} className="rounded-xl text-[13px]">Cancel</Button>
            <Button type="submit" disabled={camSaving} className="rounded-xl bg-teal-600 hover:bg-teal-700 text-[13px] font-semibold">{camSaving ? "Creating..." : "Create"}</Button>
          </div>
        </form>
      </CrudDialog>

      {/* Delete Camera Dialog */}
      <ConfirmDialog
        open={!!deletingCam}
        onClose={() => setDeletingCam(null)}
        onConfirm={handleDeleteCamera}
        title="Delete Camera"
        description={`Remove camera "${deletingCam?.position_label}"? All its slots will also be removed.`}
      />

      {/* Delete Slot Dialog */}
      <ConfirmDialog
        open={!!deletingSlot}
        onClose={() => setDeletingSlot(null)}
        onConfirm={handleDeleteSlot}
        title="Delete Slot"
        description={`Remove slot "${deletingSlot?.label}"?`}
      />
    </div>
  );
}
