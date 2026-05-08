import { useEffect, useMemo, useState } from "react"
import { useTranslation, Trans } from "react-i18next"
import { Link, Navigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  CreditCard, Download, Package, Sparkles, ArrowRight, ArrowUpRight,
  Headphones, CheckCircle2, User as UserIcon, Bell, Clock, FolderOpen,
  ShoppingBag, MessageSquare, TrendingUp, Activity, Calendar,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { fetchMyOrders } from "../services/orderService"
import { authFetch } from "../lib/api"
import { MetricCard, StatusBadge } from "../components/ui/index"

/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardPage v2 · I18N · Phase 119H
 *
 *  All visible strings keyed under `dashboard.overview.*`. Sub-components
 *  (KpiCard, ActivityItem, SpendChart) each scope their own useTranslation
 *  hook where they need it. The `timeAgo` helper accepts a `t` function so
 *  the relative-time output localizes on language switch.
 *
 *  Profile completion check uses i18n keys for field labels via a static
 *  i18nKey per check, resolved at render time.
 *  ──────────────────────────────────────────────────────────────────── */

function safeNum(val, fb = 0) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fb
}

function fmtMoney(n) {
  const x = safeNum(n)
  return `$${x.toFixed(2)}`
}

/* I18N · profile-completion checks now carry a `i18nKey` so the missing
 * field list resolves to localized labels. */
function computeProfileCompletion(user) {
  if (!user) return { percent: 0, missing: [] }
  const checks = [
    { key: "fullName",  i18nKey: "overview.profileWidget.fields.fullName", present: Boolean(user.fullName) },
    { key: "email",     i18nKey: "overview.profileWidget.fields.email",    present: Boolean(user.email) },
    { key: "avatarUrl", i18nKey: "overview.profileWidget.fields.avatar",   present: Boolean(user.avatarUrl) },
    { key: "phone",     i18nKey: "overview.profileWidget.fields.phone",    present: Boolean(user.phone) },
    { key: "country",   i18nKey: "overview.profileWidget.fields.country",  present: Boolean(user.country) },
    { key: "bio",       i18nKey: "overview.profileWidget.fields.bio",      present: Boolean(user.bio) },
  ]
  const filled = checks.filter((c) => c.present).length
  const percent = Math.round((filled / checks.length) * 100)
  const missing = checks.filter((c) => !c.present).map((c) => c.i18nKey)
  return { percent, missing }
}

/* ── Sparkline · tiny SVG line chart (matches AdminDashboard aesthetic) ── */
function Sparkline({ data, color = "var(--color-violet, #5D3FD3)", width = 88, height = 28 }) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2}
              stroke="currentColor" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="2 3" />
      </svg>
    )
  }
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y]
  })
  const pathD = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ")
  const fillD = `${pathD} L${width},${height} L0,${height} Z`
  const gradId = `mspark-${Math.random().toString(36).slice(2, 8)}`

  return (
    <svg width={width} height={height} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.00" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ── KpiCard · MetricCard-shaped but with sparkline + animation ──────── */
function KpiCard({ label, value, subValue, icon: Icon, spark, tone = "purple", delay = 0 }) {
  const tones = {
    purple: "bg-violet-pale text-violet",
    green: "bg-mint/15 text-mint",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-azure/10 text-azure",
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
      className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:shadow-[0_10px_28px_rgba(93,63,211,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {Icon && (
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${tones[tone] || tones.purple}`}>
                <Icon className="h-3 w-3" aria-hidden="true" />
              </div>
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-charcoal-80/55">{label}</p>
          </div>
          <div className="mt-3 font-mono text-[28px] font-bold leading-none tracking-tight tabular-nums text-violet">
            {value}
          </div>
          {subValue && (
            <p className="mt-1.5 font-mono text-micro tabular-nums text-charcoal-80/55">{subValue}</p>
          )}
        </div>
        {spark && (
          <div className="shrink-0 text-violet">
            <Sparkline data={spark} color="currentColor" />
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ── ActivityItem · unified timeline row ─────────────────────────────── */
function ActivityItem({ kind, title, meta, when, href, color = "violet" }) {
  const colors = {
    violet: { bg: "bg-violet-pale", fg: "text-violet" },
    mint: { bg: "bg-mint/15", fg: "text-mint" },
    azure: { bg: "bg-azure/10", fg: "text-azure" },
    amber: { bg: "bg-amber-50", fg: "text-amber-700" },
  }
  const cfg = colors[color] || colors.violet
  const icons = {
    order: ShoppingBag,
    download: Download,
    ticket: MessageSquare,
    project: FolderOpen,
  }
  const Icon = icons[kind] || Activity

  const Wrapper = href ? Link : "div"
  const wrapperProps = href ? { to: href } : {}

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex items-start gap-3 rounded-lg p-2.5 transition ${
        href ? "hover:bg-violet-pale/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset" : ""
      }`}
    >
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${cfg.bg} ${cfg.fg}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-meta font-medium text-violet">{title}</div>
        {meta && <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">{meta}</div>}
      </div>
      <div className="shrink-0 font-mono text-[10px] tabular-nums text-charcoal-80/45">{when}</div>
    </Wrapper>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [openTickets, setOpenTickets] = useState(0)
  const [tickets, setTickets] = useState([])
  const [notifications, setNotifications] = useState({ unread: 0, items: [] })
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      try {
        setLoading(true); setErrorMessage("")
        const data = await fetchMyOrders()
        if (!cancelled) setOrders(Array.isArray(data) ? data : [])
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message || t("overview.errors.load"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadOrders()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch("/api/v1/support/tickets?status=open")
        const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
        if (!cancelled) {
          setTickets(data)
          setOpenTickets(data.filter((tx) => tx.status === "open" || tx.status === "pending").length)
        }
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch("/api/member/notifications?unread=true&limit=5")
        const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
        if (!cancelled) setNotifications({ unread: items.length, items: items.slice(0, 3) })
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch("/api/member/projects?status=active")
        const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
        if (!cancelled) setProjects(items.slice(0, 3))
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [])

  const paidOrders = useMemo(
    () => orders.filter((order) => order.status === "paid"),
    [orders]
  )

  const totalSpent = useMemo(
    () => paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    [paidOrders]
  )

  const totalDownloads = useMemo(() => {
    let count = 0
    for (const order of paidOrders) {
      for (const item of order.items || []) {
        count += item.product?.files?.length || 0
      }
    }
    return count
  }, [paidOrders])

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders])

  const recentProducts = useMemo(() => {
    const rows = []
    for (const order of paidOrders) {
      for (const item of order.items || []) {
        if (item.product?.files?.length > 0) {
          rows.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            productId: item.product.id,
            title: item.product.title || item.title || "Product",
            filesCount: item.product.files.length,
            createdAt: order.createdAt,
          })
        }
      }
    }
    return rows.slice(0, 4)
  }, [paidOrders])

  // 6-month spend trend, bucketed by month
  const spendTrend = useMemo(() => {
    const now = new Date()
    const buckets = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString(localeTag, { month: "short" }),
        value: 0,
      })
    }
    for (const o of paidOrders) {
      const d = new Date(o.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const bucket = buckets.find((b) => b.key === key)
      if (bucket) bucket.value += safeNum(o.totalAmount)
    }
    return buckets
  }, [paidOrders, localeTag])

  const sparkData = useMemo(() => ({
    orders: spendTrend.map((b, i) => i + 1),
    downloads: spendTrend.map(() => Math.random() * totalDownloads),
    spend: spendTrend.map((b) => b.value),
    tickets: [openTickets * 0.5, openTickets * 0.8, openTickets],
  }), [spendTrend, totalDownloads, openTickets])

  // Unified activity feed
  const activityFeed = useMemo(() => {
    const feed = []
    for (const o of orders.slice(0, 5)) {
      feed.push({
        kind: "order",
        color: o.status === "paid" ? "mint" : o.status === "pending" ? "amber" : "violet",
        title: t("overview.activity.orderTitle", { number: o.orderNumber || String(o.id).slice(0, 6) }),
        meta: `${o.status} · ${fmtMoney(o.totalAmount)}`,
        href: `/dashboard/orders`,
        when: new Date(o.createdAt),
      })
    }
    for (const tx of tickets.slice(0, 3)) {
      feed.push({
        kind: "ticket",
        color: "azure",
        title: tx.subject || t("overview.activity.ticketFallback"),
        meta: tx.status,
        href: "/dashboard/support",
        when: new Date(tx.createdAt || tx.updatedAt || Date.now()),
      })
    }
    return feed.sort((a, b) => b.when - a.when).slice(0, 6)
  }, [orders, tickets, t])

  const profileStats = useMemo(() => computeProfileCompletion(user), [user])

  const adminPreview = user?.role === "admin"

  if (loading) {
    return (
      <section className="space-y-5" role="status" aria-busy="true" aria-label={t("overview.loading")}>
        <div className="h-[140px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-[140px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-[300px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white lg:col-span-2" />
          <div className="h-[300px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
        </div>
      </section>
    )
  }

  // Build localized "missing fields" preview list (max 3 + "and more")
  const missingPreview = profileStats.missing.slice(0, 3).map((k) => t(k)).join(", ")

  return (
    <>
      {adminPreview && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-violet/20 bg-violet-pale/60 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-violet">
            <span className="inline-flex h-6 items-center rounded-full bg-violet px-2 text-[11px] font-semibold uppercase tracking-wider text-white">{t("overview.adminPreview.pill")}</span>
            <span className="text-charcoal-80">{t("overview.adminPreview.body")}</span>
          </div>
          <a href="/admin" className="font-semibold text-violet hover:text-violet-deep">{t("overview.adminPreview.back")}</a>
        </div>
      )}
    <section className="space-y-5">
      {/* ── Welcome banner ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-violet">
              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
              {t("overview.welcome.eyebrow")}
            </div>
            <h2 className="mt-3 text-section font-bold tracking-tight text-violet">
              {t("overview.welcome.greeting", { name: user?.fullName || t("overview.welcome.fallbackName") })}
            </h2>
            <p className="mt-1.5 max-w-2xl text-meta leading-6 text-charcoal-80/70">
              {t("overview.welcome.subtitle")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {notifications.unread > 0 && (
              <Link
                to="/dashboard/notifications"
                className="relative inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-mono tabular-nums">{notifications.unread}</span>
                <span>{t("overview.welcome.unread")}</span>
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
              </Link>
            )}
            <Link
              to="/store"
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2.5 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgba(93,63,211,0.22)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              {t("overview.welcome.browseStore")}
            </Link>
          </div>
        </div>
      </motion.div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-meta text-rose-700" role="alert">
          {errorMessage}
        </div>
      )}

      {/* ── Profile completion (only when < 100%) ──────────────────────── */}
      {profileStats.percent < 100 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
              <UserIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-card font-bold text-violet">{t("overview.profileWidget.title")}</h3>
                <span className="font-mono text-meta font-bold tabular-nums text-violet">{profileStats.percent}%</span>
              </div>
              <p className="mt-0.5 text-micro text-charcoal-80/65">
                {t("overview.profileWidget.lead")}{" "}
                <span className="font-semibold text-violet">{missingPreview}</span>
                {profileStats.missing.length > 3 ? t("overview.profileWidget.andMore") : ""}{t("overview.profileWidget.tail")}
              </p>
              <div
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-violet-pale"
                role="progressbar"
                aria-valuenow={profileStats.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${profileStats.percent}%` }} />
              </div>
            </div>
            <Link
              to="/dashboard/profile"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet/20 bg-white px-4 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              {t("overview.profileWidget.cta")}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── 4 KPI cards with sparklines ────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("overview.kpi.orders")}
          value={orders.length}
          subValue={t("overview.kpi.ordersSubtitle")}
          icon={CreditCard}
          spark={sparkData.orders}
          tone="purple"
          delay={0.0}
        />
        <KpiCard
          label={t("overview.kpi.downloads")}
          value={totalDownloads}
          subValue={t("overview.kpi.downloadsSubtitle")}
          icon={Download}
          spark={sparkData.downloads}
          tone="green"
          delay={0.05}
        />
        <KpiCard
          label={t("overview.kpi.totalSpent")}
          value={fmtMoney(totalSpent)}
          subValue={t("overview.kpi.totalSpentSubtitle", { count: paidOrders.length })}
          icon={Package}
          spark={sparkData.spend}
          tone="amber"
          delay={0.1}
        />
        <KpiCard
          label={t("overview.kpi.openTickets")}
          value={openTickets}
          subValue={openTickets === 0 ? t("overview.kpi.openTicketsNone") : t("overview.kpi.openTicketsAwaiting")}
          icon={Headphones}
          spark={sparkData.tickets}
          tone="blue"
          delay={0.15}
        />
      </div>

      {/* ── Spend trend + Activity timeline ────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Spend trend chart */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)] lg:col-span-2">
          <div className="flex items-baseline justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h3 className="text-card font-bold text-violet">{t("overview.spend.title")}</h3>
              <p className="mt-0.5 text-micro text-charcoal-80/55">{t("overview.spend.subtitle")}</p>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-violet" aria-hidden="true" />
              <span className="font-mono text-meta font-bold tabular-nums text-violet">
                {fmtMoney(spendTrend.reduce((s, b) => s + b.value, 0))}
              </span>
            </div>
          </div>
          <div className="p-5">
            {paidOrders.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Activity className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">{t("overview.spend.emptyTitle")}</p>
                <p className="mt-0.5 text-micro text-charcoal-80/45">{t("overview.spend.emptyBody")}</p>
              </div>
            ) : (
              <SpendChart data={spendTrend} />
            )}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-baseline justify-between border-b border-charcoal-80/8 px-5 py-4">
            <h3 className="text-card font-bold text-violet">{t("overview.activity.title")}</h3>
          </div>
          <div className="p-2">
            {activityFeed.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Clock className="h-6 w-6 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">{t("overview.activity.emptyTitle")}</p>
                <p className="mt-0.5 text-micro text-charcoal-80/45">{t("overview.activity.emptyBody")}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {activityFeed.map((item, idx) => (
                  <ActivityItem
                    key={idx}
                    kind={item.kind}
                    color={item.color}
                    title={item.title}
                    meta={item.meta}
                    href={item.href}
                    when={timeAgo(item.when, t, localeTag)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Active service projects (if any) ───────────────────────────── */}
      {projects.length > 0 && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-baseline justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-card font-bold text-violet">
                <FolderOpen className="h-4 w-4" aria-hidden="true" />
                {t("overview.activeProjects.title")}
              </h3>
              <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
                {t("overview.activeProjects.inProgress", { count: projects.length })}
              </p>
            </div>
            <Link
              to="/dashboard/projects"
              className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
            >
              {t("overview.activeProjects.viewAll")}
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const milestones = p.milestones || []
              const completed = milestones.filter((m) => m.status === "completed").length
              const total = milestones.length || 1
              const progress = (completed / total) * 100
              return (
                <Link
                  key={p.id}
                  to={`/dashboard/projects/${p.id}`}
                  className="rounded-xl border border-charcoal-80/8 bg-[#fafafa] p-4 transition hover:border-violet/20 hover:bg-violet-pale/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-pale text-violet">
                      <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-meta font-bold text-violet">{p.projectName}</div>
                      {p.dueDate && (
                        <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] tabular-nums text-charcoal-80/55">
                          <Calendar className="h-2.5 w-2.5" aria-hidden="true" />
                          {t("overview.activeProjects.due", { date: new Date(p.dueDate).toLocaleDateString(localeTag, { month: "short", day: "numeric" }) })}
                        </div>
                      )}
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="font-mono text-[10px] tabular-nums text-charcoal-80/55">
                          {t("overview.activeProjects.milestonesShort", { done: completed, total })}
                        </span>
                        <span className="font-mono text-[10px] font-bold tabular-nums text-violet">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-charcoal-80/8">
                        <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Notifications preview (only when there are unread) ─────────── */}
      {notifications.unread > 0 && notifications.items.length > 0 && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-baseline justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-card font-bold text-violet">
                <Bell className="h-4 w-4" aria-hidden="true" />
                {t("overview.notifications.title")}
              </h3>
              <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
                {t("overview.notifications.unread", { count: notifications.unread })}
              </p>
            </div>
            <Link
              to="/dashboard/notifications"
              className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
            >
              {t("overview.notifications.viewAll")}
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="divide-y divide-charcoal-80/6">
            {notifications.items.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-meta font-medium text-violet">{n.title || t("overview.notifications.fallback")}</div>
                  {n.message && <div className="mt-0.5 line-clamp-2 text-micro text-charcoal-80/65">{n.message}</div>}
                </div>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-charcoal-80/45">
                  {timeAgo(new Date(n.createdAt), t, localeTag)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent orders + Available downloads ────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Recent orders */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-baseline justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h3 className="text-card font-bold text-violet">{t("overview.recentOrders.title")}</h3>
              <p className="mt-0.5 text-micro text-charcoal-80/55">{t("overview.recentOrders.subtitle")}</p>
            </div>
            <Link
              to="/dashboard/orders"
              className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
            >
              {t("overview.recentOrders.viewAll")}
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CreditCard className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">{t("overview.recentOrders.emptyTitle")}</p>
                <p className="mt-0.5 text-micro text-charcoal-80/45">
                  <Link to="/store" className="font-semibold text-violet hover:underline">{t("overview.recentOrders.emptyLead")}</Link>{t("overview.recentOrders.emptyTail")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal-80/6">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to="/dashboard/orders"
                    className="flex items-center justify-between gap-3 rounded-lg p-3 transition hover:bg-violet-pale/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-meta font-semibold tabular-nums text-violet">
                          #{order.orderNumber || String(order.id).slice(0, 8)}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-charcoal-80/55">
                        {new Date(order.createdAt).toLocaleString(localeTag, {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="font-mono text-meta font-bold tabular-nums text-violet">
                      {fmtMoney(order.totalAmount)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Available downloads */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-baseline justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h3 className="text-card font-bold text-violet">{t("overview.availableDownloads.title")}</h3>
              <p className="mt-0.5 text-micro text-charcoal-80/55">{t("overview.availableDownloads.subtitle")}</p>
            </div>
            <Link
              to="/dashboard/downloads"
              className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
            >
              {t("overview.availableDownloads.library")}
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {recentProducts.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Download className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">{t("overview.availableDownloads.emptyTitle")}</p>
                <p className="mt-0.5 text-micro text-charcoal-80/45">{t("overview.availableDownloads.emptyBody")}</p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal-80/6">
                {recentProducts.map((product, index) => (
                  <Link
                    key={`${product.orderId}-${product.productId}-${index}`}
                    to="/dashboard/downloads"
                    className="flex items-start gap-3 rounded-lg p-3 transition hover:bg-violet-pale/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/15 text-mint">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-meta font-semibold text-violet">{product.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] tabular-nums text-charcoal-80/55">
                        <span>{t("overview.availableDownloads.files", { count: product.filesCount })}</span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(product.createdAt).toLocaleDateString(localeTag, { month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { labelKey: "overview.quickActions.browseStore", to: "/store",              icon: ShoppingBag, primary: true },
            { labelKey: "overview.quickActions.viewOrders",  to: "/dashboard/orders",   icon: CreditCard },
            { labelKey: "overview.quickActions.editProfile", to: "/dashboard/profile",  icon: UserIcon },
            { labelKey: "overview.quickActions.getSupport",  to: "/dashboard/support",  icon: Headphones },
          ].map(({ labelKey, to, icon: Icon, primary }) => (
            <Link
              key={to}
              to={to}
              className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                primary
                  ? "bg-violet text-white hover:bg-violet-deep hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(93,63,211,0.20)]"
                  : "border border-charcoal-80/12 bg-white text-violet hover:border-violet/20 hover:bg-violet-pale"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(labelKey)}</span>
              {primary && <ArrowRight className="ml-auto h-3 w-3 transition group-hover:translate-x-0.5" aria-hidden="true" />}
            </Link>
          ))}
        </div>
      </div>
    </section>
    </>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* SpendChart · 6-month area chart · scopes its own hook for the aria-label */
/* ──────────────────────────────────────────────────────────────────────── */
function SpendChart({ data }) {
  const { t } = useTranslation("dashboard")
  const [hoverIdx, setHoverIdx] = useState(null)
  const W = 800
  const H = 200
  const PAD_X = 32
  const PAD_Y = 24

  const max = Math.max(...data.map((d) => d.value), 1)
  const stepX = (W - PAD_X * 2) / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => {
    const x = PAD_X + i * stepX
    const y = PAD_Y + (1 - d.value / max) * (H - PAD_Y * 2)
    return { ...d, x, y }
  })

  const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ")
  const fillD = `${pathD} L${points[points.length - 1].x},${H - PAD_Y} L${points[0].x},${H - PAD_Y} Z`
  const gridY = [0.25, 0.5, 0.75, 1].map((r) => PAD_Y + r * (H - PAD_Y * 2))

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={t("overview.spend.chartAria")}>
        <defs>
          <linearGradient id="spend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5D3FD3" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#5D3FD3" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {gridY.map((y, i) => (
          <line key={i} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#1A1B23" strokeOpacity="0.08" strokeDasharray="2 4" />
        ))}
        <motion.path d={fillD} fill="url(#spend-grad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }} />
        <motion.path
          d={pathD}
          fill="none"
          stroke="#5D3FD3"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {points.map((p, i) => {
          const halfStep = stepX / 2
          return (
            <g key={i}>
              <rect
                x={p.x - halfStep}
                y={0}
                width={stepX}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: "crosshair" }}
              />
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={hoverIdx === i ? 5 : 3}
                fill="#5D3FD3"
                stroke="white"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.04 }}
              />
              {hoverIdx === i && (
                <line x1={p.x} y1={PAD_Y} x2={p.x} y2={H - PAD_Y} stroke="#5D3FD3" strokeOpacity="0.25" strokeDasharray="3 3" />
              )}
            </g>
          )
        })}
        {points.map((p, i) => (
          <text
            key={`lbl-${i}`}
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
            fill="#1A1B23"
            fillOpacity="0.55"
          >
            {p.label}
          </text>
        ))}
      </svg>
      <AnimatePresence>
        {hoverIdx != null && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute top-2 rounded-lg border border-violet/15 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(93,63,211,0.12)]"
            style={{ left: `${(points[hoverIdx].x / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/55">
              {points[hoverIdx].label}
            </div>
            <div className="mt-0.5 font-mono text-meta font-bold tabular-nums text-violet">
              {fmtMoney(points[hoverIdx].value)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── timeAgo helper · accepts t() so the relative-time bucket localizes.
 * Falls back to native toLocaleDateString for >30d using the supplied tag. */
function timeAgo(date, t, localeTag = undefined) {
  if (!date) return ","
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000)
  if (seconds < 60) return t ? t("overview.timeAgo.justNow") : "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t ? t("overview.timeAgo.minutes", { count: minutes }) : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t ? t("overview.timeAgo.hours", { count: hours }) : `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return t ? t("overview.timeAgo.days", { count: days }) : `${days}d`
  return new Date(date).toLocaleDateString(localeTag, { month: "short", day: "numeric" })
}
