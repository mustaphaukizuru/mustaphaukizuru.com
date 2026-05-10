import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  Bell,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  ShoppingCart,
  CreditCard,
  RefreshCcw,
  Download,
  Package,
  MessageSquare,
  Info,
  Sparkles,
  Inbox,
} from "lucide-react"
import { MetricCard, SectionCard } from "../components/ui/index"
import { useNotifications, NOTIFICATION_TYPES } from "../context/NotificationContext"

/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardNotificationsPage · member-side full-history view.
 *
 *  Wires the missing /dashboard/notifications route. Reuses the existing
 *  NotificationContext (mounted at main.jsx) so the bell badge in the
 *  header stays in sync — marking an item read here removes the dot in
 *  the dropdown and decrements the unread counter immediately.
 *
 *  Backend contract (already shipped):
 *    GET    /api/member/notifications            (top 20, ordered desc)
 *    PATCH  /api/member/notifications/:id/read
 *    PATCH  /api/member/notifications/read-all
 *
 *  No backend work required. The page calls fetchNotifications(true) on
 *  mount to bypass the 30 s context debounce (additive flag in
 *  NotificationContext).
 *  ────────────────────────────────────────────────────────────────────── */

// Lucide icon + colour map per notification type — matches NotificationDropdown.
const TYPE_META = {
  [NOTIFICATION_TYPES.ORDER_PLACED]:     { icon: ShoppingCart, color: "bg-violet-pale text-violet" },
  [NOTIFICATION_TYPES.PAYMENT_SUCCESS]:  { icon: CreditCard,   color: "bg-[#e8f4ea] text-[#3b8f47]" },
  [NOTIFICATION_TYPES.PAYMENT_FAILED]:   { icon: CreditCard,   color: "bg-red-50 text-red-600" },
  [NOTIFICATION_TYPES.REFUND_ISSUED]:    { icon: RefreshCcw,   color: "bg-[#eef2ff] text-[#4f46e5]" },
  [NOTIFICATION_TYPES.DOWNLOAD_READY]:   { icon: Download,     color: "bg-[#e8f4ea] text-[#3b8f47]" },
  [NOTIFICATION_TYPES.DOWNLOAD_REVOKED]: { icon: Package,      color: "bg-[#f6efe3] text-[#9c5c00]" },
  [NOTIFICATION_TYPES.SERVICE_UPDATE]:   { icon: Package,      color: "bg-[#f6efe3] text-[#9c5c00]" },
  [NOTIFICATION_TYPES.SUPPORT_REPLY]:    { icon: MessageSquare, color: "bg-[#eef3fb] text-[#2f5ea8]" },
  [NOTIFICATION_TYPES.SYSTEM]:           { icon: Info,         color: "bg-[#f2f2f2] text-[#666]" },
}

function localeTagFor(lang) {
  return lang === "es" ? "es-MX" : "en-US"
}

function formatTimestamp(dateStr, localeTag) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(localeTag, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

function NotificationRow({ notification, onRead, t }) {
  const meta = TYPE_META[notification.type] || TYPE_META[NOTIFICATION_TYPES.SYSTEM]
  const Icon = meta.icon
  const { i18n } = useTranslation()
  const localeTag = localeTagFor(i18n.language)

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id)
  }

  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border border-charcoal-80/8 px-4 py-3 transition hover:border-violet/20 hover:shadow-[0_8px_22px_rgba(93,63,211,0.06)] ${
        !notification.isRead ? "bg-violet-ghost" : "bg-white"
      }`}
    >
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.color}`} aria-hidden="true">
        <Icon className="h-4.5 w-4.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-meta font-semibold text-violet">
                {notification.title || t("notificationsPage.row.markRead")}
              </h3>
              {!notification.isRead && (
                <span className="inline-flex items-center rounded-full bg-violet px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  {t("notificationsPage.row.newBadge")}
                </span>
              )}
            </div>
            {notification.message && (
              <p className="mt-1 text-micro leading-5 text-charcoal-80/70">
                {notification.message}
              </p>
            )}
            <p className="mt-1 font-mono text-[11px] tabular-nums text-charcoal-80/50">
              {formatTimestamp(notification.createdAt, localeTag)}
            </p>
          </div>

          {!notification.isRead && (
            <button
              type="button"
              onClick={handleClick}
              className="shrink-0 rounded-lg border border-violet/15 bg-white px-3 py-1.5 text-micro font-semibold text-violet opacity-0 transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 group-hover:opacity-100 sm:opacity-100"
            >
              {t("notificationsPage.row.markRead")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardNotificationsPage() {
  const { t } = useTranslation("dashboard")
  const {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications()

  const [filter, setFilter] = useState("all") // "all" | "unread" | "read"
  const [refreshing, setRefreshing] = useState(false)

  // Force a fresh fetch on mount so members landing here see the latest
  // state regardless of the dropdown's 30 s debounce window.
  useEffect(() => {
    fetchNotifications(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try { await fetchNotifications(true) } finally { setRefreshing(false) }
  }

  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead)
    if (filter === "read")   return notifications.filter((n) =>  n.isRead)
    return notifications
  }, [notifications, filter])

  const todayCount = useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000
    return notifications.filter((n) => {
      const t = new Date(n.createdAt).getTime()
      return Number.isFinite(t) && t >= since
    }).length
  }, [notifications])

  const FILTERS = [
    { id: "all",    labelKey: "notificationsPage.filters.all",    count: notifications.length },
    { id: "unread", labelKey: "notificationsPage.filters.unread", count: unreadCount },
    { id: "read",   labelKey: "notificationsPage.filters.read",   count: notifications.length - unreadCount },
  ]

  return (
    <section className="space-y-5">
      {/* Page heading */}
      <header className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
        <span className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.18em] text-violet">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t("notificationsPage.eyebrow")}
        </span>
        <h1 className="mt-3 text-section font-bold text-violet">
          {t("notificationsPage.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-meta leading-6 text-charcoal-80/65">
          {t("notificationsPage.subtitle")}
        </p>
      </header>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title={t("notificationsPage.metrics.total")}
          value={notifications.length}
          subtitle={t("notificationsPage.metrics.totalSubtitle")}
          icon={Inbox}
          tone="purple"
        />
        <MetricCard
          title={t("notificationsPage.metrics.unread")}
          value={unreadCount}
          subtitle={t("notificationsPage.metrics.unreadSubtitle")}
          icon={Bell}
          tone="amber"
        />
        <MetricCard
          title={t("notificationsPage.metrics.today")}
          value={todayCount}
          subtitle={t("notificationsPage.metrics.todaySubtitle")}
          icon={Sparkles}
          tone="green"
        />
      </div>

      {/* Filters + actions */}
      <SectionCard
        title={t("notificationsPage.title")}
        subtitle={t("notificationsPage.subtitle")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-charcoal-80/12 bg-white">
              {FILTERS.map((f) => {
                const active = filter === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    aria-pressed={active}
                    className={`flex h-[36px] items-center gap-2 px-3 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset ${
                      active ? "bg-violet text-white" : "text-charcoal-80/65 hover:text-violet"
                    }`}
                  >
                    {t(f.labelKey)}
                    <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                      active ? "bg-white/15 text-white" : "bg-charcoal-80/8 text-charcoal-80/60"
                    }`}>
                      {f.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-2 rounded-xl border border-violet/15 bg-white px-3 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("notificationsPage.actions.markAllRead")}
              </button>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              aria-label={t("notificationsPage.actions.refresh")}
              className="inline-flex items-center gap-2 rounded-xl border border-charcoal-80/10 bg-[#f7f4f8] px-3 py-2 text-micro font-medium text-violet transition hover:bg-violet-pale disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${(refreshing || loading) ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">{t("notificationsPage.actions.refresh")}</span>
            </button>
          </div>
        }
      >
        {loading && notifications.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[#f4f1f4]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
                <Bell className="h-9 w-9" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-card font-bold text-violet">
                {t("notificationsPage.empty.title")}
              </h3>
              <p className="mt-2 max-w-md text-meta leading-6 text-charcoal-80/65">
                {t("notificationsPage.empty.body")}
              </p>
              <Link
                to="/store"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                {t("notificationsPage.empty.browseStore")}
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-mist p-6 text-center text-meta text-charcoal-80/60">
              {t("notificationsPage.empty.title")}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onRead={markAsRead}
                t={t}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  )
}
