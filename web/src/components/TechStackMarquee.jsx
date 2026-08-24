import Marquee from "./motion/Marquee"
import {
  FaReact, FaNodeJs, FaPython, FaDocker, FaGitAlt, FaLinux, FaJava,
} from "react-icons/fa"
import {
  SiDjango, SiPostgresql, SiMysql, SiTailwindcss, SiPrisma,
  SiGooglecloud, SiVite, SiTypescript,
} from "react-icons/si"

/**
 * TechStackMarquee · infinite scrolling tech logo trust strip
 * ─────────────────────────────────────────────────────────────────────────
 * A horizontal auto-scrolling strip of branded tech icons — each rendered
 * in its official brand color (per Brand Identity v3 §08: "SVGL · Brand
 * Logos — preserve original brand colors, do not re-tint").
 *
 * Uses the existing project Marquee component (CSS-driven, GPU-accelerated,
 * prefers-reduced-motion aware, pause-on-hover).
 *
 * The strip sits between sections on the Home page as a subtle "proof of
 * stack" signal — it doesn't need a heading; the icons are self-explanatory
 * to the technical/semi-technical visitor.
 */

const STACK = [
  { name: "React",       Icon: FaReact,       color: "#61DAFB" },
  { name: "Node.js",     Icon: FaNodeJs,       color: "#339933" },
  { name: "Python",      Icon: FaPython,       color: "#3776AB" },
  { name: "Django",      Icon: SiDjango,       color: "#092E20" },
  { name: "PostgreSQL",  Icon: SiPostgresql,   color: "#336791" },
  { name: "MySQL",       Icon: SiMysql,        color: "#4479A1" },
  { name: "Docker",      Icon: FaDocker,       color: "#2496ED" },
  { name: "Git",         Icon: FaGitAlt,       color: "#F05032" },
  { name: "Linux",       Icon: FaLinux,        color: "#FCC624" },
  { name: "Tailwind",    Icon: SiTailwindcss,  color: "#38BDF8" },
  { name: "Prisma",      Icon: SiPrisma,       color: "#2D3748" },
  { name: "GCP",         Icon: SiGooglecloud,  color: "#4285F4" },
  { name: "Vite",        Icon: SiVite,         color: "#646CFF" },
  { name: "TypeScript",  Icon: SiTypescript,   color: "#3178C6" },
  { name: "Java",        Icon: FaJava,         color: "#007396" },
]

export default function TechStackMarquee({ className = "" }) {
  return (
    <div className={`py-8 ${className}`}>
      {/* Divider lines above/below */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-charcoal-80/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-charcoal-80/10 to-transparent" />

        <Marquee
          speed={36}
          gap="gap-10"
          fade={true}
          ariaLabel="Technologies I build with"
          className="py-5"
        >
          {STACK.map(({ name, Icon, color }) => (
            <span
              key={name}
              className="group inline-flex items-center gap-2.5 rounded-xl border border-charcoal-80/6 bg-white px-4 py-2.5 shadow-[0_2px_8px_rgb(var(--color-violet-rgb)/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-charcoal-80/14 hover:shadow-[0_6px_18px_rgb(var(--color-violet-rgb)/0.08)]"
              title={name}
            >
              <Icon
                className="h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{ color }}
                aria-hidden="true"
              />
              <span className="font-mono text-[12px] font-semibold text-charcoal/70">
                {name}
              </span>
            </span>
          ))}
        </Marquee>
      </div>
    </div>
  )
}
