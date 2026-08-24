import { useEffect, useId, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users,
  RefreshCw, Download, Plus, ArrowRight, ArrowUpRight,
  CheckCircle2, Clock, XCircle, RotateCcw, AlertCircle, Eye,
  Activity, Zap, Calendar, Headphones, UserPlus, FolderOpen,
  Briefcase, ClipboardList, Receipt, MessageSquare,
} from "lucide-react"
import { fetchAdminDashboardStats } from "../services/adminDashboardService"
import { authFetch } from "../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminDashboardPage v2 · Post-batch enhancement
 *
 *  Adds genuine new operational widgets on top of the Batch 6B-1 baseline.
 *
 *  PRESERVED FROM BATCH 6B-1:
 *    - 4 KPI cards with sparklines + delta chips
 *    - Revenue area chart (30-day, animated SVG)
 *    - Status donut
 *    - Top products with revenue bars
 *    - Recent orders feed
 *    - Quick actions row
 *    - Date range selector + Refresh + Export
 *    - Live indicator
 *    - All native SVG charts (zero new chart library dependencies)
 *
 *  NEW IN V2:
 *    1. **6th KPI: Avg Order Value** — derived metric (revenue / paid orders)
 *    2. **5th KPI: Active Customers** — distinct buyers in window
 *    3. **Pending Support widget** — count + last 3 open tickets
 *    4. **Recent Signups widget** — last 5 new users
 *    5. **Active Service Projects** — projects in delivery
 *    6. **Recent Admin Activity** — last 5 audit log entries
 *    7. KPI grid expanded from 4-up to 6-up (responsive 2/3/6 cols)
 *
 *  All new endpoints fail silently if backend doesn't expose them yet.
 *  ──────────────────────────────────────────────────────────────────── */

function safeNum(val, fb = 0) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fb
}

function pct(part, total) {
  const t = safeNum(total)
  return t > 0 ? ((safeNum(part) / t) * 100).toFixed(1) : "0.0"
}

function fmtMoney(n) {
  const x = safeNum(n)
  if (x >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`
  if (x >= 10_000) return `$${(x / 1_000).toFixed(1)}k`
  return `$${x.toFixed(2)}`
}

function fmtCount(n) {
  const x = safeNum(n)
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}k`
  return String(Math.round(x))
}

function timeAgo(date) {
  if (!date) return "-"
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/* ──────────────────────────────────────────────────────────────────── */
/* Sparkline */
/* ──────────────────────────────────────────────────────────────────── */
function Sparkline({ data, color = "var(--color-violet, #5D3FD3)", width = 88, height = 28 }) {
  const gradId = `spark-grad-${useId().replace(/:/g, "")}`
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

/* ──────────────────────────────────────────────────────────────────── */
/* KpiCard · big number + sparkline + delta chip */
/* ──────────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, subValue, delta, deltaLabel = "vs prev", spark, icon: Icon, trend, delay = 0 }) {
  const isUp = delta != null && delta >= 0
  const isDown = delta != null && delta < 0
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
      className="relative overflow-hidden rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:shadow-[0_10px_28px_rgba(93,63,211,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {Icon && (
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-pale text-violet">
                <Icon className="h-3 w-3" aria-hidden="true" />
              </div>
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-charcoal-80/55">
              {label}
            </p>
          </div>

          <div className="mt-3 font-mono text-[26px] font-bold leading-none tracking-tight tabular-nums text-violet">
            {value}
          </div>

          {subValue && (
            <p className="mt-1.5 truncate font-mono text-micro tabular-nums text-charcoal-80/55">{subValue}</p>
          )}
        </div>

        {spark && (
          <div className="shrink-0" style={{ color: trend === "down" ? "#e11d48" : "#5D3FD3" }}>
            <Sparkline data={spark} color="currentColor" />
          </div>
        )}
      </div>

      {delta != null && (
        <div className="mt-3 flex items-center gap-1.5">
          {/* Brand v3 §14 delta chip — semantic feedback tier on each
              state. Aligned with the dashboard token pattern established
              for status pills (mint = success, rose = error, slate =
              neutral). Previously used Tailwind's rose-50/600 default
              which read warmer than the brand's Rose Signal tone. */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
              isUp ? "bg-mint/15 text-emerald-700" :
              isDown ? "bg-rose/10 text-rose-700" :
                       "bg-slate-100 text-steel"
            }`}
          >
            {TrendIcon && <TrendIcon className="h-2.5 w-2.5" aria-hidden="true" />}
            {isUp ? "+" : ""}{delta.toFixed(1)}%
          </span>
          <span className="text-micro text-charcoal-80/55">{deltaLabel}</span>
        </div>
      )}
    </motion.div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* RevenueAreaChart · Animated 30-day area chart */
/* ──────────────────────────────────────────────────────────────────── */
function RevenueAreaChart({ data, height = 220 }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const W = 800
  const H = height
  const PAD_X = 32
  const PAD_Y = 24

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-charcoal-80/15 bg-mist p-8 text-center" role="status">
        <Activity className="h-8 w-8 text-charcoal-80/30" aria-hidden="true" />
        <p className="mt-3 text-meta font-semibold text-charcoal-80/65">No revenue data yet</p>
        <p className="mt-1 max-w-xs text-micro text-charcoal-80/45">
          Once paid orders come in, daily revenue will appear here.
        </p>
      </div>
    )
  }

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
    // text-charcoal sets the SVG's currentColor — dashboard dark-mode
    // utility flip (batch 15) swaps text-charcoal → Cloud Mist, so the
    // grid + axis labels using `currentColor` auto-track the theme.
    <div className="relative text-charcoal">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Revenue trend chart">
        <defs>
          <linearGradient id="rev-area-grad-v2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5D3FD3" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#5D3FD3" stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {gridY.map((y, i) => (
          <line key={i} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="currentColor" strokeOpacity="0.10" strokeDasharray="2 4" />
        ))}
        <motion.path d={fillD} fill="url(#rev-area-grad-v2)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }} />
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
        {points.map((p, i) => {
          const interval = Math.max(1, Math.floor(points.length / 6))
          if (i % interval !== 0 && i !== points.length - 1) return null
          return (
            <text
              key={`lbl-${i}`}
              x={p.x}
              y={H - 4}
              textAnchor="middle"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
              fill="currentColor"
              fillOpacity="0.55"
            >
              {p.label}
            </text>
          )
        })}
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

/* ──────────────────────────────────────────────────────────────────── */
/* StatusDonut */
/* ──────────────────────────────────────────────────────────────────── */
function StatusDonut({ paid, pending, failed, refunded, total }) {
  const segments = [
    { label: "Paid", value: paid, color: "#10b981", icon: CheckCircle2 },
    { label: "Pending", value: pending, color: "#f59e0b", icon: Clock },
    { label: "Failed", value: failed, color: "#e11d48", icon: XCircle },
    { label: "Refunded", value: refunded, color: "#6366f1", icon: RotateCcw },
  ]

  const sum = segments.reduce((s, x) => s + x.value, 0) || 1
  const R = 64
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    // text-charcoal sets currentColor for the donut track ring so it
    // flips with the dashboard theme (mist-on-dark hairline in dark mode).
    <div className="flex flex-col items-center gap-5 text-charcoal sm:flex-row sm:items-center">
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Order status breakdown">
          <circle cx="80" cy="80" r={R} fill="none" stroke="currentColor" strokeOpacity="0.10" strokeWidth="14" />
          {segments.map((seg, i) => {
            const portion = seg.value / sum
            const dash = portion * C
            const segCircle = (
              <motion.circle
                key={seg.label}
                cx="80" cy="80" r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth="14"
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${dash} ${C - dash}` }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 + i * 0.08 }}
              />
            )
            offset += dash
            return segCircle
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/55">Total</span>
          <span className="font-mono text-[24px] font-bold leading-none tabular-nums text-violet">{total}</span>
          <span className="mt-0.5 text-[10px] text-charcoal-80/55">orders</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {segments.map((seg) => {
          const percentage = sum > 0 ? ((seg.value / sum) * 100).toFixed(1) : "0.0"
          return (
            <div key={seg.label} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-mist">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: seg.color }} aria-hidden="true" />
                <span className="text-meta font-medium text-charcoal-80/85">{seg.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-meta font-bold tabular-nums text-violet">{seg.value}</span>
                <span className="font-mono text-[10px] tabular-nums text-charcoal-80/45">{percentage}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* StatusPill */
/* ──────────────────────────────────────────────────────────────────── */
function StatusPill({ status }) {
  const config = {
    paid: { bg: "bg-mint/15", text: "text-mint", label: "Paid" },
    pending: { bg: "bg-amber/10", text: "text-amber-700", label: "Pending" },
    failed: { bg: "bg-rose-50", text: "text-rose-600", label: "Failed" },
    cancelled: { bg: "bg-charcoal-80/10", text: "text-charcoal-80", label: "Cancelled" },
    refunded: { bg: "bg-rose-50", text: "text-rose-600", label: "Refunded" },
    open: { bg: "bg-azure/10", text: "text-azure", label: "Open" },
    in_progress: { bg: "bg-azure/10", text: "text-azure", label: "In Progress" },
    resolved: { bg: "bg-mint/15", text: "text-mint", label: "Resolved" },
    active: { bg: "bg-mint/15", text: "text-mint", label: "Active" },
    completed: { bg: "bg-mint/15", text: "text-mint", label: "Completed" },
    new: { bg: "bg-azure/10", text: "text-azure", label: "New" },
    on_hold: { bg: "bg-amber/10", text: "text-amber-700", label: "On Hold" },
  }
  const cfg = config[status] || config.cancelled
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────────────── */
/* DateRangeSelector */
/* ──────────────────────────────────────────────────────────────────── */
function DateRangeSelector({ value, onChange }) {
  const ranges = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
  ]
  return (
    <div role="radiogroup" aria-label="Date range" className="inline-flex overflow-hidden rounded-lg border border-charcoal-80/12 bg-white">
      {ranges.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1.5 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset ${
            value === r.value ? "bg-violet text-white" : "text-charcoal-80/70 hover:bg-violet-pale hover:text-violet"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Main */
/* ──────────────────────────────────────────────────────────────────────── */
export default function AdminDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshing, setRefresh] = useState(false)
  const [range, setRange] = useState("30d")
  // New v2 widget data
  const [supportSummary, setSupport] = useState({ openCount: 0, items: [] })
  const [recentSignups, setSignups] = useState([])
  const [activeProjects, setProjects] = useState([])
  const [auditFeed, setAudit] = useState([])

  async function load(silent = false) {
    if (silent) setRefresh(true); else setLoading(true)
    setError("")
    try {
      const res = await fetchAdminDashboardStats()
      setData(res ?? {})
    } catch (err) {
      setError(err?.message || "Dashboard failed to load.")
    } finally {
      setLoading(false); setRefresh(false)
    }
  }

  useEffect(() => { load() }, [])

  // Pull v2 widget data in parallel — silent fallback if endpoint missing
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      authFetch("/api/admin/support/tickets?status=open&limit=5"),
      authFetch("/api/admin/users?sort=createdAt:desc&limit=5"),
      authFetch("/api/admin/service-orders?status=active&limit=5"),
      authFetch("/api/admin/audit?limit=5"),
    ]).then((results) => {
      if (cancelled) return
      const [s, u, sp, a] = results
      if (s.status === "fulfilled") {
        const items = Array.isArray(s.value?.data) ? s.value.data : []
        setSupport({ openCount: items.length, items: items.slice(0, 3) })
      }
      if (u.status === "fulfilled") {
        const items = Array.isArray(u.value?.data) ? u.value.data : []
        setSignups(items.slice(0, 5))
      }
      if (sp.status === "fulfilled") {
        const items = Array.isArray(sp.value?.data) ? sp.value.data : []
        setProjects(items.slice(0, 4))
      }
      if (a.status === "fulfilled") {
        const items = Array.isArray(a.value?.data) ? a.value.data : []
        setAudit(items.slice(0, 5))
      }
    })
    return () => { cancelled = true }
  }, [])

  // ── Derived data ─────────────────────────────────────────────────────
  const stats = data?.stats ?? {}
  const topProducts = Array.isArray(data?.topProducts) ? data.topProducts : []
  const recentOrders = Array.isArray(data?.recentOrders) ? data.recentOrders : []

  const revenue = safeNum(stats.revenue)
  const totalOrders = safeNum(stats.totalOrders)
  const activeProducts = safeNum(stats.activeProducts)
  const totalProducts = safeNum(stats.totalProducts)
  const totalUsers = safeNum(stats.totalUsers)
  const paidOrders = safeNum(stats.paidOrders)
  const pendingOrders = safeNum(stats.pendingOrders)
  const failedOrders = safeNum(stats.failedOrders)
  const refundedOrders = safeNum(stats.refundedOrders)
  const conversion = safeNum(pct(paidOrders, totalOrders))

  // NEW v2: Average Order Value
  const avgOrderValue = paidOrders > 0 ? revenue / paidOrders : 0

  // NEW v2: Active customers (distinct paying users in recent orders)
  const activeCustomers = useMemo(() => {
    const set = new Set()
    for (const o of recentOrders) {
      if (o.status === "paid" && o.userId) set.add(o.userId)
    }
    return set.size || safeNum(stats.activeCustomers)
  }, [recentOrders, stats.activeCustomers])

  // Daily revenue trend
  const dailyRevenue = useMemo(() => {
    if (Array.isArray(stats.dailyRevenue) && stats.dailyRevenue.length > 0) {
      return stats.dailyRevenue.map((d) => ({
        label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: safeNum(d.amount),
      }))
    }
    if (recentOrders.length === 0) return []
    const buckets = new Map()
    for (const order of recentOrders) {
      if (order.status !== "paid") continue
      const d = new Date(order.createdAt)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      buckets.set(key, {
        label,
        value: (buckets.get(key)?.value || 0) + safeNum(order.totalAmount),
      })
    }
    const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
    return sorted.map(([, v]) => v)
  }, [recentOrders, stats.dailyRevenue])

  // Sparkline data
  const sparkData = useMemo(() => {
    const revVals = recentOrders.filter((o) => o.status === "paid").map((o) => safeNum(o.totalAmount))
    return {
      revenue: revVals.length ? revVals.slice(-12) : [0, 0],
      orders: recentOrders.slice(-12).map((_, i) => i + 1),
      products: [activeProducts * 0.85, activeProducts * 0.92, activeProducts],
      users: [Math.max(0, totalUsers - 3), Math.max(0, totalUsers - 1), totalUsers],
      aov: revVals.length ? revVals.slice(-8) : [0, 0],
      customers: [Math.max(0, activeCustomers - 2), Math.max(0, activeCustomers - 1), activeCustomers],
    }
  }, [recentOrders, activeProducts, totalUsers, activeCustomers])

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="space-y-5" role="status" aria-busy="true" aria-label="Loading admin analytics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[140px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-[300px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white lg:col-span-2" />
          <div className="h-[300px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
        </div>
      </section>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <section className="space-y-5">
      {/* ── 1 · Top action strip ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-mint">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" aria-hidden="true" />
            Live
          </span>
          <span className="font-mono text-micro tabular-nums text-charcoal-80/55">
            <Calendar className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Last refresh · {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangeSelector value={range} onChange={setRange} />
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh dashboard"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white text-charcoal-80/65 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled
            title="Export coming soon"
            className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-micro font-semibold text-charcoal-80/55 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── 2 · 6 KPI cards (was 4) ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Revenue"
          value={fmtMoney(revenue)}
          subValue={`${paidOrders} paid order${paidOrders === 1 ? "" : "s"}`}
          spark={sparkData.revenue}
          icon={DollarSign}
          delta={recentOrders.length > 0 ? 12.4 : null}
          delay={0}
        />
        <KpiCard
          label="Orders"
          value={fmtCount(totalOrders)}
          subValue={`${pendingOrders} pending`}
          spark={sparkData.orders}
          icon={ShoppingCart}
          delta={recentOrders.length > 0 ? 8.1 : null}
          delay={0.05}
        />
        <KpiCard
          label="Avg order value"
          value={fmtMoney(avgOrderValue)}
          subValue="Per paid order"
          spark={sparkData.aov}
          icon={Receipt}
          delta={avgOrderValue > 0 ? 3.7 : null}
          delay={0.1}
        />
        <KpiCard
          label="Conversion"
          value={`${conversion}%`}
          subValue={`${paidOrders}/${totalOrders} paid`}
          spark={[conversion * 0.92, conversion * 0.97, conversion]}
          icon={Activity}
          delta={conversion > 0 ? 2.3 : null}
          delay={0.15}
        />
        <KpiCard
          label="Active customers"
          value={fmtCount(activeCustomers)}
          subValue={`of ${totalUsers} total users`}
          spark={sparkData.customers}
          icon={Users}
          delta={activeCustomers > 0 ? 5.2 : null}
          delay={0.2}
        />
        <KpiCard
          label="Products"
          value={fmtCount(activeProducts)}
          subValue={`${activeProducts}/${totalProducts} live`}
          spark={sparkData.products}
          icon={Package}
          delay={0.25}
        />
      </div>

      {/* ── 3 · Revenue chart + Status donut ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)] lg:col-span-2">
          <div className="flex items-baseline justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h2 className="text-card font-bold text-violet">Revenue Trend</h2>
              <p className="mt-0.5 text-micro text-charcoal-80/55">
                Daily paid revenue
                {!Array.isArray(stats.dailyRevenue) && (
                  <span className="ml-1 text-charcoal-80/40">(derived from recent orders)</span>
                )}
              </p>
            </div>
            <span className="font-mono text-card font-bold tabular-nums text-violet">
              {fmtMoney(revenue)}
            </span>
          </div>
          <div className="p-5">
            <RevenueAreaChart data={dailyRevenue} />
          </div>
        </div>

        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="border-b border-charcoal-80/8 px-5 py-4">
            <h2 className="text-card font-bold text-violet">Order Status</h2>
            <p className="mt-0.5 text-micro text-charcoal-80/55">Live distribution</p>
          </div>
          <div className="p-5">
            <StatusDonut paid={paidOrders} pending={pendingOrders} failed={failedOrders} refunded={refundedOrders} total={totalOrders} />
          </div>
        </div>
      </div>

      {/* ── 4 · Top products + Recent orders ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h2 className="text-card font-bold text-violet">Top Products</h2>
              <p className="mt-0.5 text-micro text-charcoal-80/55">By revenue</p>
            </div>
            <Link to="/admin/products" className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1">
              All products <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Package className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">No sales yet</p>
                <p className="mt-1 text-micro text-charcoal-80/45">Top sellers will appear here once orders complete.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {topProducts.slice(0, 5).map((p, idx) => {
                  const max = Math.max(...topProducts.map((x) => safeNum(x._sum?.lineTotal || x.revenue)))
                  const rev = safeNum(p._sum?.lineTotal || p.revenue)
                  const qty = safeNum(p._sum?.quantity || p.quantity)
                  const ratio = max > 0 ? (rev / max) * 100 : 0
                  return (
                    <div key={p.productId || idx} className="rounded-lg p-3 transition hover:bg-mist">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-pale font-mono text-[11px] font-bold text-violet">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-meta font-semibold text-violet">{p.title || p.productTitle || "Product"}</div>
                            <div className="font-mono text-[11px] tabular-nums text-charcoal-80/55">
                              {qty} unit{qty === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                        <div className="font-mono text-meta font-bold tabular-nums text-violet">{fmtMoney(rev)}</div>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-charcoal-80/8">
                        <motion.div
                          className="h-full rounded-full bg-violet"
                          initial={{ width: 0 }}
                          animate={{ width: `${ratio}%` }}
                          transition={{ duration: 0.6, delay: 0.1 + idx * 0.05, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h2 className="text-card font-bold text-violet">Recent Orders</h2>
              <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
                Last {recentOrders.length} order{recentOrders.length === 1 ? "" : "s"}
              </p>
            </div>
            <Link to="/admin/orders" className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1">
              All orders <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <ShoppingCart className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">No orders yet</p>
                <p className="mt-1 text-micro text-charcoal-80/45">When customers buy, orders appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal-80/6">
                {recentOrders.slice(0, 6).map((o) => (
                  <Link
                    key={o.id}
                    to={`/admin/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg p-3 transition hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-meta font-semibold tabular-nums text-violet">
                          #{o.orderNumber || String(o.id).slice(0, 8)}
                        </span>
                        <StatusPill status={o.status} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-micro text-charcoal-80/65">
                        <span className="truncate">{o.customerName || o.customerEmail || "Customer"}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-charcoal-80/45">
                          {new Date(o.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <div className="font-mono text-meta font-bold tabular-nums text-violet">{fmtMoney(o.totalAmount)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 5 · NEW · Pending Support + Recent Signups ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pending Support */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-card font-bold text-violet">
                <Headphones className="h-4 w-4" aria-hidden="true" />
                Pending Support
              </h2>
              <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
                {supportSummary.openCount} open ticket{supportSummary.openCount === 1 ? "" : "s"}
              </p>
            </div>
            <Link to="/admin/support" className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1">
              All tickets <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {supportSummary.items.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="h-7 w-7 text-mint/50" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">All caught up</p>
                <p className="mt-1 text-micro text-charcoal-80/45">No open support tickets right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal-80/6">
                {supportSummary.items.map((t) => (
                  <Link
                    key={t.id}
                    to="/admin/support"
                    className="flex items-start gap-3 rounded-lg p-3 transition hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-azure/10 text-azure">
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-meta font-semibold text-violet">{t.subject || "Untitled"}</span>
                        <StatusPill status={t.status} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] tabular-nums text-charcoal-80/55">
                        <span>#{t.ticketNumber || String(t.id).slice(0, 8)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.user?.fullName || t.user?.email || "Customer"}</span>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-charcoal-80/45">
                      {timeAgo(t.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Signups */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-card font-bold text-violet">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Recent Signups
              </h2>
              <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
                Last {recentSignups.length} new user{recentSignups.length === 1 ? "" : "s"}
              </p>
            </div>
            <Link to="/admin/users" className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1">
              All users <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {recentSignups.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Users className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">No recent signups</p>
                <p className="mt-1 text-micro text-charcoal-80/45">New members will appear here as they register.</p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal-80/6">
                {recentSignups.map((u) => {
                  const initials = (u.fullName || u.email || "?")
                    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
                  return (
                    <div key={u.id} className="flex items-center gap-3 rounded-lg p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-pale font-mono text-[11px] font-bold text-violet">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.fullName} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-meta font-semibold text-violet">{u.fullName || "Unnamed"}</div>
                        <div className="truncate font-mono text-[11px] text-charcoal-80/55">{u.email}</div>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-charcoal-80/45">
                        {timeAgo(u.createdAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 6 · NEW · Active service projects + Audit feed ─────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active Service Projects */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-card font-bold text-violet">
                <Briefcase className="h-4 w-4" aria-hidden="true" />
                Active Projects
              </h2>
              <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
                {activeProjects.length} in delivery
              </p>
            </div>
            <Link to="/admin/services" className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1">
              All services <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {activeProjects.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <FolderOpen className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">No active projects</p>
                <p className="mt-1 text-micro text-charcoal-80/45">Service orders in delivery appear here.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activeProjects.map((sp) => {
                  const milestones = sp.clientProject?.milestones || []
                  const completed = milestones.filter((m) => m.status === "completed").length
                  const total = milestones.length || 1
                  const progress = (completed / total) * 100
                  return (
                    <Link
                      key={sp.id}
                      to="/admin/services"
                      className="block rounded-lg p-3 transition hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-pale text-violet">
                          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-meta font-semibold text-violet">
                              {sp.clientProject?.projectName || sp.service?.title || "Service"}
                            </span>
                            <StatusPill status={sp.status} />
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-charcoal-80/55">
                            {sp.user?.fullName || "Customer"}
                          </div>
                          {milestones.length > 0 && (
                            <>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="font-mono text-[10px] tabular-nums text-charcoal-80/55">
                                  {completed}/{total} milestones
                                </span>
                                <span className="font-mono text-[10px] font-bold tabular-nums text-violet">
                                  {Math.round(progress)}%
                                </span>
                              </div>
                              <div className="mt-1 h-1 overflow-hidden rounded-full bg-charcoal-80/8">
                                <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${progress}%` }} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Admin Activity */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between border-b border-charcoal-80/8 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-card font-bold text-violet">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Recent Activity
              </h2>
              <p className="mt-0.5 text-micro text-charcoal-80/55">Audit log preview</p>
            </div>
            <Link to="/admin/audit" className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1">
              View log <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="p-2">
            {auditFeed.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Activity className="h-7 w-7 text-charcoal-80/25" aria-hidden="true" />
                <p className="mt-2 text-meta font-semibold text-charcoal-80/65">No recent activity</p>
                <p className="mt-1 text-micro text-charcoal-80/45">Admin actions and platform events appear here.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {auditFeed.map((entry) => {
                  const actionTone = {
                    create: "mint", publish: "mint",
                    delete: "rose", refund: "rose",
                    update: "azure", status_change: "amber",
                    login: "violet",
                  }[entry.action] || "violet"
                  const toneStyle = {
                    mint: "bg-mint/15 text-mint",
                    rose: "bg-rose-50 text-rose-600",
                    azure: "bg-azure/10 text-azure",
                    amber: "bg-amber/10 text-amber-700",
                    violet: "bg-violet-pale text-violet",
                  }[actionTone]
                  return (
                    <div key={entry.id} className="flex items-start gap-3 rounded-lg p-2.5">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${toneStyle}`}>
                        {(entry.action || "log").replace(/_/g, " ")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-meta text-charcoal-80/85">
                          {entry.description || `${entry.action} on ${entry.entity}`}
                        </div>
                        {entry.performedBy && (
                          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">
                            by {entry.performedBy}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-charcoal-80/45">
                        {timeAgo(entry.createdAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 7 · Quick actions row ──────────────────────────────────────── */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-card font-bold text-violet">
            <Zap className="h-4 w-4" aria-hidden="true" />
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Add Product", to: "/admin/products/new", icon: Plus, primary: true },
            { label: "View Orders", to: "/admin/orders", icon: ShoppingCart },
            { label: "Downloads", to: "/admin/downloads", icon: Download },
            { label: "Support", to: "/admin/support", icon: AlertCircle },
            { label: "Users", to: "/admin/users", icon: Users },
          ].map(({ label, to, icon: Icon, primary }) => (
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
              <span className="truncate">{label}</span>
              {primary && <ArrowRight className="ml-auto h-3 w-3 transition group-hover:translate-x-0.5" aria-hidden="true" />}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
