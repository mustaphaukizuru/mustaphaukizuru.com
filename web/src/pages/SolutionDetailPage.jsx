/* ════════════════════════════════════════════════════════════════════════
   SolutionDetailPage.jsx · route /solutions/:slug
   ────────────────────────────────────────────────────────────────────────
   Renders any of the 8 productized solution packages from
   web/src/data/solutionsCatalogue.js. Source of truth is local catalogue
   data — no API call — so the page never 404s once the slug is valid.

   Anatomy (Brand v3.0):
     § Hero          Audience eyebrow + name + outcome + spec strip + CTAs
                     (Innovation Gradient on the primary "Book a call" —
                     once per viewport, per the Sacred Rule)
     § Deliverables  Headline outcomes from solution.headlineDeliverables
     § Timeline      Phased delivery from solution.timelinePhases
     § Pricing       Essential / Complete / Premium tiers
     § Composed of   Atomic services reverse-linked to parent /services/:slug
     § Related       3 other packages targeting the same audience
     § Final CTA     Charcoal banner → /book/:slug
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Calendar, Clock,
  Sparkles, ChevronRight, Star, Users, AlertCircle,
  Package as PackageIcon, FileText,
} from "lucide-react"

import Seo from "../components/seo/Seo"
import Breadcrumbs from "../components/Breadcrumbs"
import { breadcrumbSchema } from "../seo/schemas"
import Reveal from "../components/motion/Reveal"

import {
  getSolutionBySlug, SOLUTION_PACKAGES,
  SOLUTION_PLANS, SOLUTION_PLAN_TIERS,
} from "../data/solutionsCatalogue"
import { SERVICES, AUDIENCE_LABELS } from "../data/servicesCatalogue"

/* ── Motion variants ─────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/* ── Container atom (matches the rest of the public surface) ─────────────── */
function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

/* ── Reverse-link composed services ──────────────────────────────────────
   Each solution lists composed atomic services by UKZ-XX-### ID, where XX
   is the 2-letter parent service code (CS, BD, IC, WD, ET, MS). We group
   by parent so the page renders one card per category with the count of
   composed services, and link each card back to /services/:slug.
   ──────────────────────────────────────────────────────────────────────── */
const SERVICE_BY_CODE = SERVICES.reduce((acc, s) => { acc[s.code] = s; return acc }, {})

function parseUkzCode(ukzId) {
  const m = /^UKZ-([A-Z]{2})-\d+$/.exec(ukzId || "")
  return m ? m[1] : null
}

/* ── Plan tier visual tokens — token-pure (Brand v3 § 04) ─────────────── */
const PLAN_TONES = {
  azure:      { surface: "bg-white",   ring: "ring-azure/15",            border: "border-azure/15",            accent: "text-azure-deep",      price: "text-azure-deep" },
  violet:     { surface: "bg-violet",  ring: "ring-violet/30",           border: "border-violet",              accent: "text-white",           price: "text-white"      },
  terracotta: { surface: "bg-white",   ring: "ring-terracotta-deep/25",  border: "border-terracotta-deep/25",  accent: "text-terracotta-deep", price: "text-charcoal"   },
}

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function SolutionDetailPage() {
  const { slug } = useParams()
  const reduce = useReducedMotion()

  const solution = getSolutionBySlug(slug)
  const plans = solution ? SOLUTION_PLANS[solution.slug] || null : null

  // Related packages — up to 3 other solutions sharing an audience.
  const related = useMemo(() => {
    if (!solution) return []
    const myAudiences = solution.audience.split(",")
    return SOLUTION_PACKAGES
      .filter((p) => p.slug !== solution.slug)
      .filter((p) => p.audience.split(",").some((a) => myAudiences.includes(a)))
      .slice(0, 3)
  }, [solution])

  // Composed-service breakdown: group UKZ-XX-### codes by parent service.
  const composedByCategory = useMemo(() => {
    if (!solution) return []
    const counts = {}
    for (const ukz of solution.composedOf || []) {
      const code = parseUkzCode(ukz)
      if (!code) continue
      counts[code] = (counts[code] || 0) + 1
    }
    return Object.entries(counts).map(([code, count]) => ({
      code,
      count,
      parent: SERVICE_BY_CODE[code] || null,
    }))
  }, [solution])

  /* ── Not found — fall back to the Solutions index ─────────────────── */
  if (!solution) {
    return <Navigate to="/solutions" replace />
  }

  const Icon = solution.Icon
  const audienceCodes = solution.audience.split(",")

  return (
    <div className="min-h-[60vh] bg-mist">
      <Seo
        title={`${solution.name} · Solution package`}
        description={solution.outcome}
        jsonLd={[
          breadcrumbSchema([
            { name: "Solutions", url: "/solutions" },
            { name: solution.name, url: `/solutions/${solution.slug}` },
          ]),
        ]}
      />

      {/* Breadcrumb bar */}
      <div className="border-b border-charcoal/8 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
          <Breadcrumbs />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
         HERO
         ════════════════════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden border-b border-charcoal/8 bg-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-[18%] h-[420px] w-[420px] rounded-full bg-violet/8 blur-3xl" />
          <div className="absolute top-1/4 right-[10%] h-[360px] w-[360px] rounded-full bg-azure/8 blur-3xl" />
          <div className="absolute bottom-0 left-[30%] h-[260px] w-[260px] rounded-full bg-cyan/8 blur-3xl" />
        </div>

        <Container className="py-12 sm:py-16 lg:py-20">
          <nav className="mb-5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-charcoal/55">
            <Link to="/" className="transition-colors hover:text-violet">Home</Link>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <Link to="/solutions" className="transition-colors hover:text-violet">Solutions</Link>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="font-semibold text-violet">{solution.name}</span>
          </nav>

          <motion.div initial="hidden" animate="show" variants={stagger} className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            <motion.div variants={fadeUp}>
              <div className="flex flex-wrap items-center gap-2">
                {audienceCodes.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-violet"
                  >
                    <Users className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                    {AUDIENCE_LABELS?.[c]?.label || solution.audienceLabel}
                  </span>
                ))}
                {solution.primary && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/15 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-charcoal">
                    <Sparkles className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                    Flagship
                  </span>
                )}
              </div>

              <h1 className="mt-4 text-[var(--text-hero)] font-extrabold tracking-tight text-charcoal text-balance">
                {solution.name}
              </h1>
              <p className="mt-4 max-w-[var(--measure)] text-[clamp(15px,1.4vw,18px)] leading-relaxed text-charcoal/75">
                {solution.outcome}
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-xl border border-charcoal/12 bg-white px-3 py-2 text-[12.5px] text-charcoal/80">
                  <Clock className="h-3.5 w-3.5 text-violet" strokeWidth={1.8} aria-hidden="true" />
                  <span className="font-semibold">Duration:</span> {solution.duration}
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-charcoal/12 bg-white px-3 py-2 text-[12.5px] text-charcoal/80">
                  <FileText className="h-3.5 w-3.5 text-violet" strokeWidth={1.8} aria-hidden="true" />
                  <span className="font-semibold">Pricing:</span> {solution.pricingModel}
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-charcoal/12 bg-white px-3 py-2 text-[12.5px] text-charcoal/80">
                  <PackageIcon className="h-3.5 w-3.5 text-violet" strokeWidth={1.8} aria-hidden="true" />
                  <span className="font-semibold">Composed of:</span> {solution.composedOf?.length || 0} services
                </span>
              </div>

              {/* Primary CTA carries the Innovation Gradient — sacred, once per viewport */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={`/book/${solution.slug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-grad-innovation px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(93,63,211,0.55)] transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Book a discovery call
                  <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </Link>
                <Link
                  to={`/contact?topic=${encodeURIComponent(solution.slug)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-violet/30 bg-white px-5 py-3 text-[14px] font-semibold text-violet transition-colors duration-[var(--motion-base)] hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/35 focus-visible:ring-offset-2"
                >
                  Request a written proposal
                </Link>
              </div>
            </motion.div>

            <motion.aside
              variants={fadeUp}
              className="relative overflow-hidden rounded-[var(--radius-lg)] bg-charcoal p-6 text-white ring-1 ring-charcoal-light/30 sm:p-8"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet/35 blur-3xl" />
              <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-azure/25 blur-3xl" />

              <div className="relative">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${solution.iconBg || "bg-violet/15"} ${solution.iconText || "text-violet-light"}`}>
                  <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className="mt-5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cyan">
                  Best for
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                  {solution.bestFor}
                </p>
                <div className="mt-6 border-t border-white/15 pt-5">
                  <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Tagline
                  </p>
                  <p className="mt-1.5 text-[14px] italic text-white/80">
                    &ldquo;{solution.tagline}&rdquo;
                  </p>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        </Container>
      </section>

      {/* ════════════════════════════════════════════════════════════════
         HEADLINE DELIVERABLES
         ════════════════════════════════════════════════════════════════ */}
      {Array.isArray(solution.headlineDeliverables) && solution.headlineDeliverables.length > 0 && (
        <section className="py-14 sm:py-16 lg:py-20">
          <Container>
            <Reveal>
              <div className="mb-10 flex flex-col gap-3">
                <span className="eyebrow inline-flex items-center gap-2 self-start text-violet">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  What you get
                </span>
                <h2 className="text-[var(--text-section)] font-extrabold tracking-tight text-charcoal text-balance">
                  Outcomes delivered, in writing
                </h2>
                <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-steel">
                  Every package is scoped before kickoff. These are the deliverables you receive — not aspirations.
                </p>
              </div>
            </Reveal>

            <motion.ul
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={stagger}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4"
            >
              {solution.headlineDeliverables.map((d, i) => (
                <motion.li
                  key={i}
                  variants={fadeUp}
                  whileHover={reduce ? undefined : { y: -2 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="group flex items-start gap-3 rounded-[var(--radius-md)] border border-charcoal/8 bg-white p-4 transition-shadow duration-[var(--motion-base)] hover:shadow-[0_18px_40px_-16px_rgba(15,23,42,0.18)] sm:p-5"
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mint/15 text-mint">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="text-[14px] font-medium leading-snug text-charcoal">{d}</span>
                </motion.li>
              ))}
            </motion.ul>
          </Container>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
         TIMELINE PHASES
         ════════════════════════════════════════════════════════════════ */}
      {Array.isArray(solution.timelinePhases) && solution.timelinePhases.length > 0 && (
        <section className="border-t border-charcoal/8 bg-white py-14 sm:py-16 lg:py-20">
          <Container>
            <Reveal>
              <div className="mb-10 flex flex-col gap-3">
                <span className="eyebrow inline-flex items-center gap-2 self-start text-violet">
                  <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  How it ships
                </span>
                <h2 className="text-[var(--text-section)] font-extrabold tracking-tight text-charcoal text-balance">
                  Phased delivery on a fixed timeline
                </h2>
                <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-steel">
                  Weekly sprints with visible checkpoints. Adjustments are included within the agreed scope.
                </p>
              </div>
            </Reveal>

            <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-6 right-6 top-9 hidden h-0.5 bg-gradient-to-r from-violet/30 via-azure/30 to-cyan/30 lg:block"
              />
              {solution.timelinePhases.map((phase, idx) => (
                <Reveal key={idx} as="li" delay={idx * 0.06}>
                  <div className="relative rounded-[var(--radius-md)] border border-charcoal/8 bg-mist p-5 sm:p-6">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet font-mono text-[11px] font-bold tabular-nums text-white shadow-[0_4px_12px_-2px_rgba(93,63,211,0.4)]">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="ml-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-violet">
                      {phase.label}
                    </span>
                    <h3 className="mt-3 text-[16px] font-bold text-charcoal sm:text-[17px]">
                      {phase.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-snug text-charcoal/65">
                      {phase.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </Container>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
         PRICING TIERS — Essential / Complete / Premium
         ════════════════════════════════════════════════════════════════ */}
      {plans && (
        <section className="py-14 sm:py-16 lg:py-20">
          <Container>
            <Reveal>
              <div className="mb-10 flex flex-col items-center gap-3 text-center sm:mb-14">
                <span className="eyebrow inline-flex items-center gap-2 text-violet">
                  <Star className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  Pricing tiers
                </span>
                <h2 className="text-[var(--text-section)] font-extrabold tracking-tight text-charcoal text-balance">
                  Pick the tier that matches your scope
                </h2>
                <p className="max-w-[var(--measure-tight)] text-[15px] leading-relaxed text-steel">
                  Every tier is fixed scope and fixed price. No surprise invoices, no hidden retainers.
                </p>
              </div>
            </Reveal>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              variants={stagger}
              className="grid gap-5 md:grid-cols-3 md:gap-6"
            >
              {SOLUTION_PLAN_TIERS.map((tier) => {
                const plan = plans[tier.key]
                if (!plan) return null
                const tone = PLAN_TONES[tier.tone] || PLAN_TONES.azure
                const popular = tier.popular || plan.popular

                return (
                  <motion.div
                    key={tier.key}
                    variants={fadeUp}
                    whileHover={reduce ? undefined : { y: -3 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative flex flex-col rounded-[var(--radius-lg)] border ${tone.border} ${tone.surface} p-6 ring-1 ${tone.ring} sm:p-7 ${
                      popular
                        ? "shadow-[0_24px_60px_-20px_rgba(93,63,211,0.35)]"
                        : "shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
                    }`}
                  >
                    {popular && (
                      <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-charcoal shadow-sm">
                        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                        Most popular
                      </span>
                    )}

                    <span className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] ${tone.accent} opacity-80`}>
                      {tier.label}
                    </span>
                    <h3 className={`mt-1.5 text-[20px] font-bold ${popular ? "text-white" : "text-charcoal"}`}>
                      {plan.name}
                    </h3>
                    <p className={`mt-1 text-[13px] ${popular ? "text-white/75" : "text-charcoal/65"}`}>
                      {plan.label}
                    </p>

                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className={`font-mono text-[10.5px] uppercase tracking-[0.18em] ${popular ? "text-white/65" : "text-charcoal/55"}`}>
                        from
                      </span>
                      <span className={`font-mono text-[clamp(26px,3.6vw,36px)] font-bold tabular-nums ${tone.price}`}>
                        ${Number(plan.priceFromUsd).toLocaleString()}
                      </span>
                      <span className={`font-mono text-[12px] ${popular ? "text-white/65" : "text-charcoal/55"}`}>USD</span>
                    </div>
                    <p className={`font-mono text-[11px] tabular-nums ${popular ? "text-white/55" : "text-charcoal/50"}`}>
                      MX${Number(plan.priceFromMxn).toLocaleString()} · {plan.unit === "monthly" ? "per month" : "one-time"}
                    </p>

                    <ul className={`mt-5 space-y-2.5 border-t pt-5 ${popular ? "border-white/15" : "border-charcoal/8"}`}>
                      {plan.scope.map((s, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2 text-[13px] leading-snug ${popular ? "text-white/85" : "text-charcoal/80"}`}
                        >
                          <CheckCircle2
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${popular ? "text-cyan" : "text-mint"}`}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>

                    <p className={`mt-5 font-mono text-[10.5px] uppercase tracking-[0.18em] ${popular ? "text-white/55" : "text-charcoal/55"}`}>
                      Timeline: {plan.timeline}
                    </p>

                    <Link
                      to={`/contact?topic=${encodeURIComponent(solution.slug)}&tier=${tier.key}`}
                      className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-semibold transition-transform duration-[var(--motion-base)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 ${
                        popular
                          ? "bg-white text-violet shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] focus-visible:ring-cyan/50"
                          : "bg-charcoal text-white hover:bg-charcoal-light focus-visible:ring-azure/35"
                      }`}
                    >
                      Choose {plan.name}
                      <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </motion.div>
                )
              })}
            </motion.div>

            <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-steel/80">
              Prices are senior-consulting anchors · finalized in your written proposal after the 30-min call.
            </p>
          </Container>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
         COMPOSED ATOMIC SERVICES
         ════════════════════════════════════════════════════════════════ */}
      {composedByCategory.length > 0 && (
        <section className="border-t border-charcoal/8 bg-white py-14 sm:py-16">
          <Container>
            <Reveal>
              <div className="mb-10 flex flex-col gap-3">
                <span className="eyebrow inline-flex items-center gap-2 self-start text-violet">
                  <PackageIcon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  Built from the catalogue
                </span>
                <h2 className="text-[var(--text-section)] font-extrabold tracking-tight text-charcoal text-balance">
                  {solution.composedOf?.length || 0} atomic services, bundled into one engagement
                </h2>
                <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-steel">
                  Each package composes existing capabilities from the service catalogue. Any tier can be extended with additional à-la-carte services.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {composedByCategory.map(({ code, count, parent }) => (
                <Reveal key={code} as="div">
                  {parent ? (
                    <Link
                      to={`/services/${parent.slug}`}
                      className="group flex h-full items-start gap-4 rounded-[var(--radius-md)] border border-charcoal/8 bg-mist p-5 transition-all duration-[var(--motion-base)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-violet/25 hover:shadow-[0_18px_40px_-16px_rgba(15,23,42,0.18)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/35 focus-visible:ring-offset-2"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet/12 text-violet">
                        <parent.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-violet">
                            UKZ-{code} · {count} {count === 1 ? "service" : "services"}
                          </span>
                          <ArrowUpRight
                            className="h-3.5 w-3.5 text-violet transition-transform duration-[var(--motion-base)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </div>
                        <h3 className="mt-1 text-[15px] font-bold text-charcoal transition-colors group-hover:text-violet">
                          {parent.name}
                        </h3>
                        <p className="mt-1 text-[12.5px] leading-snug text-charcoal/65">
                          {parent.tagline}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex h-full items-start gap-4 rounded-[var(--radius-md)] border border-dashed border-charcoal/15 bg-mist p-5">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal/5 font-mono text-[12px] font-bold text-charcoal/55">
                        {code}
                      </span>
                      <div>
                        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-charcoal/60">
                          UKZ-{code} · {count} {count === 1 ? "service" : "services"}
                        </span>
                      </div>
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
         RELATED SOLUTIONS
         ════════════════════════════════════════════════════════════════ */}
      {related.length > 0 && (
        <section className="py-14 sm:py-16 lg:py-20">
          <Container>
            <Reveal>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="eyebrow inline-flex items-center gap-2 self-start text-violet">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                    Related packages
                  </span>
                  <h2 className="text-[var(--text-section)] font-extrabold tracking-tight text-charcoal text-balance">
                    Built for the same audience
                  </h2>
                </div>
                <Link
                  to="/solutions"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-azure transition-colors hover:text-violet"
                >
                  See all packages
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {related.map((p) => {
                const RelIcon = p.Icon
                return (
                  <Reveal key={p.slug} as="div">
                    <Link
                      to={`/solutions/${p.slug}`}
                      className="group flex h-full flex-col rounded-[var(--radius-lg)] border border-charcoal/8 bg-white p-6 transition-all duration-[var(--motion-base)] ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:border-violet/25 hover:shadow-[0_18px_44px_-20px_rgba(93,63,211,0.25)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/35 focus-visible:ring-offset-2"
                    >
                      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${p.iconBg || "bg-violet/10"} ${p.iconText || "text-violet"}`}>
                        <RelIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-[17px] font-bold leading-tight text-charcoal text-balance transition-colors group-hover:text-violet">
                        {p.name}
                      </h3>
                      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-charcoal/65">
                        {p.tagline}
                      </p>
                      <div className="mt-5 flex items-center justify-between border-t border-charcoal/8 pt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-charcoal/55">
                        <span>{p.duration}</span>
                        <ArrowUpRight
                          className="h-3.5 w-3.5 text-violet transition-transform duration-[var(--motion-base)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  </Reveal>
                )
              })}
            </div>
          </Container>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
         FINAL CTA — Charcoal banner (no Innovation Gradient — used once
         per viewport already in the hero)
         ════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-charcoal/8 bg-mist py-14 sm:py-16">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-charcoal p-8 text-center text-white sm:p-12">
              <span aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet/35 blur-3xl" />
              <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-azure/25 blur-3xl" />

              <div className="relative mx-auto max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mint">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={`absolute inline-flex h-full w-full rounded-full bg-mint opacity-75 ${reduce ? "" : "animate-ping"}`} />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
                  </span>
                  30-min · no commitment
                </span>
                <h2 className="mt-4 text-[var(--text-display)] font-extrabold tracking-tight text-white text-balance">
                  Let&apos;s see if {solution.name} fits your situation
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-white/75">
                  Book a discovery call. Within 48–72h you&apos;ll receive a written proposal with scope, timeline, and a fixed price.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to={`/book/${solution.slug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-[14px] font-semibold text-charcoal shadow-[0_12px_28px_-12px_rgba(0,0,0,0.4)] transition-transform duration-[var(--motion-base)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
                  >
                    Book a discovery call
                    <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  </Link>
                  <Link
                    to="/solutions"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-[14px] font-semibold text-white transition-colors duration-[var(--motion-base)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    Back to all packages
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </div>
  )
}
