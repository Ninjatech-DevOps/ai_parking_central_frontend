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

// ─── User ───
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  fcm_tokens: string[];
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
  status: "ACTIVE" | "INACTIVE" | "FAILED";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Canvas ───
export interface CanvasSlot {
  id: string;
  label: string;
  state: "VEHICLE" | "EMPTY" | "OBSTRUCTED";
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
  created_at: string;
  updated_at: string;
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
