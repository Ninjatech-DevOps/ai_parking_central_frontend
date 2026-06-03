import { useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";

interface SlotItem {
  id: string;
  label: string;
  state: string;
  slot_type?: string | null;
  detected_vehicle_type?: string | null;
  is_mismatched?: boolean;
  capacity_car?: number;
  capacity_two_wheeler?: number;
  occupied_car?: number;
  occupied_two_wheeler?: number;
}

interface Props {
  slots: SlotItem[];
  cameraLabel: string;
  locationName?: string;
  onSlotClick?: (slot: SlotItem) => void;
  cols?: number;
}

const TH = {
  card: "#1f1f1d",
  bayBorder: "rgba(255,255,255,0.12)",
  headerText: "rgba(255,255,255,0.95)",
  headerSub: "rgba(255,255,255,0.35)",
  headerIcon: "rgba(255,255,255,0.12)",
  headerIconText: "rgba(255,255,255,0.5)",
  legendText: "rgba(255,255,255,0.5)",
};

const STATES = {
  EMPTY: { bayFill: "rgba(151,196,89,0.06)", bayHover: "rgba(151,196,89,0.14)", carStroke: "#97C459", carBody: "none", windowFill: "transparent", dashed: true, label: "#9CC267", dot: "#97C459" },
  VEHICLE: { bayFill: "rgba(226,75,74,0.10)", bayHover: "rgba(226,75,74,0.18)", carStroke: "#A32D2D", carBody: "#E24B4A", windowFill: "rgba(255,255,255,0.40)", dashed: false, label: "#F5A0A0", dot: "#E24B4A" },
  OBSTRUCTED: { bayFill: "rgba(239,159,39,0.10)", bayHover: "rgba(239,159,39,0.18)", carStroke: "#854F0B", carBody: "#EF9F27", windowFill: "rgba(255,255,255,0.40)", dashed: false, label: "#F5C57A", dot: "#EF9F27" },
  MISMATCHED: { bayFill: "rgba(59,130,246,0.10)", bayHover: "rgba(59,130,246,0.18)", carStroke: "#1E40AF", carBody: "#3B82F6", windowFill: "rgba(255,255,255,0.40)", dashed: false, label: "#93C5FD", dot: "#3B82F6" },
};

type StateStyle = typeof STATES.EMPTY;
function getStyle(state: string, mismatched?: boolean): StateStyle {
  if (mismatched) return STATES.MISMATCHED;
  return state === "VEHICLE" ? STATES.VEHICLE : state === "OBSTRUCTED" ? STATES.OBSTRUCTED : STATES.EMPTY;
}

function TopDownCar({ state, large, mismatched }: { state: string; large?: boolean; mismatched?: boolean }) {
  const s = getStyle(state, mismatched);
  const fill = s.carBody === "none" ? "transparent" : s.carBody;
  const dash = s.dashed ? "3 2.5" : undefined;
  const headlightOpacity = s.carBody === "none" ? 0 : 1;

  return (
    <svg viewBox="0 0 50 88" xmlns="http://www.w3.org/2000/svg"
      style={{ width: large ? "55%" : "100%", maxWidth: large ? 80 : 44, height: "auto", display: "block", flex: "0 1 auto" }} aria-hidden="true">
      <rect x="3" y="26" width="4" height="6" rx="1.5" fill={fill} stroke={s.carStroke} strokeWidth="1" strokeDasharray={dash} />
      <rect x="43" y="26" width="4" height="6" rx="1.5" fill={fill} stroke={s.carStroke} strokeWidth="1" strokeDasharray={dash} />
      <rect x="6" y="4" width="38" height="80" rx="9" fill={fill} stroke={s.carStroke} strokeWidth="1.6" strokeDasharray={dash} />
      <path d="M 11 20 L 39 20 L 36 32 L 14 32 Z" fill={s.windowFill} />
      <path d="M 14 58 L 36 58 L 39 72 L 11 72 Z" fill={s.windowFill} />
      <line x1="25" y1="36" x2="25" y2="54" stroke={s.carStroke} strokeWidth="0.6" opacity="0.5" />
      <rect x="11" y="5" width="5" height="2.5" rx="1" fill="rgba(255,255,255,0.65)" opacity={headlightOpacity} />
      <rect x="34" y="5" width="5" height="2.5" rx="1" fill="rgba(255,255,255,0.65)" opacity={headlightOpacity} />
    </svg>
  );
}

function TopDownBike({ state, large, mismatched }: { state: string; large?: boolean; mismatched?: boolean }) {
  const s = getStyle(state, mismatched);
  const fill = s.carBody === "none" ? "transparent" : s.carBody;
  const dash = s.dashed ? "3 2.5" : undefined;
  const headlightOpacity = s.carBody === "none" ? 0 : 1;

  return (
    <svg viewBox="0 0 44 88" xmlns="http://www.w3.org/2000/svg"
      style={{ width: large ? "40%" : "75%", maxWidth: large ? 56 : 32, height: "auto", display: "block", flex: "0 1 auto" }} aria-hidden="true">
      {/* Front wheel — pill shape, clearly a tire from above */}
      <rect x="14" y="1" width="16" height="18" rx="8" fill={fill} stroke={s.carStroke} strokeWidth="1.6" strokeDasharray={dash} />
      {/* Headlight */}
      <rect x="17" y="2.5" width="10" height="2.5" rx="1.2" fill="rgba(255,255,255,0.65)" opacity={headlightOpacity} />
      {/* Handlebar grips — stick out wide, THE key bike identifier */}
      <rect x="1" y="14" width="11" height="5" rx="2.5" fill={fill} stroke={s.carStroke} strokeWidth="1.2" strokeDasharray={dash} />
      <rect x="32" y="14" width="11" height="5" rx="2.5" fill={fill} stroke={s.carStroke} strokeWidth="1.2" strokeDasharray={dash} />
      {/* Handlebar crossbar */}
      <rect x="11" y="15.5" width="22" height="2" rx="1" fill={fill} stroke={s.carStroke} strokeWidth="0.8" strokeDasharray={dash} />
      {/* Body frame — narrow, connects everything */}
      <rect x="15" y="19" width="14" height="46" rx="7" fill={fill} stroke={s.carStroke} strokeWidth="1.4" strokeDasharray={dash} />
      {/* Seat — wider oval overlay on body */}
      <rect x="11" y="36" width="22" height="16" rx="8" fill={fill} stroke={s.carStroke} strokeWidth="1.4" strokeDasharray={dash} />
      {/* Rear wheel */}
      <rect x="14" y="67" width="16" height="18" rx="8" fill={fill} stroke={s.carStroke} strokeWidth="1.6" strokeDasharray={dash} />
      {/* Taillight */}
      <rect x="17" y="83" width="10" height="2.5" rx="1.2" fill={fill === "transparent" ? "none" : s.carStroke} opacity={headlightOpacity} />
    </svg>
  );
}

function ParkingP({ state, large, mismatched }: { state: string; large?: boolean; mismatched?: boolean }) {
  const s = getStyle(state, mismatched);
  const fill = s.carBody === "none" ? "transparent" : s.carBody;
  const dash = s.dashed ? "3 2.5" : undefined;

  return (
    <svg viewBox="0 0 50 88" xmlns="http://www.w3.org/2000/svg"
      style={{ width: large ? "55%" : "100%", maxWidth: large ? 80 : 44, height: "auto", display: "block", flex: "0 1 auto" }} aria-hidden="true">
      <rect x="6" y="4" width="38" height="80" rx="9" fill={fill} stroke={s.carStroke} strokeWidth="1.6" strokeDasharray={dash} />
      <text x="25" y="56" textAnchor="middle" fontSize="42" fontWeight="800" fontFamily="Inter, system-ui, sans-serif" fill={s.carStroke} opacity="0.85">P</text>
    </svg>
  );
}

function SlotIcon({ slot, large }: { slot: SlotItem; large?: boolean }) {
  const isGeneral = !slot.slot_type || slot.slot_type === "GENERAL";
  const isOccupied = slot.state === "VEHICLE" || slot.state === "OBSTRUCTED";
  const mm = slot.is_mismatched;

  if (isGeneral) {
    if (isOccupied && slot.detected_vehicle_type === "TWO_WHEELER") {
      return <TopDownBike state={slot.state} large={large} mismatched={mm} />;
    }
    if (isOccupied && slot.detected_vehicle_type) {
      return <TopDownCar state={slot.state} large={large} mismatched={mm} />;
    }
    return <ParkingP state={slot.state} large={large} mismatched={mm} />;
  }

  return slot.slot_type === "TWO_WHEELER"
    ? <TopDownBike state={slot.state} large={large} mismatched={mm} />
    : <TopDownCar state={slot.state} large={large} mismatched={mm} />;
}

function isMultiVehicle(slot: SlotItem): boolean {
  return ((slot.capacity_car || 0) + (slot.capacity_two_wheeler || 0)) > 1;
}

function OccupancyBadge({ slot, large }: { slot: SlotItem; large?: boolean }) {
  const capCar = slot.capacity_car || 0;
  const cap2w = slot.capacity_two_wheeler || 0;
  const occCar = slot.occupied_car || 0;
  const occ2w = slot.occupied_two_wheeler || 0;
  const totalCap = capCar + cap2w;
  const totalOcc = occCar + occ2w;
  const fs = large ? 13 : 8;

  const parts: string[] = [];
  if (capCar > 0 && cap2w > 0) {
    parts.push(`${occCar}/${capCar}C`);
    parts.push(`${occ2w}/${cap2w}2W`);
  } else {
    parts.push(`${totalOcc}/${totalCap}`);
  }

  return (
    <span style={{
      fontSize: fs, fontWeight: 700, letterSpacing: "0.3px",
      color: totalOcc >= totalCap ? "#E24B4A" : totalOcc > 0 ? "#EF9F27" : "#97C459",
      fontFamily: "ui-monospace, monospace",
    }}>
      {parts.join(" ")}
    </span>
  );
}

function Bay({ slot, onClick, large }: { slot: SlotItem; onClick?: (s: SlotItem) => void; large?: boolean }) {
  const s = getStyle(slot.state, slot.is_mismatched);
  const multi = isMultiVehicle(slot);

  return (
    <button
      aria-label={`Bay ${slot.label}, ${slot.state}`}
      onClick={() => onClick?.(slot)}
      onMouseEnter={(e) => { e.currentTarget.style.background = s.bayHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = s.bayFill; e.currentTarget.style.transform = ""; }}
      onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = ""; }}
      style={{
        position: "relative",
        background: s.bayFill,
        border: "none",
        borderLeft: `${large ? 3 : 2}px solid ${TH.bayBorder}`,
        borderRight: `${large ? 3 : 2}px solid ${TH.bayBorder}`,
        borderRadius: large ? 8 : 0,
        padding: large ? "10px 8px" : "20px 4px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: large ? 10 : 0,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.12s ease, transform 0.08s ease",
      }}
    >
      <span style={{
        position: large ? "relative" : "absolute",
        top: large ? undefined : 3,
        left: large ? undefined : 4,
        fontSize: large ? 17 : 8,
        fontWeight: 700,
        color: s.label,
        letterSpacing: "0.5px",
        fontFamily: "ui-monospace, monospace",
      }}>
        {slot.label}
      </span>
      {multi ? (
        <OccupancyBadge slot={slot} large={large} />
      ) : (
        <SlotIcon slot={slot} large={large} />
      )}
      {large && (
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.5px", color: s.dot, textTransform: "uppercase" }}>
          {multi
            ? `${(slot.occupied_car || 0) + (slot.occupied_two_wheeler || 0)}/${(slot.capacity_car || 0) + (slot.capacity_two_wheeler || 0)} Occupied`
            : slot.is_mismatched ? "Mismatched" : slot.state === "VEHICLE" ? (slot.detected_vehicle_type === "TWO_WHEELER" ? "2-Wheeler" : slot.detected_vehicle_type === "CAR" ? "Car" : "Occupied") : slot.state === "OBSTRUCTED" ? "Blocked" : (slot.slot_type === "TWO_WHEELER" ? "2W Available" : slot.slot_type === "CAR" ? "Car Available" : "Available")}
        </span>
      )}
    </button>
  );
}

function Legend({ summary, slots }: { summary: Record<string, number>; slots: SlotItem[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 32, fontSize: 18 }}>
      {[
        { label: "Total", value: slots.length, color: TH.legendText },
        { label: "Available", value: summary.EMPTY, color: STATES.EMPTY.dot },
        { label: "Occupied", value: summary.VEHICLE, color: STATES.VEHICLE.dot },
        { label: "Obstructed", value: summary.OBSTRUCTED, color: STATES.OBSTRUCTED.dot },
        ...(summary.MISMATCHED > 0 ? [{ label: "Mismatched", value: summary.MISMATCHED, color: STATES.MISMATCHED.dot }] : []),
      ].map(({ label, value, color }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ color: TH.legendText, fontWeight: 500 }}>{label}</span>
          <span style={{ color, fontWeight: 800, fontSize: 22 }}>{value}</span>
        </span>
      ))}
    </div>
  );
}

export default function ParkingGrid({ slots, cameraLabel, locationName, onSlotClick, cols: colsProp }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const cols = colsProp || Math.min(5, Math.max(2, slots.length));

  const summary = useMemo(() => {
    const s = { TOTAL_CAPACITY: 0, TOTAL_OCCUPIED: 0, EMPTY: 0, VEHICLE: 0, OBSTRUCTED: 0, MISMATCHED: 0 };
    for (const slot of slots) {
      const cap = (slot.capacity_car || 0) + (slot.capacity_two_wheeler || 0);
      const occ = (slot.occupied_car || 0) + (slot.occupied_two_wheeler || 0);
      // Use capacity-based counting: each slot contributes its capacity to total, occupied to occupied
      s.TOTAL_CAPACITY += cap || 1; // fallback 1 for legacy single-vehicle slots
      s.TOTAL_OCCUPIED += cap > 1 ? occ : (slot.state === "VEHICLE" ? 1 : 0);
      if (slot.is_mismatched) {
        s.MISMATCHED += 1;
      } else if (slot.state === "OBSTRUCTED") {
        s.OBSTRUCTED += 1;
      }
    }
    s.VEHICLE = s.TOTAL_OCCUPIED;
    s.EMPTY = s.TOTAL_CAPACITY - s.TOTAL_OCCUPIED - s.OBSTRUCTED;
    return s;
  }, [slots]);

  if (slots.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center" style={{ background: TH.card }}>
        <p style={{ color: TH.headerSub, fontSize: 13 }}>No slots configured</p>
      </div>
    );
  }

  // --- FULLSCREEN ---
  if (fullscreen) {
    const fsCols = slots.length <= 6 ? Math.min(3, slots.length)
      : slots.length <= 12 ? Math.min(4, slots.length)
      : slots.length <= 20 ? 5
      : Math.min(6, slots.length);

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "linear-gradient(180deg, #161615 0%, #1a1a19 100%)",
        display: "flex", flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700,
              }}>P</div>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 20 }}>{cameraLabel}</div>
                {locationName && (
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 1 }}>{locationName}</div>
                )}
              </div>
            </div>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
            <Legend summary={summary} slots={slots} />
          </div>
          <button
            onClick={() => setFullscreen(false)}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, width: 36, height: 36,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.5)", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "12px 32px 24px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${fsCols}, 1fr)`,
            gridTemplateRows: `repeat(${Math.ceil(slots.length / fsCols)}, 1fr)`,
            gap: 6, width: "100%", height: "100%",
          }}>
            {slots.map((slot) => (
              <Bay key={slot.id} slot={slot} onClick={onSlotClick} large />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- NORMAL VIEW (always dark) ---
  return (
    <div>
      <div style={{
        background: TH.card, borderRadius: 12,
        padding: "16px 18px 14px",
        height: 340, display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12, color: TH.headerText,
          fontWeight: 500, fontSize: 13, letterSpacing: "0.3px", flexShrink: 0,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: TH.headerIcon, display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 12,
              color: TH.headerIconText,
            }}>P</span>
            {cameraLabel}
            {locationName && (
              <span style={{ color: TH.headerSub, fontSize: 11, marginLeft: 4 }}>
                {locationName}
              </span>
            )}
          </span>
          <button
            onClick={() => setFullscreen(true)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none", borderRadius: 6,
              padding: "5px 6px", cursor: "pointer", display: "flex", alignItems: "center",
              color: "rgba(255,255,255,0.5)", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            title="Fullscreen"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <div style={{
          background: "repeating-linear-gradient(90deg, #2a2a28 0px, #2a2a28 18px, #2c2c2a 18px, #2c2c2a 19px)",
          borderTop: "2px dashed rgba(255,255,255,0.18)",
          borderBottom: "2px dashed rgba(255,255,255,0.18)",
          borderRadius: 6, padding: "10px 10px",
          flex: 1, minHeight: 0, overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${Math.ceil(slots.length / cols)}, 1fr)`,
            gap: 3, height: "100%",
          }}>
            {slots.map((slot) => (
              <Bay key={slot.id} slot={slot} onClick={onSlotClick} />
            ))}
          </div>
        </div>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: `repeat(${summary.MISMATCHED > 0 ? 5 : 4}, 1fr)`,
        gap: 8, marginTop: 10,
      }}>
        {[
          { label: "TOTAL", value: summary.TOTAL_CAPACITY, color: "#94a3b8" },
          { label: "AVAILABLE", value: summary.EMPTY, color: "#97C459" },
          { label: "OCCUPIED", value: summary.TOTAL_OCCUPIED, color: "#E24B4A" },
          { label: "OBSTRUCTED", value: summary.OBSTRUCTED, color: "#EF9F27" },
          ...(summary.MISMATCHED > 0 ? [{ label: "MISMATCHED", value: summary.MISMATCHED, color: "#3B82F6" }] : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "#fff", borderRadius: 10,
            padding: "10px 14px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.8px", marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
