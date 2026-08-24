/* ════════════════════════════════════════════════════════════════════════
   ContactHero.jsx · V5 · 2-col conversion-oriented hero for /contact
   ────────────────────────────────────────────────────────────────────────
   V5 swaps the legacy chat-bubble illustration for an animated BOOKING
   CALENDAR that visually narrates the project lifecycle, signalling
   "we run a real booking system" at a glance:

     · BOOKING · DISCOVERY CALL eyebrow + 3-step stepper (Date · Time
       · Confirm) with the active step continuously pulsing.
     · Live timezone strip ("America/Mexico_City") + "{t("hero.liveAvailability")}"
       mint indicator with breathing dot.
     · May 2026 month grid where every cell carries a status:
         AVAILABLE  → white + mint corner dot, hint-ping on the next slot
         TODAY      → terracotta tile with pulsing violet ring
         BOOKED     → solid violet with phone glyph (discovery call)
         KICKOFF    → lavender outlined cell with rocket glyph
         IN PROGRESS→ amber tile with diagonal shimmer (running project)
         IN REVIEW  → soft blue tile with clipboard-tick glyph
         DEPLOYED   → mint tile with green check (project shipped)
       Cells stagger-fade in on mount; legend below the grid.
     · Primary "{t("hero.pickSlot")}" CTA pinned to the card footer (→ /book).
     · Floating "{t("hero.justShipped")}" toast that recurs every ~11 s and a
       rotated "{t("hero.letsBuildCheck")}" hand-stamp anchor the
       brand's playful aesthetic.

   Preserved verbatim from V3/V4:
     · Live "● {t("hero.onlineReplies")}" availability badge.
     · Primary + ghost CTAs below subhead.
     · Background: radial gradient + 3 drifting orbs + 44px grid +
       radial vignette.
     · Eyebrow chip · headline · subhead · 3 trust pills.
     · Full `prefers-reduced-motion` discipline on every loop.

   Mobile/tablet still collapse to single-column with text leading;
   the calendar hides below `lg`.
   ════════════════════════════════════════════════════════════════════════ */

import { m, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  Sparkles, Clock, MapPin, MessageCircle, ArrowRight, Calendar,
  Check, ChevronLeft, ChevronRight, Globe, Phone, Rocket,
  ClipboardCheck, CheckCircle2,
} from "lucide-react"
import Seo from "../seo/Seo"
import { pageSeo } from "../../seo/pageSeo"
import { useTranslation } from "react-i18next"

/* ── Motion variants ─────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
}

/* ── Trust-pill data ─────────────────────────────────────────────── */
const TRUST_PILLS = [
  { Icon: Clock, label: "Response Time", value: "Within 24h" },
  { Icon: MapPin, label: "Location", value: "Worldwide" },
  { Icon: MessageCircle, label: "Availability", value: "Mon – Sat" },
]

/* ════════════════════════════════════════════════════════════════════════
   Right-side BOOKING CALENDAR · lg+ only
   ────────────────────────────────────────────────────────────────────────
   Replaces the legacy chat illustration. Story it tells:
     · Booking system is live → step-1 active, timezone visible
     · A real month grid where each cell carries lifecycle state
       (open / discovery call / kickoff / in progress / in review /
       deployed) — visually narrating the journey from "free slot"
       to "shipped product"
     · Anchored by playful brand decorations: "{t("hero.letsBuild")}" cursive,
       "{t("hero.repliesIn")}" yellow pill, coral heart, sparkles, rotated
       hand-stamp, and a recurring "{t("hero.justShipped")}" toast
   All loops gated by useReducedMotion(); every animation respects it.
   ════════════════════════════════════════════════════════════════════════ */

/* ── Day-status visual tokens (brand-aligned) ─────────────────────── */
const DAY_STYLE = {
  empty: { wrap: "invisible", num: "" },
  weekend: { wrap: "bg-violet-ghost/70", num: "!text-charcoal/65" },
  available:{ wrap: "bg-white ring-1 ring-mint-400/45", num: "!text-violet" },
  today: { wrap: "bg-terracotta shadow-[0_6px_18px_rgb(var(--color-terracotta-rgb)/0.55)]", num: "!text-violet-deep font-extrabold" },
  booked: { wrap: "bg-violet", num: "!text-white" },
  kickoff: { wrap: "bg-violet-pale ring-1 ring-violet/55", num: "!text-violet" },
  progress: { wrap: "bg-[#fed978]", num: "!text-[#5a4506]" },
  review: { wrap: "bg-[#dbe4ff]", num: "!text-[#1d3a8a]" },
  deployed: { wrap: "bg-mint-400", num: "!text-[#1f3508] font-extrabold" },
}

/* ── May 2026 layout · 6 weeks, Sun-first · maps directly to the grid */
const DAYS = [
  // Week 1 (5 leading empties; May 1 = Friday)
  { kind: "empty" }, { kind: "empty" }, { kind: "empty" }, { kind: "empty" }, { kind: "empty" },
  { day: 1, kind: "deployed" }, { day: 2, kind: "today" },
  // Week 2
  { day: 3, kind: "weekend" }, { day: 4, kind: "available" }, { day: 5, kind: "booked" },
  { day: 6, kind: "available"}, { day: 7, kind: "available" }, { day: 8, kind: "available"},
  { day: 9, kind: "weekend" },
  // Week 3 — project lifecycle visible across the row
  { day: 10, kind: "weekend" }, { day: 11, kind: "kickoff" }, { day: 12, kind: "progress" },
  { day: 13, kind: "progress" }, { day: 14, kind: "progress" }, { day: 15, kind: "review" },
  { day: 16, kind: "weekend" },
  // Week 4
  { day: 17, kind: "weekend" }, { day: 18, kind: "progress" }, { day: 19, kind: "review" },
  { day: 20, kind: "review" }, { day: 21, kind: "deployed" }, { day: 22, kind: "available"},
  { day: 23, kind: "weekend" },
  // Week 5
  { day: 24, kind: "weekend" }, { day: 25, kind: "available" }, { day: 26, kind: "available"},
  { day: 27, kind: "booked" }, { day: 28, kind: "available" }, { day: 29, kind: "available"},
  { day: 30, kind: "weekend" },
  // Week 6
  { day: 31, kind: "weekend" },
  { kind: "empty" }, { kind: "empty" }, { kind: "empty" }, { kind: "empty" }, { kind: "empty" }, { kind: "empty" },
]

/* ── Bottom-of-card legend ───────────────────────────────────────── */
const LEGEND = [
  { key: "available", labelKey: "hero.legendOpenSlot", swatch: "bg-white ring-1 ring-mint-400" },
  { key: "booked", labelKey: "hero.legendBooked", swatch: "bg-violet" },
  { key: "progress", labelKey: "hero.legendInProgress", swatch: "bg-[#fed978]" },
  { key: "review", labelKey: "hero.legendInReview", swatch: "bg-[#dbe4ff]" },
  { key: "deployed", labelKey: "hero.legendDeployed", swatch: "bg-mint-400" },
]

/* ════════════════════════════════════════════════════════════════════════
   DayCell · single day in the calendar grid (status-driven)
   ════════════════════════════════════════════════════════════════════════ */
function DayCell({ day, kind, idx, reduce }) {
  const s = DAY_STYLE[kind] || DAY_STYLE.empty

  // Empty leading/trailing cells just hold layout — nothing to animate
  if (kind === "empty") return <div aria-hidden="true" className="h-9" />

  return (
    <m.div
      variants={{
        hidden: { opacity: 0, scale: 0.7 },
        show: { opacity: 1, scale: 1, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={[
        "relative flex h-9 items-center justify-center rounded-lg text-[12.5px] font-bold select-none",
        s.wrap,
        s.num,
      ].join(" ")}
    >
      {/* TODAY, pulsing violet ring */}
      {kind === "today" && !reduce && (
        <m.span
          aria-hidden="true"
          animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-violet"
        />
      )}

      {/* AVAILABLE, soft mint corner dot + occasional ping */}
      {kind === "available" && (
        <>
          <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-mint-400" />
          {/* Light up day 4 (first available cell) as a "click me" hint */}
          {!reduce && day === 4 && (
            <m.span
              aria-hidden="true"
              animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-mint-400"
            />
          )}
        </>
      )}

      {/* BOOKED, small phone icon */}
      {kind === "booked" && (
        <span aria-hidden="true" className="absolute left-1 top-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-white/15">
          <Phone className="h-2 w-2 !text-white" />
        </span>
      )}

      {/* KICKOFF, rocket micro-icon */}
      {kind === "kickoff" && (
        <Rocket aria-hidden="true" className="absolute right-1 top-1 h-2.5 w-2.5 !text-violet" />
      )}

      {/* IN PROGRESS, left-to-right shimmer to convey activity */}
      {kind === "progress" && !reduce && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <m.span
            animate={{ x: ["-110%", "210%"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear", delay: (idx % 4) * 0.25 }}
            className="absolute inset-y-0 -left-1/2 w-1/2"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)",
            }}
          />
        </span>
      )}

      {/* REVIEW, clipboard tick */}
      {kind === "review" && (
        <ClipboardCheck aria-hidden="true" className="absolute right-1 top-1 h-2.5 w-2.5 !text-[#1d3a8a]" />
      )}

      {/* DEPLOYED, green check */}
      {kind === "deployed" && (
        <Check aria-hidden="true" className="absolute right-1 top-1 h-2.5 w-2.5 !text-[#1f3508]" strokeWidth={3} />
      )}

      <span className="relative">{day}</span>
    </m.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   BookingCalendar · the new right-column hero illustration
   ════════════════════════════════════════════════════════════════════════ */
function BookingCalendar({ reduce }) {
  const { t } = useTranslation("contact")
  return (
    <m.div
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto hidden w-full max-w-[520px] lg:block"
      role="img"
      aria-label={t("hero.calendarAria")}
    >
      {/* Float wrapper, inherits the V3 idle-orb cadence */}
      <m.div
        animate={reduce ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        {/* ── Top-left "{t("hero.letsBuild")}" cursive + arrow doodle ─────── */}
        <svg
          aria-hidden="true"
          viewBox="0 0 200 70"
          className="pointer-events-none absolute -left-3 -top-7 z-20 h-14 w-44"
        >
          <text x="0" y="22" fontFamily="var(--font-script)" fontSize="22" fontWeight="700" fill="var(--color-terracotta)">
            {t("hero.letsBuild")}
          </text>
          <path
            d="M85 28 C 110 36, 135 46, 160 60"
            stroke="var(--color-terracotta)" strokeWidth="1.6" fill="none"
            strokeLinecap="round" strokeDasharray="4 4" opacity="0.75"
          />
          <polygon points="155,55 167,58 161,67" fill="var(--color-terracotta)" opacity="0.8" />
        </svg>

        {/* ── "{t("hero.repliesIn")}" yellow pill · top-right rotated ───── */}
        <m.div
          aria-hidden="true"
          initial={{ rotate: -8 }}
          animate={reduce ? { rotate: -8 } : { y: [0, -3, 0], rotate: -8 }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-4 -top-5 z-30 origin-center"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fed978] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] !text-[#5a4506] shadow-[0_10px_24px_rgba(0,0,0,0.30)]">
            <span className="relative flex h-1.5 w-1.5">
              <m.span
                animate={reduce ? undefined : { scale: [1, 2.6, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-[#5a4506]"
              />
              <span className="relative h-1.5 w-1.5 rounded-full bg-[#5a4506]" />
            </span>
            {t("hero.repliesIn")}
          </div>
        </m.div>

        {/* ── Coral heart (kept from V4) ─────────────────────────── */}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute -right-2 top-16 z-0 h-5 w-5">
          <path d="M12 21 c -7 -5 -10 -10 -10 -14 c 0 -3 3 -5 6 -3 c 2 1 3 3 4 4 c 1 -1 2 -3 4 -4 c 3 -2 6 0 6 3 c 0 4 -3 9 -10 14 z" fill="#ee8273" />
        </svg>

        {/* ── Decorative sparkles around the card ────────────────── */}
        <Sparkles aria-hidden="true" className="pointer-events-none absolute -left-5 top-1/3 h-5 w-5 !text-terracotta" />
        <Sparkles aria-hidden="true" className="pointer-events-none absolute -right-3 top-2/3 h-3.5 w-3.5 !text-terracotta/70" />
        <Sparkles aria-hidden="true" className="pointer-events-none absolute -left-3 bottom-12 h-3 w-3 !text-terracotta/80" />

        {/* ════════ MAIN CARD ════════ */}
        <div className="relative z-10 overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-black/5">

          {/* Card header · eyebrow + title + 3-step stepper */}
          <div className="flex items-start justify-between gap-3 border-b border-violet/10 px-6 pt-3.5 pb-2.5">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] !text-violet">
                Booking <span aria-hidden="true">·</span> {t("hero.discoveryCall")}
              </span>
              {/* Decorative mock-UI title — styled like a heading but not part of
                  the document outline (it would skip a level after the page h1). */}
              <p className="mt-1.5 text-[17px] font-bold leading-tight !text-violet">
                {t("hero.scheduleCall")}
              </p>
            </div>
            <ol className="flex shrink-0 items-center gap-1 pt-0.5 text-[10px] font-semibold !text-charcoal">
              {[
                { n: 1, label: "Date", active: true },
                { n: 2, label: "Time", active: false },
                { n: 3, label: "Confirm", active: false },
              ].map(({ n, label, active }, i) => (
                <li key={n} className="flex items-center gap-1.5">
                  <m.span
                    animate={
                      reduce || !active
                        ? undefined
                        : { boxShadow: [
                            "0 0 0 0 rgb(var(--color-violet-rgb)/0.35)",
                            "0 0 0 6px rgb(var(--color-violet-rgb)/0)",
                            "0 0 0 0 rgb(var(--color-violet-rgb)/0)",
                          ] }
                    }
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      active ? "bg-violet !text-white" : "bg-violet-pale !text-violet",
                    ].join(" ")}
                  >
                    {n}
                  </m.span>
                  <span className={active ? "!text-violet" : "!text-charcoal/65"}>{label}</span>
                  {i < 2 && <span aria-hidden="true" className="h-px w-3 bg-violet/20" />}
                </li>
              ))}
            </ol>
          </div>

          {/* Timezone strip + live availability indicator */}
          <div className="flex items-center justify-between gap-2 bg-violet-ghost px-6 py-1.5">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold !text-charcoal">
              <Globe className="h-3.5 w-3.5 !text-violet" aria-hidden="true" />
              America/Mexico_City
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold !text-mint-600 ring-1 ring-mint-600/25">
              <span className="relative flex h-1.5 w-1.5">
                <m.span
                  aria-hidden="true"
                  animate={reduce ? undefined : { scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-mint-600"
                />
                <span className="relative h-1.5 w-1.5 rounded-full bg-mint-600" />
              </span>
              {t("hero.liveAvailability")}
            </span>
          </div>

          {/* Calendar body */}
          <div className="px-5 pt-2.5 pb-3">
            {/* Month nav header */}
            <div className="mb-1.5 flex items-center justify-between">
              <button
                type="button"
                aria-label={t("hero.prevMonthAria")}
                className="flex h-6 w-6 items-center justify-center rounded-full !text-violet/45 transition hover:bg-violet-pale hover:!text-violet"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-[12.5px] font-bold tracking-wide !text-violet">
                May 2026
              </div>
              <button
                type="button"
                aria-label={t("hero.nextMonthAria")}
                className="flex h-6 w-6 items-center justify-center rounded-full !text-violet/45 transition hover:bg-violet-pale hover:!text-violet"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day-of-week labels */}
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase tracking-[0.12em] !text-charcoal/65">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            {/* Animated day grid · staggered fade-in */}
            <m.div
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.018, delayChildren: 0.55 } },
              }}
              initial="hidden"
              animate="show"
              className="grid grid-cols-7 gap-1"
            >
              {DAYS.map((d, idx) => (
                <DayCell key={idx} idx={idx} reduce={reduce} {...d} />
              ))}
            </m.div>

            {/* Status legend */}
            <ul className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-violet/10 pt-2 text-[10px] font-semibold !text-charcoal">
              {LEGEND.map(({ key, labelKey, swatch }) => (
                <li key={key} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
                  {t(labelKey)}
                </li>
              ))}
            </ul>
          </div>

          {/* Card footer · primary CTA */}
          <div className="border-t border-violet/10 bg-white px-5 py-2.5">
            <Link
              to="/book"
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-violet px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] !text-white shadow-[0_10px_22px_rgb(var(--color-violet-rgb)/0.30)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/45"
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {t("hero.pickSlot")}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* ── Floating "Just shipped" toast · recurs every cycle ── */}
        <m.div
          aria-hidden="true"
          initial={{ opacity: 0, y: 12, x: -8 }}
          animate={
            reduce
              ? { opacity: 1, y: 0, x: 0 }
              : {
                  opacity: [0, 0, 1, 1, 0],
                  y: [14, 0, 0, 0, -6],
                  x: [-8, 0, 0, 0, 0],
                }
          }
          transition={
            reduce
              ? { duration: 0.4, delay: 1.6 }
              : {
                  duration: 7,
                  delay: 1.6,
                  repeat: Infinity,
                  repeatDelay: 4,
                  times: [0, 0.08, 0.18, 0.85, 1],
                  ease: "easeInOut",
                }
          }
          className="absolute -bottom-4 -left-5 z-30 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_18px_38px_rgba(0,0,0,0.30)] ring-1 ring-black/5"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint-400/25">
            <Rocket className="h-3.5 w-3.5 !text-[#1f3508]" />
          </span>
          <div className="leading-tight">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.14em] !text-[#1f3508]">
              {t("hero.justShipped")}
            </div>
            <div className="text-[11px] font-semibold !text-charcoal">
              {t("hero.shippedExample")}
            </div>
          </div>
        </m.div>

        {/* ── "{t("hero.letsBuildCheck")}" hand-stamp · bottom-right ─ */}
        <m.div
          aria-hidden="true"
          initial={{ rotate: -12 }}
          animate={
            reduce
              ? { rotate: -12 }
              : { y: [0, -3, 0], rotate: [-12, -10, -12] }
          }
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-4 -bottom-5 z-30 origin-center"
        >
          <div className="rounded-md border-[1.5px] border-[#1f2937] bg-white px-3 py-1 shadow-[0_10px_24px_rgba(0,0,0,0.30)]">
            <span
              style={{ fontFamily: "var(--font-script)" }}
              className="text-[15px] font-extrabold !text-[#1f3508]"
            >
              {t("hero.letsBuildCheck")}
            </span>
          </div>
        </m.div>

        {/* ── Tiny "check" rosette top-right (kept from V4) ──────── */}
        <m.div
          aria-hidden="true"
          animate={reduce ? undefined : { rotate: [0, 8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-6 top-20 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-terracotta"
        >
          <CheckCircle2 className="h-3.5 w-3.5 !text-mint-600" />
        </m.div>
      </m.div>
    </m.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
export default function ContactHero() {
  const { t } = useTranslation("contact")
  const reduce = useReducedMotion()

  /* Common idle-orb transition — long, slow, never abrupt. */
  const orbTransition = (duration, delay = 0) => ({
    duration,
    delay,
    repeat: Infinity,
    repeatType: "mirror",
    ease: "easeInOut",
  })

  return (
    <>
      <Seo {...(pageSeo.contact || pageSeo.about || {})} includeLocalBusiness />

      <section
        className="relative overflow-hidden py-12 sm:py-16 lg:py-20"
        style={{
          backgroundImage:
            "radial-gradient(80% 70% at 80% 20%, var(--color-action-primary-active) 0%, var(--color-charcoal) 45%, var(--color-charcoal-deep) 100%)",
        }}
      >
        {/* ── Drifting orbs (violet × 2 + terracotta) ────────────── */}
        <m.div
          aria-hidden="true"
          animate={reduce ? undefined : { x: [0, 14, 0], y: [0, 10, 0] }}
          transition={orbTransition(12)}
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet/35 blur-[110px]"
        />
        <m.div
          aria-hidden="true"
          animate={reduce ? undefined : { x: [0, -12, 0], y: [0, 14, 0] }}
          transition={orbTransition(14, 0.6)}
          className="pointer-events-none absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-terracotta/15 blur-[100px]"
        />
        <m.div
          aria-hidden="true"
          animate={reduce ? undefined : { x: [0, 10, 0], y: [0, -8, 0] }}
          transition={orbTransition(15, 1.2)}
          className="pointer-events-none absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-violet/20 blur-[120px]"
        />

        {/* ── 44 px grid texture (≈3.5% opacity) ─────────────────── */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
          aria-hidden="true"
        />

        {/* ── Vignette to focus on center copy ───────────────────── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.45) 100%)",
          }}
          aria-hidden="true"
        />

        {/* ── Content ────────────────────────────────────────────── */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-12 xl:gap-16">

            {/* LEFT COLUMN · narrative + CTAs + trust pills */}
            <m.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center gap-5 text-center sm:gap-6 lg:items-start lg:text-left"
            >

              {/* Live availability badge · NEW */}
              <m.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] !text-mint ring-1 ring-mint/25 backdrop-blur-sm sm:text-[11px]"
              >
                <span className="relative flex h-2 w-2">
                  <m.span
                    aria-hidden="true"
                    animate={reduce ? undefined : { scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-mint"
                  />
                  <span className="relative h-2 w-2 rounded-full bg-mint" />
                </span>
                {t("hero.onlineReplies")}
              </m.div>

              {/* Eyebrow · soft inner glow (PRESERVED) */}
              <m.span
                variants={fadeUp}
                className="relative inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] !text-terracotta ring-1 ring-white/15 backdrop-blur-sm sm:text-[11px]"
              >
                <span
                  className="pointer-events-none absolute inset-0 rounded-full opacity-60"
                  style={{
                    background:
                      "radial-gradient(60% 100% at 50% 0%, rgb(var(--color-terracotta-rgb)/0.18), transparent 70%)",
                  }}
                  aria-hidden="true"
                />
                <Sparkles className="relative h-3.5 w-3.5" aria-hidden="true" />
                <span className="relative">{t("hero.letsConnect")}</span>
              </m.span>

              {/* Headline · PRESERVED */}
              <m.h1
                variants={fadeUp}
                className="max-w-3xl text-display !text-white"
              >
                {t("hero.startYourDigital")}{" "}
                <span
                  className="!text-terracotta"
                  style={{
                    background:
                      "linear-gradient(180deg, #FFD9BB 0%, var(--color-terracotta) 50%, #F0B58C 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Transformation
                </span>
              </m.h1>

              {/* Subhead · PRESERVED */}
              <m.p
                variants={fadeUp}
                className="max-w-xl text-[14px] leading-6 !text-white/65 sm:text-[15px] sm:leading-7 md:text-[16px]"
              >
                {t("hero.longCta")}
              </m.p>

              {/* CTAs · NEW */}
              <m.div
                variants={fadeUp}
                className="mt-2 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-3.5"
              >
                <Link
                  to="/book"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-terracotta px-7 py-3.5 text-[13.5px] font-bold !text-violet-deep shadow-[0_14px_36px_rgb(var(--color-terracotta-rgb)/0.25)] transition hover:-translate-y-0.5 hover:bg-[#ffd9be] focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:text-[14px]"
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {t("hero.bookDiscovery")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <a
                  href="#contact-form"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/[0.05] px-7 py-3.5 text-[13.5px] font-semibold !text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/[0.10] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:text-[14px]"
                >
                  {t("hero.sendMessage")}
                </a>
              </m.div>

              {/* Trust pills · PRESERVED */}
              <m.ul
                variants={fadeUp}
                className="mt-2 flex w-full list-none flex-wrap justify-center gap-2.5 p-0 sm:gap-4 lg:justify-start"
              >
                {TRUST_PILLS.map(({ Icon, label, value }) => (
                  <li
                    key={label}
                    className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] sm:px-5 sm:py-3"
                  >
                    {/* Hover trail · soft violet glow that fades in */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(80% 100% at 50% 100%, rgb(var(--color-violet-rgb)/0.25), transparent 70%)",
                      }}
                    />
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15 transition group-hover:bg-white/15 sm:h-9 sm:w-9">
                      <Icon
                        className="h-4 w-4 text-terracotta sm:h-[18px] sm:w-[18px]"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-[10px] font-medium !text-white/55 sm:text-[11px]">
                        {label}
                      </span>
                      <span className="block text-[13px] font-semibold !text-white sm:text-[14px]">
                        {value}
                      </span>
                    </span>
                  </li>
                ))}
              </m.ul>
            </m.div>

            {/* RIGHT COLUMN · animated booking calendar (lg+ only) */}
            <BookingCalendar reduce={reduce} />

          </div>
        </div>
      </section>
    </>
  )
}
