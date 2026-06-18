import { motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { FaReact, FaNodeJs, FaPython, FaDocker, FaGitAlt } from "react-icons/fa"
import { SiTypescript, SiTailwindcss, SiPostgresql } from "react-icons/si"
import Counter from "./motion/Counter"

/**
 * TechStackShowcase · "tools & tech I build with" — branded skill grid
 * ─────────────────────────────────────────────────────────────────────────
 * A pill-card grid of the core stack: each technology shows its logo in a
 * tinted circle (per Brand v3.1 §08 — "preserve original brand colors, do
 * not re-tint"), an animated count-up proficiency percentage in JetBrains
 * Mono tabular figures (§09 Proof Layer / §14 KPI = Midnight Charcoal), and
 * the tool name.
 *
 * Sits on Cloud Mist with a faint mesh aurora so it flows seamlessly out of
 * the hero above it (same §06 mesh language, lower opacity). Fully
 * responsive: 1 column on mobile, 2 on tablet, 4 on desktop. Count-up and
 * hover lift both respect prefers-reduced-motion.
 */

// Curated core stack — values mirror the About-page tech table so the two
// surfaces never contradict each other. Colors are each tool's official
// brand color, applied on a light circle so every logo stays legible.
const STACK = [
  { name: "React",        Icon: FaReact,       color: "#61DAFB", value: 88 },
  { name: "TypeScript",   Icon: SiTypescript,  color: "#3178C6", value: 85 },
  { name: "Node.js",      Icon: FaNodeJs,      color: "#339933", value: 86 },
  { name: "Python",       Icon: FaPython,      color: "#3776AB", value: 82 },
  { name: "Tailwind CSS", Icon: SiTailwindcss, color: "#38BDF8", value: 82 },
  { name: "PostgreSQL",   Icon: SiPostgresql,  color: "#336791", value: 82 },
  { name: "Docker",       Icon: FaDocker,      color: "#2496ED", value: 76 },
  { name: "Git",          Icon: FaGitAlt,      color: "#F05032", value: 90 },
]

const gridStagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const cardUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export default function TechStackShowcase({ className = "" }) {
  const { t } = useTranslation("home")
  const reduce = useReducedMotion()

  return (
    <section
      className={`relative isolate overflow-hidden bg-mist py-16 sm:py-20 lg:py-24 ${className}`}
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
        {/* Header */}
        <motion.div
          variants={gridStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.span
            variants={cardUp}
            className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-violet"
          >
            {t("techStack.eyebrow")}
          </motion.span>
          <motion.h2
            id="techstack-heading"
            variants={cardUp}
            className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight text-charcoal sm:text-[36px] lg:text-[40px]"
          >
            {t("techStack.titleLead")}{" "}
            <span className="text-violet">{t("techStack.titleAccent")}</span>
          </motion.h2>
          <motion.p variants={cardUp} className="mt-4 text-[14px] leading-7 text-charcoal-80/70 sm:text-[15px]">
            {t("techStack.subtitle")}
          </motion.p>
        </motion.div>

        {/* Card grid */}
        <motion.ul
          variants={gridStagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-3.5 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
        >
          {STACK.map(({ name, Icon, color, value }) => (
            <motion.li
              key={name}
              variants={cardUp}
              whileHover={reduce ? undefined : { y: -3 }}
              aria-label={`${name} — ${value}% proficiency`}
              className="group flex items-center gap-4 rounded-2xl border border-charcoal-80/[0.06] bg-white p-3 shadow-[0_2px_8px_rgba(93,63,211,0.04)] transition-all duration-300 hover:border-violet/20 hover:shadow-[0_10px_28px_rgba(93,63,211,0.10)] sm:p-3.5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-pale sm:h-14 sm:w-14">
                <Icon
                  className="h-6 w-6 transition-transform duration-300 group-hover:scale-110 sm:h-7 sm:w-7"
                  style={{ color }}
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0" aria-hidden="true">
                <Counter
                  to={value}
                  suffix="%"
                  className="block font-mono text-[20px] font-extrabold leading-none tabular-nums text-charcoal sm:text-[22px]"
                />
                <span className="mt-1 block truncate text-[13px] text-charcoal-80/60 sm:text-[14px]">{name}</span>
              </span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
