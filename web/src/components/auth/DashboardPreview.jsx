/* ════════════════════════════════════════════════════════════════════════
   DashboardPreview.jsx · v1
   ────────────────────────────────────────────────────────────────────────
   Decorative right-hero widget stack used by AuthShell. Mimics the
   "Transform Data into Cool Insights" dashboard preview from the
   reference design while staying fully on-brand:
     · Royal Violet (#5D3FD3) accent on bars / progress fills
     · Soft Terracotta (#E9C46A) for highlight ticks
     · All mock data is static and decorative — never read from the API.

   Built entirely with Tailwind + inline SVG so the asset budget stays
   zero. All loops are GPU-only (transform / opacity); they shut off
   when prefers-reduced-motion is set.
   ════════════════════════════════════════════════════════════════════════ */

import { m } from "framer-motion"
import {
  ArrowUpRight,
  ChevronRight,
  TrendingUp,
  Users,
  Target,
  CheckCircle2,
} from "lucide-react"

import { useTranslation } from "react-i18next"
// Bar heights for the "Closed Won by Type" chart (5 bars).
const BAR_HEIGHTS = [38, 56, 72, 48, 64]

export default function DashboardPreview({ reduce }) {
  const { t } = useTranslation("common")
  return (
    <div className="grid grid-cols-2 gap-4 xl:gap-5">
      {/* ── Sales Revenue card ────────────────────────────────────────── */}
      <Card delay={0}>
        <CardHeader title={t("auth.preview.salesRevenue")} />
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] font-semibold text-white/60">$</span>
              <span className="font-display text-[22px] font-bold text-white">5,832</span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-white/45">
              {t("auth.preview.revenueTrending")} <span className="text-mint">+12%</span>
            </p>
          </div>
          <Sparkline reduce={reduce} />
        </div>
      </Card>

      {/* ── Sales Targets · circular progress ─────────────────────────── */}
      <Card delay={0.05}>
        <CardHeader title={t("auth.preview.salesTargets")} />
        <div className="mt-3 flex items-center gap-3">
          <CircularProgress value={80} reduce={reduce} />
          <div>
            <div className="font-display text-[18px] font-bold leading-none text-white">
              3,415
              <span className="ml-1 text-[10px] font-medium text-white/40">/ 4,000</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-white/45">
              <span className="text-terracotta">20%</span> below the monthly target
            </p>
          </div>
        </div>
      </Card>

      {/* ── Closed Won by Type · bar chart (spans full width) ──────────── */}
      <Card delay={0.1} className="col-span-2">
        <CardHeader title={t("auth.preview.closedWon")} />
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-[11px] font-semibold text-white/60">$</span>
              <span className="font-display text-[22px] font-bold text-white">11,680</span>
            </div>
            <p className="mt-1 max-w-[14rem] text-[10px] leading-snug text-white/45">
              {t("auth.preview.closedWonGrew")} <span className="text-mint">+$6,450</span> vs. last month.
            </p>
          </div>

          {/* Bar chart */}
          <div className="flex h-16 items-end gap-1.5">
            {BAR_HEIGHTS.map((h, i) => (
              <m.span
                key={i}
                initial={{ scaleY: 0.3, opacity: 0.4 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.4 + i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ height: `${h}%`, transformOrigin: "bottom" }}
                className={`w-3 rounded-sm ${
                  i === 2
                    ? "bg-gradient-to-t from-violet to-violet-light"
                    : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[9px] text-white/35">
          <Legend dotClass="bg-violet" label="Existing" />
          <Legend dotClass="bg-white/30" label="New" />
        </div>
      </Card>

      {/* ── Customer Segmentation · doughnut + breakdown ──────────────── */}
      <Card delay={0.15} className="col-span-2">
        <CardHeader title={t("auth.preview.segmentation")} icon={Users} />
        <div className="mt-3 flex items-center gap-4">
          <Doughnut reduce={reduce} />
          <div className="flex-1 space-y-1.5 text-[10px]">
            <SegmentRow color="bg-violet" label={t("auth.preview.smallBusiness")} value="1,650" delta="+424" />
            <SegmentRow color="bg-violet-light" label="Enterprise" value="350" delta="+24" />
            <SegmentRow color="bg-terracotta" label="Individuals" value="458" delta="+213" />
          </div>
        </div>
      </Card>

      {/* ── Conversion Rates ──────────────────────────────────────────── */}
      <Card delay={0.2}>
        <CardHeader title={t("auth.preview.conversion")} icon={Target} />
        <div className="mt-3 space-y-1.5">
          <ConversionRow label="75.3%" delta="2,424" sub="12,565 visitors" trend="up" />
          <ConversionRow label="24.7%" delta="213" sub="1,421 product sales" trend="down" />
        </div>
      </Card>

      {/* ── Task Completion ───────────────────────────────────────────── */}
      <Card delay={0.25}>
        <CardHeader title={t("auth.preview.completion")} icon={CheckCircle2} />
        <div className="mt-3 flex items-center justify-between">
          <div className="font-display text-[22px] font-bold text-white">
            92<span className="text-[12px] font-semibold text-white/45">%</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-2 py-0.5 text-[9px] font-bold text-mint">
            <TrendingUp className="h-2.5 w-2.5" /> 12%
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
          <m.div
            initial={{ width: "0%" }}
            animate={{ width: "92%" }}
            transition={{ duration: 1.4, delay: 0.6, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-violet to-violet-light"
          />
        </div>
      </Card>
    </div>
  )
}

/* ──────────────────────────── primitives ─────────────────────────────── */

function Card({ children, delay = 0, className = "" }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border border-white/8 bg-white/[0.04] p-3.5 backdrop-blur-sm ${className}`}
    >
      {children}
    </m.div>
  )
}

function CardHeader({ title, icon: Icon }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/55">
        {Icon ? <Icon className="h-3 w-3 text-white/45" /> : null}
        {title}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-white/30" aria-hidden="true" />
    </div>
  )
}

function Sparkline({ reduce }) {
  return (
    <svg
      viewBox="0 0 120 40"
      className="h-9 w-20 shrink-0"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5D3FD3" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#5D3FD3" stopOpacity="0" />
        </linearGradient>
      </defs>
      <m.path
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
        d="M2 30 L18 22 L34 28 L50 12 L66 18 L82 8 L98 14 L118 4"
        stroke="#8B6FE8"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M2 30 L18 22 L34 28 L50 12 L66 18 L82 8 L98 14 L118 4 L118 40 L2 40 Z"
        fill="url(#spark-fill)"
      />
    </svg>
  )
}

function CircularProgress({ value = 0, reduce }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="30"
          cy="30"
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="5"
          fill="none"
        />
        <m.circle
          cx="30"
          cy="30"
          r={radius}
          stroke="#8B6FE8"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-bold text-white">
        {value}%
      </span>
    </div>
  )
}

function Doughnut({ reduce }) {
  // Three-segment doughnut · uses stroke-dasharray for clean segments
  const radius = 26
  const circumference = 2 * Math.PI * radius
  // Segment proportions (must sum to 1)
  const segments = [
    { color: "#5D3FD3", pct: 0.58 }, // Small Business
    { color: "#8B6FE8", pct: 0.13 }, // Enterprise
    { color: "#E9C46A", pct: 0.29 }, // Individuals
  ]
  let cursor = 0
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 70 70" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="35"
          cy="35"
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="7"
          fill="none"
        />
        {segments.map((s, i) => {
          const dash = s.pct * circumference
          const gap = circumference - dash
          const offset = -cursor * circumference
          cursor += s.pct
          return (
            <m.circle
              key={i}
              cx="35"
              cy="35"
              r={radius}
              stroke={s.color}
              strokeWidth="7"
              fill="none"
              strokeDasharray={`${dash} ${gap}`}
              initial={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, delay: 0.4 + i * 0.15, ease: "easeOut" }}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[8.5px] uppercase tracking-wider text-white/40">Total</span>
        <span className="font-display text-[14px] font-bold leading-none text-white">2,758</span>
      </div>
    </div>
  )
}

function Legend({ dotClass, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  )
}

function SegmentRow({ color, label, value, delta }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-white/65">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
        {label}
      </span>
      <span className="flex items-baseline gap-1.5 font-mono text-white/85">
        {value}
        <span className="inline-flex items-center text-[8.5px] font-semibold text-mint">
          <ArrowUpRight className="h-2 w-2" />
          {delta}
        </span>
      </span>
    </div>
  )
}

function ConversionRow({ label, delta, sub, trend }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <div>
        <div className="font-display text-[14px] font-bold leading-none text-white">{label}</div>
        <div className="mt-0.5 text-white/40">{sub}</div>
      </div>
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
          trend === "up" ? "bg-mint/15 text-mint" : "bg-rose/15 text-rose"
        }`}
      >
        <ArrowUpRight
          className={`h-2.5 w-2.5 ${trend === "down" ? "rotate-90" : ""}`}
        />
        {delta}
      </span>
    </div>
  )
}
