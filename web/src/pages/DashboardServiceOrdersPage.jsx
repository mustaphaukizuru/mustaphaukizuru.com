import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m } from "framer-motion"
import {
  Briefcase, Calendar, Clock, CheckCircle2, AlertCircle, Pause, XCircle,
  ChevronRight, Loader2, MessageSquare, Folder, FileText, ArrowRight,
} from "lucide-react"

import { fetchMyServiceOrders } from "../services/serviceOrderService"
import useApiQuery from "../hooks/useApiQuery"

/**
 * DashboardServiceOrdersPage · #5
 *
 * Member-facing tracker for ServiceOrder rows. Each row corresponds to a
 * service the user purchased — typically a consulting package. Status
 * machine: new → active → completed (or on_hold / cancelled).
 *
 * I18N · Phase 119A — STATUS_META labels + descriptions, empty state,
 * card chips, and CTA buttons all keyed under `dashboard.serviceOrders.*`.
 * Status keys mirror the backend enum so we can derive the i18n key
 * directly from `order.status`.
 */

const STATUS_VISUAL = {
  new:       { Icon: Clock,        fg: "text-azure-deep",  bg: "bg-azure/10",   ring: "ring-azure/20" },
  active:    { Icon: Briefcase,    fg: "text-violet", bg: "bg-violet-pale", ring: "ring-violet/20" },
  on_hold:   { Icon: Pause,        fg: "text-amber-700",  bg: "bg-amber/10",   ring: "ring-amber/20" },
  completed: { Icon: CheckCircle2, fg: "text-mint-700",   bg: "bg-mint/15",    ring: "ring-mint/25" },
  cancelled: { Icon: XCircle,      fg: "text-rose",   bg: "bg-rose/10",    ring: "ring-rose/20" },
}

const STATUS_ORDER = ["new", "active", "completed"]

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
}

function fmtDate(iso) {
  if (!iso) return ","
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return String(iso)
  }
}

export default function DashboardServiceOrdersPage() {
  const { t } = useTranslation("dashboard")
  const { data: orders = [], loading, error } = useApiQuery(
    "serviceOrders",
    () => fetchMyServiceOrders(),
    { select: (data) => (Array.isArray(data) ? data : []) }
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose/30 bg-rose/5 p-4 text-meta text-rose">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-pale text-violet">
          <Briefcase className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-card font-bold text-charcoal">{t("serviceOrders.empty.title")}</h2>
        <p className="max-w-sm text-meta text-charcoal-80/65">
          {t("serviceOrders.empty.body")}
        </p>
        <Link
          to="/services"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
        >
          {t("serviceOrders.empty.browseServices")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <ServiceOrderCard key={o.id} order={o} />
      ))}
    </div>
  )
}

function ServiceOrderCard({ order }) {
  const { t } = useTranslation("dashboard")
  const visual = STATUS_VISUAL[order.status] || STATUS_VISUAL.new
  const StatusIcon = visual.Icon
  const statusLabel = t(`serviceOrders.status.${order.status}.label`)
  const statusDesc  = t(`serviceOrders.status.${order.status}.desc`)

  const consultCount = useMemo(() => Array.isArray(order.consultations) ? order.consultations.length : 0, [order])
  const milestoneCount = useMemo(() => {
    const m = order.clientProject?.milestones
    return Array.isArray(m) ? m.length : 0
  }, [order])

  return (
    <m.article
      {...fadeUp}
      className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_4px_18px_rgb(var(--color-violet-rgb)/0.04)]"
    >
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${visual.bg} ${visual.fg} ${visual.ring}`}>
              <StatusIcon className="h-3 w-3" aria-hidden="true" /> {statusLabel}
            </span>
            <span className="font-mono text-[11px] text-charcoal-80/45">
              #{(order.id || "").slice(-8).toUpperCase()}
            </span>
          </div>

          <h3 className="mt-2 text-card font-bold leading-snug text-charcoal">
            {order.service?.title || t("serviceOrders.card.fallbackTitle")}
          </h3>
          {order.servicePackage?.title && (
            <p className="mt-0.5 font-mono text-micro text-charcoal-80/65">
              {t("serviceOrders.card.package", { name: order.servicePackage.title })}
            </p>
          )}

          <p className="mt-3 text-meta text-charcoal-80/75">{statusDesc}</p>

          {/* Step indicator */}
          {order.status !== "cancelled" && order.status !== "on_hold" && (
            <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={t("serviceOrders.card.stepperLabel")}>
              {STATUS_ORDER.map((step, idx) => {
                const reachedIndex = STATUS_ORDER.indexOf(order.status)
                const reached = reachedIndex >= idx
                const stepVisual = STATUS_VISUAL[step]
                return (
                  <li key={step} className="flex flex-col items-center gap-1.5 text-center">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${
                        reached
                          ? `${stepVisual.bg} ${stepVisual.fg} ring-2 ${stepVisual.ring}`
                          : "bg-mist text-charcoal-80/35 ring-1 ring-charcoal-80/10"
                      }`}
                      aria-current={order.status === step ? "step" : undefined}
                    >
                      {idx + 1}
                    </div>
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${reached ? "text-charcoal" : "text-charcoal-80/45"}`}>
                      {t(`serviceOrders.status.${step}.label`)}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}

          {/* Side-info chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {order.startDate && (
              <Chip Icon={Calendar} label={t("serviceOrders.card.started")} value={fmtDate(order.startDate)} />
            )}
            {order.endDate && (
              <Chip Icon={Calendar} label={t("serviceOrders.card.endTarget")} value={fmtDate(order.endDate)} />
            )}
            <Chip Icon={MessageSquare} label={t("serviceOrders.card.consultations")} value={consultCount} />
            <Chip Icon={Folder} label={t("serviceOrders.card.milestones")} value={milestoneCount} />
          </div>
        </div>

        {/* Actions column */}
        <div className="flex items-center sm:flex-col sm:items-stretch sm:gap-2">
          <Link
            to={`/dashboard/service-orders/${order.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
          >
            {t("serviceOrders.card.viewDetails")} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            to="/dashboard/support"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-charcoal-80/15 px-4 py-2 text-micro font-semibold text-charcoal-80/75 transition hover:border-violet/30 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {t("serviceOrders.card.openTicket")}
          </Link>
        </div>
      </div>
    </m.article>
  )
}

function Chip({ Icon, label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/10 bg-mist px-2 py-1 text-[11px] text-charcoal-80/75">
      <Icon className="h-3 w-3 text-charcoal-80/55" aria-hidden="true" />
      <span className="font-mono uppercase tracking-wider text-charcoal-80/55">{label}:</span>
      <span className="font-semibold text-charcoal">{value}</span>
    </span>
  )
}
