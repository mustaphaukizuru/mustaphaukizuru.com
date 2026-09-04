/* ════════════════════════════════════════════════════════════════════════
   SchoolSystemDiagram.jsx · /schools hero visual (media slot M-16 fallback)
   ────────────────────────────────────────────────────────────────────────
   Inline SVG, tokens only (Instructions v4.0 § 5.2c/d, § 5.3). Shows the
   mechanism the page sells: four school roles connected through ONE
   platform that is itself backed up. The connector paths draw on when the
   diagram enters the viewport (Framer Motion pathLength); with
   prefers-reduced-motion every path renders complete and static.
   Labels are passed in already localised so the SVG stays copy-free.
   ════════════════════════════════════════════════════════════════════════ */

import { m, useReducedMotion } from "framer-motion"
import { Building2, Users, GraduationCap, ClipboardList, ShieldCheck, LayoutGrid } from "lucide-react"

const CENTER = { x: 260, y: 200 }
const NODES = [
  { key: "direction", x: 70,  y: 70,  Icon: Building2 },
  { key: "teachers",  x: 450, y: 70,  Icon: GraduationCap },
  { key: "families",  x: 70,  y: 330, Icon: Users },
  { key: "admin",     x: 450, y: 330, Icon: ClipboardList },
]
const BACKUP = { key: "backup", x: 260, y: 380, Icon: ShieldCheck }

const EASE = [0.22, 1, 0.36, 1]

/**
 * @param {{ labels: Record<string,string>, title: string, caption: string }} props
 *   labels  — { direction, teachers, families, admin, platform, backup }
 *   title   — accessible name for the figure
 *   caption — visible <figcaption>
 */
export default function SchoolSystemDiagram({ labels, title, caption }) {
  const reduced = useReducedMotion()
  const draw = (delay) =>
    reduced
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          whileInView: { pathLength: 1, opacity: 1 },
          viewport: { once: true, amount: 0.4 },
          transition: { duration: 0.9, delay, ease: EASE },
        }
  const pop = (delay) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, scale: 0.92 },
          whileInView: { opacity: 1, scale: 1 },
          viewport: { once: true, amount: 0.4 },
          transition: { duration: 0.45, delay, ease: EASE },
        }

  return (
    <figure className="relative">
      <div className="relative overflow-hidden rounded-3xl border border-violet/15 bg-gradient-to-br from-violet-ghost via-white to-mist p-4 shadow-[var(--shadow-e4)] sm:p-6">
        {/* Low-contrast grid texture · § 5.2c */}
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-violet/[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="schools-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0V28" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#schools-grid)" />
        </svg>

        <svg
          viewBox="0 0 520 440"
          role="img"
          aria-labelledby="schools-diagram-title"
          className="relative h-auto w-full font-mono"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title id="schools-diagram-title">{title}</title>

          {/* Connectors · role → platform */}
          {NODES.map((n, i) => (
            <m.path
              key={`link-${n.key}`}
              d={`M${n.x} ${n.y} L${CENTER.x} ${CENTER.y}`}
              fill="none"
              stroke="var(--color-violet)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="6 8"
              {...draw(0.15 + i * 0.12)}
            />
          ))}
          {/* Connector · platform → backup (solid: it is the guarantee) */}
          <m.path
            d={`M${CENTER.x} ${CENTER.y + 44} L${BACKUP.x} ${BACKUP.y - 30}`}
            fill="none"
            stroke="var(--color-mint-600)"
            strokeWidth="3"
            strokeLinecap="round"
            {...draw(0.7)}
          />

          {/* Role nodes */}
          {NODES.map((n, i) => (
            <m.g key={n.key} {...pop(0.05 + i * 0.1)} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
              <circle cx={n.x} cy={n.y} r="34" stroke="var(--color-violet)" strokeWidth="1.5" className="fill-white" />
              <foreignObject role="presentation" x={n.x - 12} y={n.y - 12} width="24" height="24">
                <n.Icon className="h-6 w-6 text-violet" aria-hidden="true" />
              </foreignObject>
              <text x={n.x} y={n.y + 54} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-charcoal-80)">
                {labels[n.key]}
              </text>
            </m.g>
          ))}

          {/* Platform hub */}
          <m.g {...pop(0.55)} style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}>
            <rect x={CENTER.x - 64} y={CENTER.y - 44} width="128" height="88" rx="18" fill="var(--color-violet)" />
            <foreignObject role="presentation" x={CENTER.x - 14} y={CENTER.y - 30} width="28" height="28">
              <LayoutGrid className="h-7 w-7 text-white" aria-hidden="true" />
            </foreignObject>
            <text x={CENTER.x} y={CENTER.y + 24} textAnchor="middle" fontSize="12" fontWeight="600" className="fill-white">
              {labels.platform}
            </text>
          </m.g>

          {/* Backup node */}
          <m.g {...pop(0.85)} style={{ transformOrigin: `${BACKUP.x}px ${BACKUP.y}px` }}>
            <circle cx={BACKUP.x} cy={BACKUP.y} r="30" fill="var(--color-mint-50)" stroke="var(--color-mint-600)" strokeWidth="1.5" />
            <foreignObject role="presentation" x={BACKUP.x - 11} y={BACKUP.y - 11} width="22" height="22">
              <BACKUP.Icon className="h-[22px] w-[22px] text-mint-700" aria-hidden="true" />
            </foreignObject>
            <text x={BACKUP.x} y={BACKUP.y + 48} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--color-mint-700)">
              {labels.backup}
            </text>
          </m.g>
        </svg>
      </div>
      <figcaption className="mt-3 text-center text-meta text-charcoal-80/65">{caption}</figcaption>
    </figure>
  )
}
