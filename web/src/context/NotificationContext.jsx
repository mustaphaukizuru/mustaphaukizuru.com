import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { getStoredToken } from "../services/authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"

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
      const response = await fetch(`${API_BASE_URL}/api/member/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(Array.isArray(data?.data) ? data.data : [])
      } else if (response.status === 404) {
        // Route not registered yet — fail silently
        setNotifications([])
      }
    } catch {
      // Backend may not be available — silently fall back to local state
    } finally {
      setLoading(false)
      setLastFetched(Date.now())
    }
  }, [])

  // ── Mark one as read ───────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    const token = getStoredToken()

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    )

    if (!token) return
    try {
      await fetch(`${API_BASE_URL}/api/member/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
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
      await fetch(`${API_BASE_URL}/api/member/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      })
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
