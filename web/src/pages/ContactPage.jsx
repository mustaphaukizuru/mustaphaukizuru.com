/* ════════════════════════════════════════════════════════════════════════
   ContactPage.jsx · F09 v3
   ────────────────────────────────────────────────────────────────────────
   Brand-adapted Flowbase-style contact panel:
     · Charcoal hero (preserved) with eyebrow / headline / 3 trust pills
     · Two-column rounded card on lg+ (violet info panel · white form)
     · Phone field/number removed everywhere — replaced by a prominent
       WhatsApp call-to-action pill that deep-links to wa.me
     · Underline-style inputs (focus → violet) matching the reference
     · Project-type radios mapped to backend `subject`
     · Honeypot + apiRequest("/api/contact", …) contract preserved
     · Framer Motion entrance + idle animations gated by reduced-motion
     · WCAG AA contrast on all surfaces · fully responsive ≥ 320px

   I18N · Phase 117 · ContactPage body migrated to t() with the
   `contact` namespace. Constant arrays (AUDIENCES, INTEREST_OPTIONS,
   TIER_OPTIONS, TIMELINE_OPTIONS) flipped to keyId-pattern so labels
   resolve at render time. Sub-components mount their own
   useTranslation hooks (the page-level hook does not cross component
   boundaries — see hook-shadow incident in earlier phases).
   ════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { m } from "framer-motion"
import {
  Send, CheckCircle2, Mail, MapPin, Sparkles,
  GraduationCap, Briefcase, User, Layers, Clock as ClockIcon, Tag,
} from "lucide-react"
import { apiRequest } from "../lib/api"
import ContactHero from "../components/heroes/ContactHero"
import SocialLinks, { CONTACT_SOCIALS } from "../components/SocialLinks"
import FloatingLabelInput    from "../components/forms/FloatingLabelInput"
import FloatingLabelTextarea from "../components/forms/FloatingLabelTextarea"
import AuthErrorBanner       from "../components/auth/AuthErrorBanner"
import Confetti from "../components/motion/Confetti"

/* Social icons + animations are owned by the shared SocialLinks component
 * imported above — no per-page glyph copies are required. */

/* ── Motion variants ─────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/* ── Constants ──────────────────────────────────────────────────────── */
const WHATSAPP_URL = "https://wa.me/525552139993"
const EMAIL = "hello@mustaphaukizuru.com"
const ADDRESS_LINES = ["Tlalnepantla de Baz,", "Estado de México, México"]

/* ──────────────────────────────────────────────────────────────────
 * AUDIENCES · 3-segment qualifier matching the Services + Solutions
 * pages (Educator/School · Business/Team · Independent Pro).
 * I18N · `labelKey` lands inside contact.audiences.<key>; the icon
 * stays static on the row.
 * ────────────────────────────────────────────────────────────────── */
const AUDIENCES = [
  { value: "education",    labelKey: "audiences.education",    Icon: GraduationCap },
  { value: "business",     labelKey: "audiences.business",     Icon: Briefcase },
  { value: "professional", labelKey: "audiences.professional", Icon: User },
]

/* ──────────────────────────────────────────────────────────────────
 * INTEREST_OPTIONS · combined Service families (CS · BD · IC · WD ·
 * ET · MS) and Solution packages. Each carries an `audiences` array
 * so the dropdown filters down to relevant items per audience choice.
 * Empty audiences = "all".
 * I18N · `groupKey` lands inside contact.interests.groups.<key>;
 * `labelKey` inside contact.interests.items.<value>.
 * ────────────────────────────────────────────────────────────────── */
const INTEREST_OPTIONS = [
  { groupKey: "Services",  value: "CS", audiences: ["education", "business", "professional"] },
  { groupKey: "Services",  value: "BD", audiences: ["education", "business", "professional"] },
  { groupKey: "Services",  value: "IC", audiences: ["education", "business"] },
  { groupKey: "Services",  value: "WD", audiences: ["education", "business", "professional"] },
  { groupKey: "Services",  value: "ET", audiences: ["education"] },
  { groupKey: "Services",  value: "MS", audiences: ["education", "business"] },
  { groupKey: "Solutions", value: "smart-classroom",   audiences: ["education"] },
  { groupKey: "Solutions", value: "stem-curriculum",   audiences: ["education"] },
  { groupKey: "Solutions", value: "brand-foundation",  audiences: ["business", "professional"] },
  { groupKey: "Solutions", value: "web-launch",        audiences: ["business", "professional"] },
  { groupKey: "Solutions", value: "cloud-migration",   audiences: ["business"] },
  { groupKey: "Solutions", value: "ai-integration",    audiences: ["business", "professional"] },
  { groupKey: "Solutions", value: "managed-it",        audiences: ["business"] },
  { groupKey: "Solutions", value: "personal-platform", audiences: ["professional"] },
]

/* Tier · matches Services pricing matrix */
const TIER_OPTIONS = [
  { value: "basic",    labelKey: "tiers.basic" },
  { value: "medium",   labelKey: "tiers.medium" },
  { value: "advanced", labelKey: "tiers.advanced" },
  { value: "guidance", labelKey: "tiers.guidance" },
]

/* Timeline · when does the visitor want to start? */
const TIMELINE_OPTIONS = [
  { value: "asap",      labelKey: "timelines.asap" },
  { value: "30d",       labelKey: "timelines.30d" },
  { value: "60d",       labelKey: "timelines.60d" },
  { value: "exploring", labelKey: "timelines.exploring" },
]

/* SOCIALS are sourced from CONTACT_SOCIALS in components/SocialLinks.jsx */

/* HERO is now a standalone component imported above —
   see web/src/components/heroes/ContactHero.jsx */

/* UnderlineField + UnderlineTextarea were removed in Phase 10b · ship-
   readiness cleanup. Both were superseded by FloatingLabelInput /
   FloatingLabelTextarea (web/src/components/forms/) and confirmed unused
   anywhere else in the codebase before deletion. */

/* ── Spinner · used inside the submit button while sending ───────── */
function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg
      className={`${className} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ── Card-style radio (filled when checked) ──────────────────────── */
function RadioPill({ label, value, current, onChange, name }) {
  const checked = current === value
  return (
    <label
      className={
        "group relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200 focus-within:ring-[3px] focus-within:ring-violet/25 " +
        (checked
          ? "border-violet bg-violet/[0.06] shadow-[0_2px_8px_rgb(var(--color-violet-rgb)/0.08)]"
          : "border-charcoal-80/12 hover:border-violet/40 hover:bg-violet-pale/30")
      }
    >
      <span
        aria-hidden="true"
        className={
          "relative flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2 transition-colors " +
          (checked ? "border-violet" : "border-charcoal-80/30 group-hover:border-violet/60")
        }
      >
        {checked ? (
          <m.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="block h-2.5 w-2.5 rounded-full bg-violet"
          />
        ) : null}
      </span>
      <span
        className={
          "text-[13px] leading-tight transition-colors sm:text-meta " +
          (checked ? "font-semibold text-violet" : "text-charcoal-80/75")
        }
      >
        {label}
      </span>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
    </label>
  )
}

/* ════════════════════════════════════════════════════════════════════
   CONTACT SECTION · two-column rounded card (info panel · form)
   ════════════════════════════════════════════════════════════════════ */
/* Field-level validation helpers */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MESSAGE_MIN = 10
const MESSAGE_MAX = 1000

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  audience: "",
  interest: "",
  tier: "",
  timeline: "",
  message: "",
  consent: false,
  website: "", // honeypot
}

function ContactSection() {
  // I18N hook scope · ContactSection renders the form, which calls t()
  // for placeholder text, error messages, and the "Sending…" / "Send message"
  // button labels. The hook must be mounted inside this component — the
  // page-level useTranslation in ContactPage doesn't reach across the
  // component boundary. Was missing → ReferenceError on every render.
  const { t } = useTranslation("contact")

  // `website` is a honeypot — bots autofill it; real users never see it.
  const [form, setForm] = useState(INITIAL_FORM)
  const [touched, setTouched] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  // error: null | string | { kind, title, body, action }
  // Strings are kept for backward compatibility with i18n-driven fallbacks.
  const [error, setError] = useState(null)
  const [paramContext, setParamContext] = useState(null)

  /* ──────────────────────────────────────────────────────────────────
   * Read URL params on mount and pre-fill the form.
   * Supported: intent · audience · tier · package · category
   * Sources:
   *   · Services pricing CTA   — /contact?intent=plan&audience=schools&tier=advanced
   *   · Solutions packages CTA — /contact?intent=proposal&package=brand-foundation
   *   · Services category link — /contact?intent=service&category=WD
   * ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const intent = params.get("intent") || ""
    const audKey = params.get("audience") || ""
    const tierKey = params.get("tier") || ""
    const pkg = params.get("package") || ""
    const category = params.get("category") || ""

    // Normalize audience: "schools" → "education", "smbs" → "business",
    // "ind" / "individuals" / "pros" → "professional"
    const audMap = {
      schools: "education", education: "education", edu: "education",
      smbs: "business", business: "business", smb: "business",
      individuals: "professional", professional: "professional",
      pros: "professional", ind: "professional",
    }
    const audience = audMap[audKey.toLowerCase()] || ""

    const tier = TIER_OPTIONS.find((o) => o.value === tierKey.toLowerCase())?.value || ""
    const interestPkg = pkg && INTEREST_OPTIONS.find((o) => o.value === pkg)?.value
    const interestCat = category && INTEREST_OPTIONS.find((o) => o.value === category.toUpperCase())?.value
    const interest = interestPkg || interestCat || ""

    if (audience || tier || interest) {
      setForm((f) => ({
        ...f,
        audience: audience || f.audience,
        tier: tier || f.tier,
        interest: interest || f.interest,
      }))
      setParamContext({ intent, audience, tier, interest })
    }
  }, [])

  /* Live per-field validation — errors only surface after the user
   * has interacted with that field (touched=true) or attempted submit.
   * I18N · the messageMin/messageMax keys interpolate {{min}}/{{max}}. */
  function validateField(field, value) {
    switch (field) {
      case "firstName":
        return value.trim() ? "" : t("form.errors.firstName")
      case "lastName":
        return value.trim() ? "" : t("form.errors.lastName")
      case "email":
        if (!value.trim()) return t("form.errors.emailRequired")
        if (!EMAIL_RE.test(value)) return t("form.errors.emailInvalid")
        return ""
      case "audience":
        return value ? "" : t("form.errors.audience")
      case "message":
        if (!value.trim()) return t("form.errors.messageRequired")
        if (value.trim().length < MESSAGE_MIN) return t("form.errors.messageMin", { min: MESSAGE_MIN })
        if (value.length > MESSAGE_MAX) return t("form.errors.messageMax", { max: MESSAGE_MAX })
        return ""
      case "consent":
        return value ? "" : t("form.errors.consent")
      default:
        return ""
    }
  }

  const fieldErrors = {
    firstName: validateField("firstName", form.firstName),
    lastName: validateField("lastName", form.lastName),
    email: validateField("email", form.email),
    audience: validateField("audience", form.audience),
    message: validateField("message", form.message),
    consent: validateField("consent", form.consent),
  }
  const isValid = Object.values(fieldErrors).every((m) => !m)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }
  function updateBool(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.checked }))
  }
  function markTouched(field) {
    return () => setTouched((tt) => ({ ...tt, [field]: true }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Surface every field error on submit attempt
    setTouched({
      firstName: true, lastName: true, email: true,
      audience: true, message: true, consent: true,
    })
    if (!isValid) {
      setError({
        kind: "warning",
        title: t("form.errors.fixTitle", { defaultValue: "A few fields need your attention" }),
        body: t("form.errors.fixFields"),
      })
      return
    }
    setError(null)
    setLoading(true)
    try {
      // Resolve labels for the email subject. We send English labels to
      // the backend (the admin notification email is English) so we
      // re-resolve via the EN namespace by accessing the option's
      // labelKey through t() with `lng: "en"` would over-engineer it;
      // instead we send the canonical option `value`s and let the
      // server format the subject.
      const interestLabel = form.interest
        ? t(`interests.items.${form.interest}`)
        : ""
      const audienceLabel = form.audience
        ? t(`audiences.${form.audience}`)
        : ""
      const tierLabel = form.tier
        ? t(`tiers.${form.tier}`)
        : ""
      const timelineLabel = form.timeline
        ? t(`timelines.${form.timeline}`)
        : ""

      const subjectParts = [audienceLabel, interestLabel, tierLabel].filter(Boolean)
      const subject = subjectParts.length > 0 ? subjectParts.join(" · ") : t("form.errors.subjectFallback")

      const payload = {
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        subject,
        message: [
          form.message.trim(),
          "",
          "Lead context:",
          audienceLabel && `Audience: ${audienceLabel}`,
          interestLabel && `Interest: ${interestLabel}`,
          tierLabel && `Tier: ${tierLabel}`,
          timelineLabel && `Timeline: ${timelineLabel}`,
          paramContext?.intent && `Source intent: ${paramContext.intent}`,
        ].filter(Boolean).join("\n"),
        website: form.website,
      }
      await apiRequest("/api/contact", { method: "POST", body: JSON.stringify(payload) })
      setSuccess(true)
      setForm(INITIAL_FORM)
      setTouched({})
    } catch (err) {
      // Server-side failure — surface a brand-aligned card with a
      // brief recovery hint pointing to the WhatsApp / email fallback so
      // the visitor never hits a dead end.
      setError({
        kind: "error",
        title: t("form.errors.sendFailedTitle", { defaultValue: "Couldn't send your message" }),
        body: err?.message || t("form.errors.sendFailed"),
        action: (
          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            Email instead →
          </a>
        ),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-16 sm:py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* "Two ways to reach me", clarifies Book vs. Send Message */}
        <m.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-8 grid max-w-4xl gap-4 sm:mb-10 sm:grid-cols-2 sm:gap-5"
        >
          <Link
            to="/book"
            className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-violet bg-violet p-5 text-white shadow-[0_14px_40px_rgb(var(--color-violet-rgb)/0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgb(var(--color-violet-rgb)/0.28)] sm:p-6"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <ClockIcon className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] !text-white">
                {t("callout.talkNow")}
              </span>
            </div>
            <div>
              <h3 className="text-[18px] font-bold !text-white sm:text-[19px]">{t("callout.bookTitle")}</h3>
              <p className="mt-1 text-[13px] leading-6 !text-white/85">
                {t("callout.bookBody")}
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold !text-terracotta">
              {t("callout.bookCta")}
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </span>
          </Link>

          <a
            href="#contact-form"
            className="group relative flex flex-col gap-3 rounded-2xl border-2 border-violet/15 bg-white p-5 text-charcoal-80 shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.05)] transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_14px_40px_rgb(var(--color-violet-rgb)/0.12)] sm:p-6"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-pale text-violet">
                <Send className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-violet-pale px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet">
                {t("callout.haveQuestion")}
              </span>
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-violet sm:text-[19px]">{t("callout.writeTitle")}</h3>
              <p className="mt-1 text-[13px] leading-6 text-charcoal-80/70">
                {t("callout.writeBody")}
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-violet">
              {t("callout.writeCta")}
              <span className="transition-transform group-hover:translate-y-0.5" aria-hidden="true">↓</span>
            </span>
          </a>
        </m.div>

        <m.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-20px_rgb(var(--color-violet-rgb)/0.20)] ring-1 ring-charcoal-80/[0.06]"
          id="contact-form"
        >

          {/* ════════════════════════════════════════════════════════
               FORM panel · full-width centered
               ════════════════════════════════════════════════════════ */}
          <m.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="bg-white p-6 sm:p-10 lg:p-12"
          >
            {success ? (
              <m.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="relative flex flex-col items-center gap-4 py-10 text-center sm:py-14"
              >
                <Confetti fire={success} />
                <m.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint/12 text-emerald-700"
                >
                  <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                </m.div>
                <h3 className="text-card font-bold text-violet">{t("form.successDetail.title")}</h3>
                <p className="max-w-xs text-meta text-charcoal-80/65">
                  {t("form.successDetail.body")}
                </p>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="mt-2 inline-flex items-center gap-1 text-meta font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
                >
                  {t("form.successDetail.again")}
                </button>
              </m.div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-7" noValidate>
                {/* Honeypot (hidden) */}
                <input
                  type="text"
                  name="website"
                  value={form.website}
                  onChange={update("website")}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-9999px", top: "-9999px",
                    width: "1px", height: "1px", opacity: 0,
                  }}
                />

                {error ? (
                  <m.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-[13px] font-medium text-rose-700"
                    role="alert"
                  >
                    {error}
                  </m.div>
                ) : null}

                {/* Context chip · only when URL params pre-filled the form */}
                {paramContext ? (
                  <m.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-start gap-3 rounded-xl border border-terracotta/25 bg-terracotta/[0.08] px-4 py-3"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-800" aria-hidden="true" />
                    <div className="flex flex-col gap-1 text-[12.5px] sm:text-[13px]">
                      <span className="font-bold text-terracotta-800">
                        {t("form.context.title")}
                      </span>
                      <span className="text-charcoal-80/70">
                        {t("form.context.inquiringAbout")}{" "}
                        {[
                          paramContext.audience && t(`audiences.${paramContext.audience}`),
                          paramContext.interest && t(`interests.items.${paramContext.interest}`),
                          paramContext.tier && `${t(`tiers.${paramContext.tier}`)} ${t("form.context.tier")}`,
                        ].filter(Boolean).join(" · ") || t("form.context.yourSelection")}
                      </span>
                    </div>
                  </m.div>
                ) : null}

                {/* Phase 10 · Floating-label inputs replace the previous
                    UnderlineField. Same API surface (name/value/onChange
                    /onBlur/error/required); the visual treatment shifts
                    from an animated underline to a full bordered box
                    with a label that scales/lifts into the border on
                    focus or when filled. */}

                {/* Row · First Name + Last Name */}
                <m.div variants={fadeUp} className="grid gap-5 sm:grid-cols-2 sm:gap-6">
                  <FloatingLabelInput
                    name="firstName"
                    label={t("form.firstName")}
                    value={form.firstName}
                    onChange={update("firstName")}
                    onBlur={markTouched("firstName")}
                    autoComplete="given-name"
                    error={touched.firstName ? fieldErrors.firstName : ""}
                    required
                  />
                  <FloatingLabelInput
                    name="lastName"
                    label={t("form.lastName")}
                    value={form.lastName}
                    onChange={update("lastName")}
                    onBlur={markTouched("lastName")}
                    autoComplete="family-name"
                    error={touched.lastName ? fieldErrors.lastName : ""}
                    required
                  />
                </m.div>

                {/* Row · Mail */}
                <m.div variants={fadeUp}>
                  <FloatingLabelInput
                    name="email"
                    label={t("form.email")}
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    onBlur={markTouched("email")}
                    autoComplete="email"
                    error={touched.email ? fieldErrors.email : ""}
                    required
                  />
                </m.div>

                {/* Audience selector · 3 RadioPills */}
                <m.fieldset variants={fadeUp} className="border-0 p-0">
                  <legend className="text-[13px] font-semibold text-charcoal sm:text-meta">
                    {t("form.audienceLegend")}
                  </legend>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {AUDIENCES.map(({ value, labelKey, Icon }) => (
                      <RadioPill
                        key={value}
                        name="audience"
                        value={value}
                        current={form.audience}
                        onChange={(v) => { setForm((f) => ({ ...f, audience: v })); markTouched("audience")() }}
                        label={t(labelKey)}
                        Icon={Icon}
                      />
                    ))}
                  </div>
                  {touched.audience && fieldErrors.audience && (
                    <p className="mt-2 text-[12px] text-rose">{fieldErrors.audience}</p>
                  )}
                </m.fieldset>

                {/* Message */}
                <m.div variants={fadeUp}>
                  <FloatingLabelTextarea
                    label={t("form.messageLabel")}
                    name="message"
                    value={form.message}
                    onChange={update("message")}
                    onBlur={markTouched("message")}
                    rows={5}
                    maxLength={MESSAGE_MAX}
                    error={touched.message ? fieldErrors.message : ""}
                    required
                  />
                </m.div>

                {/* Consent */}
                <m.label variants={fadeUp} className="flex items-start gap-3 text-[13px] text-charcoal/75">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={updateBool("consent")}
                    onBlur={markTouched("consent")}
                    className="mt-1 h-4 w-4 rounded border-charcoal/25 text-violet focus:ring-2 focus:ring-violet/30"
                  />
                  <span>
                    {t("form.consent")}
                  </span>
                </m.label>
                {touched.consent && fieldErrors.consent && (
                  <p className="-mt-3 ml-7 text-[12px] text-rose">{fieldErrors.consent}</p>
                )}

                {error && (
                  <m.div variants={fadeUp}>
                    <AuthErrorBanner error={error} onDismiss={() => setError(null)} />
                  </m.div>
                )}

                {/* Submit */}
                <m.div variants={fadeUp} className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgb(var(--color-violet-rgb)/0.28)] transition hover:-translate-y-0.5 hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <Spinner /> {t("form.sending")}
                      </>
                    ) : (
                      <>
                        {t("form.submit")}
                        <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </m.div>
              </form>
            )}
          </m.div>
        </m.div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   ContactChannelsSection · Email · WhatsApp · Address quick-links
   ──────────────────────────────────────────────────────────────────
   I18N · scoped useTranslation; address lines stay as canonical
   geographic data (the city name does not translate).
   ════════════════════════════════════════════════════════════════════ */
function ContactChannelsSection() {
  const { t } = useTranslation("contact")
  return (
    <section className="py-16 sm:py-20" style={{ backgroundColor: "rgb(var(--color-mist-rgb)/0.5)" }}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-[24px] font-bold text-violet sm:text-[32px]">{t("channels.title")}</h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-steel-700">
            {t("channels.subtitle")}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <a
              href={`mailto:${EMAIL}`}
              className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_12px_32px_rgb(var(--color-violet-rgb)/0.08)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-violet">{t("channels.email")}</div>
                <div className="mt-0.5 text-[12px] text-steel-700">{EMAIL}</div>
              </div>
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_12px_32px_rgb(var(--color-violet-rgb)/0.08)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-50 text-mint">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-violet">{t("channels.whatsapp")}</div>
                <div className="mt-0.5 text-[12px] text-steel-700">{t("channels.whatsappBody")}</div>
              </div>
            </a>
            <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-amber-700">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-violet">{t("channels.basedIn")}</div>
                <div className="mt-0.5 text-[12px] leading-5 text-steel-700">
                  {ADDRESS_LINES.map((line) => <div key={line}>{line}</div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   ContactSocialsSection · social links footer
   ──────────────────────────────────────────────────────────────────
   Renders the canonical SocialLinks component with the contact-page
   bundle (LinkedIn · GitHub · Telegram · Instagram · WhatsApp) in the
   "filled" variant — official brand colors + sheen sweep + halo lift.
   ════════════════════════════════════════════════════════════════════ */
function ContactSocialsSection() {
  const { t } = useTranslation("contact")
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-steel">
            {t("socials.findMe")}
          </span>
          <SocialLinks
            platforms={CONTACT_SOCIALS}
            variant="filled"
            size="sm"
            align="center"
            ariaLabel={t("socials.ariaLabel")}
          />
        </div>
      </div>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════ */
export default function ContactPage() {
  return (
    <>
      <ContactHero />
      <ContactSection />
      <ContactChannelsSection />
      <ContactSocialsSection />
    </>
  )
}
