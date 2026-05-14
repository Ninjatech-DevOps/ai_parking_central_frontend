import { useRef, useEffect, useState, useCallback } from "react";
import type { CanvasCamera, CanvasSlot } from "@/types/api";

const COLORS = {
  VEHICLE: { fill: "rgba(239, 68, 68, 0.3)", stroke: "#ef4444", text: "#dc2626" },
  EMPTY: { fill: "rgba(34, 197, 94, 0.3)", stroke: "#22c55e", text: "#16a34a" },
  OBSTRUCTED: { fill: "rgba(245, 158, 11, 0.3)", stroke: "#f59e0b", text: "#d97706" },
};

interface Props {
  camera: CanvasCamera;
}

export default function CameraCanvas({ camera }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSlot, setHoveredSlot] = useState<CanvasSlot | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 480, height: 300 });

  // Auto-size canvas to container width + camera aspect ratio
  const updateSize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const frameW = camera.frame_width || 1920;
    const frameH = camera.frame_height || 1080;
    const aspect = frameH / frameW;
    setCanvasSize({ width: containerWidth, height: Math.round(containerWidth * aspect) });
  }, [camera.frame_width, camera.frame_height]);

  useEffect(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [updateSize]);

  const { width, height } = canvasSize;

  // Parse polygon coords for each slot
  const parsedSlots = camera.slots.map((s) => {
    let points: number[][] = [];
    if (s.polygon_coords) {
      try { points = JSON.parse(s.polygon_coords); } catch { /* ignore */ }
    }
    // Fallback to bounding box if no polygon
    if (points.length === 0 && s.pos_x1 != null && s.pos_x2 != null) {
      points = [[s.pos_x1!, s.pos_y1!], [s.pos_x2!, s.pos_y1!], [s.pos_x2!, s.pos_y2!], [s.pos_x1!, s.pos_y2!]];
    }
    return { ...s, points };
  });
  const slotsWithPos = parsedSlots.filter((s) => s.points.length >= 3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    if (slotsWithPos.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No slot positions configured", width / 2, height / 2 - 10);
      ctx.fillStyle = "#475569";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillText("Waiting for client to push slot config", width / 2, height / 2 + 10);
      return;
    }

    // Use frame dimensions from camera if available, otherwise compute from slot bounds
    const hasFrameDims = camera.frame_width && camera.frame_height;
    const frameW = camera.frame_width || Math.max(...slotsWithPos.flatMap((s) => s.points.map((p) => p[0]))) * 1.05;
    const frameH = camera.frame_height || Math.max(...slotsWithPos.flatMap((s) => s.points.map((p) => p[1]))) * 1.05;

    // No margin when we have exact frame dims, small margin for fallback
    const margin = hasFrameDims ? 0 : 10;
    const scale = Math.min((width - margin * 2) / frameW, (height - margin * 2) / frameH);
    const offsetX = (width - frameW * scale) / 2;
    const offsetY = (height - frameH * scale) / 2;

    // Draw each slot as polygon
    for (const slot of slotsWithPos) {
      const color = COLORS[slot.state as keyof typeof COLORS] || COLORS.EMPTY;
      const pts = slot.points.map(([px, py]) => [px * scale + offsetX, py * scale + offsetY]);

      // Draw polygon
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();

      ctx.fillStyle = color.fill;
      ctx.fill();
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Centroid for label
      const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
      const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(slot.label, cx, cy - 6);

      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.fillStyle = color.text;
      ctx.fillText(slot.state, cx, cy + 8);
    }
  }, [camera, width, height, slotsWithPos]);

  // Point-in-polygon test (ray casting)
  function pointInPolygon(px: number, py: number, pts: number[][]) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || slotsWithPos.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    const frameW = camera.frame_width || Math.max(...slotsWithPos.flatMap((s) => s.points.map((p) => p[0])));
    const frameH = camera.frame_height || Math.max(...slotsWithPos.flatMap((s) => s.points.map((p) => p[1])));
    const scale = Math.min(width / frameW, height / frameH);
    const offsetX = (width - frameW * scale) / 2;
    const offsetY = (height - frameH * scale) / 2;

    const found = slotsWithPos.find((s) => {
      const pts = s.points.map(([px, py]) => [px * scale + offsetX, py * scale + offsetY]);
      return pointInPolygon(mx, my, pts);
    });
    setHoveredSlot(found || null);
  }

  const vehicleCount = camera.slots.filter((s) => s.state === "VEHICLE").length;
  const emptyCount = camera.slots.filter((s) => s.state === "EMPTY").length;
  const obstructedCount = camera.slots.filter((s) => s.state === "OBSTRUCTED").length;

  return (
    <div className="bg-white rounded-2xl card-shadow overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold text-slate-800">{camera.position_label}</p>
          <p className="text-[11px] text-slate-400">{camera.slots.length} slots</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-lg px-2 py-1 ${
          camera.status === "ACTIVE" ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
        }`}>{camera.status}</span>
      </div>

      {/* Canvas */}
      <div className="relative" ref={containerRef}>
        <canvas
          ref={canvasRef}
          style={{ width, height, display: "block" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredSlot(null)}
          className="cursor-crosshair"
        />

        {/* Tooltip */}
        {hoveredSlot && (
          <div
            className="absolute pointer-events-none bg-slate-900/90 text-white rounded-lg px-3 py-2 text-[11px] z-10"
            style={{ left: mousePos.x + 12, top: mousePos.y - 30 }}
          >
            <p className="font-bold">{hoveredSlot.label}</p>
            <p className={`${
              hoveredSlot.state === "VEHICLE" ? "text-red-300" :
              hoveredSlot.state === "EMPTY" ? "text-green-300" : "text-amber-300"
            }`}>{hoveredSlot.state}</p>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/30 border border-green-500" /> Empty: {emptyCount}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 border border-red-500" /> Vehicle: {vehicleCount}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500" /> Obstructed: {obstructedCount}</span>
      </div>
    </div>
  );
}
