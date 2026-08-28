import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { m } from "framer-motion"
import {
  Sparkles, ArrowRight, ArrowUpRight, ShoppingBag, Download, Calendar,
  FolderOpen, Headphones, User as UserIcon, Video, AlertCircle, RefreshCw,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { fetchMyOrders } from "../services/orderService"
import { fetchMyConsultations, formatDateTime, getBrowserTimezone } from "../services/bookingService"
import { fetchMyProjects } from "../services/clientProjectService"
import { authGet } from "../lib/api"
import { StatusBadge } from "../components/ui/index"
import useApiQuery from "../hooks/useApiQuery"

/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardPage · Overview · roadmap step 29
 *
 *  One screen, five blocks — orders, downloads, next consultation, active
 *  projects, open support tickets — each fed by useApiQuery (shared cache
 *  with the detail pages, so navigating into a section is instant) and each
 *  linking to its page. Every empty state carries exactly one next action.
 *  ──────────────────────────────────────────────────────────────────── */

const ACTIVE_CONSULTATION = ["pending", "confirmed", "scheduled"]
const CLOSED_PROJECT = ["completed", "cancelled", "archived"]
const OPEN_TICKET = ["open", "pending"]

function fmtMoney(n) {
  const x = Number(n)
  return `$${(Number.isFinite(x) ? x : 0).toFixed(2)}`
}

function computeProfileCompletion(user) {
  if (!user) return { percent: 0, missing: [] }
  const checks = [
    { i18nKey: "overview.profileWidget.fields.fullName", present: Boolean(user.fullName) },
    { i18nKey: "overview.profileWidget.fields.email",    present: Boolean(user.email) },
    { i18nKey: "overview.profileWidget.fields.avatar",   present: Boolean(user.avatarUrl) },
    { i18nKey: "overview.profileWidget.fields.phone",    present: Boolean(user.phone) },
    { i18nKey: "overview.profileWidget.fields.country",  present: Boolean(user.country) },
    { i18nKey: "overview.profileWidget.fields.bio",      present: Boolean(user.bio) },
  ]
  const filled = checks.filter((c) => c.present).length
  return {
    percent: Math.round((filled / checks.length) * 100),
    missing: checks.filter((c) => !c.present).map((c) => c.i18nKey),
  }
}

const asList = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [])

/* ── Block · shared card chrome with loading / error / empty handling ──── */
function Block({ title, icon: Icon, to, linkLabel, query, empty, children, className = "" }) {
  const { t } = useTranslation("dashboard")
  return (
    <div className={`flex flex-col rounded-xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e3)] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-charcoal-80/8 px-5 py-4">
        <h3 className="flex items-center gap-2 text-card font-bold text-violet">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {title}
        </h3>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-micro font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
        >
          {linkLabel}
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      <div className="flex-1 p-4">
        {query.loading ? (
          <div role="status" aria-busy="true" className="space-y-2">
            <div className="h-10 animate-pulse rounded-lg bg-violet-pale/50" />
            <div className="h-10 animate-pulse rounded-lg bg-violet-pale/50" />
          </div>
        ) : query.error ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-rose/20 bg-rose/5 px-3 py-2.5 text-micro text-rose-700">
            <span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{query.error}</span>
            <button
              type="button"
              onClick={query.refetch}
              className="inline-flex items-center gap-1 rounded-md border border-rose/20 bg-white px-2 py-1 font-semibold text-rose-700 transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              {t("overview.blocks.retry")}
            </button>
          </div>
        ) : empty ? (
          <EmptyBlock {...empty} />
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function EmptyBlock({ title, body, ctaLabel, ctaTo }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-6 text-center">
      <p className="text-meta font-semibold text-charcoal-80/65">{title}</p>
      {body && <p className="mt-0.5 max-w-xs text-micro text-charcoal-80/65">{body}</p>}
      <Link
        to={ctaTo}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
      >
        {ctaLabel}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const { user } = useAuth()

  const orders        = useApiQuery("orders",        () => fetchMyOrders(), { select: asList })
  const consultations = useApiQuery("consultations", () => fetchMyConsultations(), { select: asList })
  const projects      = useApiQuery("projects",      () => fetchMyProjects(), { select: asList })
  const tickets       = useApiQuery("support:tickets", () => authGet("/api/member/support/tickets"), { select: asList })

  const orderList = useMemo(() => orders.data || [], [orders.data])
  const recentOrders = useMemo(() => orderList.slice(0, 3), [orderList])
  // Snapshot once per mount — Date.now() inside useMemo trips the purity rule.
  const [now] = useState(() => Date.now())
  const downloadsCount = useMemo(() => {
    let count = 0
    for (const order of orderList) {
      if (order.status !== "paid") continue
      for (const item of order.items || []) count += item.product?.files?.length || 0
    }
    return count
  }, [orderList])

  const nextConsultation = useMemo(() => {
    return (consultations.data || [])
      .filter((c) => ACTIVE_CONSULTATION.includes(c.status) && new Date(c.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null
  }, [consultations.data, now])

  const activeProjects = useMemo(
    () => (projects.data || []).filter((p) => !CLOSED_PROJECT.includes(p.projectStatus ?? p.status)),
    [projects.data]
  )
  const latestMilestone = useMemo(() => {
    const p = activeProjects[0]
    if (!p) return null
    const ms = p.milestones || []
    const m = ms.find((x) => x.status !== "completed") || ms[ms.length - 1]
    return m ? { project: p, milestone: m } : { project: p, milestone: null }
  }, [activeProjects])

  const openTickets = useMemo(
    () => (tickets.data || []).filter((tx) => OPEN_TICKET.includes(tx.status)),
    [tickets.data]
  )

  const profileStats = useMemo(() => computeProfileCompletion(user), [user])
  const missingPreview = profileStats.missing.slice(0, 3).map((k) => t(k)).join(", ")
  const adminPreview = user?.role === "admin"
  const tz = getBrowserTimezone()

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
        {/* ── Welcome banner ─────────────────────────────────────────── */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]"
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
              <p className="mt-1.5 max-w-2xl text-meta leading-6 text-charcoal-80/70">{t("overview.welcome.subtitle")}</p>
            </div>
            <Link
              to="/store"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet px-4 py-2.5 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[var(--shadow-lift-4)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              {t("overview.welcome.browseStore")}
            </Link>
          </div>
        </m.div>

        {/* ── Profile completion (only when < 100%) ──────────────────── */}
        {profileStats.percent < 100 && (
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e3)]">
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
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-violet-pale" role="progressbar" aria-valuenow={profileStats.percent} aria-valuemin={0} aria-valuemax={100}>
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
          </div>
        )}

        {/* ── Summary blocks ─────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Orders · last 3 */}
          <Block
            title={t("overview.blocks.orders.title")}
            icon={ShoppingBag}
            to="/dashboard/orders"
            linkLabel={t("overview.blocks.viewAll")}
            query={orders}
            empty={recentOrders.length === 0 && {
              title: t("overview.blocks.orders.emptyTitle"),
              body: t("overview.blocks.orders.emptyBody"),
              ctaLabel: t("overview.blocks.orders.emptyCta"),
              ctaTo: "/store",
            }}
          >
            <div className="divide-y divide-charcoal-80/6">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg p-2.5 transition hover:bg-violet-pale/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-meta font-semibold tabular-nums text-violet">#{order.orderNumber || String(order.id).slice(0, 8)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-charcoal-80/65">
                      {new Date(order.createdAt).toLocaleDateString(localeTag, { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className="font-mono text-meta font-bold tabular-nums text-violet">{fmtMoney(order.totalAmount)}</div>
                </Link>
              ))}
            </div>
          </Block>

          {/* Downloads · count */}
          <Block
            title={t("overview.blocks.downloads.title")}
            icon={Download}
            to="/dashboard/downloads"
            linkLabel={t("overview.blocks.downloads.link")}
            query={orders}
            empty={downloadsCount === 0 && {
              title: t("overview.blocks.downloads.emptyTitle"),
              body: t("overview.blocks.downloads.emptyBody"),
              ctaLabel: t("overview.blocks.downloads.emptyCta"),
              ctaTo: "/store",
            }}
          >
            <Link
              to="/dashboard/downloads"
              className="flex h-full items-center gap-4 rounded-lg p-2.5 transition hover:bg-violet-pale/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mint/15 text-mint">
                <Download className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[28px] font-bold leading-none tabular-nums text-violet">{downloadsCount}</div>
                <div className="mt-1.5 text-micro text-charcoal-80/65">{t("overview.blocks.downloads.count", { count: downloadsCount })}</div>
              </div>
            </Link>
          </Block>

          {/* Next consultation */}
          <Block
            title={t("overview.blocks.consultation.title")}
            icon={Calendar}
            to="/dashboard/consultations"
            linkLabel={t("overview.blocks.viewAll")}
            query={consultations}
            empty={!nextConsultation && {
              title: t("overview.blocks.consultation.emptyTitle"),
              body: t("overview.blocks.consultation.emptyBody"),
              ctaLabel: t("overview.blocks.consultation.emptyCta"),
              ctaTo: "/book",
            }}
          >
            {nextConsultation && (
              <div className="flex h-full flex-col justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={nextConsultation.status} />
                    <span className="text-[11px] text-charcoal-80/65">{nextConsultation.service?.title || t("overview.blocks.consultation.fallbackService")}</span>
                  </div>
                  <div className="mt-2 text-[15px] font-bold text-violet">{formatDateTime(nextConsultation.scheduledAt, nextConsultation.timezone || tz)}</div>
                  {nextConsultation.assignedAdmin?.fullName && (
                    <div className="mt-0.5 text-micro text-charcoal-80/65">{t("overview.blocks.consultation.with", { name: nextConsultation.assignedAdmin.fullName })}</div>
                  )}
                </div>
                {nextConsultation.meetingLink ? (
                  <a
                    href={nextConsultation.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
                  >
                    <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("overview.blocks.consultation.join")}
                  </a>
                ) : (
                  <p className="text-micro text-charcoal-80/65">{t("overview.blocks.consultation.linkPending")}</p>
                )}
              </div>
            )}
          </Block>

          {/* Active projects */}
          <Block
            title={t("overview.blocks.projects.title")}
            icon={FolderOpen}
            to="/dashboard/projects"
            linkLabel={t("overview.blocks.viewAll")}
            query={projects}
            empty={activeProjects.length === 0 && {
              title: t("overview.blocks.projects.emptyTitle"),
              body: t("overview.blocks.projects.emptyBody"),
              ctaLabel: t("overview.blocks.projects.emptyCta"),
              ctaTo: "/services",
            }}
          >
            {latestMilestone && (
              <Link
                to={`/dashboard/projects/${latestMilestone.project.id}`}
                className="flex h-full flex-col justify-between gap-3 rounded-lg p-2.5 transition hover:bg-violet-pale/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
              >
                <div className="flex items-center gap-4">
                  <div className="font-mono text-[28px] font-bold leading-none tabular-nums text-violet">{activeProjects.length}</div>
                  <div className="text-micro text-charcoal-80/65">{t("overview.blocks.projects.active", { count: activeProjects.length })}</div>
                </div>
                <div className="rounded-lg border border-charcoal-80/8 bg-mist px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-charcoal-80/65">{t("overview.blocks.projects.latestMilestone")}</div>
                  <div className="mt-0.5 truncate text-meta font-semibold text-violet">
                    {latestMilestone.milestone?.title || t("overview.blocks.projects.noMilestone")}
                  </div>
                  <div className="mt-0.5 truncate text-micro text-charcoal-80/65">{latestMilestone.project.projectName}</div>
                </div>
              </Link>
            )}
          </Block>

          {/* Open support tickets */}
          <Block
            className="lg:col-span-2"
            title={t("overview.blocks.support.title")}
            icon={Headphones}
            to="/dashboard/support"
            linkLabel={t("overview.blocks.viewAll")}
            query={tickets}
            empty={openTickets.length === 0 && {
              title: t("overview.blocks.support.emptyTitle"),
              body: t("overview.blocks.support.emptyBody"),
              ctaLabel: t("overview.blocks.support.emptyCta"),
              ctaTo: "/dashboard/support",
            }}
          >
            <div className="divide-y divide-charcoal-80/6">
              {openTickets.slice(0, 3).map((tx) => (
                <Link
                  key={tx.id}
                  to="/dashboard/support"
                  className="flex items-center justify-between gap-3 rounded-lg p-2.5 transition hover:bg-violet-pale/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-meta font-medium text-violet">{tx.subject || t("overview.activity.ticketFallback")}</div>
                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-charcoal-80/65">
                      {new Date(tx.updatedAt || tx.createdAt).toLocaleDateString(localeTag, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <StatusBadge status={tx.status} />
                </Link>
              ))}
              {openTickets.length > 3 && (
                <p className="px-2.5 pt-2 text-micro text-charcoal-80/65">{t("overview.blocks.support.more", { count: openTickets.length - 3 })}</p>
              )}
            </div>
          </Block>
        </div>

        {(orders.loading && consultations.loading && projects.loading && tickets.loading) && (
          <span className="sr-only" role="status">{t("overview.loading")}</span>
        )}
      </section>
    </>
  )
}
