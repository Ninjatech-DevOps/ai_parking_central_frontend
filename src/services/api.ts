import axios from "axios";
import type {
  PaginatedResponse, TokenResponse, User, State, City, Taluka, Village, Area,
  Location, Floor, Zone, ParkingSlot, Device, DeviceCommand, AlertEvent,
  Camera, CanvasResponse,
} from "@/types/api";

const api = axios.create({ baseURL: "/api/v1", headers: { "Content-Type": "application/json" } });

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
          const { data } = await axios.post("/api/v1/auth/refresh", { refresh_token: rt });
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

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) { if (v) p.set(k, v); }
  return p.toString();
}

export const authApi = {
  login: (email: string, password: string) => api.post<TokenResponse>("/auth/login", { email, password }),
};

export const usersApi = {
  list: (params?: string) => api.get<PaginatedResponse<User>>(`/users?${params || ""}`),
  me: () => api.get<User>("/users/me"),
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
};

// ─── Devices ───
export const devicesApi = {
  list: (params?: string) => api.get<PaginatedResponse<Device>>(`/devices?${params || "page_size=100"}`),
  get: (id: string) => api.get<Device>(`/devices/${id}`),
  create: (d: Record<string, unknown>) => api.post<Device>("/devices", d),
  update: (id: string, d: Record<string, unknown>) => api.patch<Device>(`/devices/${id}`, d),
  delete: (id: string) => api.delete(`/devices/${id}`),
  getSnapshot: (id: string) => api.get(`/devices/${id}/snapshot`, { responseType: "arraybuffer" }),
};

export const rolesApi = {
  list: () => api.get<PaginatedResponse<{ id: string; name: string; description: string | null }>>("/roles"),
};

export const commandsApi = {
  list: (params?: string) => api.get<PaginatedResponse<DeviceCommand>>(`/device-commands?${params || ""}`),
  send: (d: Record<string, unknown>) => api.post<DeviceCommand>("/device-commands", d),
  restart: (deviceId: string) => api.post<DeviceCommand>(`/device-commands/${deviceId}/restart`),
  updateDevice: (deviceId: string, image: string) => api.post<DeviceCommand>(`/device-commands/${deviceId}/update?image=${image}`),
  snapshot: (deviceId: string) => api.post<DeviceCommand>(`/device-commands/${deviceId}/snapshot`),
  history: (deviceId: string, limit = 20) => api.get<DeviceCommand[]>(`/device-commands/${deviceId}/history?limit=${limit}`),
};

// ─── Alerts ───
export const alertsApi = {
  list: (params?: string) => api.get<PaginatedResponse<AlertEvent>>(`/alerts?${params || "page_size=50"}`),
  get: (id: string) => api.get<AlertEvent>(`/alerts/${id}`),
};

// ─── Notification Preferences ───
export const notifPrefsApi = {
  get: () => api.get("/notification-preferences/me"),
  update: (prefs: Record<string, unknown>[]) => api.put("/notification-preferences/me", { preferences: prefs }),
};

export default api;
