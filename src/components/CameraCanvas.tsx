import { useRef, useEffect, useState } from "react";
import type { CanvasCamera, CanvasSlot } from "@/types/api";

const COLORS = {
  VEHICLE: { fill: "rgba(239, 68, 68, 0.3)", stroke: "#ef4444", text: "#dc2626" },
  EMPTY: { fill: "rgba(34, 197, 94, 0.3)", stroke: "#22c55e", text: "#16a34a" },
  OBSTRUCTED: { fill: "rgba(245, 158, 11, 0.3)", stroke: "#f59e0b", text: "#d97706" },
};

interface Props {
  camera: CanvasCamera;
  width?: number;
  height?: number;
}

export default function CameraCanvas({ camera, width = 480, height = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSlot, setHoveredSlot] = useState<CanvasSlot | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Find the max coordinates to determine scale
  const slotsWithPos = camera.slots.filter((s) => s.pos_x1 != null && s.pos_x2 != null);

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

    // Calculate uniform scale to fit all slots with margin
    const minX = Math.min(...slotsWithPos.map((s) => s.pos_x1!));
    const minY = Math.min(...slotsWithPos.map((s) => s.pos_y1!));
    const maxX = Math.max(...slotsWithPos.map((s) => s.pos_x2!)) - minX;
    const maxY = Math.max(...slotsWithPos.map((s) => s.pos_y2!)) - minY;
    const margin = 30;
    const scale = Math.min((width - margin * 2) / maxX, (height - margin * 2) / maxY);
    const scaleX = scale;
    const scaleY = scale;
    const offsetX = (width - maxX * scale) / 2 - minX * scale;
    const offsetY = (height - maxY * scale) / 2 - minY * scale;

    // Draw each slot
    for (const slot of slotsWithPos) {
      const x = slot.pos_x1! * scaleX + offsetX;
      const y = slot.pos_y1! * scaleY + offsetY;
      const w = (slot.pos_x2! - slot.pos_x1!) * scaleX;
      const h = (slot.pos_y2! - slot.pos_y1!) * scaleY;
      const color = COLORS[slot.state] || COLORS.EMPTY;

      // Fill
      ctx.fillStyle = color.fill;
      ctx.fillRect(x, y, w, h);

      // Border
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);

      // Label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(slot.label, x + w / 2, y + h / 2 - 6);

      // State text
      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.fillStyle = color.text;
      ctx.fillText(slot.state, x + w / 2, y + h / 2 + 8);
    }
  }, [camera, width, height, slotsWithPos]);

  // Mouse hover detection
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || slotsWithPos.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    const minX = Math.min(...slotsWithPos.map((s) => s.pos_x1!));
    const minY = Math.min(...slotsWithPos.map((s) => s.pos_y1!));
    const maxX = Math.max(...slotsWithPos.map((s) => s.pos_x2!)) - minX;
    const maxY = Math.max(...slotsWithPos.map((s) => s.pos_y2!)) - minY;
    const margin = 30;
    const scale = Math.min((width - margin * 2) / maxX, (height - margin * 2) / maxY);
    const offsetX = (width - maxX * scale) / 2 - minX * scale;
    const offsetY = (height - maxY * scale) / 2 - minY * scale;

    const found = slotsWithPos.find((s) => {
      const x = s.pos_x1! * scale + offsetX;
      const y = s.pos_y1! * scale + offsetY;
      const w = (s.pos_x2! - s.pos_x1!) * scale;
      const h = (s.pos_y2! - s.pos_y1!) * scale;
      return mx >= x && mx <= x + w && my >= y && my <= y + h;
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
      <div className="relative">
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
