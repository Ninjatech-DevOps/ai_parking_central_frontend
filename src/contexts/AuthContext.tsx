import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import api from "@/services/api";
import type { UserMe } from "@/types/api";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/firebase";
import { notificationsApi } from "@/services/notificationApi";
import { showBySeverity } from "@/lib/toast";

interface AuthContextType {
  user: UserMe | null;
  isLoading: boolean;
  permissions: string[];
  /** Check if user has a specific permission (e.g. "devices:view") */
  hasPermission: (perm: string) => boolean;
  /** Check if user has any of the given permissions */
  hasAnyPermission: (...perms: string[]) => boolean;
  /** Primary role name for display (first role or null) */
  roleName: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const FCM_TOKEN_KEY = "fcm_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const foregroundUnsub = useRef<(() => void) | null>(null);

  // Derived from user — kept in sync automatically
  const permissions = user?.permissions || [];
  const roleName = user?.roles?.[0]?.name || null;

  const hasPermission = useCallback(
    (perm: string) => permissions.includes(perm),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]) => perms.some((p) => permissions.includes(p)),
    [permissions],
  );

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  // Register FCM + listen for foreground messages when user is logged in
  useEffect(() => {
    if (!user) return;
    registerFcmToken();
    foregroundUnsub.current = onForegroundMessage((payload) => {
      const title = payload.notification?.title || "AI Parking Alert";
      const body = payload.notification?.body || "";
      // Show toast in-app
      const severity = payload.data?.severity;
      showBySeverity(`${title}: ${body}`, severity);
      // Also show browser notification (so user sees it even if not looking at the tab)
      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "ai-parking-" + Date.now(),
        });
      }
    });
    return () => {
      foregroundUnsub.current?.();
    };
  }, [user?.id]);

  async function registerFcmToken() {
    try {
      console.log("[FCM] Requesting notification permission...");
      const token = await requestNotificationPermission();
      if (token) {
        // Always register — the token belongs to THIS browser, and we need it
        // on the currently logged-in user (not a previous user)
        console.log("[FCM] Token obtained, registering with backend...");
        await notificationsApi.registerFcmToken(token);
        localStorage.setItem(FCM_TOKEN_KEY, token);
        console.log("[FCM] Token registered successfully");
      } else {
        console.warn("[FCM] No token received (permission denied or unsupported)");
      }
    } catch (err) {
      console.error("[FCM] Registration failed:", err);
    }
  }

  async function removeFcmToken() {
    try {
      const token = localStorage.getItem(FCM_TOKEN_KEY);
      if (token) {
        await notificationsApi.removeFcmToken(token);
        localStorage.removeItem(FCM_TOKEN_KEY);
      }
    } catch {
      /* best effort */
    }
  }

  async function fetchUser() {
    try {
      const { data } = await api.get<UserMe>("/users/me");
      setUser(data);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    await fetchUser();
  }

  async function logout() {
    await removeFcmToken();
    foregroundUnsub.current?.();
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user, isLoading, permissions, hasPermission, hasAnyPermission, roleName,
        login, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
