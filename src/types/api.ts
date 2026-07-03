// ─── Pagination ───
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Auth ───
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ─── RBAC ───
export interface RoleInfo {
  id: string;
  name: string;
  description: string | null;
}

export interface ScopeInfo {
  id: string;
  scope_type: "STATE" | "CITY" | "AREA" | "LOCATION" | "ZONE";
  scope_id: string;
  scope_name: string | null;
}

export interface PermissionItem {
  id: string;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  permissions: PermissionItem[];
  user_count: number;
  created_at: string;
  updated_at: string;
}

// ─── User ───
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  fcm_tokens: string[];
  roles: RoleInfo[];
  scopes: ScopeInfo[];
  created_at: string;
  updated_at: string;
}

// Enriched response from GET /users/me
export interface UserMe {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  roles: RoleInfo[];
  permissions: string[];
  scopes: ScopeInfo[];
  created_at: string;
  updated_at: string;
}

// ─── Geographic Hierarchy ───
export interface State {
  id: string;
  name: string;
  code: string;
  country: string;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  state_id: string;
  created_at: string;
  updated_at: string;
}

export interface Taluka {
  id: string;
  name: string;
  city_id: string;
  created_at: string;
  updated_at: string;
}

export interface Village {
  id: string;
  name: string;
  taluka_id: string;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  name: string;
  city_id: string;
  taluka_id: string | null;
  village_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Parking Hierarchy ───
export interface Location {
  id: string;
  name: string;
  area_id: string;
  city_id: string | null;
  taluka_id: string | null;
  village_id: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  location_type: "MALL" | "STREET" | "OPEN" | "COMMERCIAL" | "RESIDENTIAL";
  total_capacity: number;
  total_car_slots: number;
  total_two_wheeler_slots: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: string;
  location_id: string;
  label: string;
  level_number: number;
  capacity: number;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  name: string;
  floor_id: string;
  capacity: number;
  created_at: string;
  updated_at: string;
}

export interface ParkingSlot {
  id: string;
  label: string;
  zone_id: string;
  camera_id: string | null;
  state: "VEHICLE" | "EMPTY" | "OBSTRUCTED";
  slot_type: "CAR" | "TWO_WHEELER" | "GENERAL";
  detected_vehicle_type: "CAR" | "TWO_WHEELER" | null;
  capacity_car: number;
  capacity_two_wheeler: number;
  occupied_car: number;
  occupied_two_wheeler: number;
  polygon_coords: string | null;
  pos_x1: number | null;
  pos_y1: number | null;
  pos_x2: number | null;
  pos_y2: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Camera ───
export interface Camera {
  id: string;
  device_id: string;
  position_label: string;
  source: string | null;
  camera_type: string | null;
  module_type: "AI_PARKING" | "ANPR";
  detection_interval: number | null;
  status: "ACTIVE" | "INACTIVE" | "FAILED";
  is_active: boolean;
  frame_width: number | null;
  frame_height: number | null;
  snapshot_path: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Canvas ───
export interface CanvasSlot {
  id: string;
  label: string;
  state: "VEHICLE" | "EMPTY" | "OBSTRUCTED";
  slot_type: "CAR" | "TWO_WHEELER" | "GENERAL";
  detected_vehicle_type: "CAR" | "TWO_WHEELER" | null;
  is_mismatched: boolean;
  capacity_car: number;
  capacity_two_wheeler: number;
  occupied_car: number;
  occupied_two_wheeler: number;
  polygon_coords: string | null;
  pos_x1: number | null;
  pos_y1: number | null;
  pos_x2: number | null;
  pos_y2: number | null;
}

export interface CanvasCamera {
  id: string;
  device_id: string;
  position_label: string;
  status: string;
  frame_width: number | null;
  frame_height: number | null;
  debug_frame_url: string | null;
  clean_frame_url: string | null;
  slots: CanvasSlot[];
}

export interface CanvasResponse {
  location_id: string;
  location_name: string;
  cameras: CanvasCamera[];
}

// ─── Devices ───
export interface Device {
  id: string;
  device_id: string;
  location_id: string;
  city_id: string | null;
  zone_id: string | null;
  status: "ONLINE" | "OFFLINE" | "UPDATING" | "MAINTENANCE";
  ip_address: string | null;
  docker_image_version: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceCommand {
  id: string;
  device_id: string;
  command_type: string;
  payload: string | null;
  status: string;
  sent_by: string | null;
  sent_at: string;
  completed_at: string | null;
  error_message: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Parking Sessions ───
export interface ParkingSession {
  entry_event_id: string;
  slot_id: string;
  slot_label: string;
  camera_label: string | null;
  location_name: string | null;
  location_id: string | null;
  area_name: string | null;
  city_name: string | null;
  camera_id: string | null;
  event_type: string;
  detected_vehicle_type: "CAR" | "TWO_WHEELER" | null;
  image_url: string | null;
  entry_time: string;
  exit_time: string | null;
  duration_minutes: number | null;
  is_active: boolean;
}

// ─── Shared Links ───
export interface ViewConfig {
  pages: string[];
  fields: Record<string, string[]>;
}

export interface SharedLink {
  id: string;
  token: string;
  name: string | null;
  scope_type: "CITY" | "TALUKA" | "VILLAGE" | "AREA" | "LOCATION" | "CAMERA";
  scope_id: string | null;
  camera_ids: string | null;
  created_by_user_id: string;
  expires_at: string | null;
  is_active: boolean;
  view_count: number;
  view_config: ViewConfig | null;
  created_at: string;
  updated_at: string;
}

export interface PublicLocationData {
  id: string;
  name: string;
  cameras: CanvasCamera[];
  summary: { total: number; available: number; occupied: number; obstructed: number };
}

export interface PublicViewResponse {
  name: string | null;
  scope_type: string;
  view_config: ViewConfig | null;
  locations: PublicLocationData[];
  total_summary: { total: number; available: number; occupied: number; obstructed: number };
}

// ─── Alerts ───
export interface AlertEvent {
  id: string;
  alert_rule_id: string;
  device_id: string | null;
  location_id: string | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  status: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
}

// ─── Occupancy Analysis ───
export interface HourlyOccupancy {
  hour: number;
  occupancy_pct: number;
  occupied_slots: number;
  total_slots: number;
  mismatch_pct: number;
}

export interface PeakPeriod {
  start_hour: number;
  end_hour: number;
  avg_occupancy_pct: number;
  avg_mismatch_pct: number;
  label: string;
}

export interface ZoneOccupancyAnalysis {
  zone_id: string;
  zone_name: string;
  floor_label: string;
  location_name: string;
  area_name: string | null;
  total_slots: number;
  slots_by_type: Record<string, number>;
  avg_occupancy_pct: number;
  avg_mismatch_pct: number;
  hourly_breakdown: HourlyOccupancy[];
  peak_periods: PeakPeriod[];
  insight: string;
}

export interface OccupancyAnalysisResponse {
  threshold: number;
  slot_type_filter: string | null;
  start_date: string;
  end_date: string;
  zones: ZoneOccupancyAnalysis[];
  global_peak_hour: number | null;
  global_avg_occupancy_pct: number;
  global_avg_mismatch_pct: number;
  hotspot_zones: string[];
}

// ─── ANPR ───
export interface AnprRecord {
  id: string;
  device_id: string;
  camera_id: string;
  location_id: string;
  city_id: string | null;
  number_plate: string;
  vehicle_type: "CAR" | "TWO_WHEELER";
  direction: "IN" | "OUT";
  image_url: string | null;
  gemini_result: string | null;
  paddle_result: string | null;
  confidence_gemini: number | null;
  confidence_paddle: number | null;
  recorded_at: string;
  location_name: string | null;
}

export interface AnprSession {
  id: string;
  location_id: string;
  city_id: string | null;
  number_plate: string;
  vehicle_type: "CAR" | "TWO_WHEELER";
  entry_record_id: string;
  exit_record_id: string | null;
  entry_time: string;
  exit_time: string | null;
  entry_image_url: string | null;
  exit_image_url: string | null;
  is_active: boolean;
  duration_display: string | null;
  location_name: string | null;
  created_at: string;
  updated_at: string;
  revenue?: string | null; // Rs; populated by the public shared-link view ("-" when not exited)
}

/** ANPR report payload (cards + charts) returned under `report` by the public anpr-dashboard endpoint. */
export interface AnprReportVehicle {
  total: number;
  in: number;
  out: number;
  available: number;
}
export interface AnprReport {
  summary: {
    car: AnprReportVehicle;
    bike: AnprReportVehicle;
    occupancy_pct: number;
    revenue: string;
    accuracy_pct: number;
  };
  analytics: {
    chart: { labels: string[]; in: number[]; out: number[]; granularity: string };
    duration: { label: string; count: number }[];
  };
}

export interface AnprDashboardSummary {
  car_total: number;
  car_occupied: number;
  car_available: number;
  two_wheeler_total: number;
  two_wheeler_occupied: number;
  two_wheeler_available: number;
  obstructions: number;
}

export interface AnprDashboardLocation {
  location_id: string;
  location_name: string;
  car_total: number;
  car_occupied: number;
  car_available: number;
  two_wheeler_total: number;
  two_wheeler_occupied: number;
  two_wheeler_available: number;
  obstructions: number;
  occupancy_pct: number;
  availability_pct: number;
}

export interface AnprCameraConfig {
  id: string;
  camera_id: string;
  roi_coords: string | null;
  trigger_line: string | null;
  direction: "IN" | "OUT";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Parking Scan (Simplified History) ───
export interface ParkingScan {
  id: string;
  device_id: string;
  camera_id: string;
  location_id: string;
  city_id: string | null;
  image_url: string | null;
  car_occupied: number;
  car_available: number;
  car_total: number;
  two_wheeler_occupied: number;
  two_wheeler_available: number;
  two_wheeler_total: number;
  has_obstruction: boolean;
  recorded_at: string;
  location_name: string | null;
  camera_label: string | null;
  device_name: string | null;
}

// ─── Parking occupancy summary (latest scan per location, summed) ───
/** Hourly occupancy bucket (10 AM-6 PM) + summary stats for the AI Parking shared-link report. */
export interface ParkingHourlyBucket {
  hour: number;
  occ_car: number;
  tot_car: number;
  occ_bike: number;
  tot_bike: number;
}
export interface ParkingReport {
  hourly: ParkingHourlyBucket[];
  stats: {
    peak_hour_label: string;
    peak_hour_count: number;
    peak_occupancy_pct: number;
    avg_car_occ: number;
    avg_2w_occ: number;
    max_cars: number;
    max_2w: number;
  };
}

export interface OccupancySummary {
  location_name: string;
  location_count: number;
  car_total: number;
  car_occupied: number;
  car_available: number;
  two_wheeler_total: number;
  two_wheeler_occupied: number;
  two_wheeler_available: number;
  updated_at: string | null;
  report?: ParkingReport;
}
