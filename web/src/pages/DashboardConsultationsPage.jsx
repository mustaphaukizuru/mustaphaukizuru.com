// ─────────────────────────────────────────────────────────────────────────────
// DashboardConsultationsPage.jsx — member-facing list of bookings
//
// I18N · Phase 119F — strings keyed under `dashboard.consultations.*`. Status
// taxonomy preserved verbatim (backend enum drives the i18n key directly).
// Sub-components (StatusBadge, CancelModal, RescheduleDrawer, ConsultationRow)
// each scope their own useTranslation hook to satisfy the established pattern.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react"
import { LocalizedLink as Link } from "../components/LocalizedLink"
import { useTranslation } from "react-i18next"
import { m, AnimatePresence } from "framer-motion"
import {
  Calendar, Clock, Video, Trash2, RefreshCw, X, AlertCircle, CheckCircle2, Loader2, ExternalLink,
} from "lucide-react"
import { MetricCard, SectionCard, SkeletonCard, EmptyState } from "../components/ui/index"
import {
  fetchMyConsultations,
  cancelConsultation,
  rescheduleConsultation,
  formatDateTime,
  formatLongDate,
  formatTime,
  getBrowserTimezone,
  fetchAvailableSlots,
  fetchAvailableDays,
} from "../services/bookingService"
import BookingCalendar from "../components/booking/BookingCalendar"
import { useToast } from "../context/ToastContext"
import useApiQuery from "../hooks/useApiQuery"

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

// Brand v3 §05 semantic tokens. Each status maps to the canonical
// feedback tier: pending = warning (amber), confirmed/scheduled =
// success (mint), completed = brand anchor (violet), cancelled/
// rescheduled = neutral (steel on slate), no_show = error (rose).
// Replaced ad-hoc Tailwind hex colors (green-700, indigo-600, gray-500) with
// brand tokens that match the rest of the platform.
const STATUS_CLS = {
  pending:     "bg-amber/12 text-amber-700",
  confirmed:   "bg-mint/12 text-emerald-700",
  scheduled:   "bg-mint/12 text-emerald-700",
  completed:   "bg-violet-pale text-violet-deep",
  cancelled:   "bg-slate-100 text-steel-700",
  rescheduled: "bg-slate-100 text-steel-700",
  no_show:     "bg-rose/10 text-rose-700",
}

function StatusBadge({ status }) {
  const { t } = useTranslation("dashboard")
  const cls = STATUS_CLS[status] || "bg-slate-100 text-steel-700"
  const label = t(`consultations.status.${status}`, { defaultValue: status })
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${cls}`}>{label}</span>
}

const ACTIVE = ["pending", "confirmed", "scheduled"]

// ─────────────────────────────────────────────────────────────────────────────
// CancelModal
// ─────────────────────────────────────────────────────────────────────────────
function CancelModal({ open, consultation, onClose, onConfirmed }) {
  const { t } = useTranslation("dashboard")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { if (open) { setReason(""); setError("") } }, [open])

  async function handleConfirm() {
    try {
      setSubmitting(true); setError("")
      const updated = await cancelConsultation(consultation.id, { reason })
      onConfirmed(updated)
    } catch (e) {
      setError(e?.message || t("consultations.errors.cancel"))
    } finally { setSubmitting(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <m.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[70] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-charcoal/10 bg-white p-5 shadow-[0_20px_50px_rgb(var(--color-violet-rgb)/0.18)] sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-700">{t("consultations.cancelModal.eyebrow")}</div>
                <h3 className="mt-1 text-[18px] font-bold text-violet">{t("consultations.cancelModal.title")}</h3>
              </div>
              <button onClick={onClose} aria-label={t("consultations.cancelModal.close")} className="text-charcoal/65 hover:text-violet">
                <X className="h-5 w-5" />
              </button>
            </div>

            {consultation && (
              <div className="mt-3 rounded-xl bg-violet-ghost p-3 text-[12.5px] text-charcoal/85">
                {formatDateTime(consultation.scheduledAt, consultation.timezone)}
              </div>
            )}

            <label htmlFor="cx-reason" className="mt-4 block text-[12px] font-semibold text-violet">
              {t("consultations.cancelModal.reasonLabel")} <span className="font-normal text-charcoal/65">{t("consultations.cancelModal.optional")}</span>
            </label>
            <textarea
              id="cx-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t("consultations.cancelModal.reasonPlaceholder")}
              className="mt-1.5 w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2.5 text-[13px] text-violet outline-none transition focus:border-violet"
            />

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/10 px-3 py-2 text-[12px] text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal transition hover:bg-violet-ghost"
              >
                {t("consultations.cancelModal.keep")}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t("consultations.cancelModal.confirm")}
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RescheduleDrawer
// ─────────────────────────────────────────────────────────────────────────────
function RescheduleDrawer({ open, consultation, onClose, onRescheduled }) {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const tz = consultation?.timezone || getBrowserTimezone()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [days, setDays] = useState([])
  const [date, setDate] = useState(null)
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [daysLoading, setDaysLoading] = useState(false)

  useEffect(() => {
    if (!open || !consultation) return
    let aborted = false
    async function load() {
      try {
        setDaysLoading(true)
        const d = await fetchAvailableDays({ serviceId: consultation.serviceId || null, year, month, timezone: tz })
        if (!aborted) setDays(d)
      } catch { /* surfaced when user clicks */ }
      finally { if (!aborted) setDaysLoading(false) }
    }
    load()
    return () => { aborted = true }
  }, [open, consultation, year, month, tz])

  useEffect(() => {
    if (!date) return
    let aborted = false
    async function load() {
      try {
        setSlotsLoading(true)
        const s = await fetchAvailableSlots({ serviceId: consultation.serviceId || null, date, timezone: tz })
        if (!aborted) setSlots(s)
      } catch { /* surfaced inline */ }
      finally { if (!aborted) setSlotsLoading(false) }
    }
    load()
    return () => { aborted = true }
  }, [date, consultation, tz])

  async function handlePickSlot(slot) {
    try {
      setSubmitting(true); setError("")
      const updated = await rescheduleConsultation(consultation.id, {
        newStartUtc: slot.startUtc,
        newTimezone: tz,
      })
      toast?.showSuccess?.(t("consultations.toast.rescheduledTitle"), formatDateTime(updated.scheduledAt, tz))
      onRescheduled(updated)
    } catch (e) {
      setError(e?.message || t("consultations.errors.reschedule"))
      toast?.showError?.(t("consultations.toast.rescheduleErrTitle"), e?.message || "")
    } finally { setSubmitting(false) }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <m.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-charcoal/10 bg-white px-5 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet">{t("consultations.rescheduleDrawer.eyebrow")}</div>
                <h3 className="mt-1 text-[16px] font-bold text-violet">{t("consultations.rescheduleDrawer.title")}</h3>
                <p className="mt-0.5 text-[11px] text-charcoal/65">
                  {t("consultations.rescheduleDrawer.currently", { when: formatDateTime(consultation.scheduledAt, tz) })}
                </p>
              </div>
              <button onClick={onClose} aria-label={t("consultations.rescheduleDrawer.close")} className="text-charcoal/65 hover:text-violet">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-5">
              {/* Month nav · pure updaters; calling setYear() inside a setMonth()
                  updater is a side-effect that runs twice under React 18
                  StrictMode and caused the year to skip 2027 → 2028. */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
                    else { setMonth((m) => m - 1) }
                  }}
                  className="rounded-xl px-3 py-2 text-[13px] font-semibold text-violet hover:bg-violet-ghost"
                >
                  {t("consultations.rescheduleDrawer.prev")}
                </button>
                <div className="text-[13px] font-bold text-violet">{year} · {String(month).padStart(2, "0")}</div>
                <button
                  type="button"
                  onClick={() => {
                    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
                    else { setMonth((m) => m + 1) }
                  }}
                  className="rounded-xl px-3 py-2 text-[13px] font-semibold text-violet hover:bg-violet-ghost"
                >
                  {t("consultations.rescheduleDrawer.next")}
                </button>
              </div>

              {daysLoading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {[1,2,3,4,5,6,7,8].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-violet-ghost" />)}
                </div>
              ) : days.length === 0 ? (
                <p className="text-center text-[12px] text-charcoal/65">{t("consultations.rescheduleDrawer.noDays")}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDate(d)}
                      className={[
                        "rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition",
                        date === d
                          ? "border-transparent bg-violet text-white"
                          : "border-violet/15 bg-white text-violet hover:bg-violet-ghost",
                      ].join(" ")}
                    >
                      {new Date(`${d}T12:00:00Z`).toLocaleDateString(localeTag, { weekday: "short", month: "short", day: "numeric", timeZone: tz })}
                    </button>
                  ))}
                </div>
              )}

              {date && (
                <div className="mt-5">
                  <div className="mb-2 text-[12px] font-semibold text-violet">
                    {t("consultations.rescheduleDrawer.timesOn", { date: formatLongDate(`${date}T12:00:00Z`, tz) })}
                  </div>
                  {slotsLoading ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[1,2,3,4,5,6].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-violet-ghost" />)}
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-[12px] text-charcoal/65">{t("consultations.rescheduleDrawer.noTimes")}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {slots.map((s) => (
                        <button
                          key={s.startUtc}
                          type="button"
                          disabled={submitting}
                          onClick={() => handlePickSlot(s)}
                          className="rounded-xl border border-violet/15 bg-white px-3 py-2.5 text-[13px] font-semibold text-violet transition hover:bg-violet hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {formatTime(s.startUtc, tz)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/10 px-3 py-2 text-[12px] text-rose-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </div>
              )}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────
function ConsultationRow({ c, onCancel, onReschedule }) {
  const { t } = useTranslation("dashboard")
  const tz = c.timezone || getBrowserTimezone()
  const isActive = ACTIVE.includes(c.status)
  const startMs = new Date(c.scheduledAt).getTime()
  const [now] = useState(() => Date.now())
  const within15Min = startMs - now < 15 * 60 * 1000 && startMs - now > -60 * 60 * 1000
  const canJoin = isActive && c.meetingLink && within15Min
  const hoursUntil = (startMs - now) / (1000 * 60 * 60)
  const canCancelOrReschedule = isActive && hoursUntil >= 12
  const minutes = c.durationMin || 30
  const hostName = c.assignedAdmin?.fullName || t("consultations.row.fallbackHost")
  const serviceTitle = c.service?.title || t("consultations.row.fallbackService")

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-[var(--shadow-e3)] transition hover:shadow-[var(--shadow-e4)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <span className="text-[11px] text-charcoal/65">{serviceTitle}</span>
          </div>
          <div className="mt-2 text-[15px] font-bold text-violet">
            {formatDateTime(c.scheduledAt, tz)}
          </div>
          <div className="mt-0.5 text-[11.5px] text-charcoal/65">
            {t("consultations.row.minutesWith", { minutes, name: hostName })}
          </div>
          {c.clientNotes && (
            <p className="mt-2 line-clamp-2 text-[12px] text-charcoal/75">
              <span className="font-semibold text-violet">{t("consultations.row.notesPrefix")} </span>{c.clientNotes}
            </p>
          )}
          {c.cancellationReason && (
            <p className="mt-2 text-[12px] text-charcoal/65">
              <span className="font-semibold text-violet">{t("consultations.row.reasonPrefix")} </span>{c.cancellationReason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          {canJoin ? (
            <a
              href={c.meetingLink}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet px-3.5 py-2 text-[12px] font-semibold text-white shadow-[var(--shadow-lift-4)] transition hover:bg-violet-deep"
            >
              <Video className="h-3.5 w-3.5" /> {t("consultations.row.joinMeeting")}
            </a>
          ) : c.meetingLink && isActive ? (
            <a
              href={c.meetingLink}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet/15 bg-white px-3.5 py-2 text-[12px] font-semibold text-violet transition hover:bg-violet-ghost"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("consultations.row.viewLink")}
            </a>
          ) : isActive ? (
            // Active booking but no meeting link yet — almost always means the
            // Google Meet provisioner couldn't reach Google at booking time
            // (mis-configured / revoked refresh token). Show a clear pending
            // chip so the customer doesn't quietly assume something is broken,
            // and the admin sees the same indicator on the admin list.
            <span
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-terracotta/30 bg-terracotta/5 px-3.5 py-2 text-[12px] font-semibold text-terracotta-800"
              title={t("consultations.row.linkPendingTitle")}
            >
              <Video className="h-3.5 w-3.5" /> {t("consultations.row.linkPending")}
            </span>
          ) : null}

          {canCancelOrReschedule && (
            <>
              <button
                type="button"
                onClick={() => onReschedule(c)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet/15 bg-white px-3.5 py-2 text-[12px] font-semibold text-violet transition hover:bg-violet-ghost"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {t("consultations.row.reschedule")}
              </button>
              <button
                type="button"
                onClick={() => onCancel(c)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose/20 bg-white px-3.5 py-2 text-[12px] font-semibold text-rose-700 transition hover:bg-rose/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("consultations.row.cancel")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardConsultationsPage() {
  const { t } = useTranslation("dashboard")
  const { data: items = [], loading, error, refetch: load, setData: setItems } = useApiQuery(
    "consultations",
    () => fetchMyConsultations(),
    { select: (data) => (Array.isArray(data) ? data : []) }
  )
  const [cancelTarget, setCancelTarget] = useState(null)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)

  // Snapshot once per mount — Date.now() inside useMemo trips the purity rule.
  const [now] = useState(() => Date.now())
  const { upcoming, past } = useMemo(() => {
    const up = [], pa = []
    items.forEach((c) => {
      const ts = new Date(c.scheduledAt).getTime()
      if (ACTIVE.includes(c.status) && ts >= now) up.push(c)
      else pa.push(c)
    })
    up.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    pa.sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))
    return { upcoming: up, past: pa }
  }, [items, now])

  function replaceItem(updated) {
    setItems((prev = []) => {
      const idx = prev.findIndex((x) => x.id === updated.id)
      if (idx === -1) return [updated, ...prev]
      const copy = [...prev]; copy[idx] = updated
      return copy
    })
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {[1,2,3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[280px]" />
      </section>
    )
  }

  return (
    <m.section variants={fadeUp} initial="hidden" animate="show" className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title={t("consultations.metrics.upcoming")}  value={upcoming.length}                                  subtitle={t("consultations.metrics.upcomingSubtitle")}  icon={Calendar}     tone="purple" />
        <MetricCard title={t("consultations.metrics.completed")} value={items.filter((c) => c.status === "completed").length} subtitle={t("consultations.metrics.completedSubtitle")} icon={CheckCircle2} tone="green" />
        <MetricCard title={t("consultations.metrics.total")}     value={items.length}                                       subtitle={t("consultations.metrics.totalSubtitle")}     icon={Clock}        tone="blue" />
      </div>

      {/* Upcoming */}
      <SectionCard
        title={t("consultations.section.upcomingTitle")}
        subtitle={t("consultations.section.upcomingSubtitle")}
        action={
          <Link
            to="/book"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3.5 py-2 text-[12px] font-semibold text-white shadow-[var(--shadow-lift-4)] transition hover:bg-violet-deep"
          >
            <Calendar className="h-3.5 w-3.5" /> {t("consultations.section.bookCall")}
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={t("consultations.empty.title")}
            description={t("consultations.empty.body")}
            action={<Link to="/book" className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-[13px] font-semibold text-white">{t("consultations.empty.bookCall")}</Link>}
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((c) => (
              <ConsultationRow key={c.id} c={c} onCancel={setCancelTarget} onReschedule={setRescheduleTarget} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Past */}
      {past.length > 0 && (
        <SectionCard title={t("consultations.section.pastTitle")} subtitle={t("consultations.section.pastSubtitle")}>
          <div className="space-y-3">
            {past.map((c) => (
              <ConsultationRow key={c.id} c={c} onCancel={setCancelTarget} onReschedule={setRescheduleTarget} />
            ))}
          </div>
        </SectionCard>
      )}

      <CancelModal
        open={Boolean(cancelTarget)}
        consultation={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirmed={(updated) => { replaceItem(updated); setCancelTarget(null) }}
      />

      {rescheduleTarget && (
        <RescheduleDrawer
          open={Boolean(rescheduleTarget)}
          consultation={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={(updated) => {
            replaceItem(updated)
            setRescheduleTarget(null)
            load()
          }}
        />
      )}
    </m.section>
  )
}
