// ─────────────────────────────────────────────────────────────────────────────
// BookingCalendar.jsx — three-step public booking flow
//
// Step 1  Date — month grid; days with ≥ 1 slot are interactive.
// Step 2  Time — chips of slot start times in the visitor's timezone.
// Step 3  Confirm — agenda notes + book.
//
// Embeddable: pass serviceId (optional). When the user is unauthenticated, the
// confirm step routes them to /login?from=/book/[serviceSlug] preserving intent.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { m, AnimatePresence } from "framer-motion"
import {
  Calendar, ChevronLeft, ChevronRight, ChevronDown, Clock, Globe2,
  Check, ArrowLeft, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import {
  fetchAvailableSlots,
  fetchAvailableDays,
  bookConsultation,
  getBrowserTimezone,
  formatTime,
  labelSlots,
  formatLongDate,
  localDateKey,
} from "../../services/bookingService"

import { useTranslation } from "react-i18next"
// ── Motion variants (match site convention) ──────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

// ── Date helpers (no external deps) ──────────────────────────────────────────
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// True when the (year, month) pair sits inside the bookable window — i.e.
// not earlier than the current month and not later than the policy maxima.
function isMonthInRange(y, m, minYear, minMonth, maxYear, maxMonth) {
  const target = y * 12 + (m - 1)
  const min = minYear * 12 + (minMonth - 1)
  const max = maxYear * 12 + (maxMonth - 1)
  return target >= min && target <= max
}

function buildMonthGrid(year, month /* 1-12 */) {
  const firstOfMonth = new Date(year, month - 1, 1)
  const startWeekday = firstOfMonth.getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    cells.push({ day: d, dateStr })
  }
  return cells
}

// Common timezone choices (a curated short list — Intl.supportedValuesOf is
// supported in modern browsers but the list is huge; the user can manually type).
const TZ_PRESETS = [
  "America/Mexico_City", "America/New_York", "America/Los_Angeles", "America/Chicago",
  "America/Sao_Paulo", "Europe/London", "Europe/Madrid", "Europe/Istanbul",
  "Africa/Kigali", "Africa/Addis_Ababa", "Asia/Dubai", "Asia/Tokyo", "Australia/Sydney", "UTC",
]

// ─────────────────────────────────────────────────────────────────────────────
// MonthYearPicker — inline popover paired with the calendar header
// ─────────────────────────────────────────────────────────────────────────────
//
// Replaces a static "January 2026" label with a clickable button that opens
// a compact picker:
//
//   ┌─────────────────────────────────────┐
//   │ ‹ 2026 ›                             │   ← year row (clamped to bounds)
//   ├─────────────────────────────────────┤
//   │ Jan · Feb · Mar · Apr                │
//   │ May · Jun · Jul · Aug                │   ← 4×3 month grid
//   │ Sep · Oct · Nov · Dec                │
//   └─────────────────────────────────────┘
//
// Months/years outside the bookable window (today → today+maxAdvanceDays) are
// rendered disabled so visitors never select an unbookable period. Closes on
// outside click or Escape.
//
function MonthYearPicker({
  year, month, onChange,
  minYear, minMonth, maxYear, maxMonth,
}) {
  const { t } = useTranslation("common")
  const [open, setOpen] = useState(false)
  const [draftYear, setDraft] = useState(year)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)

  // Keep the picker year in sync when the parent navigates with arrows
  useEffect(() => { setDraft(year) }, [year])

  // Clamp draft year inside bounds whenever the picker opens
  useEffect(() => {
    if (!open) return
    if (draftYear < minYear) setDraft(minYear)
    else if (draftYear > maxYear) setDraft(maxYear)
  }, [open, draftYear, minYear, maxYear])

  // Outside-click + Escape to close
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const canPrevYear = draftYear > minYear
  const canNextYear = draftYear < maxYear

  const pickMonth = (m) => {
    if (!isMonthInRange(draftYear, m, minYear, minMonth, maxYear, maxMonth)) return
    onChange({ year: draftYear, month: m })
    setOpen(false)
    // Return focus to the trigger so keyboard users land somewhere sane
    requestAnimationFrame(() => buttonRef.current?.focus())
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Change month and year (currently ${MONTHS[month - 1]} ${year})`}
        className="cursor-pointer group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-violet transition hover:bg-violet-ghost focus:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/20"
      >
        <span>{MONTHS[month - 1]} {year}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            role="dialog"
            aria-label={t("bookingCalendar.monthYearAria")}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 z-30 mt-2 w-[280px] -translate-x-1/2 overflow-hidden rounded-2xl border border-charcoal/10 bg-white p-3 shadow-[0_18px_50px_-12px_rgb(var(--color-violet-rgb)/0.22),0_2px_8px_rgba(0,0,0,0.04)]"
          >
            {/* Year row */}
            <div className="flex items-center justify-between gap-2 border-b border-charcoal/8 pb-2.5">
              <button
                type="button"
                onClick={() => canPrevYear && setDraft((y) => y - 1)}
                disabled={!canPrevYear}
                aria-label={t("bookingCalendar.prevYearAria")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-violet transition hover:bg-violet-ghost disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="font-mono text-[14px] font-bold tabular-nums text-violet">
                {draftYear}
              </div>
              <button
                type="button"
                onClick={() => canNextYear && setDraft((y) => y + 1)}
                disabled={!canNextYear}
                aria-label={t("bookingCalendar.nextYearAria")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-violet transition hover:bg-violet-ghost disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Month grid */}
            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {MONTHS_SHORT.map((short, idx) => {
                const m = idx + 1
                const isCurrent = draftYear === year && m === month
                const inRange = isMonthInRange(draftYear, m, minYear, minMonth, maxYear, maxMonth)
                return (
                  <button
                    key={short}
                    type="button"
                    onClick={() => pickMonth(m)}
                    disabled={!inRange}
                    aria-pressed={isCurrent}
                    aria-label={`${MONTHS[idx]} ${draftYear}${inRange ? "" : " (unavailable)"}`}
                    className={[
                      "relative h-9 rounded-lg text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/20",
                      !inRange
                        ? "cursor-not-allowed text-charcoal/25"
                        : isCurrent
                          ? "bg-violet text-white shadow-[0_4px_12px_rgb(var(--color-violet-rgb)/0.25)]"
                          : "bg-violet-ghost text-violet hover:bg-violet hover:text-white",
                    ].join(" ")}
                  >
                    {short}
                  </button>
                )
              })}
            </div>

            {/* Helper line */}
            <div className="mt-2.5 border-t border-charcoal/8 pt-2 text-center text-[10.5px] text-charcoal/65">
              {t("bookingCalendar.bookableHighlight")}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function StepBadge({ active, complete, n, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={[
          "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition",
          complete ? "bg-violet text-white"
            : active ? "bg-violet text-white shadow-[0_4px_12px_rgb(var(--color-violet-rgb)/0.25)]"
            : "bg-violet-pale text-violet",
        ].join(" ")}
      >
        {complete ? <Check className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={`text-[13px] font-semibold ${active || complete ? "text-violet" : "text-charcoal/65"}`}>
        {label}
      </span>
    </div>
  )
}

function StepperHeader({ step }) {
  const { t } = useTranslation("common")
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px] sm:gap-5">
      <StepBadge n={1} active={step === 1} complete={step > 1} label={t("bookingCalendar.stepDate")} />
      <div className="hidden h-px w-8 bg-charcoal/15 sm:block" />
      <StepBadge n={2} active={step === 2} complete={step > 2} label={t("bookingCalendar.stepTime")} />
      <div className="hidden h-px w-8 bg-charcoal/15 sm:block" />
      <StepBadge n={3} active={step === 3} complete={false} label={t("bookingCalendar.stepConfirm")} />
    </div>
  )
}

function PolicyHint({ minNoticeHours, maxAdvanceDays }) {
  const { t } = useTranslation("common")
  return (
    <p className="mt-2 text-[11px] text-charcoal/65">
      {t("bookingCalendar.bookingNeeds")} {minNoticeHours ?? 24}{t("bookingCalendar.hNotice")} {maxAdvanceDays ?? 60} {t("bookingCalendar.daysAhead")}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function BookingCalendar({
  serviceId = null,
  serviceSlug = null,
  serviceTitle = "Consultation",
  durationMin = 30,
  policy = { minNoticeHours: 24, maxAdvanceDays: 60 },
  onBooked = null, // (consultation) => void , host can override flow
}) {
  const { t } = useTranslation("common")
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const today = useMemo(() => new Date(), [])
  const [timezone, setTimezone] = useState(() => getBrowserTimezone())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-12
  const [step, setStep] = useState(1)

  const [availableDays, setAvailableDays] = useState([])
  const [daysLoading, setDaysLoading] = useState(false)
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null) // YYYY-MM-DD
  const [selectedSlot, setSelectedSlot] = useState(null) // { startUtc, ... }
  const [clientNotes, setClientNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [bookedRecord, setBookedRecord] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])

  // ── Fetch available days when month/timezone/service changes ───────────────
  useEffect(() => {
    let aborted = false
    async function load() {
      try {
        setDaysLoading(true); setErrorMessage("")
        const days = await fetchAvailableDays({ serviceId, year, month, timezone })
        if (!aborted) setAvailableDays(days)
      } catch (e) {
        if (!aborted) setErrorMessage(e?.message || "Could not load availability")
      } finally {
        if (!aborted) setDaysLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [serviceId, year, month, timezone])

  // ── Fetch slots when a date is selected ────────────────────────────────────
  useEffect(() => {
    if (!selectedDate) return
    let aborted = false
    async function load() {
      try {
        setSlotsLoading(true); setErrorMessage("")
        const result = await fetchAvailableSlots({ serviceId, date: selectedDate, timezone })
        if (!aborted) setSlots(result)
      } catch (e) {
        if (!aborted) setErrorMessage(e?.message || "Could not load times")
      } finally {
        if (!aborted) setSlotsLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [selectedDate, serviceId, timezone])

  // ── Navigation handlers ────────────────────────────────────────────────────
  // Pure updaters — calling setYear() inside setMonth()'s updater function
  // is a side-effect, and React 18 StrictMode invokes updaters twice in
  // development. That caused the year to advance by 2 (skipping 2027 →
  // jumping straight to 2028). Splitting the calls fixes the calendar.
  const goPrevMonth = useCallback(() => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else { setMonth((m) => m - 1) }
  }, [month])
  const goNextMonth = useCallback(() => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else { setMonth((m) => m + 1) }
  }, [month])

  const isPrevDisabled = useMemo(() => {
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const firstOfNavMonth = new Date(year, month - 1, 1)
    return firstOfNavMonth <= firstOfThisMonth
  }, [year, month, today])

  // ── Bookable window — feeds both the ">" button and the picker ─────────────
  // Policy: today → today + maxAdvanceDays. We expose the bounds as
  // {minYear, minMonth, maxYear, maxMonth} so the MonthYearPicker can disable
  // months outside the window.
  const bounds = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today)
    end.setDate(end.getDate() + (policy?.maxAdvanceDays ?? 60))
    return {
      minYear: start.getFullYear(),
      minMonth: start.getMonth() + 1,
      maxYear: end.getFullYear(),
      maxMonth: end.getMonth() + 1,
    }
  }, [today, policy?.maxAdvanceDays])

  const isNextDisabled = useMemo(() => {
    const navIdx = year * 12 + (month - 1)
    const maxIdx = bounds.maxYear * 12 + (bounds.maxMonth - 1)
    return navIdx >= maxIdx
  }, [year, month, bounds])

  function handleDayClick(cell) {
    if (!cell) return
    if (!availableDays.includes(cell.dateStr)) return
    setSelectedDate(cell.dateStr)
    setSelectedSlot(null)
    setStep(2)
  }

  function handleSlotClick(slot) {
    setSelectedSlot(slot)
    setStep(3)
  }

  async function handleConfirm() {
    if (!selectedSlot) return
    if (!user) {
      // Preserve intent so post-login the user lands back on the booking page
      const dest = serviceSlug ? `/book/${serviceSlug}` : "/book"
      navigate(`/login?from=${encodeURIComponent(dest)}`)
      return
    }

    try {
      setSubmitting(true); setErrorMessage("")
      const consultation = await bookConsultation({
        serviceId,
        startUtc: selectedSlot.startUtc,
        timezone,
        clientNotes: clientNotes.trim() || null,
      })
      setBookedRecord(consultation)
      toast?.show?.({ type: "success", title: "Booked", message: "We'll send a confirmation email shortly." })
      if (typeof onBooked === "function") onBooked(consultation)
    } catch (e) {
      setErrorMessage(e?.message || "Could not complete the booking")
      toast?.show?.({ type: "error", title: "Booking failed", message: e?.message || "Please try again" })
    } finally {
      setSubmitting(false)
    }
  }

  // ── SUCCESS STATE ──────────────────────────────────────────────────────────
  if (bookedRecord) {
    return (
      <m.div
        variants={fadeUp} initial="hidden" animate="show"
        className="rounded-xl border border-charcoal/10 bg-white p-6 text-center shadow-[var(--shadow-e6)] sm:p-10"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint/12 text-emerald-700 sm:h-16 sm:w-16">
          <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <h2 className="mt-5 text-[22px] font-bold tracking-tight text-violet sm:text-[26px]">
          {t("bookingCalendar.consultationBooked")}
        </h2>
        <p className="mt-2 text-[13px] text-charcoal/70 sm:text-[14px]">
          {formatLongDate(bookedRecord.scheduledAt, timezone)} · {formatTime(bookedRecord.scheduledAt, timezone)}
        </p>
        <p className="mt-1 text-[12px] text-charcoal/65">
          {t("bookingCalendar.confirmationOnWay")} {bookedRecord?.user?.email || "your inbox"}.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate("/dashboard/consultations")}
            className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3 text-[13px] font-semibold text-white shadow-[var(--shadow-lift-2)] transition hover:bg-violet-deep"
          >
            {t("bookingCalendar.viewDashboard")}
          </button>
          <button
            type="button"
            onClick={() => {
              setBookedRecord(null); setSelectedSlot(null); setSelectedDate(null); setStep(1); setClientNotes("")
            }}
            className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-violet/15 bg-white px-5 py-3 text-[13px] font-semibold text-violet transition hover:bg-violet-ghost"
          >
            {t("bookingCalendar.bookAnother")}
          </button>
        </div>
      </m.div>
    )
  }

  // ── MAIN UI ────────────────────────────────────────────────────────────────
  return (
    <m.div
      variants={stagger} initial="hidden" animate="show"
      className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-[var(--shadow-e6)] sm:p-6"
    >
      {/* Header, title + stepper + timezone */}
      <m.div variants={fadeUp} className="mb-5 flex flex-col gap-3 border-b border-charcoal/10 pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet">
            <span className="rounded-full bg-violet-pale px-2 py-0.5">{t("bookingCalendar.bookingShort")}</span>
            {serviceTitle ? <span className="text-charcoal/65">· {serviceTitle}</span> : null}
          </div>
          <h2 className="mt-1.5 text-[18px] font-bold tracking-tight text-violet sm:text-[20px]">
            {t("bookingCalendar.scheduleCall")}
          </h2>
        </div>
        <StepperHeader step={step} />
      </m.div>

      {/* Timezone selector, always visible */}
      <m.div variants={fadeUp} className="mb-5 flex flex-col gap-2 rounded-xl bg-violet-ghost p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2 text-[12px] text-charcoal/75">
          <Globe2 className="h-4 w-4 text-violet" />
          <span>{t("bookingCalendar.timesShown")}</span>
        </div>
        <select
          aria-label={t("bookingCalendar.timezoneAria")}
          value={timezone}
          onChange={(e) => { setTimezone(e.target.value); setSelectedSlot(null); setStep(1) }}
          className="w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-[13px] font-semibold text-violet outline-none focus:border-violet sm:w-auto"
        >
          {[timezone, ...TZ_PRESETS.filter((t) => t !== timezone)].map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </m.div>

      {/* Error banner */}
      <AnimatePresence>
        {errorMessage && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-[13px] text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── STEP 1, DATE ───────────────────────────────────────────────────── */}
      {step === 1 && (
        <m.div variants={fadeUp}>
          {/* Month nav, clickable label opens a month/year picker */}
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={goPrevMonth}
              disabled={isPrevDisabled}
              aria-label={t("bookingCalendar.prevMonthAria")}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-violet transition hover:bg-violet-ghost disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center">
              <MonthYearPicker
                year={year}
                month={month}
                onChange={({ year: y, month: m }) => {
                  setYear(y)
                  setMonth(m)
                  // Clear any in-flight selection so the next step is fresh
                  setSelectedDate(null)
                  setSelectedSlot(null)
                }}
                minYear={bounds.minYear}
                minMonth={bounds.minMonth}
                maxYear={bounds.maxYear}
                maxMonth={bounds.maxMonth}
              />
              <div className="mt-0.5 text-[10px] text-charcoal/65">{t("bookingCalendar.tapHighlighted")}</div>
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              disabled={isNextDisabled}
              aria-label={t("bookingCalendar.nextMonthAria")}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-violet transition hover:bg-violet-ghost disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1.5 px-1 pb-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal/65 sm:gap-2">
            {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {grid.map((cell, idx) => {
              if (!cell) return <div key={`pad-${idx}`} />
              const isAvailable = availableDays.includes(cell.dateStr)
              const todayKey = localDateKey(today, timezone)
              const isPast = cell.dateStr < todayKey
              const isToday = cell.dateStr === todayKey

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => handleDayClick(cell)}
                  disabled={!isAvailable || isPast}
                  aria-label={`${MONTHS[month - 1]} ${cell.day}, ${year}${isAvailable ? " (available)" : ""}`}
                  aria-pressed={selectedDate === cell.dateStr}
                  className={[
                    "relative flex aspect-square items-center justify-center rounded-xl text-[14px] font-semibold transition",
                    isPast
                      ? "cursor-not-allowed text-charcoal/25"
                      : isAvailable
                        ? "bg-violet-ghost text-violet hover:bg-violet hover:text-white hover:shadow-[var(--shadow-lift-4)]"
                        : "cursor-not-allowed text-charcoal/30",
                    isToday && !isPast ? "ring-1 ring-violet/30" : "",
                  ].join(" ")}
                >
                  {cell.day}
                  {isAvailable && !isPast && (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Loading shimmer */}
          {daysLoading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[12px] text-charcoal/65">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("bookingCalendar.checkingAvailability")}
            </div>
          )}

          <PolicyHint {...policy} />
        </m.div>
      )}

      {/* ── STEP 2, TIME ───────────────────────────────────────────────────── */}
      {step === 2 && (
        <m.div variants={fadeUp}>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="cursor-pointer mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet transition hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("bookingCalendar.backToDate")}
          </button>

          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet" />
            <span className="text-[13px] font-semibold text-violet">
              {formatLongDate(`${selectedDate}T12:00:00Z`, timezone)}
            </span>
          </div>

          {slotsLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {[1,2,3,4,5,6,7,8].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-violet-ghost" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-charcoal/20 bg-violet-ghost p-6 text-center">
              <Clock className="mx-auto h-5 w-5 text-charcoal/40" />
              <p className="mt-2 text-[13px] font-semibold text-charcoal">{t("bookingCalendar.noTimes")}</p>
              <p className="mt-1 text-[12px] text-charcoal/65">{t("bookingCalendar.tryDifferentDay")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {labelSlots(slots, timezone).map((labelled, i) => (
                <button
                  key={labelled.startUtc}
                  type="button"
                  onClick={() => handleSlotClick(slots[i])}
                  className="cursor-pointer rounded-xl border border-violet/15 bg-white px-3 py-3 text-[13px] font-semibold text-violet transition hover:border-transparent hover:bg-violet hover:text-white hover:shadow-[var(--shadow-lift-4)]"
                >
                  {labelled.label}
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-[11px] text-charcoal/65">
            {t("bookingCalendar.eachSlotIs")} {durationMin} {t("bookingCalendar.minutesLong")}
          </p>
        </m.div>
      )}

      {/* ── STEP 3, CONFIRM ────────────────────────────────────────────────── */}
      {step === 3 && selectedSlot && (
        <m.div variants={fadeUp}>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="cursor-pointer mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet transition hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("bookingCalendar.chooseAnother")}
          </button>

          {/* Summary card */}
          <div className="rounded-xl border border-charcoal/10 bg-violet-ghost p-4 sm:p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet">{t("bookingCalendar.yourBooking")}</div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[16px] font-bold text-violet">{serviceTitle}</div>
                <div className="mt-0.5 text-[13px] text-charcoal/75">{durationMin} {t("bookingCalendar.minutes")}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold text-violet">
                  {formatTime(selectedSlot.startUtc, timezone)}
                </div>
                <div className="mt-0.5 text-[11px] text-charcoal/65">
                  {formatLongDate(selectedSlot.startUtc, timezone)}
                </div>
                <div className="mt-0.5 text-[10px] text-charcoal/65">{timezone}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <label htmlFor="bk-notes" className="mt-5 block text-[12px] font-semibold text-violet">
            {t("bookingCalendar.discussLabel")} <span className="font-normal text-charcoal/65">{t("bookingCalendar.optionalTag")}</span>
          </label>
          <textarea
            id="bk-notes"
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t("bookingCalendar.discussPlaceholder")}
            className="mt-1.5 w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2.5 text-[13px] text-violet outline-none transition focus:border-violet"
          />

          {/* Auth notice */}
          {!user && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber/20 bg-amber/10 px-4 py-3 text-[12px] text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {t("bookingCalendar.signInHint")}
            </div>
          )}

          {/* Confirm button */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3.5 text-[14px] font-semibold text-white shadow-[var(--shadow-lift-3)] transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> {t("bookingCalendar.bookingEllipsis")}</>) : (<>{t("bookingCalendar.confirmBooking")} <Check className="h-4 w-4" /></>)}
          </button>
        </m.div>
      )}
    </m.div>
  )
}
