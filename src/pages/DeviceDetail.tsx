import { useState, useCallback, useEffect, useRef, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { showSuccess, showError } from "@/lib/toast";
import { devicesApi, camerasApi, slotsApi, commandsApi, anprConfigsApi } from "@/services/api";
import type { AnprCameraConfig } from "@/types/api";
import PolygonDrawer, { type SlotData } from "@/components/PolygonDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import CrudDialog from "@/components/CrudDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  ArrowLeft, Plus, Camera as CamIcon, Trash2, Crosshair, Eye, PenTool, Square, Pentagon,
  Monitor, Wifi, WifiOff, ParkingSquare, ScanLine,
} from "lucide-react";
import type { Device, Camera, ParkingSlot } from "@/types/api";
import DeviceDetailSkeleton from "@/components/skeletons/DeviceDetailSkeleton";

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
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);

  // Camera form
  const [showCamForm, setShowCamForm] = useState(false);
  const [camLabel, setCamLabel] = useState("");
  const [camSource, setCamSource] = useState("0");
  const [camType, setCamType] = useState("USB");
  const [camModuleType, setCamModuleType] = useState<"AI_PARKING" | "ANPR">("AI_PARKING");
  const [camSaving, setCamSaving] = useState(false);
  const [deletingCam, setDeletingCam] = useState<Camera | null>(null);

  // Slot drawing
  const [drawMode, setDrawMode] = useState(false);
  const [shapeMode, setShapeMode] = useState<"rectangle" | "polygon">("rectangle");
  const [nextLabel, setNextLabel] = useState("A-01");
  const [slotType, setSlotType] = useState("GENERAL");
  const [capCar, setCapCar] = useState("1");
  const [cap2w, setCap2w] = useState("0");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState<ParkingSlot | null>(null);
  const [showDetection, setShowDetection] = useState(false);
  const [pendingPolygon, setPendingPolygon] = useState<number[][] | null>(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotModalSaving, setSlotModalSaving] = useState(false);

  // ANPR config state
  const [anprConfig, setAnprConfig] = useState<AnprCameraConfig | null>(null);
  const [anprDrawMode, setAnprDrawMode] = useState<"" | "roi" | "line">("");
  const [anprRoi, setAnprRoi] = useState<number[][]>([]);
  const [anprLine, setAnprLine] = useState<number[][]>([]);
  const [clearSignal, setClearSignal] = useState(0); // bump to cancel an in-progress slot drawing
  const [anprDirection, setAnprDirection] = useState<"IN" | "OUT">("IN");
  const [anprSaving, setAnprSaving] = useState(false);

  // Fetch device
  const fetchDevice = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await devicesApi.get(id);
      setDevice(data);
    } finally {
      setLoading(false);
    }
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
    setAnprDrawMode("");
    fetchSlotsForCamera(selectedCamera.id);
    loadSnapshot(selectedCamera.id);

    // Load ANPR config if ANPR camera
    if ((selectedCamera as any).module_type === "ANPR") {
      anprConfigsApi.byCamera(selectedCamera.id).then(({ data }) => {
        if (data) {
          setAnprConfig(data);
          try { setAnprRoi(JSON.parse(data.roi_coords || "[]")); } catch { setAnprRoi([]); }
          try { setAnprLine(JSON.parse(data.trigger_line || "[]")); } catch { setAnprLine([]); }
          setAnprDirection(data.direction || "IN");
        } else {
          setAnprConfig(null); setAnprRoi([]); setAnprLine([]); setAnprDirection("IN");
        }
      }).catch(() => { setAnprConfig(null); setAnprRoi([]); setAnprLine([]); });
    } else {
      setAnprConfig(null); setAnprRoi([]); setAnprLine([]);
    }
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
        module_type: camModuleType,
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

  // Slot CRUD via polygon drawing — show popup after drawing
  function handlePolygonComplete(polygon: number[][]) {
    if (!selectedCamera || !device) return;
    setPendingPolygon(polygon);
    setSlotType("GENERAL");
    setCapCar("1");
    setCap2w("0");
    setShowSlotModal(true);
  }

  async function handleSlotModalSave() {
    if (!selectedCamera || !device || !pendingPolygon) return;
    const createdLabel = nextLabel.trim();
    if (!createdLabel) { showError("Enter a slot label"); return; }
    setSlotModalSaving(true);
    try {
      await slotsApi.create({
        label: createdLabel,
        zone_id: device.zone_id,
        camera_id: selectedCamera.id,
        polygon_coords: JSON.stringify(pendingPolygon),
        slot_type: slotType,
        capacity_car: parseInt(capCar) || 0,
        capacity_two_wheeler: parseInt(cap2w) || 0,
      });
      showSuccess(`Slot ${createdLabel} created`);
      setNextLabel(incrementLabel(createdLabel));
      setShowSlotModal(false);
      setPendingPolygon(null);
      fetchSlotsForCamera(selectedCamera.id, false);
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to create slot");
    } finally {
      setSlotModalSaving(false);
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

  // ANPR drawing handlers
  function handleAnprPolygonComplete(polygon: number[][]) {
    if (anprDrawMode === "roi") {
      setAnprRoi(polygon);
      setAnprDrawMode("");
      showSuccess("ROI drawn — now draw the trigger line or save");
    } else if (anprDrawMode === "line") {
      // Line = just first 2 points
      setAnprLine(polygon.slice(0, 2));
      setAnprDrawMode("");
      showSuccess("Trigger line drawn — save to apply");
    }
  }

  async function handleAnprSave() {
    if (!selectedCamera) return;
    setAnprSaving(true);
    try {
      const payload = {
        camera_id: selectedCamera.id,
        roi_coords: anprRoi.length > 0 ? JSON.stringify(anprRoi) : null,
        trigger_line: anprLine.length === 2 ? JSON.stringify(anprLine) : null,
        direction: anprDirection,
        is_active: true,
      };
      if (anprConfig) {
        await anprConfigsApi.update(anprConfig.id, payload);
      } else {
        const { data } = await anprConfigsApi.create(payload);
        setAnprConfig(data);
      }
      showSuccess("ANPR config saved & synced to device");
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to save ANPR config");
    }
    setAnprSaving(false);
  }

  async function handleAnprDelete() {
    if (!anprConfig) return;
    try {
      await anprConfigsApi.delete(anprConfig.id);
      setAnprConfig(null); setAnprRoi([]); setAnprLine([]); setAnprDirection("IN");
      showSuccess("ANPR config deleted");
    } catch (err: any) {
      showError(err?.response?.data?.detail || "Failed to delete");
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
    slot_type: s.slot_type,
    detected_vehicle_type: s.detected_vehicle_type,
  }));

  const isOnline = device?.status === "ONLINE";
  const isMismatch = (s: any) => s.state === "VEHICLE" && s.slot_type && s.slot_type !== "GENERAL" && s.detected_vehicle_type != null && s.detected_vehicle_type !== s.slot_type;
  const mismatched = slots.filter(isMismatch).length;
  const totalCapacity = slots.reduce((sum, s) => sum + ((s.capacity_car || 0) + (s.capacity_two_wheeler || 0) || 1), 0);
  const totalOccupied = slots.reduce((sum, s) => sum + (s.occupied_car || 0) + (s.occupied_two_wheeler || 0), 0);
  const vehicle = totalOccupied;
  const empty = totalCapacity - totalOccupied;
  const obstructed = slots.filter((s) => s.state === "OBSTRUCTED").length;

  if (loading && !device) return <DeviceDetailSkeleton />;
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
            {(cam as any).module_type === "ANPR" && (
              <span className={`w-1.5 h-1.5 rounded-full ${selectedCamera?.id === cam.id ? "bg-white/80" : "bg-violet-500"}`} />
            )}
          </button>
        ))}
        <Button
          onClick={() => { setCamLabel(""); setCamSource("0"); setCamType("USB"); setCamModuleType("AI_PARKING"); setShowCamForm(true); }}
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
                <span className={`text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${
                  (selectedCamera as any).module_type === "ANPR" ? "bg-violet-100 text-violet-700" : "bg-teal-100 text-teal-700"
                }`}>
                  {(selectedCamera as any).module_type === "ANPR" ? "ANPR" : "Parking"}
                </span>
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

            {/* Mode Toggle — different for AI Parking vs ANPR */}
            {snapshotUrl && (selectedCamera as any).module_type === "ANPR" ? (
              /* ANPR Mode Toggle */
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex rounded-xl overflow-hidden border border-slate-200">
                    <button
                      onClick={() => setAnprDrawMode("")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all ${anprDrawMode === "" ? "bg-violet-600 text-white" : "bg-white text-slate-500"}`}
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      onClick={() => setAnprDrawMode("roi")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border-l border-slate-200 transition-all ${anprDrawMode === "roi" ? "bg-violet-600 text-white" : "bg-white text-slate-500"}`}
                    >
                      <Pentagon size={12} /> Draw ROI
                    </button>
                    <button
                      onClick={() => setAnprDrawMode("line")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border-l border-slate-200 transition-all ${anprDrawMode === "line" ? "bg-violet-600 text-white" : "bg-white text-slate-500"}`}
                    >
                      <PenTool size={12} /> Draw Line
                    </button>
                  </div>
                  {(anprDrawMode === "roi" || anprDrawMode === "line") && (
                    <button
                      onClick={() => (anprDrawMode === "roi" ? setAnprRoi([]) : setAnprLine([]))}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={12} /> Clear {anprDrawMode === "roi" ? "ROI" : "Line"}
                    </button>
                  )}
                </div>
                {anprDrawMode === "roi" && (
                  <span className="text-[11px] text-violet-600 font-medium">Click corners to draw ROI polygon. Click near start to close.</span>
                )}
                {anprDrawMode === "line" && (
                  <span className="text-[11px] text-violet-600 font-medium">Click 2 points to define the trigger line.</span>
                )}
              </div>
            ) : snapshotUrl && (
              /* AI Parking Mode Toggle */
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex rounded-xl overflow-hidden border border-slate-200">
                    <button
                      onClick={() => { setDrawMode(false); setShowDetection(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all ${!drawMode && !showDetection ? "bg-teal-600 text-white" : "bg-white text-slate-500"}`}
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      onClick={() => { setDrawMode(true); setShowDetection(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border-l border-slate-200 transition-all ${drawMode ? "bg-teal-600 text-white" : "bg-white text-slate-500"}`}
                    >
                      <PenTool size={12} /> Draw
                    </button>
                    <button
                      onClick={() => { setShowDetection(!showDetection); setDrawMode(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold border-l border-slate-200 transition-all ${showDetection ? "bg-red-500 text-white" : "bg-white text-slate-500"}`}
                    >
                      <Eye size={12} /> Detection
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
                      <button
                        onClick={() => setClearSignal((c) => c + 1)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} /> Clear
                      </button>
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

            {/* Canvas / Polygon Drawer / ANPR Overlay */}
            {(selectedCamera as any).module_type === "ANPR" ? (
              /* ANPR Camera — show ROI + trigger line overlays */
              snapshotUrl ? (
                <div>
                  <PolygonDrawer
                    imageUrl={snapshotUrl}
                    existingSlots={anprRoi.length > 0 ? [{
                      id: "anpr-roi",
                      label: "ROI",
                      polygon_coords: JSON.stringify(anprRoi),
                      state: "EMPTY" as const,
                      slot_type: "GENERAL" as const,
                      detected_vehicle_type: null,
                    }] : []}
                    onComplete={anprDrawMode ? handleAnprPolygonComplete : undefined}
                    drawingEnabled={anprDrawMode !== ""}
                    drawingMode={anprDrawMode === "line" ? "line" : "polygon"}
                    overlayLine={anprLine.length === 2 ? anprLine : null}
                  />
                  {/* Trigger line legend */}
                  <div className="mt-3 flex gap-5 text-[11px] font-medium text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-green-500/30 border border-green-500" />
                      ROI: {anprRoi.length > 0 ? `${anprRoi.length} points` : "Not set"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-violet-500/30 border border-violet-500" />
                      Trigger Line: {anprLine.length === 2 ? `[${anprLine[0]}] → [${anprLine[1]}]` : "Not set"}
                    </span>
                  </div>
                </div>
              ) : snapshotLoading ? (
                <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl py-20">
                  <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-[14px] font-semibold text-white">Loading image...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-violet-200 py-20">
                  <ScanLine size={32} className="text-violet-300 mb-3" />
                  <p className="text-[14px] font-semibold text-slate-500">No snapshot available</p>
                  <p className="text-[12px] text-slate-400 mt-1">Click "Snapshot" to capture a reference image for ROI drawing</p>
                </div>
              )
            ) : (
              /* AI Parking Camera — existing slot drawing */
              <>
                {showDetection && device ? (
                  <div className="rounded-xl overflow-hidden border-2 border-red-200">
                    <img
                      src={`https://api-minio.projectanddemoserver.com/ai-parking/debug/${device.device_id}/${selectedCamera.position_label}/latest.jpg?t=${Date.now()}`}
                      alt="Detection view"
                      className="w-full"
                      onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                    />
                  </div>
                ) : snapshotUrl ? (
                  <PolygonDrawer
                    imageUrl={snapshotUrl}
                    existingSlots={drawerSlots}
                    onComplete={drawMode ? handlePolygonComplete : undefined}
                    onSlotClick={!drawMode ? (s) => setDeletingSlot(slots.find((sl) => sl.id === s.id) || null) : undefined}
                    drawingEnabled={drawMode}
                    drawingMode={shapeMode}
                    clearSignal={clearSignal}
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
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500" /> Occupied: {vehicle}</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/30 border border-green-500" /> Available: {empty}</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500" /> Obstructed: {obstructed}</span>
                    {mismatched > 0 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/30 border border-blue-500" /> Mismatched: {mismatched}</span>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Sidebar — ANPR config or Slots list */}
          {(selectedCamera as any).module_type === "ANPR" ? (
            <div className="w-[300px] flex-shrink-0 space-y-4">
              {/* Camera Details */}
              <div className="bg-white rounded-2xl card-shadow overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                    <CamIcon size={15} className="text-slate-500" />
                  </div>
                  <h2 className="text-[14px] font-bold text-slate-900">Camera Details</h2>
                </div>
                <div className="p-4 space-y-2.5 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Module</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 bg-violet-100 text-violet-700">ANPR</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Camera Type</span>
                    <span className="font-semibold text-slate-700">{selectedCamera.camera_type || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Resolution</span>
                    <span className="font-semibold text-slate-700">{selectedCamera.frame_width ? `${selectedCamera.frame_width}×${selectedCamera.frame_height}` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Detection Interval</span>
                    <span className="font-semibold text-slate-700">{selectedCamera.detection_interval != null ? `${selectedCamera.detection_interval}s` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Status</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${selectedCamera.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{selectedCamera.status}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Source</p>
                    <p className="text-[11px] font-mono text-slate-600 break-all bg-slate-50 rounded-lg px-2 py-1.5">{selectedCamera.source || "—"}</p>
                  </div>
                </div>
              </div>

              {/* ANPR Configuration */}
              <div className="bg-white rounded-2xl card-shadow overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                    <ScanLine size={15} className="text-violet-600" />
                  </div>
                  <h2 className="text-[14px] font-bold text-slate-900">ANPR Configuration</h2>
                </div>

                <div className="p-4 space-y-3">
                  {/* ROI Polygon — emerald (matches canvas) */}
                  <div className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30 border border-emerald-500" /> ROI Polygon
                      </span>
                      {anprRoi.length > 0 ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">{anprRoi.length} points</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 rounded-full px-2 py-0.5">Not set</span>
                      )}
                    </div>
                    {anprRoi.length > 0 ? (
                      <div className="max-h-16 overflow-y-auto text-[10px] font-mono text-slate-500 bg-slate-50 rounded-lg px-2 py-1.5 break-all leading-relaxed">{JSON.stringify(anprRoi)}</div>
                    ) : (
                      <p className="text-[11px] text-slate-400">Use <b className="text-violet-600 font-semibold">Draw ROI</b> to mark the detection region.</p>
                    )}
                  </div>

                  {/* Trigger Line — violet (matches canvas) */}
                  <div className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <span className="w-2.5 h-2.5 rounded-sm bg-violet-500/30 border border-violet-500" /> Trigger Line
                      </span>
                      {anprLine.length === 2 ? (
                        <span className="text-[10px] font-bold text-violet-700 bg-violet-50 rounded-full px-2 py-0.5">Set</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 rounded-full px-2 py-0.5">Not set</span>
                      )}
                    </div>
                    {anprLine.length === 2 ? (
                      <div className="text-[10px] font-mono text-slate-500 bg-slate-50 rounded-lg px-2 py-1.5 break-all">[{String(anprLine[0])}] → [{String(anprLine[1])}]</div>
                    ) : (
                      <p className="text-[11px] text-slate-400">Use <b className="text-violet-600 font-semibold">Draw Line</b> to set the capture trigger.</p>
                    )}
                  </div>

                  {/* Direction */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Direction</p>
                    <div className="flex rounded-xl overflow-hidden border border-slate-200">
                      <button onClick={() => setAnprDirection("IN")}
                        className={`flex-1 py-2 text-[12px] font-semibold transition-all ${
                          anprDirection === "IN" ? "bg-blue-500 text-white" : "bg-white text-slate-500 hover:text-slate-700"
                        }`}>
                        IN (Entry)
                      </button>
                      <button onClick={() => setAnprDirection("OUT")}
                        className={`flex-1 py-2 text-[12px] font-semibold border-l border-slate-200 transition-all ${
                          anprDirection === "OUT" ? "bg-red-500 text-white" : "bg-white text-slate-500 hover:text-slate-700"
                        }`}>
                        OUT (Exit)
                      </button>
                    </div>
                  </div>

                  {/* Status */}
                  {anprConfig && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Saved — {new Date(anprConfig.updated_at).toLocaleString()}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                    <Button onClick={handleAnprSave} disabled={anprSaving}
                      className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-[12px] font-semibold">
                      {anprSaving ? "Saving..." : anprConfig ? "Update & Sync" : "Save Config"}
                    </Button>
                    {anprConfig && (
                      <Button variant="ghost" onClick={handleAnprDelete}
                        className="w-full rounded-xl text-[12px] text-red-600 hover:bg-red-50">
                        Delete Config
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="w-[240px] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-slate-900">Slots ({slots.length})</h2>
              {slots.length > 0 && (
                <span className={`text-[10px] font-bold rounded-lg px-2 py-1 ${vehicle > 0 ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50"}`}>
                  {vehicle}/{totalCapacity} occupied
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 max-h-[550px] overflow-y-auto pr-1">
              {slots.map((s) => {
                const sc = isMismatch(s)
                  ? { bg: "bg-blue-50", border: "border-blue-200", color: "text-blue-600" }
                  : s.state === "VEHICLE"
                  ? { bg: "bg-red-50", border: "border-red-200", color: "text-red-600" }
                  : s.state === "OBSTRUCTED"
                  ? { bg: "bg-amber-50", border: "border-amber-200", color: "text-amber-600" }
                  : { bg: "bg-emerald-50", border: "border-emerald-200", color: "text-emerald-600" };
                return (
                  <div key={s.id} className={`rounded-xl border ${sc.border} ${sc.bg} p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <input
                        defaultValue={s.label}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          if (val && val !== s.label) {
                            try { await slotsApi.update(s.id, { label: val }); if (selectedCamera) fetchSlotsForCamera(selectedCamera.id, false); }
                            catch { showError("Failed to update label"); e.target.value = s.label; }
                          } else { e.target.value = s.label; }
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="text-[13px] font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-none w-20"
                      />
                      <span className={`text-[10px] font-bold ${sc.color}`}>{s.state === "VEHICLE" && s.detected_vehicle_type ? (s.detected_vehicle_type === "TWO_WHEELER" ? "2W" : "CAR") : s.state}</span>
                    </div>
                    <div className="mb-2">
                      <select
                        value={s.slot_type || "GENERAL"}
                        onChange={async (e) => {
                          try {
                            await slotsApi.update(s.id, { slot_type: e.target.value });
                            if (selectedCamera) fetchSlotsForCamera(selectedCamera.id, false);
                          } catch { showError("Failed to update slot type"); }
                        }}
                        className="w-full h-6 rounded-md border border-slate-200 bg-white/80 px-2 text-[10px] font-medium"
                      >
                        <option value="GENERAL">General</option>
                        <option value="CAR">Car</option>
                        <option value="TWO_WHEELER">2-Wheeler</option>
                      </select>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <label className="text-[9px] font-semibold text-slate-400">Car Cap</label>
                        <input type="number" min="0" value={s.capacity_car ?? 0}
                          onChange={async (e) => {
                            try { await slotsApi.update(s.id, { capacity_car: parseInt(e.target.value) || 0 }); if (selectedCamera) fetchSlotsForCamera(selectedCamera.id, false); }
                            catch { showError("Failed to update"); }
                          }}
                          className="w-full h-6 rounded-md border border-slate-200 bg-white/80 px-2 text-[10px] font-medium text-center" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] font-semibold text-slate-400">2W Cap</label>
                        <input type="number" min="0" value={s.capacity_two_wheeler ?? 0}
                          onChange={async (e) => {
                            try { await slotsApi.update(s.id, { capacity_two_wheeler: parseInt(e.target.value) || 0 }); if (selectedCamera) fetchSlotsForCamera(selectedCamera.id, false); }
                            catch { showError("Failed to update"); }
                          }}
                          className="w-full h-6 rounded-md border border-slate-200 bg-white/80 px-2 text-[10px] font-medium text-center" />
                      </div>
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
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow p-16 text-center">
          <Monitor size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-500">No cameras configured</p>
          <p className="text-[12px] text-slate-400 mt-1 mb-4">Add a camera to start monitoring</p>
          <Button
            onClick={() => { setCamLabel(""); setCamSource("0"); setCamType("USB"); setCamModuleType("AI_PARKING"); setShowCamForm(true); }}
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
            <Label className="text-[13px] font-semibold text-slate-700">Source Type</Label>
            <div className="mt-2">
              <Select value={camType} onValueChange={(v) => setCamType(v ?? "USB")}>
                <SelectTrigger className="h-10 rounded-xl text-[13px]"><span>{camType}</span></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="USB">USB</SelectItem>
                  <SelectItem value="RTSP">RTSP</SelectItem>
                  <SelectItem value="CSI">CSI (RPi Camera)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-slate-700">Camera Module</Label>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setCamModuleType("AI_PARKING")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold border-2 transition-all ${
                  camModuleType === "AI_PARKING" ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}>
                <ParkingSquare size={14} /> AI Parking
              </button>
              <button type="button" onClick={() => setCamModuleType("ANPR")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold border-2 transition-all ${
                  camModuleType === "ANPR" ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}>
                <ScanLine size={14} /> ANPR
              </button>
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

      {/* Slot Creation Modal */}
      <CrudDialog
        open={showSlotModal}
        onClose={() => { setShowSlotModal(false); setPendingPolygon(null); }}
        title="New Parking Slot"
        maxWidth="380px"
      >
        <div className="space-y-4 mt-3">
          <div>
            <Label className="text-[12px]">Label</Label>
            <Input value={nextLabel} onChange={(e) => setNextLabel(e.target.value)} className="mt-1.5 h-9 rounded-lg text-[13px]" placeholder="A-01" />
          </div>
          <div>
            <Label className="text-[12px]">Slot Type</Label>
            <select value={slotType} onChange={(e) => {
              setSlotType(e.target.value);
              if (e.target.value === "CAR") { setCapCar("1"); setCap2w("0"); }
              else if (e.target.value === "TWO_WHEELER") { setCapCar("0"); setCap2w("1"); }
              else { setCapCar("1"); setCap2w("0"); }
            }} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]">
              <option value="GENERAL">General (Any Vehicle)</option>
              <option value="CAR">Car</option>
              <option value="TWO_WHEELER">2-Wheeler</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[12px]">Car Capacity</Label>
              <Input type="number" min="0" value={capCar} onChange={(e) => setCapCar(e.target.value)} className="mt-1.5 h-9 rounded-lg text-[13px] text-center" />
            </div>
            <div>
              <Label className="text-[12px]">2W Capacity</Label>
              <Input type="number" min="0" value={cap2w} onChange={(e) => setCap2w(e.target.value)} className="mt-1.5 h-9 rounded-lg text-[13px] text-center" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => { setShowSlotModal(false); setPendingPolygon(null); }} className="h-9 text-[12px]">Cancel</Button>
            <Button onClick={handleSlotModalSave} disabled={slotModalSaving} className="h-9 text-[12px] bg-teal-600 hover:bg-teal-700">
              {slotModalSaving ? "Creating..." : "Create Slot"}
            </Button>
          </div>
        </div>
      </CrudDialog>
    </div>
  );
}
