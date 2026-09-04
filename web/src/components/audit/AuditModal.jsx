/**
 * AuditModal.jsx — Full-screen native React audit wizard.
 *
 * Replaces the iframe embed. Handles every state of the audit:
 *   audience → prequal → sections (A–F) → results → email gate
 *
 * Brand: Royal Violet · Deep Azure · brand tokens from tailwind config.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"
import { Modal } from "../ui/Modal"
import {
  X, ChevronLeft, ChevronRight, GraduationCap, Building2, User,
  CheckCircle2, AlertCircle, Clock, TrendingUp, ArrowRight,
  Mail, Send, Printer, MessageCircle, RotateCcw, Info,
  Shield, Zap, Star,
} from "lucide-react"
import {
  AUDIT_SECTIONS, TIERS, PREQUAL_CHALLENGES, PREQUAL_TIMELINES,
  sectionsForAudience, itemsForAudience, tierForScore,
  computeSectionScores, computeOverall, computeTopPriorities,
} from "../../data/auditData"
import { trackEvent } from "../../lib/analytics"
import { apiPost } from "../../lib/api"
import { Link } from "react-router-dom"
import { CATEGORIES, getOfferingBySlug, legacyIdMap, bookHref } from "../../data/servicesCatalogue"
import { pick, useCatalogueLang } from "../services/localize"

/* ─── Closed-set mapping (Instructions v4.0 § 06) ──────────────────────
   The audit instrument still carries the retired SKU ids (UKZ-CS-001 …)
   in its item tuples. Nothing rendered to a visitor may show one of
   those ids or imply a service line outside the four categories, so every
   svc id is resolved through legacyIdMap → catalogue offering → category.
   Unmapped ids (capabilities the closed set no longer sells) resolve to
   null and render no service tag at all.                                */
function resolveOffering(svcId) {
  const id = legacyIdMap[svcId]
  return id ? getOfferingBySlug(id) : null
}

/** The category that appears most often among the top priorities, ties
 *  broken by canonical order (strategy → automation → infra → build). */
function recommendCategory(topPriorities = []) {
  const counts = new Map()
  topPriorities.forEach((p) => {
    const off = resolveOffering(p.svc)
    if (off) counts.set(off.category.slug, (counts.get(off.category.slug) || 0) + 1)
  })
  let best = null
  CATEGORIES.forEach((c) => {
    const n = counts.get(c.slug) || 0
    if (n > 0 && (!best || n > best.n)) best = { n, category: c }
  })
  return best ? best.category : null
}

/* ─── localStorage key ─────────────────────────────────────────────── */
const LS_KEY = "mu_audit_v2"

function saveState(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* quota */ } }
function loadState()  { try { return JSON.parse(localStorage.getItem(LS_KEY) || "null") } catch { return null } }
function clearState() { try { localStorage.removeItem(LS_KEY) } catch { /* ok */ } }

/* ─── Tier colors ───────────────────────────────────────────────────── */
const TIER_COLOR = {
  Foundation:  { bg: "bg-rose/10",   text: "text-rose",  ring: "ring-rose/30",   hex: "var(--color-rose)" },
  Stabilizing: { bg: "bg-amber/10",  text: "text-amber-700", ring: "ring-amber/30",  hex: "var(--color-amber)" },
  Optimizing:  { bg: "bg-azure/10",  text: "text-azure-deep", ring: "ring-azure/30",  hex: "var(--color-azure)" },
  Mature:      { bg: "bg-mint/10",   text: "text-mint-700",  ring: "ring-mint/30",   hex: "var(--color-mint)" },
}

/* ─── Score button colors ───────────────────────────────────────────── */
const SCORE_LABELS = ["None","Aware","Partial","In place","Optimized"]
const SCORE_COLORS = [
  "border-rose/40 hover:border-rose hover:bg-rose/5 data-[sel=true]:bg-rose data-[sel=true]:border-rose data-[sel=true]:text-white",
  "border-amber/40 hover:border-amber hover:bg-amber/5 data-[sel=true]:bg-amber data-[sel=true]:border-amber data-[sel=true]:text-charcoal",
  "border-steel/30 hover:border-steel hover:bg-charcoal/5 data-[sel=true]:bg-steel data-[sel=true]:border-steel data-[sel=true]:text-white",
  "border-azure/40 hover:border-azure hover:bg-azure/5 data-[sel=true]:bg-azure-deep data-[sel=true]:border-azure-deep data-[sel=true]:text-white",
  "border-mint/40 hover:border-mint hover:bg-mint/5 data-[sel=true]:bg-mint data-[sel=true]:border-mint data-[sel=true]:text-charcoal",
]

/* ─── Animated score ring ────────────────────────────────────────────── */
function ScoreRing({ pct, tier, size = 200 }) {
  const reduce = useReducedMotion()
  const [displayed, setDisplayed] = useState(reduce ? pct : 0)
  const tc = TIER_COLOR[tier?.name] || TIER_COLOR.Foundation
  const circumference = 2 * Math.PI * (size / 2 - 14)
  const dash = circumference * (pct / 100)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- skip animation under reduced motion
    if (reduce) { setDisplayed(pct); return }
    let frame
    const start = performance.now()
    const duration = 1200
    function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(pct * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [pct, reduce])

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={size/2 - 14} fill="none" stroke="var(--color-slate-100)" strokeWidth={10} />
        <m.circle
          cx={size/2} cy={size/2} r={size/2 - 14}
          fill="none" stroke={tc.hex} strokeWidth={10}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[42px] font-bold text-charcoal leading-none">{displayed}</span>
        <span className="font-mono text-[13px] text-charcoal/40 leading-none">/100</span>
        {tier && (
          <span className={`mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] ${tc.bg} ${tc.text}`}>
            {tier.name}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function AuditModal({ open, onClose }) {
  const { t } = useTranslation("audit")

  /* State */
  const [step, setStep]           = useState("audience")   // audience | prequal | audit | results | email
  const [audience, setAudience]   = useState(null)
  const [prequal, setPrequal]     = useState({ challenge: "", timeline: "" })
  const [scores, setScores]       = useState({})
  const [sectionIdx, setSectionIdx] = useState(0)
  const [tooltip, setTooltip]     = useState(null)          // { itemId, score }
  const [emailForm, setEmailForm] = useState({ email: "", name: "", org: "", newsletterOptIn: false })
  const [emailStatus, setEmailStatus] = useState("idle")    // idle | sending | sent | error
  const [resumePrompt, setResumePrompt] = useState(false)
  const scrollRef = useRef(null)

  /* Load saved state on first open */
  useEffect(() => {
    if (!open) return
    const saved = loadState()
    if (saved?.audience && saved?.step && Object.keys(saved.scores || {}).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage when the modal opens
      setResumePrompt(true)
    }
  }, [open])

  /* Persist state */
  useEffect(() => {
    if (audience) saveState({ step, audience, prequal, scores, sectionIdx })
  }, [step, audience, prequal, scores, sectionIdx])

  /* Scroll to top of modal content on step change */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [step, sectionIdx])

  /* Derived */
  const sections      = audience ? sectionsForAudience(audience) : []
  const currentSec    = sections[sectionIdx]
  const items         = currentSec ? itemsForAudience(currentSec, audience) : []
  const overall       = audience ? computeOverall(scores, audience) : { pct: 0, raw: 0, max: 0 }
  const sectionScores = audience ? computeSectionScores(scores, audience) : {}
  const tier          = tierForScore(overall.pct)
  const tc            = TIER_COLOR[tier?.name] || TIER_COLOR.Foundation
  const topPriorities = audience ? computeTopPriorities(scores, audience) : []
  const recommended   = audience ? recommendCategory(topPriorities) : null

  /* Progress */
  const totalItems    = sections.reduce((s, sec) => s + itemsForAudience(sec, audience || "SMB").length, 0)
  const answered      = Object.keys(scores).filter((k) =>
    sections.some((sec) => itemsForAudience(sec, audience).some((it) => it[0] === k))
  ).length
  const progressPct   = totalItems ? Math.round((answered / totalItems) * 100) : 0

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleResume = () => {
    const saved = loadState()
    if (saved) {
      setAudience(saved.audience)
      setPrequal(saved.prequal || { challenge: "", timeline: "" })
      setScores(saved.scores || {})
      setSectionIdx(saved.sectionIdx || 0)
      setStep(saved.step || "audit")
    }
    setResumePrompt(false)
  }

  const handleStartFresh = () => {
    clearState()
    setAudience(null); setScores({}); setSectionIdx(0); setStep("audience")
    setResumePrompt(false)
  }

  const selectAudience = (aud) => {
    setAudience(aud); setScores({}); setSectionIdx(0)
    setStep("prequal")
    try { trackEvent("self_audit_audience_selected", { audience: aud }) } catch { /* ok */ }
  }

  const startAudit = () => {
    setStep("audit")
    try { trackEvent("self_audit_started", { audience, prequal }) } catch { /* ok */ }
  }

  const scoreItem = useCallback((id, n) => {
    setScores((prev) => ({ ...prev, [id]: n }))
    try { trackEvent("self_audit_item_scored", { id, score: n }) } catch { /* ok */ }
  }, [])

  const nextSection = () => {
    if (sectionIdx < sections.length - 1) {
      setSectionIdx((i) => i + 1)
    } else {
      setStep("results")
      try { trackEvent("self_audit_completed", { score: overall.pct, tier: tier?.name, audience }) } catch { /* ok */ }
    }
  }

  const prevSection = () => {
    if (sectionIdx > 0) setSectionIdx((i) => i - 1)
    else setStep("prequal")
  }

  const handleClose = () => {
    onClose()
    setTooltip(null)
  }

  /* ── Email submission ─────────────────────────────────────────────── */
  const submitEmail = async (e) => {
    e.preventDefault()
    if (!emailForm.email) return
    setEmailStatus("sending")
    try {
      await apiPost("/api/v1/diagnostic-submission", {
          name:          emailForm.name || null,
          email:         emailForm.email,
          organization:  emailForm.org || null,
          audience,
          scores,
          sectionScores,
          overall,
          topPriorities,
          matchedBundle: recommended ? { name: recommended.name, slug: recommended.slug } : null,
          prequal,
          website:       emailForm.website || "",   // honeypot — humans leave it empty
          newsletterOptIn: emailForm.newsletterOptIn === true,
          submittedAt:   new Date().toISOString(),
      })
      setEmailStatus("sent")
      clearState()
      try { trackEvent("self_audit_email_submitted", { audience, score: overall.pct, tier: tier?.name }) } catch { /* ok */ }
    } catch {
      setEmailStatus("error")
    }
  }

  const whatsappUrl = `https://wa.me/+525512345678?text=${encodeURIComponent(
    `Hi Mustapha, I just completed the self-audit and scored ${overall.pct}/100 (${tier?.name} tier). I'd like to discuss my results.`
  )}`

  /* ── Render ───────────────────────────────────────────────────────── */
  /* Panel — full screen on desktop (16px inset), bottom-sheet slide on
     mobile. Escape, focus trap, scroll lock and reduced-motion handling
     come from the canonical <Modal>. */
  return (
    <Modal
      open={open}
      onClose={handleClose}
      bare
      hideClose
      ariaLabel="Digital & Technology Self-Audit"
      size="full"
      motion="slide-up"
      zIndex={90}
      backdropClassName="bg-charcoal/60 backdrop-blur-sm"
      className="flex flex-col bg-white sm:rounded-2xl overflow-hidden shadow-[0_32px_80px_rgb(var(--color-charcoal-rgb)/0.35)]"
    >
            {/* ── Header bar ────────────────────────────────────────── */}
            <div className="shrink-0 flex items-center justify-between gap-4 border-b border-charcoal/8 bg-white/95 backdrop-blur-sm px-4 py-3 sm:px-6">
              {/* Brand */}
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-violet flex items-center justify-center text-white font-bold text-[15px]">M</div>
                <div className="hidden sm:block">
                  <div className="text-[13px] font-semibold text-charcoal leading-none">Mustapha Ukizuru</div>
                  <div className="font-mono text-[10px] text-charcoal/65 mt-0.5">Self-Audit · v2.0</div>
                </div>
              </div>

              {/* Progress bar (shown during audit) */}
              {step === "audit" && (
                <div className="flex-1 max-w-xs mx-4 hidden sm:block">
                  <div className="h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                    <m.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-violet),var(--color-azure))]"
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-charcoal/40 text-right">{progressPct}% complete · {answered}/{totalItems}</div>
                </div>
              )}

              {/* Step label */}
              <div className="font-mono text-[11px] text-charcoal/65 uppercase tracking-[0.1em] hidden sm:block">
                {step === "audience" && "Step 1 of 3 · Audience"}
                {step === "prequal"  && "Step 2 of 3 · Quick context"}
                {step === "audit"    && `Section ${sectionIdx + 1} of ${sections.length} · ${currentSec?.letter}`}
                {step === "results"  && "Your results"}
                {step === "email"    && "Get your PDF report"}
              </div>

              {/* Close */}
              <button
                onClick={handleClose}
                className="cursor-pointer shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-charcoal/65 hover:bg-charcoal/8 hover:text-charcoal transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
                aria-label="Close audit"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile progress bar */}
            {step === "audit" && (
              <div className="sm:hidden h-1 bg-charcoal/8">
                <m.div
                  className="h-full bg-[linear-gradient(90deg,var(--color-violet),var(--color-azure))]"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {/* ── Scrollable content ────────────────────────────────── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">

              {/* ══ RESUME PROMPT ══════════════════════════════════════ */}
              {resumePrompt && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-charcoal/50 backdrop-blur-sm p-4">
                  <m.div
                    initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgb(var(--color-charcoal-rgb)/0.25)]"
                  >
                    <div className="h-12 w-12 rounded-xl bg-violet-pale flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-6 w-6 text-violet" />
                    </div>
                    <h3 className="text-[18px] font-bold text-charcoal mb-2">{t("modal.resumeTitle")}</h3>
                    <p className="text-[14px] text-charcoal/65 mb-6">{t("modal.resumeBody")}</p>
                    <div className="flex gap-3">
                      <button onClick={handleResume} className="cursor-pointer flex-1 rounded-xl bg-violet px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-violet/90 transition">
                        Continue
                      </button>
                      <button onClick={handleStartFresh} className="cursor-pointer flex-1 rounded-xl border border-charcoal/15 px-4 py-2.5 text-[14px] font-medium text-charcoal/70 hover:bg-charcoal/5 transition">
                        {t("modal.resumeFresh")}
                      </button>
                    </div>
                  </m.div>
                </div>
              )}

              {/* ══ STEP: AUDIENCE ═════════════════════════════════════ */}
              {step === "audience" && (
                <AudienceStep onSelect={selectAudience} />
              )}

              {/* ══ STEP: PREQUAL ══════════════════════════════════════ */}
              {step === "prequal" && (
                <PrequalStep
                  prequal={prequal}
                  onChange={(k, v) => setPrequal((p) => ({ ...p, [k]: v }))}
                  onBack={() => setStep("audience")}
                  onNext={startAudit}
                />
              )}

              {/* ══ STEP: AUDIT ════════════════════════════════════════ */}
              {step === "audit" && currentSec && (
                <AuditSectionStep
                  section={currentSec}
                  items={items}
                  scores={scores}
                  sectionIdx={sectionIdx}
                  totalSections={sections.length}
                  sectionScores={sectionScores}
                  overall={overall}
                  audience={audience}
                  tooltip={tooltip}
                  setTooltip={setTooltip}
                  onScore={scoreItem}
                  onPrev={prevSection}
                  onNext={nextSection}
                />
              )}

              {/* ══ STEP: RESULTS ══════════════════════════════════════ */}
              {step === "results" && (
                <ResultsStep
                  overall={overall}
                  tier={tier}
                  tc={tc}
                  sectionScores={sectionScores}
                  topPriorities={topPriorities}
                  recommended={recommended}
                  audience={audience}
                  whatsappUrl={whatsappUrl}
                  onGetPdf={() => setStep("email")}
                  onRestart={handleStartFresh}
                />
              )}

              {/* ══ STEP: EMAIL ════════════════════════════════════════ */}
              {step === "email" && (
                <EmailStep
                  emailForm={emailForm}
                  setEmailForm={setEmailForm}
                  emailStatus={emailStatus}
                  overall={overall}
                  tier={tier}
                  tc={tc}
                  onSubmit={submitEmail}
                  onSkip={() => setStep("results")}
                />
              )}

            </div>
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   AUDIENCE STEP
════════════════════════════════════════════════════════════════════════ */
function AudienceStep({ onSelect }) {
  const { t } = useTranslation("audit")
  const CARDS = [
    {
      aud: "EDU", icon: GraduationCap,
      title: "School / Educational Institution",
      scope: "All 6 sections · 82 items",
      body: "Strategy, brand, infrastructure, web & AI, EdTech, and managed services. Section E (EdTech) is built specifically for you.",
      color: "hover:border-violet/50 hover:shadow-[0_16px_40px_-12px_rgb(var(--color-violet-rgb)/0.22)]",
      iconBg: "bg-violet-pale text-violet",
    },
    {
      aud: "SMB", icon: Building2,
      title: "Business / SME / Startup",
      scope: "5 sections · 70 items",
      body: "Strategy through managed services, end to end. Section E (EdTech) is skipped as it doesn't apply.",
      color: "hover:border-azure/50 hover:shadow-[0_16px_40px_-12px_rgb(var(--color-azure-rgb)/0.22)]",
      iconBg: "bg-azure/10 text-azure",
    },
    {
      aud: "IND", icon: User,
      title: "Individual / Professional",
      scope: "Focused scan · 12 items",
      body: "Personal brand, web presence, and managed hosting. A targeted scan in under 5 minutes.",
      color: "hover:border-mint/50 hover:shadow-[0_16px_40px_-12px_rgb(var(--color-mint-rgb)/0.20)]",
      iconBg: "bg-mint/10 text-mint",
    },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center mb-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-violet mb-3">STEP 1 OF 3</p>
        <h2 className="text-[clamp(22px,3.5vw,34px)] font-extrabold tracking-tight text-charcoal mb-3">{t("modal.audienceQuestion")}</h2>
        <p className="text-[15px] text-charcoal/65">Different audiences see different sections. We'll tailor your shortlist accordingly.</p>
      </div>
      <div className="space-y-4">
        {CARDS.map(({ aud, icon: Icon, title, scope, body, color, iconBg }) => (
          <button
            key={aud}
            onClick={() => onSelect(aud)}
            className={`cursor-pointer w-full text-left rounded-2xl border border-charcoal/10 bg-white p-6 transition duration-200 ${color} focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40`}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-0.5 h-12 w-12 shrink-0 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-[16px] font-bold text-charcoal">{title}</span>
                  <span className="font-mono text-[11px] font-bold text-violet uppercase tracking-[0.08em]">{scope}</span>
                </div>
                <p className="mt-1 text-[13.5px] text-charcoal/65 leading-relaxed">{body}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-charcoal/25 shrink-0 mt-0.5" aria-hidden="true" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   PREQUAL STEP
════════════════════════════════════════════════════════════════════════ */
function PrequalStep({ prequal, onChange, onBack, onNext }) {
  const { t } = useTranslation("audit")
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 sm:mb-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-violet mb-3">{t("modal.step2Eyebrow")}</p>
        <h2 className="text-[clamp(22px,3vw,30px)] font-extrabold tracking-tight text-charcoal mb-2">{t("modal.step2Title")}</h2>
        <p className="text-[14px] text-charcoal/65">{t("modal.step2Body")}</p>
      </div>

      <div className="space-y-7 sm:space-y-8">
        <div>
          <label className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-charcoal/65 mb-3">
            {t("modal.challengeQuestion")}
          </label>
          {/* 1 col on xs, 2 cols from sm — prevents cramped cards on narrow phones */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PREQUAL_CHALLENGES.map((c) => (
              <button
                key={c}
                onClick={() => onChange("challenge", c)}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-[13px] text-left transition ${
                  prequal.challenge === c
                    ? "border-violet bg-violet-pale text-violet font-semibold"
                    : "border-charcoal/12 text-charcoal/65 hover:border-violet/40 hover:bg-violet/4"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-charcoal/65 mb-3">
            {t("modal.timelineQuestion")}
          </label>
          <div className="space-y-2">
            {PREQUAL_TIMELINES.map((t) => (
              <button
                key={t}
                onClick={() => onChange("timeline", t)}
                className={`cursor-pointer w-full rounded-xl border px-4 py-3 text-[13.5px] text-left transition flex items-center gap-3 ${
                  prequal.timeline === t
                    ? "border-violet bg-violet-pale text-violet font-semibold"
                    : "border-charcoal/12 text-charcoal/65 hover:border-violet/40"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${prequal.timeline === t ? "border-violet" : "border-charcoal/25"}`}>
                  {prequal.timeline === t && <div className="h-2 w-2 rounded-full bg-violet" />}
                </div>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Nav — stacks on mobile (Next first, Back below), side-by-side on sm+ */}
      <div className="mt-8 flex flex-col-reverse gap-2 sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={onBack} className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl border border-charcoal/15 px-4 py-2.5 text-[13px] text-charcoal/65 hover:bg-charcoal/5 transition sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:justify-start">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="cursor-pointer inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-violet),var(--color-azure))] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.3)] hover:shadow-[0_6px_20px_rgb(var(--color-violet-rgb)/0.4)] transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40 sm:w-auto sm:py-3"
        >
          {prequal.challenge || prequal.timeline ? "Start the audit" : "Skip & start the audit"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   AUDIT SECTION STEP
════════════════════════════════════════════════════════════════════════ */
function AuditSectionStep({ section, items, scores, sectionIdx, totalSections, sectionScores, overall, tooltip, setTooltip, onScore, onPrev, onNext }) {
  const { t } = useTranslation("audit")
  const lang = useCatalogueLang()
  const isLast = sectionIdx === totalSections - 1

  return (
    <div className="flex flex-col lg:flex-row min-h-full">
      {/* Main content */}
      <div className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:max-w-[calc(100%-260px)]">

        {/* ── Mobile live-scores strip (hidden on lg where sidebar shows) ── */}
        <div className="lg:hidden mb-5 rounded-xl border border-charcoal/8 bg-mist/60 px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-charcoal/40">{t("modal.liveScores")}</p>
            <span className="font-mono text-[12px] font-bold text-violet">{overall.pct} / 100</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {Object.entries(sectionScores).map(([letter, d]) => {
              const sc = tierForScore(d.pct)
              const c  = TIER_COLOR[sc?.name]
              return (
                <div key={letter} className="flex items-center gap-1.5 min-w-[80px]">
                  <span className="font-mono text-[10px] font-bold text-violet w-3 shrink-0">{letter}</span>
                  <div className="flex-1 h-1.5 bg-charcoal/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${d.pct}%`, background: c?.hex || "var(--color-violet)" }} />
                  </div>
                  <span className="font-mono text-[10px] text-charcoal/65 w-6 text-right shrink-0">{d.pct}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-xl sm:rounded-2xl bg-violet flex items-center justify-center text-white text-[24px] sm:text-[28px] font-bold leading-none">
            {section.letter}
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] sm:text-[22px] font-bold text-charcoal leading-tight">{section.title}</h2>
            <p className="text-[12px] sm:text-[13px] text-charcoal/65 mt-0.5">{section.subtitle}</p>
            <span className="mt-1.5 inline-block rounded-full bg-violet-pale px-2.5 py-0.5 font-mono text-[10px] font-bold text-violet uppercase tracking-[0.08em]">
              {items.length} items · Section {sectionIdx + 1} of {totalSections}
            </span>
          </div>
        </div>

        <p className="text-[13.5px] sm:text-[14px] text-charcoal/65 leading-relaxed mb-5 sm:mb-6">{section.intro}</p>

        {/* Score key — hidden on xs (cramped), shown from sm */}
        <div className="hidden sm:flex mb-6 items-center gap-px rounded-xl overflow-hidden border border-charcoal/10">
          {SCORE_LABELS.map((label, n) => (
            <div key={n} className="flex-1 bg-white text-center py-2.5 px-1 border-r border-charcoal/8 last:border-0">
              <div className="font-mono text-[13px] font-bold text-violet">{n}</div>
              <div className="text-[10px] text-charcoal/65 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        {/* Compact score legend for xs */}
        <div className="sm:hidden mb-4 flex items-center gap-2 text-[11px] text-charcoal/65">
          <span className="font-mono font-bold text-rose">0</span><span>None</span>
          <span className="mx-1 text-charcoal/20">·</span>
          <span className="font-mono font-bold text-amber-700">1–2</span><span>Aware/Partial</span>
          <span className="mx-1 text-charcoal/20">·</span>
          <span className="font-mono font-bold text-mint-700">3–4</span><span>In place/Optimized</span>
        </div>

        {/* Items */}
        <div className="divide-y divide-charcoal/6">
          {items.map((it) => {
            const [id, svc, title, stmt, tier, , risk, investRange] = it
            const sel     = scores[id]
            const showTip = tooltip?.itemId === id

            return (
              <div key={id} className="py-5 sm:py-6">
                {/* ID + Title row — no large indent on mobile */}
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="font-mono text-[11px] sm:text-[12px] font-bold text-violet shrink-0 mt-0.5 w-10">{id}</span>
                  <span className="text-[14px] sm:text-[15px] font-semibold text-charcoal leading-snug">{title}</span>
                </div>

                {/* Statement — slight indent on sm+, none on xs */}
                <p className="pl-[0px] sm:pl-[52px] text-[13px] sm:text-[13.5px] text-charcoal/65 leading-relaxed mb-4">{stmt}</p>

                {/* Score buttons + service tag + info */}
                <div className="sm:pl-[52px] flex flex-col gap-3">
                  {/* Score buttons row — fill full width on mobile */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1 sm:gap-1.5 sm:flex-none" role="group" aria-label={`Score for ${title}`}>
                      {[0,1,2,3,4].map((n) => (
                        <button
                          key={n}
                          onClick={() => onScore(id, n)}
                          data-sel={sel === n}
                          className={`cursor-pointer flex-1 sm:flex-none h-10 sm:h-10 sm:w-10 min-w-0 rounded-lg border font-mono text-[13px] font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${SCORE_COLORS[n]}`}
                          aria-label={`Score ${n} — ${SCORE_LABELS[n]}`}
                          aria-pressed={sel === n}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {/* Info button */}
                    <button
                      onClick={() => setTooltip(showTip ? null : { itemId: id })}
                      className="cursor-pointer shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-charcoal/10 text-charcoal/30 hover:border-violet/30 hover:text-violet transition"
                      aria-label="Why does this matter?"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Service tag — shown when score is low */}
                  {sel !== undefined && sel <= 2 && resolveOffering(svc) && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-azure-deep font-medium">
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="font-bold text-violet">{pick(resolveOffering(svc), "name", lang)}</span>
                      <span className="text-charcoal/40 hidden sm:inline">· {tier}</span>
                    </span>
                  )}
                </div>

                {/* Tooltip: risk + invest */}
                <AnimatePresence>
                  {showTip && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="mt-3 sm:ml-[52px] overflow-hidden"
                    >
                      <div className="rounded-xl bg-charcoal/[0.03] border border-charcoal/8 p-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rose mb-1.5">{t("modal.riskIfIgnored")}</p>
                          <p className="text-[13px] text-charcoal/65 leading-relaxed">{risk}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-violet mb-1.5">{t("modal.typicalInvestment")}</p>
                          <p className="font-mono text-[14px] font-bold text-charcoal">{investRange}</p>
                          <p className="text-[12px] text-charcoal/65 mt-0.5">{tier}</p>
                        </div>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Section nav — sticky at bottom of scroll area on mobile */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-charcoal/8 px-0 pt-4 pb-4 mt-6 flex flex-col-reverse gap-2 sm:static sm:bg-transparent sm:backdrop-blur-none sm:pt-6 sm:pb-0 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <button
            onClick={onPrev}
            className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl border border-charcoal/15 px-4 py-2.5 text-[13.5px] font-medium text-charcoal/65 hover:bg-charcoal/5 transition sm:justify-start"
          >
            <ChevronLeft className="h-4 w-4" /> {sectionIdx === 0 ? "Back to context" : "Previous section"}
          </button>
          <button
            onClick={onNext}
            className="cursor-pointer inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-violet),var(--color-azure))] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_4px_12px_rgb(var(--color-violet-rgb)/0.3)] hover:shadow-[0_6px_18px_rgb(var(--color-violet-rgb)/0.4)] transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40 sm:w-auto sm:py-2.5"
          >
            {isLast ? "See my results" : "Next section"} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sticky scoreboard sidebar (desktop only — mobile uses the strip above) */}
      <aside className="hidden lg:flex lg:w-[260px] shrink-0 flex-col border-l border-charcoal/8 bg-mist/50 px-5 py-8">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal/40 mb-5">{t("modal.yourLiveScores")}</p>
        <div className="space-y-3.5">
          {Object.entries(sectionScores).map(([letter, d]) => {
            const sc = tierForScore(d.pct)
            const c  = TIER_COLOR[sc?.name]
            return (
              <div key={letter} className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] font-bold text-violet w-4">{letter}</span>
                <div className="flex-1 h-1.5 bg-charcoal/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${d.pct}%`, background: c?.hex || "var(--color-violet)" }} />
                </div>
                <span className="font-mono text-[11px] text-charcoal/65 w-7 text-right">{d.pct}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-5 pt-5 border-t border-charcoal/10">
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-semibold text-charcoal">Overall</span>
            <span className="font-mono text-[16px] font-bold text-violet">{overall.pct} / 100</span>
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   RESULTS STEP
════════════════════════════════════════════════════════════════════════ */
function ResultsStep({ overall, tier, tc, sectionScores, topPriorities, recommended, audience, whatsappUrl, onGetPdf, onRestart }) {
  const { t } = useTranslation("audit")
  const lang = useCatalogueLang()
  const audienceLabel = { EDU: "schools in Latin America", SMB: "businesses in your sector", IND: "individual professionals" }[audience] || "similar organisations"
  const avgBenchmarks = { EDU: 36, SMB: 41, IND: 32 }
  const avg = avgBenchmarks[audience] || 38
  const vsAvg = overall.pct - avg
  const reduce = useReducedMotion()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero score — ring shrinks on mobile */}
      <div className="text-center mb-8 sm:mb-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/40 mb-4 sm:mb-6">{t("modal.maturityHeading")}</p>
        <div className="flex justify-center mb-4 sm:mb-5">
          <div className="hidden sm:block"><ScoreRing pct={overall.pct} tier={tier} size={200} /></div>
          <div className="sm:hidden"><ScoreRing pct={overall.pct} tier={tier} size={160} /></div>
        </div>
        {/* Benchmark comparison */}
        <div className="inline-flex items-center gap-2 rounded-full border border-charcoal/10 bg-white px-4 py-2 text-[13px] mt-2">
          <TrendingUp className="h-4 w-4 text-charcoal/40" />
          <span className="text-charcoal/65">vs. avg <strong className="text-charcoal">{avg}/100</strong> for {audienceLabel}</span>
          <span className={`font-mono font-bold ${vsAvg >= 0 ? "text-mint-700" : "text-rose"}`}>
            {vsAvg >= 0 ? "+" : ""}{vsAvg}
          </span>
        </div>
        {/* Tier message */}
        <div className={`mx-auto mt-6 max-w-xl rounded-2xl border p-5 text-left ${tc.bg} ${tc.ring} ring-1`}>
          <p className="font-semibold text-[15px] text-charcoal mb-1">{tier?.headline}</p>
          <p className="text-[13.5px] text-charcoal/65 leading-relaxed mb-3">{tier?.desc}</p>
          <p className="text-[12.5px] font-semibold text-charcoal/70 italic">{tier?.urgency}</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-charcoal/8 p-6 mb-6">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-charcoal/40 mb-5">{t("modal.maturityByCategory")}</h3>
        <div className="space-y-4">
          {Object.entries(sectionScores).map(([letter, d]) => {
            const sc  = tierForScore(d.pct)
            const c   = TIER_COLOR[sc?.name] || TIER_COLOR.Foundation
            const sec = AUDIT_SECTIONS.find((s) => s.letter === letter)
            const gap = d.total - d.answered

            return (
              <div key={letter}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-mono text-[11px] font-bold text-violet w-5">{letter}</span>
                  <span className="text-[13.5px] font-semibold text-charcoal flex-1">{d.name.replace(/Audit$/, "").trim()}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${c.bg} ${c.text}`}>{sc?.name}</span>
                  <span className="font-mono text-[13px] font-bold text-charcoal/70 w-9 text-right">{d.pct}%</span>
                </div>
                <div className="ml-8 flex items-center gap-2.5">
                  <div className="flex-1 h-2.5 bg-charcoal/8 rounded-full overflow-hidden">
                    <m.div
                      className="h-full rounded-full"
                      initial={reduce ? { width: `${d.pct}%` } : { width: 0 }}
                      animate={{ width: `${d.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                      style={{ background: c.hex }}
                    />
                  </div>
                  {gap > 0 && (
                    <span className="text-[11px] text-charcoal/40 shrink-0">{gap} gap{gap > 1 ? "s" : ""}</span>
                  )}
                </div>
                {sec && <p className="ml-8 mt-1 text-[11px] text-charcoal/40">{d.answered}/{d.total} items scored</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Top priorities */}
      {topPriorities.length > 0 && (
        <div className="bg-white rounded-2xl border border-charcoal/8 p-6 mb-6">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-charcoal/40 mb-5">YOUR TOP {topPriorities.length} PRIORITIES</h3>
          <div className="space-y-5">
            {topPriorities.map((p, i) => (
              <div key={p.id} className="grid grid-cols-[40px_1fr] gap-4 items-start pb-5 border-b border-charcoal/6 last:border-0 last:pb-0">
                <div className="font-mono text-[22px] font-bold text-violet leading-none pt-0.5">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                    {resolveOffering(p.svc) && (
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-violet">{resolveOffering(p.svc).category.code}</span>
                    )}
                    <span className="text-[15px] font-bold text-charcoal">{p.title}</span>
                  </div>
                  {/* Score vs ideal */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5">
                      {[0,1,2,3,4].map((n) => (
                        <div key={n} className={`h-1.5 w-5 rounded-full ${n <= p.score ? "bg-rose" : "bg-charcoal/10"}`} />
                      ))}
                    </div>
                    <span className="text-[11px] text-charcoal/65">{t("modal.youScored")} <strong className="text-rose">{p.score}/4</strong> {t("modal.scoreTarget")}</span>
                  </div>
                  {/* Risk */}
                  <p className="text-[13px] text-charcoal/65 leading-relaxed mb-2">{p.risk}</p>
                  {/* Meta */}
                  <div className="flex flex-wrap gap-3 text-[11px] font-mono">
                    <span className="rounded-full bg-violet-pale px-2.5 py-1 text-violet font-bold">{p.tier}</span>
                    <span className="rounded-full bg-charcoal/5 px-2.5 py-1 text-charcoal/65">{p.investRange}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {topPriorities.length === 0 && (
            <p className="text-[14px] text-charcoal/65">{t("modal.allStrong")}</p>
          )}
        </div>
      )}

      {/* Recommended service line · one of the closed set of four */}
      {recommended && (
        <div className={`relative overflow-hidden rounded-2xl p-6 mb-6 text-white ${recommended.tile}`}>
          <div className="absolute -top-1/2 -right-8 h-[200%] w-1/2 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              {recommended.Icon && <recommended.Icon className="h-6 w-6" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 mb-2">{t("modal.recommendedLine")}</p>
              <h4 className="text-[20px] font-bold text-white mb-1">{pick(recommended, "name", lang)}</h4>
              <p className="text-[13.5px] text-white/80 mb-4">{pick(recommended, "outcome", lang)}</p>
              <div className="flex flex-wrap gap-3">
                <Link to={`/services/${recommended.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[13px] font-bold text-violet hover:-translate-y-0.5 transition">
                  {t("modal.viewLine")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link to={bookHref(recommended.slug)} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-[13px] font-bold text-white ring-1 ring-white/30 hover:bg-white/25 transition">
                  {t("modal.bookCall")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTAs — 1 col on xs, 3 cols on sm+ */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-3 mb-8">
        <button
          onClick={onGetPdf}
          className="cursor-pointer flex flex-col gap-2 rounded-xl border border-violet/25 bg-violet/[0.04] px-5 py-4 text-left hover:border-violet/45 hover:bg-violet/8 transition"
        >
          <Mail className="h-5 w-5 text-violet" />
          <span className="text-[14px] font-bold text-charcoal">{t("modal.getPdf")}</span>
          <span className="text-[12px] text-charcoal/65">{t("modal.getPdfHint")}</span>
        </button>
        <a
          href="https://mustaphaukizuru.com/contact"
          className="cursor-pointer flex flex-col gap-2 rounded-xl border border-charcoal/10 bg-white px-5 py-4 text-left hover:border-violet/30 transition"
        >
          <Clock className="h-5 w-5 text-charcoal/65" />
          <span className="text-[14px] font-bold text-charcoal">{t("modal.bookCall")}</span>
          <span className="text-[12px] text-charcoal/65">{t("modal.bookCallHint")}</span>
        </a>
        <a
          href={whatsappUrl}
          target="_blank" rel="noopener noreferrer"
          className="cursor-pointer flex flex-col gap-2 rounded-xl border border-charcoal/10 bg-white px-5 py-4 text-left hover:border-mint/40 transition"
        >
          <MessageCircle className="h-5 w-5 text-mint" />
          <span className="text-[14px] font-bold text-charcoal">{t("modal.whatsapp")}</span>
          <span className="text-[12px] text-charcoal/65">{t("modal.whatsappHint")}</span>
        </a>
      </div>

      {/* Restart */}
      <div className="text-center">
        <button onClick={onRestart} className="cursor-pointer inline-flex items-center gap-1.5 text-[13px] text-charcoal/40 hover:text-charcoal transition">
          <RotateCcw className="h-3.5 w-3.5" /> {t("modal.startNew")}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EMAIL STEP
════════════════════════════════════════════════════════════════════════ */
function EmailStep({ emailForm, setEmailForm, emailStatus, overall, tier, tc, onSubmit, onSkip }) {
  const { t } = useTranslation("audit")
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-violet-pale flex items-center justify-center">
            <Mail className="h-7 w-7 text-violet" />
          </div>
        </div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-charcoal mb-2">{t("modal.pdfFormTitle")}</h2>
        <p className="text-[14px] text-charcoal/65">
          A branded PDF with your full scores, top priorities, investment ranges, and recommended next steps — yours to keep and share.
        </p>
      </div>

      {/* Score summary */}
      <div className={`flex items-center gap-4 rounded-2xl border p-4 mb-8 ${tc.ring} ring-1 ${tc.bg}`}>
        <div className="text-center">
          <div className="font-mono text-[32px] font-bold text-charcoal leading-none">{overall.pct}</div>
          <div className="font-mono text-[11px] text-charcoal/40">/100</div>
        </div>
        <div>
          <div className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${tc.bg} ${tc.text} mb-1`}>{tier?.name}</div>
          <p className="text-[13px] text-charcoal/65 leading-snug">{tier?.action}</p>
        </div>
      </div>

      {emailStatus === "sent" ? (
        <div className="text-center py-8">
          <CheckCircle2 className="h-14 w-14 text-mint mx-auto mb-4" />
          <h3 className="text-[20px] font-bold text-charcoal mb-2">{t("modal.pdfSent")}</h3>
          <p className="text-[14px] text-charcoal/65">
            Check your inbox — your PDF report will arrive within a few minutes.
            {emailForm.newsletterOptIn && " We also sent a separate email to confirm your newsletter subscription."}
          </p>
          <button onClick={onSkip} className="cursor-pointer mt-6 text-[13px] text-violet underline underline-offset-2">
            {t("modal.backToResults")}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {/* Email — recommended */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="ae-email" className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-charcoal/65">
                {t("modal.emailLabel")}
              </label>
              <span className="rounded-full bg-violet-pale px-2 py-0.5 font-mono text-[10px] font-bold text-violet">RECOMMENDED</span>
            </div>
            <input
              id="ae-email"
              type="email"
              placeholder="you@yourorg.com"
              value={emailForm.email}
              onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-[14.5px] text-charcoal placeholder-charcoal/30 transition focus:border-azure focus:outline-none focus:shadow-[0_0_0_4px_rgb(var(--color-azure-rgb)/0.15)]"
            />
          </div>

          {/* Honeypot — visually hidden, excluded from tab order and AT. Bots
              that fill every field trip it; the API then silently drops the
              submission. Same pattern as ContactPage. */}
          <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="ae-website">Website</label>
            <input
              id="ae-website"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={emailForm.website || ""}
              onChange={(e) => setEmailForm((f) => ({ ...f, website: e.target.value }))}
            />
          </div>

          {/* Name and org — optional: 1-col on xs, 2-col on sm+ */}
          <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-2">
            <div>
              <label htmlFor="ae-name" className="block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal/40 mb-2">
                {t("modal.nameLabel")} <span className="text-charcoal/25">(optional)</span>
              </label>
              <input
                id="ae-name"
                type="text"
                placeholder="Your name"
                value={emailForm.name}
                onChange={(e) => setEmailForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-charcoal/12 bg-white px-3 py-2.5 text-[13.5px] text-charcoal placeholder-charcoal/25 transition focus:border-azure focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--color-azure-rgb)/0.12)]"
              />
            </div>
            <div>
              <label htmlFor="ae-org" className="block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal/40 mb-2">
                Organisation <span className="text-charcoal/25">(optional)</span>
              </label>
              <input
                id="ae-org"
                type="text"
                placeholder="Your school / company"
                value={emailForm.org}
                onChange={(e) => setEmailForm((f) => ({ ...f, org: e.target.value }))}
                className="w-full rounded-xl border border-charcoal/12 bg-white px-3 py-2.5 text-[13.5px] text-charcoal placeholder-charcoal/25 transition focus:border-azure focus:outline-none focus:shadow-[0_0_0_3px_rgb(var(--color-azure-rgb)/0.12)]"
              />
            </div>
          </div>

          {/* Nurture opt-in — unchecked by default; double opt-in on the API side */}
          <label htmlFor="ae-newsletter" className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-charcoal/12 bg-white px-4 py-3">
            <input
              id="ae-newsletter"
              type="checkbox"
              checked={emailForm.newsletterOptIn}
              onChange={(e) => setEmailForm((f) => ({ ...f, newsletterOptIn: e.target.checked }))}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-charcoal/30 accent-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            />
            <span className="text-[13px] leading-snug text-charcoal/75">
              Also send me occasional tips on fixing what this audit found.{" "}
              <span className="text-charcoal/65">You&apos;ll get a confirmation email first — nothing is sent until you confirm, and you can unsubscribe any time.</span>
            </span>
          </label>

          {emailStatus === "error" && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose/8 border border-rose/20 px-4 py-3 text-[13px] text-rose">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Something went wrong. Please try again or{" "}
              <a href="mailto:hello@mustaphaukizuru.com" className="cursor-pointer underline">email us directly</a>.
            </div>
          )}

          <button
            type="submit"
            disabled={!emailForm.email || emailStatus === "sending"}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-violet),var(--color-azure))] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.3)] hover:shadow-[0_6px_20px_rgb(var(--color-violet-rgb)/0.4)] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {emailStatus === "sending" ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Sending…</>
            ) : (
              <><Send className="h-4 w-4" /> {t("modal.sendReport")}</>
            )}
          </button>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[11px] text-charcoal/35">
              <Shield className="h-3 w-3 inline mr-1" />
              {emailForm.newsletterOptIn ? "One report, plus a confirmation email." : "One report, no newsletter."}{" "}
              <a href="/privacy" className="cursor-pointer underline hover:text-charcoal/65" target="_blank" rel="noopener noreferrer">{t("modal.privacyPolicy")}</a>
            </p>
            <button
              type="button"
              onClick={onSkip}
              className="cursor-pointer text-[12px] text-charcoal/40 hover:text-charcoal/70 transition underline underline-offset-2"
            >
              {t("modal.skipToResults")}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
