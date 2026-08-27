import useApiQuery from "../hooks/useApiQuery"
import { fetchSkills } from "../services/bioService"
import { ICON_REGISTRY } from "../lib/skillIcons"

/**
 * TechStackShowcase · V4 — compact logo row fed by the Skill table
 * ─────────────────────────────────────────────────────────────────────────
 * V3 hardcoded eight logos, so the admin's edits under /admin/bio (Skills)
 * never reached the home page. V4 reads GET /api/v1/bio/skills (visible
 * rows only, server-side), keeps the ones with a registered iconKey, sorts
 * by displayOrder and shows the first MAX_ITEMS. The static FALLBACK list
 * renders only while the request is in flight or after it failed, so the
 * strip never flashes empty.
 *
 * Official brand colours are preserved (Brand v3.1 §08 — never re-tint
 * third-party marks); keys without a colour render in the text colour.
 *
 * Props:
 *   label — accessible group label (translated by the caller)
 */
const MAX_ITEMS = 8

/* Vendor logo colours by iconKey — allowlisted in scripts/check-raw-hex.mjs. */
const BRAND_COLOR = {
  react: "#61DAFB", typescript: "#3178C6", javascript: "#F7DF1E", nodejs: "#339933",
  express: "#404040", python: "#3776AB", django: "#092E20", flask: "#404040",
  java: "#007396", springboot: "#6DB33F", tailwind: "#06B6D4", framer: "#0055FF",
  vite: "#646CFF", html5: "#E34F26", css3: "#1572B6", bootstrap: "#7952B3",
  postgresql: "#336791", mysql: "#4479A1", prisma: "#2D3748", mongodb: "#47A248",
  redis: "#DC382D", docker: "#2496ED", kubernetes: "#326CE5", git: "#F05032",
  github: "#181717", linux: "#FCC624", aws: "#FF9900", gcp: "#4285F4",
  google: "#4285F4", nginx: "#009639", cloudflare: "#F38020", jwt: "#404040",
  springsecurity: "#6DB33F", openssl: "#721412",
}

const FALLBACK = [
  { name: "React",        iconKey: "react" },
  { name: "TypeScript",   iconKey: "typescript" },
  { name: "Node.js",      iconKey: "nodejs" },
  { name: "Python",       iconKey: "python" },
  { name: "PostgreSQL",   iconKey: "postgresql" },
  { name: "Docker",       iconKey: "docker" },
  { name: "AWS",          iconKey: "aws" },
  { name: "Google Cloud", iconKey: "gcp" },
]

/** Visible skills with a known icon, by displayOrder, capped. */
function selectStack(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter((s) => s && s.isVisible !== false && s.iconKey && ICON_REGISTRY[s.iconKey])
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || String(a.name).localeCompare(String(b.name)))
    .slice(0, MAX_ITEMS)
}

export default function TechStackShowcase({ label, className = "" }) {
  const { data, loading, error } = useApiQuery(
    "bio:skills",
    () => fetchSkills(),
    { select: (res) => selectStack(res?.items), staleTime: 10 * 60_000 },
  )
  const stack = loading || error || !data?.length ? FALLBACK : data

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 ${className}`}>
      {label && (
        <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-steel">
          {label}
        </span>
      )}
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={label}>
        {stack.map(({ name, iconKey }) => {
          const Icon = ICON_REGISTRY[iconKey]
          const color = BRAND_COLOR[iconKey]
          return (
            <li key={iconKey + name} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-charcoal-80/70">
              <Icon className="h-4 w-4" style={color ? { color } : undefined} aria-hidden="true" />
              {name}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
