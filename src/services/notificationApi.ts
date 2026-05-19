import api from "@/services/api";
import type { PaginatedResponse } from "@/types/api";

export interface InAppNotification {
  id: string;
  alert_event_id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
  device_id: string | null;
  location_name: string | null;
}

export const notificationsApi = {
  list: (params?: string) =>
    api.get<PaginatedResponse<InAppNotification>>(`/notifications/me?${params || "page_size=10"}`),

  unreadCount: () =>
    api.get<{ unread_count: number }>("/notifications/me/unread-count"),

  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    api.patch("/notifications/me/read-all"),

  registerFcmToken: (token: string) =>
    api.post("/users/me/fcm-token", { token }),

  removeFcmToken: (token: string) =>
    api.delete("/users/me/fcm-token", { data: { token } }),
};
