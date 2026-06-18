import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { Briefcase, Globe2, Sparkles, GraduationCap } from "lucide-react"
import { useTranslation } from "react-i18next"
import Counter from "./motion/Counter"
import BorderBeam from "./motion/BorderBeam"

/**
 * HomeStatsStrip · animated credibility metrics for the Home page
 * ─────────────────────────────────────────────────────────────────────────
 * Four bento tiles in a 2×2 / 4-col grid, each showing a key credibility
 * number with an animated Counter that fires once on viewport entry.
 *
 * Lead tile (8+ years) spans 2 cols on desktop — same pattern as
 * AboutStatsStrip to maintain visual language across pages.
 *
 * Brand design language:
 *   · Soft violet-tinted tile surfaces (no dark canvas — this sits between
 *     two light sections on Home)
 *   · JetBrains Mono tabular-nums at hero scale
 *   · BorderBeam on the lead tile — premium depth cue
 *   · Scroll-driven proof spine (thin gradient line at left edge)
 */
export default function HomeStatsStrip() {
  const { t } = useTranslation("home")
  const reduced = useReducedMotion()
  const ref = useRef(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 30%"],
  })
  const spineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  const tiles = [
    {
      key: "years",
      to: 8,
      suffix: "+",
      Icon: Briefcase,
      label: t("stats.yearsLabel", { defaultValue: "Years shipping production work" }),
      hint:  t("stats.yearsHint",  { defaultValue: "Rwanda · Turkey · Ethiopia · Mexico" }),
      tone: "violet",
      lead: true,
    },
    {
      key: "projects",
      to: 47,
      suffix: "",
      Icon: Sparkles,
      label: t("stats.projectsLabel", { defaultValue: "Projects shipped" }),
      hint:  t("stats.projectsHint",  { defaultValue: "Web · SaaS · EdTech" }),
      tone: "azure",
    },
    {
      key: "countries",
      to: 4,
      suffix: "",
      Icon: Globe2,
      label: t("stats.countriesLabel", { defaultValue: "Countries lived & worked" }),
      hint:  t("stats.countriesHint",  { defaultValue: "EN · ES · TR · KIN" }),
      tone: "terracotta",
    },
    {
      key: "students",
      to: 100,
      suffix: "+",
      Icon: GraduationCap,
      label: t("stats.studentsLabel", { defaultValue: "Students taught" }),
      hint:  t("stats.studentsHint",  { defaultValue: "CS & STEM" }),
      tone: "mint",
    },
  ]

  const TONE = {
    violet:    { surface: "bg-violet-pale/60",  number: "text-violet",      icon: "bg-violet/10 text-violet",        accent: "bg-violet",    hint: "text-violet/65"   },
    azure:     { surface: "bg-azure-pale/60",   number: "text-azure-deep",  icon: "bg-azure/10 text-azure",          accent: "bg-azure",     hint: "text-azure-deep/65" },
    terracotta:{ surface: "bg-terracotta/15",   number: "text-charcoal",    icon: "bg-terracotta/25 text-charcoal",  accent: "bg-terracotta",hint: "text-charcoal/55" },
    mint:      { surface: "bg-mint-50/70",      number: "text-mint-700",    icon: "bg-mint/12 text-mint",            accent: "bg-mint",      hint: "text-mint-700/65" },
  }

  const fadeUp = {
    hidden: { opacity: 0, y: reduced ? 0 : 24 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }
  const stagger = {
    hidden: {},
    show:   { transition: { staggerChildren: 0.07 } },
  }

  return (
    <section
      ref={ref}
      className="relative isolate py-16 lg:py-20"
      aria-label="Key metrics"
    >
      {/* Proof spine */}
      <motion.span
        aria-hidden="true"
        className="absolute left-4 top-4 hidden h-16 w-px origin-top bg-gradient-to-b from-violet via-azure to-cyan sm:block"
        style={reduced ? { scaleY: 1 } : { scaleY: spineScale }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section label */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mb-8 flex items-center gap-3"
        >
          <motion.span variants={fadeUp} className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-steel">
            <span className="h-px w-8 bg-violet/40" aria-hidden="true" />
            {t("stats.eyebrow", { defaultValue: "By the numbers" })}
          </motion.span>
        </motion.div>

        {/* Tiles grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:auto-rows-[minmax(160px,1fr)]"
        >
          {tiles.map((tile, idx) => {
            const p = TONE[tile.tone]
            const span = tile.lead ? "col-span-2 lg:col-span-2 lg:row-span-2" : ""

            return (
              <motion.div
                key={tile.key}
                variants={fadeUp}
                whileHover={reduced ? undefined : { y: -3 }}
                transition={{ duration: 0.3 }}
                className={`group relative flex flex-col overflow-hidden rounded-2xl ${p.surface} ring-1 ring-charcoal-80/8 p-5 sm:p-6 ${span}`}
              >
                {/* BorderBeam on lead tile */}
                {tile.lead && <BorderBeam colorFrom="#5D3FD3" colorTo="#0284C7" duration={10} />}

                {/* Icon row */}
                <div className="flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.icon}`}>
                    <tile.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  {tile.lead && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-charcoal/5 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                      Live
                    </span>
                  )}
                </div>

                {/* Number */}
                <div className="mt-auto flex items-baseline gap-1.5 pt-5">
                  <Counter
                    to={tile.to}
                    className={`font-mono font-bold leading-none tracking-tight tabular-nums ${p.number} ${
                      tile.lead
                        ? "text-[clamp(52px,7vw,88px)]"
                        : "text-[clamp(36px,4.5vw,56px)]"
                    }`}
                  />
                  {tile.suffix && (
                    <span className={`font-mono font-semibold ${p.number} opacity-70 ${tile.lead ? "text-[clamp(24px,3.5vw,40px)]" : "text-[clamp(18px,2.5vw,28px)]"}`}>
                      {tile.suffix}
                    </span>
                  )}
                </div>

                {/* Label + hint */}
                <div className="mt-2 flex flex-col gap-1">
                  <p className={`font-semibold leading-snug text-charcoal ${tile.lead ? "text-[14px] sm:text-[15px]" : "text-[12.5px] sm:text-[13px]"}`}>
                    {tile.label}
                  </p>
                  <p className={`font-mono uppercase tracking-[0.14em] ${p.hint} ${tile.lead ? "text-[10.5px]" : "text-[10px]"}`}>
                    {tile.hint}
                  </p>
                </div>

                {/* Hover accent line */}
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0 left-0 h-[2px] w-0 ${p.accent} transition-[width] duration-300 ease-out group-hover:w-full`}
                />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
