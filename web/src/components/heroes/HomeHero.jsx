import { lazy, Suspense, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { LocalizedLink as Link } from "../LocalizedLink"
import { m, useReducedMotion } from "framer-motion"
import { ArrowRight, Calendar } from "lucide-react"
import Image from "../ui/Image"
import { canRenderHeroDepth, scheduleAfterLoad } from "../motion/heroDepth/gate"

// Separate chunk; only requested on capable desktops after load + idle.
const HeroDepth = lazy(() => import("../motion/HeroDepth"))

/**
 * HomeHero · V12 — "One thesis, two paths" (roadmap step 24)
 * ─────────────────────────────────────────────────────────────────────────
 * V11 carried a phone mockup, three floating satellites, a kinetic headline
 * and a pulsing status dot (~15 motion elements before the fold). V12 keeps
 * one job: say what Mustapha builds and for whom, then offer exactly two
 * doors — book a call (services) or browse products (store).
 *
 *   · LCP element is the <h1> text (plain, no word-by-word reveal) or the
 *     56px avatar; nothing else above the fold is heavier than a gradient.
 *   · ONE orchestrated load sequence: a stagger container with 5 children
 *     (eyebrow, headline, subtitle, CTA row, signature). No other motion.
 *   · useReducedMotion → children render in place with no transform.
 *   · At 375px the headline and both CTAs fit above the fold: the
 *     signature row is the only element pushed below them.
 *   · Step 34: on desktop (≥1024px, no reduced-motion, no saveData,
 *     ≥4 cores) a lazy <HeroDepth> canvas fades in over the static
 *     gradient after `load` + idle. Mobile never requests the chunk.
 */
export default function HomeHero() {
  const { t } = useTranslation("home")
  const reduced = useReducedMotion()
  const [depth, setDepth] = useState(false)

  useEffect(() => {
    if (!canRenderHeroDepth()) return undefined
    return scheduleAfterLoad(() => setDepth(true))
  }, [])

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.08, delayChildren: 0.05 } },
  }
  const item = {
    hidden: { opacity: 0, y: reduced ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <section
      className="relative isolate overflow-hidden bg-mist"
      aria-label={t("hero.ariaLabel")}
    >
      {/* Mesh aurora background (Brand v3 §06) — static, no motion */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(at 8% 12%, rgb(var(--color-violet-rgb)/0.16) 0px, transparent 50%), " +
            "radial-gradient(at 92% 0%, rgb(var(--color-azure-rgb)/0.12) 0px, transparent 50%), " +
            "radial-gradient(at 0% 100%, rgb(var(--color-terracotta-rgb)/0.12) 0px, transparent 50%)",
        }}
      />
      {depth && (
        <Suspense fallback={null}>
          <HeroDepth />
        </Suspense>
      )}

      <m.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex max-w-7xl flex-col items-start px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24"
      >
        {/* 1 · Eyebrow */}
        <m.span
          variants={item}
          className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1.5 text-micro font-semibold uppercase tracking-[0.12em] text-violet-deep"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet" aria-hidden="true" />
          {t("hero.eyebrow")}
        </m.span>

        {/* 2 · Headline — the LCP element */}
        <m.h1
          variants={item}
          className="mt-5 max-w-4xl font-display text-[clamp(32px,6.2vw,60px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-charcoal text-balance"
        >
          {t("hero.headline")}
        </m.h1>

        {/* 3 · Subtitle — the four catalogue categories, plainly */}
        <m.p
          variants={item}
          className="mt-5 max-w-2xl text-[15px] leading-[1.7] text-charcoal-80/75 sm:text-[17px]"
        >
          {t("hero.subtitle")}
        </m.p>

        {/* 4 · Exactly two CTAs */}
        <m.div
          variants={item}
          className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
        >
          <Link
            to="/book"
            className="ukz-shimmer group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-grad-innovation px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-violet/20 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {t("hero.ctaPrimary")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            to="/store"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-charcoal/15 bg-white/80 px-6 py-3 text-[15px] font-semibold text-charcoal backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
          >
            {t("hero.ctaSecondary")}
          </Link>
        </m.div>

        {/* 5 · Signature — the person behind the offer + the no-pressure note */}
        <m.div
          variants={item}
          className="mt-8 flex items-center gap-3"
        >
          <Image
            src="/images/profile/Ukizuru_Mustapha_Photo.jpg"
            alt={t("hero.avatarAlt")}
            width={56}
            height={56}
            widths={[112, 224, 448]}
            sizes="56px"
            loading="eager"
            fetchPriority="high"
            className="h-14 w-14 shrink-0"
            imgClassName="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-[0_8px_20px_-8px_rgb(var(--color-violet-rgb)/0.35)]"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-bold leading-tight text-charcoal">{t("hero.avatarName")}</p>
            <p className="mt-0.5 text-[12.5px] leading-tight text-charcoal-80/65">{t("hero.avatarRole")}</p>
            <p className="mt-1 text-[12px] leading-tight text-violet">{t("hero.callNote")}</p>
          </div>
        </m.div>
      </m.div>
    </section>
  )
}
