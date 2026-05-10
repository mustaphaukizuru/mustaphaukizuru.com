import { useEffect, useRef, useState } from "react"
import {
  Bell,
  ShoppingCart,
  Download,
  CreditCard,
  RefreshCcw,
  MessageSquare,
  Package,
  Info,
  CheckCheck,
  X,
} from "lucide-react"
import { useNotifications, NOTIFICATION_TYPES } from "../../context/NotificationContext"

import { useTranslation } from "react-i18next"
// ─────────────────────────────────────────────────────────────────────────────
// Icon & color map per notification type
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_META = {
  [NOTIFICATION_TYPES.ORDER_PLACED]: {
    icon: ShoppingCart,
    color: "bg-violet-pale text-violet",
  },
  [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: {
    icon: CreditCard,
    color: "bg-[#e8f4ea] text-mint-800",
  },
  [NOTIFICATION_TYPES.PAYMENT_FAILED]: {
    icon: CreditCard,
    color: "bg-red-50 text-red-600",
  },
  [NOTIFICATION_TYPES.REFUND_ISSUED]: {
    icon: RefreshCcw,
    color: "bg-[#eef2ff] text-[#4f46e5]",
  },
  [NOTIFICATION_TYPES.DOWNLOAD_READY]: {
    icon: Download,
    color: "bg-[#e8f4ea] text-mint-800",
  },
  [NOTIFICATION_TYPES.DOWNLOAD_REVOKED]: {
    icon: Package,
    color: "bg-[#f6efe3] text-amber-800",
  },
  [NOTIFICATION_TYPES.SERVICE_UPDATE]: {
    icon: Package,
    color: "bg-[#f6efe3] text-amber-800",
  },
  [NOTIFICATION_TYPES.SUPPORT_REPLY]: {
    icon: MessageSquare,
    color: "bg-[#eef3fb] text-[#2f5ea8]",
  },
  [NOTIFICATION_TYPES.SYSTEM]: {
    icon: Info,
    color: "bg-slate-50 text-[#666]",
  },
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotificationItem({ notification, onRead }) {
  const meta = TYPE_META[notification.type] || TYPE_META[NOTIFICATION_TYPES.SYSTEM]
  const Icon = meta.icon

  return (
    <button
      type="button"
      onClick={() => onRead(notification.id)}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#f7f4f8] ${
        !notification.isRead ? "bg-violet-ghost" : ""
      }`}
    >
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-meta font-semibold leading-5 text-violet">
            {notification.title}
          </div>
          {!notification.isRead && (
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet" />
          )}
        </div>

        {notification.message && (
          <div className="mt-0.5 line-clamp-2 text-micro leading-5 text-charcoal-80/70">
            {notification.message}
          </div>
        )}

        <div className="mt-1 text-micro text-charcoal-80/50">
          {timeAgo(notification.createdAt)}
        </div>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dropdown component
// ─────────────────────────────────────────────────────────────────────────────
export default function NotificationDropdown() {
  const { t } = useTranslation("dashboard")
  const { notifications, loading, unreadCount, fetchNotifications, markAsRead, markAllAsRead } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Fetch on mount and when opened
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleRead = (id) => {
    markAsRead(id)
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal-80/10 bg-white text-violet transition hover:bg-[#f4eef6]"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet text-micro font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] rounded-xl border border-charcoal-80/10 bg-white shadow-[0_20px_60px_rgba(93,63,211,0.14)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-charcoal-80/10 px-4 py-3">
            <div>
              <div className="text-body font-semibold text-violet">Notifications</div>
              {unreadCount > 0 && (
                <div className="text-micro text-charcoal-80/60">{unreadCount} unread</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal-80/10 px-3 py-1.5 text-micro font-medium text-violet transition hover:bg-[#f4eef6]"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t("notifDropdown.markAllRead")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-charcoal-80/50 transition hover:bg-[#f4eef6] hover:text-violet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[380px] overflow-y-auto px-2 py-2">
            {loading && notifications.length === 0 ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-[#f4f1f4]" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <Bell className="h-6 w-6" />
                </div>
                <div className="mt-3 text-meta font-semibold text-violet">
                  {t("notifDropdown.allCaughtUp")}
                </div>
                <div className="mt-1 text-micro text-charcoal-80/60">
                  {t("notifDropdown.noNotifs")}
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onRead={handleRead}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
