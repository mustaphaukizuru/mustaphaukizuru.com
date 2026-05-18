import { useEffect, useMemo, useState } from "react"
import {
  Activity, BarChart3, MousePointerClick, ShoppingCart,
  CreditCard, DollarSign, TrendingUp, Smartphone, Monitor, Tablet, Bot,
  Loader2, AlertCircle,
} from "lucide-react"
import { motion } from "framer-motion"

import { adminFetchAnalyticsDashboard, adminFetchAnalyticsEvents } from "../services/analyticsService"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminAnalyticsPage · M14
 *
 *  Privacy-first analytics dashboard. All data comes from server-side
 *  PageView + AnalyticsEvent rows; no third-party trackers, no cookies.
 *
 *  Layout:
 *    1. Range selector (7 / 30 / 90 days)
 *    2. KPI grid: pageviews · sessions · add-to-cart · begin-checkout ·
 *       purchases · revenue · conversion rate
 *    3. Sparkline of daily pageviews
 *    4. Top paths table
 *    5. Device breakdown
 *    6. Recent events feed
 *  ──────────────────────────────────────────────────────────────────── */

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
]

const DEVICE_ICONS = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  bot: Bot,
  unknown: Activity,
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
}

function num(n) {
  return Number(n || 0).toLocaleString("en-US")
}

function money(n, currency = "MXN") {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(Number(n || 0))
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError("")
    Promise.all([
      adminFetchAnalyticsDashboard({ days }),
      adminFetchAnalyticsEvents({ days: Math.min(days, 30), limit: 50 }),
    ])
      .then(([dashboard, eventList]) => {
        if (cancelled) return
        setData(dashboard)
        setEvents(eventList)
      })
      .catch((e) => { if (!cancelled) setError(e?.message || "Failed to load analytics.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days])

  const kpis = data?.kpis || {}

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-charcoal tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-charcoal-80">
            Privacy-first server-side analytics. No cookies, no third-party trackers.
          </p>
        </div>
        <div role="tablist" aria-label="Time range" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              role="tab"
              aria-selected={days === r.value}
              onClick={() => setDays(r.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 ${
                days === r.value
                  ? "bg-violet text-white"
                  : "text-charcoal-80 hover:bg-slate-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {loading || !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-violet" />
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <motion.section {...fadeUp} className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
            <KpiCard icon={Activity} label="Pageviews" value={num(kpis.pageviews)} tone="violet" />
            <KpiCard icon={BarChart3} label="Sessions" value={num(kpis.sessions)} tone="azure" />
            <KpiCard icon={MousePointerClick} label="Add to cart" value={num(kpis.addToCart)} tone="cyan" />
            <KpiCard icon={ShoppingCart} label="Begin checkout" value={num(kpis.beginCheckout)} tone="terracotta" />
            <KpiCard icon={CreditCard} label="Purchases" value={num(kpis.purchases)} tone="mint" />
            <KpiCard icon={DollarSign} label="Revenue" value={money(kpis.revenue)} tone="violet" />
            <KpiCard icon={TrendingUp} label="Conversion rate" value={`${(kpis.conversionRate || 0).toFixed(2)}%`} tone="azure" />
          </motion.section>

          {/* Sparkline */}
          <motion.section {...fadeUp} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-charcoal">Daily pageviews</h2>
            <Sparkline points={data.daily} />
          </motion.section>

          {/* Top paths + Devices side by side */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <motion.section {...fadeUp} className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold text-charcoal">Top paths</h2>
              {data.topPaths.length === 0 ? (
                <p className="py-4 text-center text-sm text-charcoal-50">No traffic in this range yet.</p>
              ) : (
                <PathList paths={data.topPaths} />
              )}
            </motion.section>

            <motion.section {...fadeUp} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold text-charcoal">Devices</h2>
              {data.devices.length === 0 ? (
                <p className="py-4 text-center text-sm text-charcoal-50">No data.</p>
              ) : (
                <DeviceList devices={data.devices} />
              )}
            </motion.section>
          </div>

          {/* Recent events */}
          <motion.section {...fadeUp} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-charcoal">Recent events</h2>
            {events.length === 0 ? (
              <p className="py-4 text-center text-sm text-charcoal-50">No events recorded yet.</p>
            ) : (
              <EventList events={events} />
            )}
          </motion.section>
        </>
      )}
    </div>
  )
}

/* ─────────────── KPI Card ─────────────── */

const TONES = {
  violet: { bg: "bg-violet-pale", fg: "text-violet" },
  azure: { bg: "bg-azure/10", fg: "text-azure" },
  cyan: { bg: "bg-cyan/15", fg: "text-azure" },
  terracotta: { bg: "bg-terracotta/15", fg: "text-charcoal" },
  mint: { bg: "bg-mint/15", fg: "text-mint" },
}

function KpiCard({ icon: Icon, label, value, tone = "violet" }) {
  const t = TONES[tone] || TONES.violet
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.fg}`}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-charcoal-50">{label}</div>
      <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-charcoal">{value}</div>
    </div>
  )
}

/* ─────────────── Sparkline (inline SVG, no chart lib) ─────────────── */

function Sparkline({ points }) {
  const W = 800, H = 200, PAD_X = 16, PAD_Y = 18

  if (!Array.isArray(points) || points.length === 0) {
    return <p className="py-8 text-center text-sm text-charcoal-50">No traffic data yet.</p>
  }

  const values = points.map((p) => p.pageviews)
  const max = Math.max(1, ...values)
  const stepX = (W - 2 * PAD_X) / Math.max(1, points.length - 1)

  const coords = points.map((p, i) => ({
    x: PAD_X + i * stepX,
    y: H - PAD_Y - (p.pageviews / max) * (H - 2 * PAD_Y),
    day: p.day, val: p.pageviews,
  }))

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${H - PAD_Y} L ${coords[0].x.toFixed(1)} ${H - PAD_Y} Z`

  return (
    // text-charcoal sets the SVG's currentColor — in dashboard dark
    // mode the global utility flip (batch 15) swaps text-charcoal to
    // Cloud Mist, so grid lines that use stroke="currentColor" stay
    // visible against the dark canvas without per-element overrides.
    <div className="-mx-1 overflow-x-auto text-charcoal">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Daily pageviews trend">
        <defs>
          <linearGradient id="sparklineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5D3FD3" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#5D3FD3" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {/* horizontal grid — currentColor inherits from the parent's
            text color, which auto-flips with the theme. opacity stays
            low so the grid never competes with the data line. */}
        {[0.25, 0.5, 0.75].map((t, i) => {
          const y = PAD_Y + t * (H - 2 * PAD_Y)
          return <line key={i} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="currentColor" strokeOpacity="0.10" strokeDasharray="2 4" />
        })}
        <path d={areaPath} fill="url(#sparklineFill)" />
        <path d={linePath} fill="none" stroke="#5D3FD3" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill="#5D3FD3">
            <title>{`${c.day}: ${c.val} pageviews`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

/* ─────────────── Top paths bar list ─────────────── */

function PathList({ paths }) {
  const max = Math.max(1, ...paths.map((p) => p.views))
  return (
    <ul className="space-y-2">
      {paths.map((p) => {
        const pct = (p.views / max) * 100
        return (
          <li key={p.path}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-mono text-charcoal-80">{p.path}</span>
              <span className="font-mono font-semibold tabular-nums text-charcoal">{num(p.views)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={p.views}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={`${p.path}: ${p.views} views`}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ─────────────── Device list ─────────────── */

function DeviceList({ devices }) {
  const total = devices.reduce((sum, d) => sum + d.views, 0) || 1
  return (
    <ul className="space-y-3">
      {devices.map((d) => {
        const Icon = DEVICE_ICONS[d.device] || DEVICE_ICONS.unknown
        const pct = ((d.views / total) * 100).toFixed(1)
        return (
          <li key={d.device} className="flex items-center gap-3">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-pale text-violet">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize text-charcoal">{d.device}</span>
                <span className="font-mono tabular-nums text-charcoal-80">{pct}%</span>
              </div>
              <div className="font-mono text-xs tabular-nums text-charcoal-50">{num(d.views)} views</div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ─────────────── Event list ─────────────── */

function EventList({ events }) {
  const grouped = useMemo(() => {
    const counts = events.reduce((acc, e) => {
      acc[e.name] = (acc[e.name] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [events])

  return (
    <div>
      {/* Summary by name */}
      <div className="mb-4 flex flex-wrap gap-2">
        {grouped.map(([name, count]) => (
          <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs">
            <span className="font-mono font-semibold text-charcoal">{count}</span>
            <span className="text-charcoal-80">{name}</span>
          </span>
        ))}
      </div>

      {/* Recent feed (most recent 20) */}
      <ul className="divide-y divide-slate-100">
        {events.slice(0, 20).map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <span className="font-mono font-semibold text-violet">{e.name}</span>
              {e.path && <span className="ml-2 font-mono text-charcoal-50">{e.path}</span>}
            </div>
            <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-charcoal-50">
              {e.amount != null && <span className="font-semibold text-charcoal">{money(e.amount)}</span>}
              <time>{new Date(e.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
