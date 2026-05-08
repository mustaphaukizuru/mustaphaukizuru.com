/* ════════════════════════════════════════════════════════════════════════
   SolutionsHero.jsx · Modernized 2-col hero · senior UX redesign
   ────────────────────────────────────────────────────────────────────────
   Left column · narrative
     · Bicolor display headline
     · Subhead
     · Two CTAs (filled violet · ghost outlined)
     · Inline social-proof line with star strip + customer count

   Right column · rich data card
     · Header: icon tile + title + LIVE pulse + year
     · Floating "+18% YoY" badge overlapping top-right corner
     · Main bar chart · 4 quarters · per-bar brand palette · peak in
       violet gradient with annotation overlay (leader line + On-Track tag)
     · 3-cell KPI strip beneath the chart (On-Time · Avg Delivery · NPS)
     · Footer · avatar stack (4 initials + count chip) · "{t("hero.updatedAgo")}"
     · Numbers count up on mount · annotation lines stroke-draw
     · Hover micro-interactions on every interactive element
   Respects `prefers-reduced-motion`.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion, useInView } from "framer-motion"
import { Link } from "react-router-dom"
import {
  ArrowRight, BarChart3, TrendingUp, CheckCircle2, Clock, Star,
  Users, RefreshCw, Sparkles,
} from "lucide-react"

/* ── Animation variants ─────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

/* ── CountUp · animates a number from 0 → target when in view ───────────── */
function CountUp({ to, duration = 1.4, decimals = 0, suffix = "", prefix = "", reduce, delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduce) { setN(to); return }
    let raf
    const start = performance.now() + delay * 1000
    const tick = (t) => {
      if (t < start) { raf = requestAnimationFrame(tick); return }
      const p = Math.min((t - start) / (duration * 1000), 1)
      setN(p * to)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to, duration, reduce, delay])

  const display = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString()
  return <span ref={ref}>{prefix}{display}{suffix}</span>
}

/* ── Quarter data · per-bar palette ─────────────────────────────────────── */
const QUARTERS = [
  { label: "Q1", period: "01-26", value: 45, fill: "bg-azure/25", text: "text-azure" },
  { label: "Q2", period: "04-26", value: 62, fill: "bg-mint/25", text: "text-mint" },
  { label: "Q3", period: "07-26", value: 88, peak: true },
  { label: "Q4", period: "10-26", value: 54, fill: "bg-terracotta/30", text: "text-terracotta-deep" },
]

/* ── KPI strip data ─────────────────────────────────────────────────────── */
const KPIS = [
  { value: 94, suffix: "%", label: "On-Time", sub: "Delivery rate", icon: CheckCircle2, accent: "text-mint", bg: "bg-mint/12" },
  { value: 18, suffix: " d", label: "Avg Time", sub: "Per program", icon: Clock, accent: "text-azure", bg: "bg-azure/12" },
  { value: 9.2, decimals: 1, label: "NPS", sub: "Customer score", icon: Star, accent: "text-terracotta-deep", bg: "bg-terracotta/15" },
]

/* ── Avatar stack data ──────────────────────────────────────────────────── */
const AVATARS = [
  { initials: "MR", bg: "bg-violet" },
  { initials: "JK", bg: "bg-terracotta" },
  { initials: "AL", bg: "bg-mint" },
  { initials: "SD", bg: "bg-azure" },
]

/* ── Outcomes chart card · the centerpiece ──────────────────────────────── */
function OutcomesCard({ reduce }) {
  const { t } = useTranslation("solutions")
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[460px] lg:max-w-none"
    >
      {/* Floating "+18% YoY" badge · overlapping top-right corner */}
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.0, type: "spring", stiffness: 240, damping: 16 }}
        className="absolute -right-2 -top-3 z-30 flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_8px_20px_rgba(40,167,69,0.30)] sm:-right-4 sm:text-[12px]"
      >
        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
        {t("hero.yoyGrowth")}
      </motion.div>

      {/* Card */}
      <div className="relative overflow-hidden rounded-3xl border border-charcoal-80/8 bg-mist p-5 shadow-[0_18px_50px_rgba(93,63,211,0.10)] sm:p-6">

        {/* ── Card header ───────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet text-white shadow-[0_6px_16px_rgba(93,63,211,0.25)]">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold leading-tight !text-charcoal-80 sm:text-[18px]">
                {t("hero.solutionsShipped")}
              </h3>
              <p className="mt-0.5 text-[11px] font-semibold text-charcoal-80/55 sm:text-[12px]">
                <CountUp to={8} reduce={reduce} duration={0.9} /> {t("hero.activePrograms")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* LIVE pulse */}
            <div className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-charcoal-80/8">
              <span className="relative flex h-2 w-2">
                <motion.span
                  animate={reduce ? undefined : { scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-mint"
                />
                <span className="relative h-2 w-2 rounded-full bg-mint" />
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
                {t("hero.liveBadge")}
              </span>
            </div>
            <span className="text-[14px] font-bold !text-charcoal-80 sm:text-[16px]">
              2026
            </span>
          </div>
        </div>

        {/* ── Chart area · height reduced 40% ───────────────────── */}
        <div className="relative mt-5 h-[114px] sm:mt-6 sm:h-[120px]">

          {/* Annotation text · top-left */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.0 }}
            className="absolute left-0 top-0 z-20 max-w-[44%]"
          >
            <p className="text-[11px] font-semibold leading-tight !text-violet sm:text-[12px]">
              <CountUp to={88} suffix="%" reduce={reduce} duration={1.0} delay={0.4} /> {t("hero.peakDeliveryIn")}
              <br />
              {t("hero.peakQuarter")}
            </p>
          </motion.div>

          {/* Mini "88%" floating label */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.3 }}
            className="absolute left-1/2 top-0 z-20 -translate-x-2"
          >
            <p className="text-[11px] font-semibold text-charcoal-80/65 sm:text-[12px]">
              <CountUp to={88} suffix="%" reduce={reduce} duration={1.0} delay={0.6} />
            </p>
          </motion.div>

          {/* On-Track tag */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, x: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 1.5, type: "spring", stiffness: 300, damping: 18 }}
            className="absolute right-2 top-[16%] z-20 flex items-center gap-1 rounded-md bg-charcoal-80 px-2 py-1 text-[10.5px] font-semibold !text-white shadow-md sm:px-2.5 sm:text-[11px]"
          >
            <Sparkles className="h-3 w-3 text-mint" aria-hidden="true" />
            {t("hero.onTrack")}
          </motion.div>

          {/* BARS · 4 columns · top/bottom chrome rescaled for the 40% shorter chart */}
          <div className="absolute inset-x-0 bottom-5 top-7 grid grid-cols-4 items-end gap-3 sm:gap-4">
            {QUARTERS.map((q, i) => {
              const isPeak = q.peak
              const barFill = isPeak
                ? "bg-gradient-to-b from-violet via-violet to-violet-deep shadow-[0_10px_24px_rgba(93,63,211,0.30)]"
                : `${q.fill} hover:opacity-80`
              const valueText = isPeak ? "!text-violet" : q.text
              return (
                <div key={q.label} className="group relative flex h-full flex-col items-center justify-end">
                  {/* Percent label above bar */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
                    className={`mb-1 text-[12px] font-bold sm:text-[13px] ${valueText}`}
                  >
                    <CountUp to={q.value} suffix="%" reduce={reduce} duration={1.0} delay={0.5 + i * 0.1} />
                  </motion.div>

                  {/* Soft glow halo behind the peak bar · pulses continuously */}
                  {isPeak && (
                    <motion.div
                      aria-hidden="true"
                      animate={reduce ? undefined : { opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
                      transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut" }}
                      className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full rounded-t-3xl bg-violet/30 blur-xl"
                      style={{ height: `${q.value}%` }}
                    />
                  )}

                  {/* Bar */}
                  <motion.div
                    initial={{ height: "0%" }}
                    animate={{ height: `${q.value}%` }}
                    transition={{
                      duration: 1.0,
                      delay: 0.4 + i * 0.12,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={{ scale: 1.04, y: -2 }}
                    className={`relative z-10 w-full rounded-t-2xl transition-all ${barFill}`}
                    style={{ minHeight: 8 }}
                  />

                  {/* Period chip below bar */}
                  <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
                    {isPeak ? (
                      <motion.span
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 1.1 }}
                        className="rounded-md bg-charcoal-80 px-2 py-0.5 text-[10px] font-semibold !text-white"
                      >
                        {q.period}
                      </motion.span>
                    ) : (
                      <span className="text-[10.5px] font-medium text-charcoal-80/45">
                        {q.period}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="my-5 h-px bg-gradient-to-r from-transparent via-charcoal-80/12 to-transparent" />

        {/* ── KPI strip · 3 mini stat boxes ───────────────────── */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {KPIS.map((k, i) => {
            const Icon = k.icon
            return (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.3 + i * 0.08 }}
                whileHover={{ y: -3, scale: 1.02 }}
                className="flex flex-col gap-1 rounded-xl border border-charcoal-80/8 bg-white p-2.5 transition-shadow hover:shadow-[0_8px_20px_rgba(93,63,211,0.08)]"
              >
                <div className="flex items-center justify-between">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${k.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${k.accent}`} aria-hidden="true" />
                  </div>
                </div>
                <div className="font-mono text-[18px] font-extrabold leading-none tabular-nums !text-charcoal-80 sm:text-[20px]">
                  <CountUp
                    to={k.value}
                    decimals={k.decimals || 0}
                    suffix={k.suffix || ""}
                    reduce={reduce}
                    duration={1.2}
                    delay={1.4 + i * 0.1}
                  />
                </div>
                <div>
                  <div className="text-[10.5px] font-bold !text-charcoal-80 sm:text-[11px]">
                    {k.label}
                  </div>
                  <div className="mt-0.5 text-[9.5px] text-charcoal-80/55 sm:text-[10px]">
                    {k.sub}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className="my-4 h-px bg-gradient-to-r from-transparent via-charcoal-80/12 to-transparent" />

        {/* ── Footer · avatar stack + updated time ─────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {AVATARS.map((a, i) => (
                <motion.div
                  key={a.initials}
                  initial={{ opacity: 0, scale: 0.6, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 1.7 + i * 0.07, type: "spring", stiffness: 280, damping: 18 }}
                  whileHover={{ y: -2, scale: 1.08, zIndex: 10 }}
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${a.bg} text-[9.5px] font-bold !text-white ring-2 ring-mist`}
                >
                  {a.initials}
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, scale: 0.6, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 2.0, type: "spring", stiffness: 280, damping: 18 }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal-80 text-[9px] font-bold !text-white ring-2 ring-mist"
              >
                +<CountUp to={24} reduce={reduce} duration={1.0} delay={1.9} />
              </motion.div>
            </div>
            <div>
              <div className="text-[11px] font-bold !text-charcoal-80 sm:text-[12px]">
                <CountUp to={28} reduce={reduce} duration={1.0} delay={1.9} /> {t("hero.schoolsServed")}
              </div>
              <div className="text-[9.5px] text-charcoal-80/55 sm:text-[10px]">
                {t("hero.countriesContinents")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-charcoal-80/55 sm:text-[10.5px]">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {t("hero.updatedAgo")}
          </div>
        </div>

        {/* View report link · subtle, full width, hover lifts arrow */}
        <motion.a
          href="#segmented-anchor"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 2.2 }}
          whileHover={{ x: 2 }}
          className="group/link mt-3.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] !text-violet transition hover:!text-violet-deep"
        >
          {t("hero.viewFullReport")}
          <ArrowRight className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
        </motion.a>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
export default function SolutionsHero() {
  const { t } = useTranslation("solutions")
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-white py-12 sm:py-16 lg:py-20">

      {/* Soft ambient blobs */}
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [0, 24, 0], y: [0, 16, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-20 right-1/4 h-72 w-72 rounded-full bg-violet/[0.06] blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [0, -20, 0], y: [0, -12, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
        className="pointer-events-none absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-terracotta/[0.08] blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">

          {/* ── LEFT · narrative ──────────────────────────────────── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="max-w-xl"
          >
            {/* Eyebrow chip */}
            <motion.div
              variants={fadeUp}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t("hero.solutionsEyebrow")}
            </motion.div>

            {/* Display headline · bicolor */}
            <motion.h1
              variants={fadeUp}
              className="mt-5 text-display !text-charcoal-80"
            >
              {t("hero.achieveReal")}
              <br className="hidden sm:block" />
              <span className="!text-violet"> {t("hero.withProductized")}</span>
              <br className="hidden sm:block" />
              <span className="!text-violet"> {t("hero.solutionsWord")}</span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-md text-[15px] leading-7 text-charcoal-80/65 sm:text-[16px]"
            >
              {t("hero.longSubtitle")}
            </motion.p>

            {/* Social proof line */}
            <motion.div
              variants={fadeUp}
              className="mt-5 flex flex-wrap items-center gap-3 text-[12px] text-charcoal-80/65"
            >
              <span className="inline-flex items-center gap-0.5 text-terracotta-deep" aria-label={t("hero.fiveStarAria")}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </span>
              <span className="font-semibold !text-charcoal-80">
                {t("hero.trustCountries")}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t("hero.yearsShipping")}</span>
            </motion.div>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4"
            >
              {/* Primary conversion CTA, Innovation Gradient (Brand v3 sacred). */}
              <Link
                to="/book"
                aria-label={t("hero.getStartedAria")}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-grad-innovation px-7 py-3.5 text-[14px] font-bold !text-white shadow-[0_16px_38px_-10px_rgba(93,63,211,0.55),0_4px_10px_-2px_rgba(2,132,199,0.25)] ring-1 ring-inset ring-white/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-10px_rgba(93,63,211,0.65),0_6px_14px_-2px_rgba(2,132,199,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/50 focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent"
                />
                <span className="relative">{t("hero.getStarted")}</span>
                <ArrowRight className="relative h-4 w-4 !text-white transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>

              <a
                href="#segmented-anchor"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-charcoal-80/20 bg-white px-7 py-3.5 text-[14px] font-bold !text-charcoal-80 transition hover:-translate-y-0.5 hover:border-violet/30 hover:!text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/30"
              >
                {t("hero.ourSolutions")}
              </a>
            </motion.div>
          </motion.div>

          {/* ── RIGHT · outcomes data card ─────────────────────────── */}
          <OutcomesCard reduce={reduce} />
        </div>
      </div>
    </section>
  )
}
