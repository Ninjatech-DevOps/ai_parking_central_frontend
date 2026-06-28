// ───────────────────────────────────────────────────────────────────────────
// STATIC REPORT DATA (mock)
// ---------------------------------------------------------------------------
// The Reports page currently renders entirely from this module so the full UI
// can be demoed without a backend. To switch back to live data, replace the
// calls in src/pages/Reports.tsx (see the "STATIC MOCK — swap point" comments)
// with the corresponding reportsApi / anprSessionsApi / anprDashboardApi calls.
// ───────────────────────────────────────────────────────────────────────────
import type {
  AnprSession, AnprDashboardSummary, AnprDashboardLocation, OccupancyAnalysisResponse,
} from "@/types/api";

/** Shape consumed by Reports.tsx (mirrors the /reports/summary response). */
export interface MockReportData {
  summary: {
    total_sessions: number;
    active_sessions: number;
    completed_sessions: number;
    vehicle_sessions: number;
    obstructed_sessions: number;
    car_sessions: number;
    two_wheeler_sessions: number;
    avg_duration_minutes: number | null;
    max_duration_minutes: number | null;
    min_duration_minutes: number | null;
    peak_hour: number | null;
    peak_hour_count: number;
    hourly_distribution: number[];
    duration_distribution: Record<string, number>;
    top_slots: { label: string; count: number }[];
    unique_slots: number;
  };
  slot_counts: { total: number; available: number; occupied: number; obstructed: number };
  device_summary: { total: number; online: number; offline: number };
  alert_summary: { total: number; critical: number; high: number; medium: number; low: number; active: number; resolved: number };
  sessions: MockParkingSession[];
  total_sessions_in_period: number;
}

export interface MockParkingSession {
  slot_label: string;
  event_type: string;
  detected_vehicle_type: "CAR" | "TWO_WHEELER" | null;
  area_name: string | null;
  location_name: string | null;
  camera_label: string | null;
  entry_time: string;
  exit_time: string | null;
  duration_minutes: number | null;
  is_active: boolean;
}

// ─── helpers ───
/** ISO timestamp for `h:m` today (local). */
function todayAt(h: number, m = 0): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const PLATES = [
  "GJ01AB1234", "GJ05CD8821", "MH12EF4407", "GJ27GH9015", "GJ01KL3390",
  "RJ14MN7762", "GJ05PQ1148", "MH04RS6623", "GJ18TU2204", "GJ01VW5567",
  "GJ06XY8890", "DL08ZA1123", "GJ01BC4456", "GJ27DE7789", "GJ05FG3312",
];
const AREAS = ["Satellite", "Bodakdev", "Navrangpura", "Maninagar", "Prahlad Nagar"];
const LOCATIONS = ["City Center Mall", "Riverfront Lot A", "ISKCON Crossroad", "Alpha One Mall", "Vastrapur Lake"];

// ─── Parking summary ───
export function getReportData(): MockReportData {
  const hourly = [2, 1, 0, 0, 1, 3, 8, 17, 26, 22, 19, 24, 31, 21, 18, 23, 29, 38, 41, 33, 24, 16, 9, 4];
  const sessions: MockParkingSession[] = [];
  const slotLabels = ["A-12", "B-07", "A-03", "C-21", "B-15", "D-09", "A-19", "C-04", "B-22", "D-17", "A-08", "C-11"];
  for (let i = 0; i < 36; i++) {
    const startH = 7 + (i % 14);
    const startM = (i * 7) % 60;
    const active = i % 5 === 0;
    const isObs = i % 11 === 0;
    const dur = active ? null : 18 + ((i * 23) % 360);
    const exit = active ? null : todayAt(startH + Math.floor((startM + (dur || 0)) / 60), (startM + (dur || 0)) % 60);
    sessions.push({
      slot_label: slotLabels[i % slotLabels.length],
      event_type: isObs ? "OBSTRUCTED" : "VEHICLE",
      detected_vehicle_type: isObs ? null : i % 3 === 0 ? "TWO_WHEELER" : "CAR",
      area_name: AREAS[i % AREAS.length],
      location_name: LOCATIONS[i % LOCATIONS.length],
      camera_label: `CAM-${(i % 8) + 1}`,
      entry_time: todayAt(startH, startM),
      exit_time: exit,
      duration_minutes: dur,
      is_active: active,
    });
  }
  return {
    summary: {
      total_sessions: 318,
      active_sessions: 131,
      completed_sessions: 187,
      vehicle_sessions: 295,
      obstructed_sessions: 23,
      car_sessions: 214,
      two_wheeler_sessions: 104,
      avg_duration_minutes: 84,
      max_duration_minutes: 612,
      min_duration_minutes: 3,
      peak_hour: 18,
      peak_hour_count: 41,
      hourly_distribution: hourly,
      duration_distribution: { under_30m: 96, "30m_to_1h": 78, "1h_to_2h": 64, "2h_to_8h": 58, over_8h: 22 },
      top_slots: [
        { label: "A-12", count: 41 }, { label: "B-07", count: 38 }, { label: "A-03", count: 33 },
        { label: "C-21", count: 29 }, { label: "B-15", count: 26 }, { label: "D-09", count: 22 },
        { label: "A-19", count: 19 }, { label: "C-04", count: 15 },
      ],
      unique_slots: 86,
    },
    slot_counts: { total: 240, available: 92, occupied: 131, obstructed: 17 },
    device_summary: { total: 28, online: 24, offline: 4 },
    alert_summary: { total: 47, critical: 3, high: 9, medium: 18, low: 17, active: 11, resolved: 36 },
    sessions,
    total_sessions_in_period: 318,
  };
}

// ─── ANPR sessions ───
export function getAnprSessions(): AnprSession[] {
  const out: AnprSession[] = [];
  for (let i = 0; i < 42; i++) {
    const startH = 6 + (i % 16);
    const startM = (i * 11) % 60;
    const active = i % 6 === 0;
    const durMin = active ? null : 12 + ((i * 17) % 300);
    const entry = todayAt(startH, startM);
    const exit = active ? null : todayAt(startH + Math.floor((startM + (durMin || 0)) / 60), (startM + (durMin || 0)) % 60);
    const h = durMin ? Math.floor(durMin / 60) : 0;
    const m = durMin ? durMin % 60 : 0;
    out.push({
      id: `anpr-${i}`,
      location_id: `loc-${i % LOCATIONS.length}`,
      city_id: "city-1",
      number_plate: PLATES[i % PLATES.length],
      vehicle_type: i % 3 === 0 ? "TWO_WHEELER" : "CAR",
      entry_record_id: `rec-in-${i}`,
      exit_record_id: active ? null : `rec-out-${i}`,
      entry_time: entry,
      exit_time: exit,
      entry_image_url: null,
      exit_image_url: null,
      is_active: active,
      duration_display: durMin ? (h > 0 ? `${h}h ${m}m` : `${m}m`) : null,
      location_name: LOCATIONS[i % LOCATIONS.length],
      created_at: entry,
      updated_at: exit || entry,
    });
  }
  return out;
}

// ─── ANPR live occupancy summary ───
export function getAnprSummary(): AnprDashboardSummary {
  return {
    car_total: 180, car_occupied: 119, car_available: 61,
    two_wheeler_total: 120, two_wheeler_occupied: 77, two_wheeler_available: 43,
    obstructions: 6,
  };
}

export function getAnprLocations(): AnprDashboardLocation[] {
  const base = [
    { car: [42, 28], tw: [30, 19], obs: 2 },
    { car: [36, 25], tw: [24, 14], obs: 1 },
    { car: [30, 22], tw: [22, 16], obs: 2 },
    { car: [40, 26], tw: [26, 17], obs: 0 },
    { car: [32, 18], tw: [18, 11], obs: 1 },
  ];
  return LOCATIONS.map((name, i) => {
    const b = base[i];
    const total = b.car[0] + b.tw[0];
    const occ = b.car[1] + b.tw[1];
    return {
      location_id: `loc-${i}`,
      location_name: name,
      car_total: b.car[0], car_occupied: b.car[1], car_available: b.car[0] - b.car[1],
      two_wheeler_total: b.tw[0], two_wheeler_occupied: b.tw[1], two_wheeler_available: b.tw[0] - b.tw[1],
      obstructions: b.obs,
      occupancy_pct: Math.round((occ / total) * 100),
      availability_pct: Math.round(((total - occ) / total) * 100),
    };
  });
}

// ─── Occupancy heatmap analysis ───
export function getOccupancyAnalysis(threshold: number, slotType: string): OccupancyAnalysisResponse {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const zoneDefs = [
    { name: "Ground — Zone A", loc: "City Center Mall", floor: "Ground", slots: 48, peak: 18, base: 62 },
    { name: "Ground — Zone B", loc: "City Center Mall", floor: "Ground", slots: 36, peak: 19, base: 71 },
    { name: "Level 1 — Zone A", loc: "Alpha One Mall", floor: "Level 1", slots: 52, peak: 13, base: 48 },
    { name: "Surface Lot", loc: "Riverfront Lot A", floor: "", slots: 80, peak: 11, base: 55 },
    { name: "Basement — Zone C", loc: "ISKCON Crossroad", floor: "Basement", slots: 40, peak: 20, base: 83 },
    { name: "Open Lot", loc: "Vastrapur Lake", floor: "", slots: 30, peak: 17, base: 38 },
  ];
  const zones = zoneDefs.map((z, zi) => {
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const dist = Math.abs(h - z.peak);
      let pct = Math.max(0, z.base - dist * 6 + (h >= 6 && h <= 22 ? 8 : -20));
      pct = Math.min(100, Math.round(pct));
      const occupied = Math.round((pct / 100) * z.slots);
      return { hour: h, occupancy_pct: pct, occupied_slots: occupied, total_slots: z.slots, mismatch_pct: h % 7 === 0 ? 6 : 0 };
    });
    const avg = Math.round(hourly.reduce((a, b) => a + b.occupancy_pct, 0) / 24);
    return {
      zone_id: `zone-${zi}`,
      zone_name: z.name,
      floor_label: z.floor,
      location_name: z.loc,
      area_name: AREAS[zi % AREAS.length],
      total_slots: z.slots,
      slots_by_type: { CAR: Math.round(z.slots * 0.7), TWO_WHEELER: Math.round(z.slots * 0.3) },
      avg_occupancy_pct: avg,
      avg_mismatch_pct: 3,
      hourly_breakdown: hourly,
      peak_periods: [
        { start_hour: z.peak - 1, end_hour: z.peak + 1, avg_occupancy_pct: Math.min(100, z.base + 12), avg_mismatch_pct: 4, label: `${z.peak - 1}:00–${z.peak + 1}:00` },
      ],
      insight: `${z.name} peaks around ${z.peak > 12 ? `${z.peak - 12} PM` : `${z.peak} AM`} at ~${Math.min(100, z.base + 12)}% occupancy.`,
    };
  });
  const filtered = slotType ? zones : zones;
  return {
    threshold,
    slot_type_filter: slotType || null,
    start_date: start.toISOString(),
    end_date: new Date(start.getTime() + 86400000).toISOString(),
    zones: filtered,
    global_peak_hour: 18,
    global_avg_occupancy_pct: Math.round(zones.reduce((a, b) => a + b.avg_occupancy_pct, 0) / zones.length),
    global_avg_mismatch_pct: 3,
    hotspot_zones: zones.filter((z) => z.avg_occupancy_pct >= threshold).map((z) => z.zone_id),
  };
}
