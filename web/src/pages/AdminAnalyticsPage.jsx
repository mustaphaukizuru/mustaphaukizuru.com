import { useEffect, useMemo, useState } from "react"
import {
  Activity, BarChart3, MousePointerClick, ShoppingCart,
  CreditCard, DollarSign, TrendingUp, Smartphone, Monitor, Tablet, Bot,
  Loader2, AlertCircle, Receipt, Undo2, Package, Briefcase, Info,
} from "lucide-react"
import { m } from "framer-motion"

import { adminFetchAnalyticsDashboard, adminFetchAnalyticsEvents, adminFetchRevenueReport } from "../services/analyticsService"

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
 *    7. Revenue panel (Tier 4) — monthly paid-order series, service /
 *       package performance, top products. Own month range, own fetch.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets fetch state before syncing with the analytics API
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
          <m.section {...fadeUp} className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
            <KpiCard icon={Activity} label="Pageviews" value={num(kpis.pageviews)} tone="violet" />
            <KpiCard icon={BarChart3} label="Sessions" value={num(kpis.sessions)} tone="azure" />
            <KpiCard icon={MousePointerClick} label="Add to cart" value={num(kpis.addToCart)} tone="cyan" />
            <KpiCard icon={ShoppingCart} label="Begin checkout" value={num(kpis.beginCheckout)} tone="terracotta" />
            <KpiCard icon={CreditCard} label="Purchases" value={num(kpis.purchases)} tone="mint" />
            <KpiCard icon={DollarSign} label="Revenue" value={money(kpis.revenue)} tone="violet" />
            <KpiCard icon={TrendingUp} label="Conversion rate" value={`${(kpis.conversionRate || 0).toFixed(2)}%`} tone="azure" />
          </m.section>

          {/* G4 · Funnel — where sessions drop between view and paid */}
          <m.section {...fadeUp} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-charcoal">Store funnel</h2>
              <span className="text-xs text-charcoal-50">Unique sessions · product view → add to cart → checkout → paid</span>
            </div>
            <FunnelPanel funnel={data.funnel} />
          </m.section>

          {/* Sparkline */}
          <m.section {...fadeUp} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-charcoal">Daily pageviews</h2>
            <Sparkline points={data.daily} />
          </m.section>

          {/* Top paths + Devices side by side */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <m.section {...fadeUp} className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold text-charcoal">Top paths</h2>
              {data.topPaths.length === 0 ? (
                <p className="py-4 text-center text-sm text-charcoal-50">No traffic in this range yet.</p>
              ) : (
                <PathList paths={data.topPaths} />
              )}
            </m.section>

            <m.section {...fadeUp} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-lg font-semibold text-charcoal">Devices</h2>
              {data.devices.length === 0 ? (
                <p className="py-4 text-center text-sm text-charcoal-50">No data.</p>
              ) : (
                <DeviceList devices={data.devices} />
              )}
            </m.section>
          </div>

          {/* Tier 4 · Revenue reporting */}
          <RevenuePanel />

          {/* Recent events */}
          <m.section {...fadeUp} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold text-charcoal">Recent events</h2>
            {events.length === 0 ? (
              <p className="py-4 text-center text-sm text-charcoal-50">No events recorded yet.</p>
            ) : (
              <EventList events={events} />
            )}
          </m.section>
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

/* ─────────────── Funnel (G4) ─────────────── */

function FunnelPanel({ funnel }) {
  const steps = funnel?.steps || []
  if (steps.length === 0 || steps[0].sessions === 0) {
    return <p className="py-4 text-center text-sm text-charcoal-50">No product views in this range yet.</p>
  }
  const top = Math.max(1, steps[0].sessions)
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const width = Math.max(2, Math.round((s.sessions / top) * 100))
        const worst = funnel.biggestDropOff === s.key
        return (
          <li key={s.key}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
              <span className="font-medium text-charcoal">
                {i + 1}. {s.label}
                {worst && (
                  <span className="ml-2 rounded-md bg-terracotta/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal">
                    biggest drop
                  </span>
                )}
              </span>
              <span className="font-mono text-xs tabular-nums text-charcoal-80">
                {num(s.sessions)} sessions
                {i > 0 && <> · {s.stepRate.toFixed(1)}% of previous · {s.overallRate.toFixed(1)}% of views · −{num(s.dropOff)}</>}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${s.label}: ${s.sessions} sessions`}>
              <div
                className={`h-full rounded-full ${worst ? "bg-terracotta" : "bg-violet"}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        )
      })}
    </ol>
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
            <stop offset="0%" stopColor="var(--color-violet)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--color-violet)" stopOpacity="0.00" />
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
        <path d={linePath} fill="none" stroke="var(--color-violet)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--color-violet)">
            <title>{`${c.day}: ${c.val} pageviews`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

/* ─────────────── Revenue panel (Tier 4) ─────────────── */

const REVENUE_RANGES = [
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
]

function RevenuePanel() {
  const [months, setMonths] = useState(12)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets fetch state before syncing with the revenue API
    setLoading(true); setError("")
    adminFetchRevenueReport({ months })
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(e?.message || "Failed to load revenue report.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [months])

  const kpis = report?.kpis || {}
  const currency = report?.currency || "MXN"

  return (
    <m.section {...fadeUp} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-charcoal">Revenue</h2>
          <p className="text-xs text-charcoal-50">Paid orders by payment month · refunds are full-only and net out of the month they were paid in</p>
        </div>
        <div role="tablist" aria-label="Revenue range" className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {REVENUE_RANGES.map((r) => (
            <button
              key={r.value}
              role="tab"
              aria-selected={months === r.value}
              onClick={() => setMonths(r.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 ${
                months === r.value ? "bg-violet text-white" : "text-charcoal-80 hover:bg-slate-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {loading || !report ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard icon={DollarSign} label="Gross" value={money(kpis.gross, currency)} tone="violet" />
            <KpiCard icon={Undo2} label="Refunded" value={money(kpis.refunded, currency)} tone="terracotta" />
            <KpiCard icon={TrendingUp} label="Net" value={money(kpis.net, currency)} tone="mint" />
            <KpiCard icon={Receipt} label="Paid orders" value={num(kpis.orders)} tone="azure" />
            <KpiCard icon={CreditCard} label="Avg order value" value={money(kpis.aov, currency)} tone="cyan" />
            <KpiCard icon={Undo2} label="Refund rate" value={`${(kpis.refundRate || 0).toFixed(1)}%`} tone="terracotta" />
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-charcoal-50">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
            <span>MRR: not available — {kpis.mrrNote}</span>
          </p>
          {report.truncated && (
            <p className="mt-1 text-xs text-charcoal-80">Only the newest 5,000 paid orders were counted; older months may be incomplete.</p>
          )}

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-charcoal">Monthly gross vs net</h3>
            <RevenueBars series={report.series} currency={currency} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RevenueTable
              icon={Briefcase}
              title="Services"
              empty="No service revenue in this range."
              rows={report.services.map((s) => ({ key: s.serviceId || s.name, name: s.name, revenue: s.revenue, count: s.count }))}
              currency={currency}
            />
            <RevenueTable
              icon={Package}
              title="Packages"
              empty="No package revenue in this range."
              rows={report.packages.map((p) => ({ key: p.servicePackageId, name: p.name, sub: p.serviceName, revenue: p.revenue, count: p.count }))}
              currency={currency}
            />
            <RevenueTable
              icon={ShoppingCart}
              title="Top products"
              empty="No product revenue in this range."
              rows={report.topProducts.map((p) => ({ key: p.productId || p.title, name: p.title, revenue: p.revenue, count: p.count }))}
              currency={currency}
            />
          </div>
        </>
      )}
    </m.section>
  )
}

/* Grouped bars, inline SVG — same no-chart-lib approach as Sparkline. */
function RevenueBars({ series, currency }) {
  const W = 800, H = 220, PAD_X = 16, PAD_Y = 18, LABEL_H = 22

  if (!Array.isArray(series) || series.length === 0) {
    return <p className="py-8 text-center text-sm text-charcoal-50">No revenue data yet.</p>
  }
  const max = Math.max(1, ...series.map((s) => s.gross))
  const plotH = H - 2 * PAD_Y - LABEL_H
  const slot = (W - 2 * PAD_X) / series.length
  const barW = Math.max(3, Math.min(28, slot * 0.34))
  const baseY = PAD_Y + plotH
  const hOf = (v) => (v / max) * plotH

  return (
    <div className="-mx-1 overflow-x-auto text-charcoal">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Monthly gross and net revenue">
        {[0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = baseY - t * plotH
          return <line key={i} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="currentColor" strokeOpacity="0.10" strokeDasharray="2 4" />
        })}
        <line x1={PAD_X} y1={baseY} x2={W - PAD_X} y2={baseY} stroke="currentColor" strokeOpacity="0.25" />
        {series.map((s, i) => {
          const cx = PAD_X + slot * (i + 0.5)
          const gH = hOf(s.gross), nH = hOf(Math.max(0, s.net))
          return (
            <g key={s.month}>
              <rect x={cx - barW - 1} y={baseY - gH} width={barW} height={gH} rx="2" fill="var(--color-violet)" fillOpacity="0.35">
                <title>{`${s.month} · gross ${money(s.gross, currency)} · ${s.count} orders`}</title>
              </rect>
              <rect x={cx + 1} y={baseY - nH} width={barW} height={nH} rx="2" fill="var(--color-violet)">
                <title>{`${s.month} · net ${money(s.net, currency)} · refunded ${money(s.refunded, currency)}`}</title>
              </rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.6" fontFamily="var(--font-mono, monospace)">
                {s.month.slice(2)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-charcoal-50">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet/35" />Gross</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet" />Net</span>
      </div>
    </div>
  )
}

function RevenueTable({ icon: Icon, title, rows, empty, currency }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-charcoal">
        <Icon className="h-4 w-4 text-violet" strokeWidth={1.75} />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-charcoal-50">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-charcoal-50">
                <th className="py-1 pr-2 font-semibold">Name</th>
                <th className="py-1 pr-2 text-right font-semibold">Revenue</th>
                <th className="py-1 text-right font-semibold">Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-1.5 pr-2">
                    <div className="truncate font-medium text-charcoal">{r.name}</div>
                    {r.sub && <div className="truncate text-xs text-charcoal-50">{r.sub}</div>}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-charcoal">{money(r.revenue, currency)}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-charcoal-80">{num(r.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
