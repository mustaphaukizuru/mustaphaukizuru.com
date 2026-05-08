import { motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Download,
  Star,
  BadgeCheck,
  Settings2,
  Sparkles,
} from "lucide-react"

import SocialLinks, { FOLLOW_SOCIALS } from "../SocialLinks"

/* CV — Spanish (full-stack engineer + cover letter).
 * If you'd rather keep the original filename with spaces, replace the
 * import path with the literal string (Vite handles spaces but the
 * bundled URL is ugly):
 *   import resumePdf from "../../assets/cv/Es_ Ingeniero de Software Full-Stack CV y Carta de Motivacion Mustapha Ukizuru.pdf?url"
 */
import resumePdf from "../../assets/cv/Es_ Ingeniero de Software Full-Stack CV y Carta de Motivacion Mustapha Ukizuru.pdf?url"

/**
 * AboutHero · V3.2 — 3-column composition with full social row + CV download
 *
 * Layout:
 *   [Greeting + name + stats + CTAs + 6 socials]   [Portrait]   [Tagline + review + role + trust]
 *
 * Secondary CTA replaced: "Explore Store" → "Download my CV" (Spanish PDF).
 *
 * Brand tokens only (Royal Violet, Soft Terracotta, Charcoal, Mist).
 * Right column hidden below lg so mobile stays focused on the headline +
 * portrait. All idle motion respects `prefers-reduced-motion`.
 */

const profilePhoto = "/images/profile/Ukizuru_Mustapha_Photo.jpg"

/* ─────────────────────────── content ─────────────────────────────────── */

const TRUST_BULLETS = [
  { icon: BadgeCheck, label: "Proven Results", desc: "Delivered across schools & businesses" },
  { icon: Settings2, label: "Expert Systems", desc: "Infrastructure & digital platforms" },
  { icon: Sparkles, label: "STEM & EdTech", desc: "Coding, robotics, digital learning" },
]

const REVIEW_INITIALS = ["AM", "JN", "CK", "TM"]

const HERO_BG =
  "radial-gradient(at 100% 0%, rgba(124,58,237,0.10) 0px, transparent 55%), " +
  "radial-gradient(at 0% 100%, rgba(233,196,106,0.18) 0px, transparent 50%), " +
  "linear-gradient(160deg, #F8FAFC 0%, #EFE7F8 40%, #EFF1F5 100%)"

const RING_GRADIENT =
  "conic-gradient(from 0deg, #E9C46A 0%, #5D3FD3 35%, #7c3aed 50%, #5D3FD3 65%, #E9C46A 100%)"

/* ─────────────────────────── component ───────────────────────────────── */

export default function AboutHero() {
  const { t } = useTranslation("about")
  const reduced = useReducedMotion()

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : 0.08,
        delayChildren: 0.1,
      },
    },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: reduced ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <section
      aria-labelledby="about-hero-title"
      className="relative min-h-[100dvh] overflow-hidden"
      style={{ background: HERO_BG }}
    >
      {/* Idle ring rotation + portrait float */}
      <style>{`
        @keyframes ukzAboutRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ukzAboutFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .ukz-about-ring { animation: ukzAboutRing 40s linear infinite; }
        .ukz-about-float { animation: ukzAboutFloat 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ukz-about-ring, .ukz-about-float { animation: none; }
        }
      `}</style>

      {/* Decorative blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-violet/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-terracotta/15 blur-2xl"
      />

      <Container className="flex min-h-[100dvh] items-center py-12 sm:py-16 lg:py-20">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-0">

          {/* ═══ LEFT, greeting · stats · CTAs · socials ═══ */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-7 pr-0 lg:pr-8"
          >
            {/* Greeting + headline */}
            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              <p className="text-[clamp(16px,1.4vw,20px)] font-semibold text-charcoal-80/65">
                {t("hero.helloIAm")}
              </p>
              <h1
                id="about-hero-title"
                className="text-display text-violet"
              >
                Mustapha{" "}
                <span className="relative inline-block text-terracotta">
                  Ukizuru.
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-violet/20"
                  />
                </span>
              </h1>
            </motion.div>

            {/* Stats */}
            <motion.div variants={fadeUp} className="flex items-center gap-4">
              <div>
                <span className="text-[clamp(40px,5vw,52px)] font-extrabold leading-none text-violet">
                  8+
                </span>
                <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.2em] text-charcoal-80/55">
                  {t("hero.yearsExperience")}
                </div>
              </div>
              <div aria-hidden="true" className="h-12 w-px bg-charcoal-80/15" />
              <div>
                <span className="text-[clamp(28px,3.5vw,38px)] font-extrabold leading-none text-violet">
                  10+
                </span>
                <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.2em] text-charcoal-80/55">
                  {t("hero.projectsDelivered")}
                </div>
              </div>
            </motion.div>

            {/* CTAs, primary: Book Consultation · secondary: Download CV */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              {/* Primary conversion CTA — Innovation Gradient (Brand v3 sacred,
                  reserved for Book / Buy / Checkout / Contact CTAs). */}
              <Link
                to="/contact"
                aria-label={t("hero.contactAria")}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-grad-innovation px-6 py-3.5 text-[14px] font-bold !text-white shadow-[0_14px_34px_-8px_rgba(93,63,211,0.55),0_4px_10px_-2px_rgba(2,132,199,0.25)] ring-1 ring-inset ring-white/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-8px_rgba(93,63,211,0.65),0_6px_14px_-2px_rgba(2,132,199,0.32)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/50 focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent"
                />
                <span className="relative">{t("cta.letsTalk", "Contact")}</span>
                <ArrowRight
                  className="relative h-4 w-4 !text-white transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>

              <a
              href={resumePdf}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("hero.openCvAria")}
                className="group inline-flex items-center gap-2 rounded-xl border border-violet/25 bg-white/60 px-6 py-3.5 text-[14px] font-semibold text-violet transition hover:-translate-y-0.5 hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30 focus-visible:ring-offset-2"
              >
                <Download
                  className="h-4 w-4 transition-transform group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
                {t("hero.viewCv")}
              </a>
            </motion.div>

            {/* Socials — filled brand chips, no surrounding panel.
                Same SocialLinks component the Footer uses, rendered
                directly on the hero's mist surface. */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-charcoal-80/45">
                {t("hero.connectLabel")}
              </span>
              <div aria-hidden="true" className="h-px max-w-[40px] flex-1 bg-charcoal-80/15" />
              <SocialLinks
                platforms={FOLLOW_SOCIALS}
                variant="filled"
                size="sm"
                align="start"
                ariaLabel="Connect with Mustapha"
              />
            </motion.div>
          </motion.div>

          {/* ═══ CENTRE, circular portrait with rotating gradient ring ═══ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="relative mx-auto my-6 flex items-center justify-center lg:my-0"
            style={{ width: "min(340px, 85vw)", height: "min(400px, 100vw)" }}
          >
            {/* Rotating brand gradient ring */}
            <div
              aria-hidden="true"
              className="ukz-about-ring absolute inset-0 rounded-full"
              style={{ background: RING_GRADIENT }}
            />
            {/* Inner mist disc, leaves a 6 px gap so the ring shows through */}
            <div
              aria-hidden="true"
              className="absolute inset-[6px] rounded-full"
              style={{ background: "#F8FAFC" }}
            />

            {/* Portrait, gentle idle float */}
            <div
              className="ukz-about-float relative z-10 overflow-hidden rounded-full shadow-[0_20px_60px_-10px_rgba(93,63,211,0.30)]"
              style={{ width: "min(320px, 80vw)", height: "min(380px, 95vw)" }}
            >
              <img
                src={profilePhoto}
                alt={t("hero.portraitAlt")}
                loading="eager"
                className="h-full w-full object-cover object-top"
              />
            </div>
          </motion.div>

          {/* ═══ RIGHT, tagline · review · role · trust bullets (lg+ only) ═══ */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="hidden flex-col gap-7 pl-0 lg:flex lg:pl-8"
          >
            {/* Tagline */}
            <motion.div variants={fadeUp} className="text-right">
              <p className="text-[clamp(15px,1.1vw,17px)] italic leading-7 text-charcoal-80/65">
                {t("hero.tagline1")}
                <br />
                <span className="font-semibold not-italic text-violet">
                  {t("hero.tagline2")}
                </span>
              </p>
            </motion.div>

            {/* Review card */}
            <motion.div variants={fadeUp} className="flex justify-end">
              <div className="rounded-xl border border-charcoal-80/10 bg-white px-5 py-4 shadow-[0_12px_32px_-8px_rgba(93,63,211,0.15)]">
                <div className="flex items-center gap-3 text-[13px] font-semibold">
                  <span className="text-[12px] font-normal text-charcoal-80/60">
                    {t("hero.clientReviews")}
                  </span>
                  <div className="flex gap-0.5 text-terracotta">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {REVIEW_INITIALS.map((init) => (
                      <div
                        key={init}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet text-[9.5px] font-bold text-white"
                      >
                        {init}
                      </div>
                    ))}
                  </div>
                  <span className="text-[20px] font-extrabold text-violet tabular-nums">
                    4.3
                  </span>
                </div>
                <div className="mt-1.5 text-[10px] text-charcoal-80/45">
                  {t("hero.basedOnFeedback")}
                </div>
              </div>
            </motion.div>

            {/* Role */}
            <motion.div variants={fadeUp} className="text-right">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-charcoal-80/50">
                {t("hero.technologyKicker")}
              </p>
              <p
                className="text-[clamp(28px,2.8vw,36px)] font-extrabold leading-tight tracking-tight text-violet"
                style={{ fontStyle: "italic" }}
              >
                {t("hero.consultantWord")}
              </p>
            </motion.div>

            {/* Trust bullets */}
            <motion.div variants={fadeUp} className="flex flex-col gap-3">
              {TRUST_BULLETS.map((bullet) => {
                const Icon = bullet.icon
                return (
                  <div
                    key={bullet.label}
                    className="group flex items-center gap-3 rounded-xl p-1 text-[13px] transition hover:bg-white/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet ring-1 ring-violet/10 transition group-hover:bg-violet group-hover:text-white">
                      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="font-semibold text-violet">{bullet.label}</div>
                      <div className="text-[11px] text-charcoal-80/55">{bullet.desc}</div>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}

/* Local container — keeps the file self-contained so it can be imported
 * without depending on Home.jsx's internal Container helper. */
function Container({ children, className = "" }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  )
}
