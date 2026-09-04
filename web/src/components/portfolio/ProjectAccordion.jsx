import { useState } from "react"
import { LocalizedLink as Link } from "../LocalizedLink"
import { useTranslation } from "react-i18next"
import { Compass, Bot, CloudCog, Code2, Briefcase } from "lucide-react"
import { projectImages, responsiveSrcSet, getCaseStudy } from "./caseStudy"

/**
 * ProjectAccordion · expanding image panels
 * ─────────────────────────────────────────────────────────────────────────
 * A row of full-bleed project photographs. The active panel takes most of
 * the width; the rest stay as slivers. Pointing at a panel, or tabbing to
 * it, brings it forward — so the same interaction works with a mouse, a
 * keyboard and a screen reader, and on touch (where hover does not exist) a
 * tap simply follows the link.
 *
 *   · No animation library: one `flex-grow` transition on a list item.
 *     Nothing re-renders on scroll and it costs no bytes beyond this file.
 *   · A real <ul>/<li> of links, and the title stays in the DOM whether or
 *     not its panel is open — collapsing is a visual state, never a content
 *     one, so the list reads correctly when linearised.
 *   · prefers-reduced-motion: the width change is instant. It is a media
 *     query in the class list rather than a JS branch, so it also tracks a
 *     live OS change.
 *   · Under 640px the panels stack into a column; `flex-grow` drives the
 *     open one in either direction, so there is one mechanism, not two.
 *
 * Props
 *   projects — portfolio rows (API shape or the static fallbacks). Anything
 *              without a usable image is dropped; 2 panels minimum, else the
 *              component renders nothing.
 *   limit    — how many panels to show (default 5)
 */

/* Same four service lines as data/homeData.js — a project inherits the icon
 * of the service its case study maps to, and falls back to the briefcase
 * used for role/engagement elsewhere on the portfolio pages. */
const SERVICE_ICONS = {
  "it-strategy-consulting": Compass,
  "ai-automation": Bot,
  "cloud-architecture-migration": CloudCog,
  "digital-product-engineering": Code2,
}

function panelFor(project) {
  const image = projectImages(project)[0]
  if (!image) return null
  const cs = getCaseStudy(project)
  return {
    id: project.id || project.slug,
    slug: project.slug,
    image,
    title: project.title || "",
    subtitle: project.outcomeLine || project.shortDescription || project.category || "",
    Icon: SERVICE_ICONS[cs?.serviceSlug] || Briefcase,
  }
}

export default function ProjectAccordion({ projects, limit = 5 }) {
  const { t } = useTranslation("portfolio")
  const [active, setActive] = useState(0)

  const panels = (Array.isArray(projects) ? projects : [])
    .map(panelFor)
    .filter(Boolean)
    .slice(0, limit)

  if (panels.length < 2) return null

  return (
    <ul
      aria-label={t("featured.ariaLabel")}
      className="flex h-[34rem] w-full list-none flex-col gap-1.5 sm:h-[26rem] sm:flex-row lg:h-[32rem]"
    >
      {panels.map((panel, index) => {
        const open = index === active
        return (
          <li
            key={panel.id}
            style={{ flexBasis: 0 }}
            className={`relative isolate min-h-0 overflow-hidden rounded-lg transition-[flex-grow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              open ? "grow-[6]" : "grow"
            }`}
            onMouseEnter={() => setActive(index)}
          >
            <img
              src={panel.image}
              srcSet={responsiveSrcSet(panel.image)}
              sizes={open ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, 15vw"}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
            {/* Scrim — keeps the caption legible over any photograph */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/90 via-charcoal/45 via-40% to-transparent"
            />

            <Link
              to={`/projects/${panel.slug}`}
              onFocus={() => setActive(index)}
              className="absolute inset-0 flex items-end gap-3 p-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-azure/60"
            >
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/40 bg-charcoal/40 text-white backdrop-blur"
              >
                <panel.Icon className="h-5 w-5" />
              </span>
              <span
                className={`min-w-0 pb-1 transition-opacity duration-300 motion-reduce:transition-none ${
                  open ? "opacity-100" : "opacity-0"
                }`}
              >
                <span className="block truncate text-[15px] font-semibold text-white">
                  {panel.title}
                </span>
                {panel.subtitle && (
                  <span className="block truncate text-micro text-white/80">
                    {panel.subtitle}
                  </span>
                )}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
