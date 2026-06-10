import axios from "axios";
import type {
  PaginatedResponse, TokenResponse, User, UserMe, State, City, Taluka, Village, Area,
  Location, Floor, Zone, ParkingSlot, Device, DeviceCommand, AlertEvent,
  Camera, CanvasResponse, ParkingSession, Role, PermissionItem,
  SharedLink, PublicViewResponse,
} from "@/types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const api = axios.create({ baseURL: API_BASE, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((c) => {
  const t = localStorage.getItem("access_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      const rt = localStorage.getItem("refresh_token");
      if (rt && !err.config._retry) {
        err.config._retry = true;
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: rt });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          err.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(err.config);
        } catch { localStorage.clear(); window.location.href = "/login"; }
      } else { localStorage.clear(); window.location.href = "/login"; }
    }
    return Promise.reject(err);
  }
);


export const authApi = {
  login: (email: string, password: string) => api.post<TokenResponse>("/auth/login", { email, password }),
};

export const usersApi = {
  list: (params?: string) => api.get<PaginatedResponse<User>>(`/users?${params || ""}`),
  me: () => api.get<UserMe>("/users/me"),
  create: (d: Record<string, unknown>) => api.post<User>("/users", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<User>(`/users/${id}`, d),
  delete: (id: string) => api.delete(`/users/${id}`),
  changePassword: (d: { current_password: string; new_password: string }) => api.post("/users/me/change-password", d),
};

// ─── Geographic Hierarchy ───
export const statesApi = {
  list: (params?: string) => api.get<PaginatedResponse<State>>(`/states?${params || "page_size=50"}`),
  create: (d: Record<string, unknown>) => api.post<State>("/states", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<State>(`/states/${id}`, d),
  delete: (id: string) => api.delete(`/states/${id}`),
};

export const citiesApi = {
  list: (params?: string) => api.get<PaginatedResponse<City>>(`/cities?${params || "page_size=100"}`),
  byState: (stateId: string) => api.get<PaginatedResponse<City>>(`/cities?state_id=${stateId}&page_size=100`),
  create: (d: Record<string, unknown>) => api.post<City>("/cities", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<City>(`/cities/${id}`, d),
  delete: (id: string) => api.delete(`/cities/${id}`),
};

export const talukasApi = {
  list: (params?: string) => api.get<PaginatedResponse<Taluka>>(`/talukas?${params || "page_size=200"}`),
  byCity: (cityId: string) => api.get<PaginatedResponse<Taluka>>(`/talukas?city_id=${cityId}&page_size=200`),
  create: (d: Record<string, unknown>) => api.post<Taluka>("/talukas", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Taluka>(`/talukas/${id}`, d),
  delete: (id: string) => api.delete(`/talukas/${id}`),
};

export const villagesApi = {
  list: (params?: string) => api.get<PaginatedResponse<Village>>(`/villages?${params || "page_size=200"}`),
  byTaluka: (talukaId: string) => api.get<PaginatedResponse<Village>>(`/villages?taluka_id=${talukaId}&page_size=200`),
  create: (d: Record<string, unknown>) => api.post<Village>("/villages", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Village>(`/villages/${id}`, d),
  delete: (id: string) => api.delete(`/villages/${id}`),
};

export const areasApi = {
  list: (params?: string) => api.get<PaginatedResponse<Area>>(`/areas?${params || "page_size=500"}`),
  byCity: (cityId: string) => api.get<PaginatedResponse<Area>>(`/areas?city_id=${cityId}&page_size=500`),
  create: (d: Record<string, unknown>) => api.post<Area>("/areas", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Area>(`/areas/${id}`, d),
  delete: (id: string) => api.delete(`/areas/${id}`),
};

// ─── Parking Hierarchy ───
export const locationsApi = {
  list: (params?: string) => api.get<PaginatedResponse<Location>>(`/locations?${params || "page_size=100"}`),
  get: (id: string) => api.get<Location>(`/locations/${id}`),
  create: (d: Record<string, unknown>) => api.post<Location>("/locations", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Location>(`/locations/${id}`, d),
  delete: (id: string) => api.delete(`/locations/${id}`),
  canvas: (id: string) => api.get<CanvasResponse>(`/locations/${id}/canvas`),
};

export const camerasApi = {
  list: (params?: string) => api.get<PaginatedResponse<Camera>>(`/cameras?${params || "page_size=100"}`),
  byDevice: (deviceId: string) => api.get<PaginatedResponse<Camera>>(`/cameras?device_id=${deviceId}&page_size=100`),
  create: (d: Record<string, unknown>) => api.post<Camera>("/cameras", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Camera>(`/cameras/${id}`, d),
  delete: (id: string) => api.delete(`/cameras/${id}`),
  slotConfig: (id: string, slots: Record<string, unknown>[]) => api.post(`/cameras/${id}/slot-config`, { slots }),
  getSnapshot: (id: string) => api.get(`/cameras/${id}/snapshot?_t=${Date.now()}`, { responseType: "arraybuffer" }),
  captureSnapshot: (id: string) => api.post(`/cameras/${id}/capture-snapshot`),
  calibrateSlot: (cameraId: string, slotId: string) => api.post(`/cameras/${cameraId}/slots/${slotId}/calibrate`),
  snapshotBlobUrl: async (id: string) => {
    const resp = await api.get(`/cameras/${id}/snapshot?_t=${Date.now()}`, { responseType: "arraybuffer" });
    return URL.createObjectURL(new Blob([resp.data], { type: "image/jpeg" }));
  },
};

export const floorsApi = {
  list: (params?: string) => api.get<PaginatedResponse<Floor>>(`/floors?${params || "page_size=100"}`),
  byLocation: (locId: string) => api.get<PaginatedResponse<Floor>>(`/floors?location_id=${locId}&page_size=100`),
  create: (d: Record<string, unknown>) => api.post<Floor>("/floors", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Floor>(`/floors/${id}`, d),
  delete: (id: string) => api.delete(`/floors/${id}`),
};

export const zonesApi = {
  list: (params?: string) => api.get<PaginatedResponse<Zone>>(`/zones?${params || "page_size=100"}`),
  byFloor: (floorId: string) => api.get<PaginatedResponse<Zone>>(`/zones?floor_id=${floorId}&page_size=100`),
  create: (d: Record<string, unknown>) => api.post<Zone>("/zones", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Zone>(`/zones/${id}`, d),
  delete: (id: string) => api.delete(`/zones/${id}`),
};

export const slotsApi = {
  list: (params?: string) => api.get<PaginatedResponse<ParkingSlot>>(`/parking-slots?${params || "page_size=100"}`),
  create: (d: Record<string, unknown>) => api.post<ParkingSlot>("/parking-slots", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<ParkingSlot>(`/parking-slots/${id}`, d),
  delete: (id: string) => api.delete(`/parking-slots/${id}`),
  zoneStats: (zoneId: string) => api.get(`/parking-slots/zone/${zoneId}/stats`),
  snapshot: (slotId: string) => api.post<{ command_id: string; status: string }>(`/parking-slots/${slotId}/snapshot`),
};

// ─── Devices ───
export const devicesApi = {
  list: (params?: string) => api.get<PaginatedResponse<Device>>(`/devices?${params || "page_size=100"}`),
  get: (id: string) => api.get<Device>(`/devices/${id}`),
  create: (d: Record<string, unknown>) => api.post<Device>("/devices", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Device>(`/devices/${id}`, d),
  delete: (id: string) => api.delete(`/devices/${id}`),
  getSnapshot: (id: string) => api.get(`/devices/${id}/snapshot?_t=${Date.now()}`, { responseType: "arraybuffer" }),
};

export const rolesApi = {
  list: (params?: string) => api.get<PaginatedResponse<Role>>(`/roles?${params || ""}`),
  get: (id: string) => api.get<Role>(`/roles/${id}`),
  create: (d: Record<string, unknown>) => api.post<Role>("/roles", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Role>(`/roles/${id}`, d),
  delete: (id: string) => api.delete(`/roles/${id}`),
  permissions: () => api.get<PermissionItem[]>("/roles/permissions"),
};

export const commandsApi = {
  list: (params?: string) => api.get<PaginatedResponse<DeviceCommand>>(`/device-commands?${params || ""}`),
  send: (d: Record<string, unknown>) => api.post<DeviceCommand>("/device-commands", d),
  restart: (deviceId: string) => api.post<DeviceCommand>(`/device-commands/${deviceId}/restart`),
  updateDevice: (deviceId: string, branch?: string, commit?: string) => {
    const params = new URLSearchParams();
    if (branch) params.set("branch", branch);
    if (commit) params.set("commit", commit);
    const qs = params.toString();
    return api.post<DeviceCommand>(`/device-commands/${deviceId}/update${qs ? `?${qs}` : ""}`);
  },
  rollback: (deviceId: string, commit?: string) => {
    const qs = commit ? `?commit=${commit}` : "";
    return api.post<DeviceCommand>(`/device-commands/${deviceId}/rollback${qs}`);
  },
  version: (deviceId: string) => api.post<DeviceCommand>(`/device-commands/${deviceId}/version`),
  snapshot: (deviceId: string) => api.post<DeviceCommand>(`/device-commands/${deviceId}/snapshot`),
  history: (deviceId: string, limit = 20) => api.get<DeviceCommand[]>(`/device-commands/${deviceId}/history?limit=${limit}`),
  status: (commandId: string) => api.get<DeviceCommand>(`/device-commands/status/${commandId}`),
};

// ─── Slot Events / Parking History ───
export const slotEventsApi = {
  history: (params?: string) => api.get<PaginatedResponse<ParkingSession>>(`/slot-events/history?${params || "page_size=20"}`),
  bySlot: (slotId: string, params?: string) => api.get<ParkingSession[]>(`/slot-events/${slotId}?${params || ""}`),
};

// ─── Reports ───
export const reportsApi = {
  summary: (params?: string) => api.get<any>(`/reports/summary?${params || ""}`),
  exportCsvUrl: (params?: string) => `${API_BASE}/reports/export-csv?${params || ""}`,
  occupancyAnalysis: (params?: string) => api.get<any>(`/reports/occupancy-analysis?${params || ""}`),
  occupancyExportCsvUrl: (params?: string) => `${API_BASE}/reports/occupancy-analysis/export-csv?${params || ""}`,
};

// ─── Alerts ───
export const alertsApi = {
  list: (params?: string) => api.get<PaginatedResponse<AlertEvent>>(`/alerts?${params || "page_size=50"}`),
  get: (id: string) => api.get<AlertEvent>(`/alerts/${id}`),
  acknowledge: (id: string) => api.patch<AlertEvent>(`/alerts/${id}/acknowledge`),
  resolve: (id: string) => api.patch<AlertEvent>(`/alerts/${id}/resolve`),
};

// ─── Shared Links ───
export const sharedLinksApi = {
  list: (params?: string) => api.get<PaginatedResponse<SharedLink>>(`/shared-links?${params || ""}`),
  get: (id: string) => api.get<SharedLink>(`/shared-links/${id}`),
  create: (d: Record<string, unknown>) => api.post<SharedLink>("/shared-links", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<SharedLink>(`/shared-links/${id}`, d),
  delete: (id: string) => api.delete(`/shared-links/${id}`),
};

export const publicViewApi = {
  get: (token: string) => api.get<PublicViewResponse>(`/public/view/${token}`),
};

// ─── Notification Preferences ───
export const notifPrefsApi = {
  get: () => api.get("/notification-preferences/me"),
  update: (prefs: Record<string, unknown>[]) => api.put("/notification-preferences/me", { preferences: prefs }),
};

export default api;
