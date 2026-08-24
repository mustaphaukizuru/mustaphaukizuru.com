/* eslint-disable react-refresh/only-export-components -- provider + hook co-located */
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { authFetch } from "../lib/api"
import { getStoredToken } from "../services/authService"

const NotificationContext = createContext(null)

// ─────────────────────────────────────────────────────────────────────────────
// Notification types used across the platform
// ─────────────────────────────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = {
  ORDER_PLACED: "order_placed",
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_FAILED: "payment_failed",
  REFUND_ISSUED: "refund_issued",
  DOWNLOAD_READY: "download_ready",
  DOWNLOAD_REVOKED: "download_revoked",
  SERVICE_UPDATE: "service_update",
  SUPPORT_REPLY: "support_reply",
  SYSTEM: "system",
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState(null)

  // ── Fetch from backend ─────────────────────────────────────────────────────
  // The optional `force` flag bypasses the 30s debounce. Used by the
  // DashboardNotificationsPage refresh button so users can pull the latest
  // state on demand without waiting for the next debounced window.
  const fetchNotifications = useCallback(async (force = false) => {
    const token = getStoredToken()
    if (!token) return

    // Debounce: skip if fetched within last 30 seconds (unless forced).
    if (!force && lastFetched && Date.now() - lastFetched < 30_000) return

    setLoading(true)
    try {
      const response = await authFetch("/api/v1/member/notifications", { method: "GET" })
      setNotifications(Array.isArray(response?.data) ? response.data : [])
    } catch (err) {
      // 404 (route not yet registered) and network blips both land here.
      // We swallow them so a missing endpoint never breaks the dashboard
      // shell — the badge just stays at zero until the endpoint comes back.
      if (err?.status !== 404) {
         
        console.warn("[notifications] fetch failed:", err?.message)
      }
      setNotifications([])
    } finally {
      setLoading(false)
      setLastFetched(Date.now())
    }
  }, [lastFetched])

  // ── Mark one as read ───────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    const token = getStoredToken()

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )

    if (!token) return
    try {
      await authFetch(`/api/v1/member/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
      })
    } catch {
      // No-op — optimistic update stays
    }
  }, [])

  // ── Mark all as read ───────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    const token = getStoredToken()

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))

    if (!token) return
    try {
      await authFetch("/api/v1/member/notifications/read-all", { method: "PATCH" })
    } catch {
      // No-op
    }
  }, [])

  // ── Add a local notification (for immediate UI feedback) ───────────────────
  const addLocal = useCallback((notification) => {
    const newItem = {
      id: `local-${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      ...notification,
    }
    setNotifications((prev) => [newItem, ...prev])
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  )

  const value = useMemo(
    () => ({
      notifications,
      loading,
      lastFetched,
      unreadCount,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      addLocal,
    }),
    [notifications, loading, lastFetched, unreadCount, fetchNotifications, markAsRead, markAllAsRead, addLocal]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider")
  return ctx
}
