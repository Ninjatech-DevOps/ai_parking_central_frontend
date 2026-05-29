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
