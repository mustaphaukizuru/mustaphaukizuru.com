import { Link, useLocation } from "react-router-dom"
import { ChevronRight, Home } from "lucide-react"

/**
 * Breadcrumbs · v1.0
 *
 * Visible breadcrumb navigation that mirrors the BreadcrumbList JSON-LD
 * already emitted by Seo.jsx. Brand v3.0 styling — Royal Violet links on
 * Cloud Mist canvas with Slate Blue separators.
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { name: "Store", path: "/store" },
 *     { name: "School AI Automation Kit", path: "/store/school-ai-automation-kit" },
 *   ]} />
 *
 * If `items` is omitted, breadcrumbs auto-build from the current pathname.
 * Pass `nameOverrides={{ "/store/foo": "Foo" }}` to override segment names.
 *
 * Accessibility:
 *   · <nav aria-label="Breadcrumb">
 *   · The current page is rendered as <span aria-current="page">
 *   · Visible focus ring · WCAG 2.1 AA contrast on every state
 */
export default function Breadcrumbs({ items, nameOverrides = {}, className = "" }) {
  const location = useLocation()

  // Auto-build crumbs from pathname when items aren't supplied
  let crumbs = items
  if (!Array.isArray(crumbs)) {
    const path = (location.pathname || "/").split("?")[0].split("#")[0]
    if (path === "/" || path === "") return null
    const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean)
    let acc = ""
    crumbs = segments.map((seg) => {
      acc += "/" + seg
      const override = nameOverrides[acc]
      const name = override || decodeURIComponent(seg).replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
      return { name, path: acc }
    })
  }

  if (!Array.isArray(crumbs) || crumbs.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-[12.5px] ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {/* Home root */}
        <li className="flex items-center gap-1.5">
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-steel transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Home</span>
          </Link>
        </li>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <li key={c.path || c.name || i} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-charcoal/30" aria-hidden="true" />
              {isLast ? (
                <span aria-current="page" className="rounded-md px-1.5 py-0.5 font-semibold text-violet">
                  {c.name}
                </span>
              ) : (
                <Link
                  to={c.path || "#"}
                  className="rounded-md px-1.5 py-0.5 font-medium text-steel transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
                >
                  {c.name}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
