import { useEffect, useRef, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "framer-motion"
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
// Brand v3 §05 — feedback-tier semantic mapping. Mirrors
// DashboardNotificationsPage's TYPE_META exactly so the in-header
// dropdown and the full notifications page render the same chip tones
// for any given event. Sole source of truth lives here AND there;
// any future change must update both.
const TYPE_META = {
  [NOTIFICATION_TYPES.ORDER_PLACED]: {
    icon: ShoppingCart,
    color: "bg-violet-pale text-violet",
  },
  [NOTIFICATION_TYPES.PAYMENT_SUCCESS]: {
    icon: CreditCard,
    color: "bg-mint/12 text-emerald-700",
  },
  [NOTIFICATION_TYPES.PAYMENT_FAILED]: {
    icon: CreditCard,
    color: "bg-rose/10 text-rose-700",
  },
  [NOTIFICATION_TYPES.REFUND_ISSUED]: {
    icon: RefreshCcw,
    color: "bg-azure-pale text-azure",
  },
  [NOTIFICATION_TYPES.DOWNLOAD_READY]: {
    icon: Download,
    color: "bg-mint/12 text-emerald-700",
  },
  [NOTIFICATION_TYPES.DOWNLOAD_REVOKED]: {
    icon: Package,
    color: "bg-amber/12 text-amber-700",
  },
  [NOTIFICATION_TYPES.SERVICE_UPDATE]: {
    icon: Package,
    color: "bg-amber/12 text-amber-700",
  },
  [NOTIFICATION_TYPES.SUPPORT_REPLY]: {
    icon: MessageSquare,
    color: "bg-azure-pale text-azure",
  },
  [NOTIFICATION_TYPES.SYSTEM]: {
    icon: Info,
    color: "bg-slate-100 text-steel",
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
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-violet-pale/40 ${
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

        <div className="mt-1 text-micro text-charcoal-80/65">
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
  const reduce = useReducedMotion()
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
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal-80/10 bg-white text-violet transition hover:bg-violet-pale/60"
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
      {/* max-w keeps the panel inside the viewport: a hard 360px anchored to
          the right edge overflowed horizontally on 320-360px phones.
          Animated like the other header popovers, reduced-motion aware. */}
      <AnimatePresence>
      {open && (
        <m.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: reduce ? 0.08 : 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] max-w-[calc(100vw-2rem)] origin-top-right rounded-xl border border-charcoal-80/10 bg-white shadow-[0_20px_60px_rgb(var(--color-violet-rgb)/0.14)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-charcoal-80/10 px-4 py-3">
            <div>
              <div className="text-body font-semibold text-violet">Notifications</div>
              {unreadCount > 0 && (
                <div className="text-micro text-charcoal-80/65">{unreadCount} unread</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal-80/10 px-3 py-1.5 text-micro font-medium text-violet transition hover:bg-violet-pale/60"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t("notifDropdown.markAllRead")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-charcoal-80/65 transition hover:bg-violet-pale/60 hover:text-violet"
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
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-violet-pale/40" />
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
                <div className="mt-1 text-micro text-charcoal-80/65">
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
        </m.div>
      )}
      </AnimatePresence>
    </div>
  )
}
