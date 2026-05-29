import { useRef, useState, useEffect, useCallback } from "react";

interface SlotData {
  id: string;
  label: string;
  polygon_coords: string | null;
  state: string;
  slot_type?: string | null;
  detected_vehicle_type?: string | null;
}

interface Props {
  imageUrl: string;
  existingSlots: SlotData[];
  onComplete?: (polygon: number[][]) => void;
  onSlotClick?: (slot: SlotData) => void;
  drawingEnabled?: boolean;
  drawingMode?: "polygon" | "rectangle";
}

export type { SlotData };

export default function PolygonDrawer({ imageUrl, existingSlots, onComplete, onSlotClick, drawingEnabled = true, drawingMode = "polygon" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<number[][]>([]);
  const [rectStart, setRectStart] = useState<number[] | null>(null);
  const [mousePos, setMousePos] = useState<number[] | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [imgNatural, setImgNatural] = useState({ w: 800, h: 600 });
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  useEffect(() => {
    setImgLoaded(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
      const scale = Math.min(800 / img.naturalWidth, 600 / img.naturalHeight);
      setCanvasSize({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) });
      setImgLoaded(true);
    };
  }, [imageUrl]);

  const scaleX = imgNatural.w / canvasSize.w;
  const scaleY = imgNatural.h / canvasSize.h;

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !imgRef.current) return;

    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
    ctx.drawImage(imgRef.current, 0, 0, canvasSize.w, canvasSize.h);

    for (const slot of existingSlots) {
      if (!slot.polygon_coords) continue;
      try {
        const pts: number[][] = JSON.parse(slot.polygon_coords);
        const isHovered = hoveredSlot === slot.id;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] / scaleX, pts[0][1] / scaleY);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] / scaleX, pts[i][1] / scaleY);
        ctx.closePath();
        const isMismatched = slot.state === "VEHICLE" && slot.slot_type && slot.slot_type !== "GENERAL" && slot.detected_vehicle_type != null && slot.detected_vehicle_type !== slot.slot_type;
        ctx.fillStyle = isMismatched ? "rgba(59,130,246,0.3)" : slot.state === "VEHICLE" ? "rgba(239,68,68,0.3)" : slot.state === "OBSTRUCTED" ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)";
        ctx.fill();
        ctx.strokeStyle = isHovered ? "#fbbf24" : isMismatched ? "#3b82f6" : slot.state === "VEHICLE" ? "#ef4444" : slot.state === "OBSTRUCTED" ? "#f59e0b" : "#22c55e";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();

        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length / scaleX;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length / scaleY;

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        const textWidth = ctx.measureText(slot.label).width;
        ctx.fillRect(cx - textWidth / 2 - 4, cy - 10, textWidth + 8, 20);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(slot.label, cx, cy + 4);
      } catch { /* ignore malformed */ }
    }

    // Rectangle preview
    if (drawingEnabled && drawingMode === "rectangle" && rectStart && mousePos) {
      const x1 = Math.min(rectStart[0], mousePos[0]);
      const y1 = Math.min(rectStart[1], mousePos[1]);
      const x2 = Math.max(rectStart[0], mousePos[0]);
      const y2 = Math.max(rectStart[1], mousePos[1]);
      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(59,130,246,0.15)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rectStart[0], rectStart[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Polygon preview
    if (drawingEnabled && drawingMode === "polygon" && points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      if (mousePos) ctx.lineTo(mousePos[0], mousePos[1]);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
        ctx.closePath();
        ctx.fillStyle = "rgba(59,130,246,0.15)";
        ctx.fill();
      }

      for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(points[i][0], points[i][1], 5, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#22c55e" : "#3b82f6";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (mousePos && points.length >= 3) {
        const dist = Math.sqrt((mousePos[0] - points[0][0]) ** 2 + (mousePos[1] - points[0][1]) ** 2);
        if (dist < 15) {
          ctx.beginPath();
          ctx.arc(points[0][0], points[0][1], 12, 0, Math.PI * 2);
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }, [points, rectStart, mousePos, existingSlots, canvasSize, scaleX, scaleY, hoveredSlot, drawingEnabled, drawingMode]);

  useEffect(() => { if (imgLoaded) draw(); }, [draw, imgLoaded]);

  function getSlotAt(x: number, y: number): SlotData | null {
    for (const slot of existingSlots) {
      if (!slot.polygon_coords) continue;
      try {
        const pts: number[][] = JSON.parse(slot.polygon_coords);
        const scaledPts = pts.map((p) => [p[0] / scaleX, p[1] / scaleY]);
        if (pointInPolygon(x, y, scaledPts)) return slot;
      } catch { /* ignore */ }
    }
    return null;
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!drawingEnabled) {
      const slot = getSlotAt(x, y);
      if (slot) onSlotClick?.(slot);
      return;
    }

    if (drawingMode === "rectangle") {
      if (!rectStart) {
        setRectStart([x, y]);
      } else {
        const x1 = Math.min(rectStart[0], x);
        const y1 = Math.min(rectStart[1], y);
        const x2 = Math.max(rectStart[0], x);
        const y2 = Math.max(rectStart[1], y);
        if (x2 - x1 > 5 && y2 - y1 > 5) {
          onComplete?.([
            [Math.round(x1 * scaleX), Math.round(y1 * scaleY)],
            [Math.round(x2 * scaleX), Math.round(y1 * scaleY)],
            [Math.round(x2 * scaleX), Math.round(y2 * scaleY)],
            [Math.round(x1 * scaleX), Math.round(y2 * scaleY)],
          ]);
        }
        setRectStart(null);
      }
      return;
    }

    // Polygon mode
    if (points.length === 0) {
      const slot = getSlotAt(x, y);
      if (slot) { onSlotClick?.(slot); return; }
    }

    if (points.length >= 3) {
      const dist = Math.sqrt((x - points[0][0]) ** 2 + (y - points[0][1]) ** 2);
      if (dist < 15) {
        onComplete?.(points.map((p) => [Math.round(p[0] * scaleX), Math.round(p[1] * scaleY)]));
        setPoints([]);
        return;
      }
    }
    setPoints([...points, [x, y]]);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos([x, y]);

    if (!drawingEnabled || (drawingMode === "polygon" && points.length === 0) || (drawingMode === "rectangle" && !rectStart)) {
      setHoveredSlot(getSlotAt(x, y)?.id ?? null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setPoints([]); setRectStart(null); }
  }

  useEffect(() => { if (!drawingEnabled) { setPoints([]); setRectStart(null); } }, [drawingEnabled]);
  useEffect(() => { setPoints([]); setRectStart(null); }, [drawingMode]);

  const borderColor = drawingEnabled ? "#93c5fd" : hoveredSlot ? "#fcd34d" : "#cbd5e1";
  const cursor = drawingEnabled ? "crosshair" : hoveredSlot ? "pointer" : "default";

  if (!imgLoaded) {
    return (
      <div className="flex items-center justify-center bg-slate-100 rounded-xl" style={{ width: 800, height: 400 }}>
        <p className="text-[13px] text-slate-400">Loading snapshot...</p>
      </div>
    );
  }

  return (
    <div tabIndex={0} onKeyDown={handleKeyDown} style={{ outline: "none" }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setMousePos(null); setHoveredSlot(null); }}
        style={{
          width: canvasSize.w, height: canvasSize.h,
          borderRadius: 12, border: `2px solid ${borderColor}`, cursor,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      />
    </div>
  );
}

function pointInPolygon(x: number, y: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
