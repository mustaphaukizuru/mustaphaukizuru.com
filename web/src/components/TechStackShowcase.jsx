import { FaReact, FaNodeJs, FaPython, FaDocker, FaAws } from "react-icons/fa"
import { SiTypescript, SiPostgresql, SiGooglecloud } from "react-icons/si"

/**
 * TechStackShowcase · V3 — compact logo row (no section, no motion)
 * ─────────────────────────────────────────────────────────────────────────
 * V2 was a standalone section with 9 staggered chips. V3 is a single quiet
 * row rendered INSIDE the proof strip (HomeStatsStrip): the stack is
 * context for the numbers, not a section of its own. Official brand colours
 * are preserved (Brand v3.1 §08 — never re-tint third-party marks).
 *
 * Props:
 *   label — accessible group label (translated by the caller)
 */
const STACK = [
  { name: "React",        Icon: FaReact,       color: "#61DAFB" },
  { name: "TypeScript",   Icon: SiTypescript,  color: "#3178C6" },
  { name: "Node.js",      Icon: FaNodeJs,      color: "#339933" },
  { name: "Python",       Icon: FaPython,      color: "#3776AB" },
  { name: "PostgreSQL",   Icon: SiPostgresql,  color: "#336791" },
  { name: "Docker",       Icon: FaDocker,      color: "#2496ED" },
  { name: "AWS",          Icon: FaAws,         color: "#FF9900" },
  { name: "Google Cloud", Icon: SiGooglecloud, color: "#4285F4" },
]

export default function TechStackShowcase({ label, className = "" }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 ${className}`}>
      {label && (
        <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-steel">
          {label}
        </span>
      )}
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={label}>
        {STACK.map(({ name, Icon, color }) => (
          <li key={name} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-charcoal-80/70">
            <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}
