import { motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { FaReact, FaNodeJs, FaPython, FaDocker, FaGitAlt } from "react-icons/fa"
import { SiTypescript, SiTailwindcss, SiPostgresql } from "react-icons/si"

/**
 * TechStackShowcase · "tools & tech I build with" — quiet tool strip
 * ─────────────────────────────────────────────────────────────────────────
 * V2 (reference-site audit, 2026-07): the previous version showed animated
 * self-graded proficiency percentages ("React 88%"). None of the reference
 * sites do this — self-assessed numbers read as arbitrary, and the pattern
 * dates the page. Outcomes (projects, students, years — see HomeStatsStrip)
 * carry the proof; the stack is context, not a KPI.
 *
 * So this is now a single-row "trusted-by"-style chip strip: each tool is
 * a white pill with its official brand-color logo (Brand v3.1 §08 —
 * "preserve original brand colors, do not re-tint") and its name. Compact
 * vertical footprint so the stats strip below arrives one scroll earlier.
 *
 * Sits on Cloud Mist with a faint mesh aurora so it flows seamlessly out of
 * the hero above it (same §06 mesh language, lower opacity). Hover lift
 * respects prefers-reduced-motion.
 */

// Curated core stack — mirrors the About-page tech table so the two
// surfaces never contradict each other.
const STACK = [
  { name: "React",        Icon: FaReact,       color: "#61DAFB" },
  { name: "TypeScript",   Icon: SiTypescript,  color: "#3178C6" },
  { name: "Node.js",      Icon: FaNodeJs,      color: "#339933" },
  { name: "Python",       Icon: FaPython,      color: "#3776AB" },
  { name: "Tailwind CSS", Icon: SiTailwindcss, color: "#38BDF8" },
  { name: "PostgreSQL",   Icon: SiPostgresql,  color: "#336791" },
  { name: "Docker",       Icon: FaDocker,      color: "#2496ED" },
  { name: "Git",          Icon: FaGitAlt,      color: "#F05032" },
]

const gridStagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const chipUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

export default function TechStackShowcase({ className = "" }) {
  const { t } = useTranslation("home")
  const reduce = useReducedMotion()

  return (
    <section
      className={`relative isolate overflow-hidden bg-mist py-12 sm:py-14 lg:py-16 ${className}`}
      aria-labelledby="techstack-heading"
    >
      {/* Faint mesh aurora — echoes the hero (§06) so the two sections blend */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(at 10% 8%, rgba(93,63,211,0.10) 0px, transparent 45%), " +
            "radial-gradient(at 90% 100%, rgba(2,132,199,0.08) 0px, transparent 45%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header — single quiet line, no full section heading */}
        <motion.p
          id="techstack-heading"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-steel"
        >
          {t("techStack.stripLabel", { defaultValue: "The stack behind the work" })}
        </motion.p>

        {/* Chip strip */}
        <motion.ul
          variants={gridStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-2.5 sm:gap-3"
        >
          {STACK.map(({ name, Icon, color }) => (
            <motion.li
              key={name}
              variants={chipUp}
              whileHover={reduce ? undefined : { y: -2 }}
              className="inline-flex items-center gap-2 rounded-full border border-charcoal-80/[0.06] bg-white px-4 py-2 shadow-[0_2px_8px_rgba(93,63,211,0.04)] transition-shadow duration-300 hover:border-violet/20 hover:shadow-[0_8px_20px_rgba(93,63,211,0.10)]"
            >
              <Icon className="h-4.5 w-4.5" style={{ color }} aria-hidden="true" />
              <span className="text-[13px] font-semibold text-charcoal">{name}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
