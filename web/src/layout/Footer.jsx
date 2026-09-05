import { useState } from "react"
import { LocalizedLink as Link } from "../components/LocalizedLink"
import {
  Mail,
  ArrowRight,
  Sparkles,
} from "lucide-react"

import { apiRequest } from "../lib/api"
import BrandLogo from "../components/BrandLogo"
import SocialLinks, { DEFAULT_SOCIALS } from "../components/SocialLinks"
import LanguageSwitcher from "../components/LanguageSwitcher"
import { useTranslation } from "react-i18next"

const mercadoPagoLogo = "/images/brand/MP_CMYK_HANDSHAKE_color_horizontal.png"
const paypalLogo = "/images/brand/pp-logo-150px.png"

/* ──────────────────────────────────────────────────────────────────────────
 *  Footer · V2.2 · "Mesh-panel" structure
 *
 *  Three tiers, all on a unified mesh-gradient backdrop (same visual
 *  language as the V2 hero and loading screen — three radial glows of
 *  violet, azure, and terracotta over a deep charcoal base):
 *
 *    Tier 1 — Newsletter band   · centred · BrandLogo mark tile + heading
 *    Tier 2 — Middle row        · socials · quick links · payment badges
 *    Tier 3 — Legal bar         · copyright + tagline + legal links
 *
 *  Brand tokens only — no raw hex outside the official payment-method
 *  badges. Soft Terracotta drives the warm accent; Royal Violet drives
 *  every interactive accent.
 *  ──────────────────────────────────────────────────────────────────────── */

/* Footer quick links — includes the editorial surfaces (Blog)
 * that we deliberately keep OUT of the primary navbar so the header stays
 * focused on what visitors hire Mustapha for. */
const QUICK_LINKS = [
  { nameKey: "footer.navHome", path: "/" },
  { nameKey: "footer.navAbout", path: "/about" },
  { nameKey: "footer.navServices", path: "/services" },
  { nameKey: "footer.navHowWeWork", path: "/how-we-work" },
  { nameKey: "footer.navSelfAudit", path: "/self-audit" },
  { nameKey: "footer.navSchools", path: "/schools" },
  // T5-5 · clients arrive here from an invoice with a code in hand and
  // nothing else; the footer is on every page they might land on first.
  { nameKey: "footer.navTrack", path: "/track" },
  // T1-9 · in the footer because the footer is on the error page too.
  { nameKey: "footer.navStatus", path: "/status" },
  { nameKey: "footer.navStore", path: "/store" },
  { nameKey: "footer.navBlog", path: "/blog" },
  { nameKey: "footer.navContact", path: "/contact" },
]

const LEGAL_LINKS = [
  { nameKey: "footer.legalTerms",   shortKey: "footer.legalTermsShort",   path: "/terms" },
  { nameKey: "footer.legalPrivacy", shortKey: "footer.legalPrivacyShort", path: "/privacy" },
  // Aviso de Privacidad Integral (LFPDPPP) — anchor inside PrivacyPage.
  { nameKey: "footer.legalNotice",  shortKey: "footer.legalNoticeShort",  path: "/privacy#aviso-de-privacidad" },
  { nameKey: "footer.legalCookies", shortKey: "footer.legalCookiesShort", path: "/cookies" },
  { nameKey: "footer.legalRefund",  shortKey: "footer.legalRefundShort",  path: "/refund" },
]

/* Mesh gradient — three radial glows on a deep charcoal base.
 * Pre-built as a string so the JSX `style` attribute stays simple. Same
 * language as the V2 hero and loading screen for visual unity. */
const FOOTER_GRADIENT =
  "radial-gradient(at 18% 20%, rgb(var(--color-violet-rgb)/0.55) 0px, transparent 55%), " +
  "radial-gradient(at 82% 0%, rgb(var(--color-azure-rgb)/0.30) 0px, transparent 50%), " +
  "radial-gradient(at 50% 100%, rgb(var(--color-terracotta-rgb)/0.18) 0px, transparent 55%), " +
  "linear-gradient(180deg, var(--color-charcoal-deep) 0%, var(--color-charcoal) 100%)"

export default function Footer() {
  const { t } = useTranslation("common")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  async function handleSubscribe(e) {
    e.preventDefault()
    setSuccess("")
    setError("")
    if (!email.trim()) {
      setError(t("footer.emailRequired"))
      return
    }
    try {
      setLoading(true)
      // Canonical versioned route + `source` so footer signups are
      // attributable in the admin lead report, like every other form.
      const res = await apiRequest("/api/v1/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), source: "footer" }),
      })
      // Double opt-in: nobody is subscribed until they click the emailed
      // confirmation link, so never claim they are.
      setSuccess(res.message || t("footer.subscribeSuccess"))
      setEmail("")
    } catch (err) {
      const friendly =
        (err && typeof err.toUserMessage === "function" && err.toUserMessage()) ||
        (err && err.message) ||
        t("footer.subscribeError")
      setError(friendly)
    } finally {
      setLoading(false)
    }
  }

  const year = new Date().getFullYear()

  return (
    <footer
      className="relative isolate overflow-hidden text-white"
      style={{ background: FOOTER_GRADIENT }}
    >
      {/* Subtle dot grid for depth, barely visible, adds tactile finish */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:32px_32px]"
      />

      {/* ── Tier 1 · Newsletter band (no card, transparent on the mesh) ── */}
      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Brand mark tile, same centerpiece treatment as the splash screen */}
          <Link
            to="/"
            aria-label={t("footer.homeAria")}
            className="group relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_18px_50px_rgb(var(--color-violet-rgb)/0.45)] ring-1 ring-white/15 transition hover:-translate-y-[2px] hover:shadow-[0_22px_60px_rgb(var(--color-violet-rgb)/0.55)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/40 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
          >
            {/* Soft halo, picks up the mesh hue on hover */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 rounded-3xl bg-violet/30 opacity-0 blur-xl transition group-hover:opacity-100"
            />
            <BrandLogo variant="mark" theme="violet" size={36} />
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/25 bg-terracotta/10 px-3.5 py-1 backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-terracotta" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-terracotta">
              {t("footer.stayConnected")}
            </span>
          </span>

          <div>
          <h2 className="text-[clamp(30px,4.2vw,44px)] font-bold leading-[1.05] tracking-[-0.012em] !text-white">
  {t("footer.stayHeadlineLead")} <span className="text-terracotta">{t("footer.stayHeadlineHighlight")}</span>.
</h2>
            <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/65">
              {t("footer.newsletterBody2")} {t("footer.unsubscribeAnytime")}
            </p>
          </div>

          <form
            onSubmit={handleSubscribe}
            noValidate
            className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              {t("footer.emailAria2")}
            </label>
            <div className="relative flex-1">
              <Mail
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                aria-hidden="true"
              />
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("footer.emailPlaceholder")}
                autoComplete="email"
                className="w-full rounded-xl border border-white/12 bg-white/[0.06] py-3.5 pl-11 pr-4 text-[14px] text-white placeholder-white/35 outline-none backdrop-blur-sm transition focus:border-terracotta/40 focus:bg-white/[0.10] focus:ring-[3px] focus:ring-terracotta/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgb(var(--color-violet-rgb)/0.45)] transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_14px_36px_rgb(var(--color-violet-rgb)/0.55)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {loading ? t("footer.subscribing") : t("footer.subscribeCta")}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </form>

          <div className="min-h-[20px]" aria-live="polite">
            {success ? (
              <p role="status" className="text-[13px] font-medium text-terracotta">
                {"✓"} {success}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-[13px] font-medium text-rose-300">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Tier 2 · Middle row · socials · quick links · payments ── */}
      <div className="relative border-t border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">
            {/* Socials — official brand colors at rest, with sheen-sweep,
                spring lift, and brand-tinted halo bloom on hover. */}
            <SocialLinks
              platforms={DEFAULT_SOCIALS}
              variant="filled"
              size="sm"
              align="center"
              ariaLabel="Follow Mustapha on social media"
            />

            {/* Quick links, pipe-separated */}
            <nav
              aria-label={t("footer.quickLinksAria")}
              className="flex flex-wrap items-center justify-center"
            >
              {QUICK_LINKS.map((link, i) => (
                <span key={link.nameKey} className="flex items-center">
                  <Link
                    to={link.path}
                    className="rounded-md px-3 py-1 text-[13px] font-medium text-white/60 transition hover:text-terracotta focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/40 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
                  >
                    {t(link.nameKey)}
                  </Link>
                  {i < QUICK_LINKS.length - 1 ? (
                    <span className="text-white/15" aria-hidden="true">|</span>
                  ) : null}
                </span>
              ))}
            </nav>

            {/* Payment badges */}
            <div
              className="flex items-center gap-3"
              aria-label={t("footer.paymentsAria")}
            >
              <div className="flex items-center overflow-hidden rounded-md border border-white/10 bg-[#ffe600] px-3">
                {/* Rendered at 112x24 but the PNG master is 1021px wide.
                    AVIF and WebP siblings already exist in
                    web/public/images/brand -- a plain <img src=".png">
                    ignored all of them and shipped the master on every
                    page. AVIF first, WebP next, PNG as the last resort. */}
                <picture>
                  <source
                    type="image/avif"
                    srcSet="/images/brand/MP_CMYK_HANDSHAKE_color_horizontal-400.avif"
                  />
                  <source
                    type="image/webp"
                    srcSet="/images/brand/MP_CMYK_HANDSHAKE_color_horizontal-400.webp"
                  />
                  <img
                    src={mercadoPagoLogo}
                    alt={t("footer.mercadoPagoAcceptedAlt")}
                    width={112}
                    height={24}
                    loading="lazy"
                    decoding="async"
                    className="h-6 w-28 object-contain"
                  />
                </picture>
              </div>
              <div className="flex items-center overflow-hidden rounded-md border border-white/10 bg-white px-3 py-2">
                <img
                  src={paypalLogo}
                  alt={t("footer.paypalAcceptedAlt")}
                  className="h-6 w-28 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tier 3 · Legal bar ──────────────────────────────────────── */}
      <div className="relative border-t border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-[12px] text-white/40">
              © {year} {t("footer.copyrightText")}
              <span className="ml-1 text-white/30">
                {t("footer.tagline")}
              </span>
            </p>

            {/* Language switcher · footer */}
            <LanguageSwitcher variant="text" tone="dark" />

            <nav
              aria-label={t("footer.legalAria")}
              className="flex flex-wrap items-center justify-center"
            >
              {LEGAL_LINKS.map((link, i) => (
                <span key={link.nameKey} className="flex items-center">
                  <Link
                    to={link.path}
                    className="rounded-md px-2 py-0.5 text-[12px] text-white/40 transition hover:text-white/75 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/40 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
                  >
                    {/* Brief labels on small screens, full labels from sm up */}
                    <span className="sm:hidden">{t(link.shortKey)}</span>
                    <span className="hidden sm:inline">{t(link.nameKey)}</span>
                  </Link>
                  {i < LEGAL_LINKS.length - 1 ? (
                    <span className="text-white/15" aria-hidden="true">|</span>
                  ) : null}
                </span>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}

