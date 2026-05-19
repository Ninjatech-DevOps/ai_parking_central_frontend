import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/usePolling";
import { notificationsApi, type InAppNotification } from "@/services/notificationApi";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-teal-500",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await notificationsApi.unreadCount();
      setUnreadCount(data.unread_count);
    } catch {
      /* ignore */
    }
  }, []);

  usePolling(fetchUnreadCount, 10000);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.list("page_size=15");
      setNotifications(data.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 rounded-xl hover:bg-slate-50"
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} className="text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 w-[380px] bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-lg ml-1"
                onClick={() => setOpen(false)}
              >
                <X size={14} className="text-slate-400" />
              </Button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-25 transition-colors ${
                    !n.is_read ? "bg-teal-50/40" : ""
                  }`}
                >
                  {/* Severity dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${SEVERITY_COLORS[n.severity] || "bg-slate-400"} ${
                        n.severity === "CRITICAL" && !n.is_read ? "animate-pulse" : ""
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] leading-relaxed ${!n.is_read ? "text-slate-800 font-medium" : "text-slate-500"}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {n.location_name && (
                        <span className="text-[10px] text-slate-400">{n.location_name}</span>
                      )}
                      <span className="text-[10px] text-slate-300">{timeAgo(n.sent_at)}</span>
                    </div>
                  </div>

                  {/* Mark read button */}
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="mt-1 flex-shrink-0 p-1 rounded-lg hover:bg-teal-100 text-teal-600 transition-colors"
                      title="Mark as read"
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <a
                href="/alerts"
                className="text-[11px] text-teal-600 hover:text-teal-700 font-medium"
              >
                View all alerts
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
