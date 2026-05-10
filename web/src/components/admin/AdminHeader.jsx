import { useEffect, useState } from "react"
import { useLocation, useNavigate, Link } from "react-router-dom"
import { Search, HelpCircle, LogOut, Home, ChevronRight, Command } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { API_BASE_URL } from "../../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminHeader · Batch 6B-1
 *
 *  Refinements applied:
 *    - Dense, professional top bar with: breadcrumb · page title · keyboard
 *      shortcut hint (⌘K placeholder) · live site link · support · avatar.
 *    - Compact height (10–11 vertical px) — productivity surface, not a
 *      marketing header.
 *    - Mono breadcrumb path for consistent typography.
 *    - Dynamic page meta resolved from a single source of truth, with smart
 *      pattern matching for nested routes (/admin/products/:id/edit, etc.).
 *    - Search input with ⌘K shortcut hint badge (visual only — wires up
 *      when command bar is implemented).
 *    - Focus rings on every interactive element.
 *    - ARIA labels on icon-only buttons (View live site, Support, Sign out).
 *    - Avatar uses Royal Violet ring instead of gradient for cleaner pro
 *      aesthetic.
 *
 *  Preserved verbatim:
 *    - PAGE_META lookup
 *    - Logout flow
 *    - Avatar resolution + fallback initials
 *    - Search input position (no functional change yet)
 *  ──────────────────────────────────────────────────────────────────── */

const PAGE_META = {
  "/admin": { title: "Dashboard", sub: "Live analytics, KPIs, and operational metrics" },
  "/admin/orders": { title: "Orders", sub: "Purchases, fulfillment, and status tracking" },
  "/admin/products": { title: "Products", sub: "Catalog, media, and publication management" },
  "/admin/products/new": { title: "New Product", sub: "Create a new digital product" },
  "/admin/downloads": { title: "Downloads", sub: "Digital delivery and download activity" },
  "/admin/payments": { title: "Payments", sub: "Transactions, gateways, and payment status" },
  "/admin/categories": { title: "Categories", sub: "Product taxonomy and organization" },
  "/admin/services": { title: "Services", sub: "Consulting and service delivery" },
  "/admin/portfolio": { title: "Portfolio", sub: "Case studies and featured projects" },
  "/admin/support": { title: "Support Tickets", sub: "Member requests, replies, and resolution" },
  "/admin/pages": { title: "CMS Pages", sub: "Content, legal, and published pages" },
  "/admin/media": { title: "Media Library", sub: "Images, documents, and digital assets" },
  "/admin/email-templates": { title: "Email Templates", sub: "Transactional email configuration" },
  "/admin/email-logs": { title: "Email Logs", sub: "Delivery history and debugging" },
  "/admin/users": { title: "Users", sub: "Members, roles, and account state" },
  "/admin/audit": { title: "Audit Log", sub: "Admin actions and platform events" },
}

function resolveMeta(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname.startsWith("/admin/products/") && pathname.endsWith("/edit")) return { title: "Edit Product", sub: "Update product details and media" }
  if (pathname.startsWith("/admin/products/")) return { title: "Product Editor", sub: "Create or update product content" }
  if (pathname.startsWith("/admin/orders/")) return { title: "Order Detail", sub: "Inspect customer information and items" }
  if (pathname.startsWith("/admin/support/")) return { title: "Support Thread", sub: "Review and reply to this support ticket" }
  if (pathname.startsWith("/admin/portfolio/")) return { title: "Portfolio Editor", sub: "Create or update a portfolio case study" }
  return { title: "Admin", sub: "Manage your platform operations" }
}

export default function AdminHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [now, setNow] = useState(() => new Date())

  // Update time once per minute for the operations clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const meta = resolveMeta(pathname)
  const initials = user?.fullName?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "A"
  const avatarUrl = user?.avatarUrl
    ? (user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_BASE_URL}${user.avatarUrl}`)
    : null

  function handleLogout() {
    logout()
    navigate("/", { replace: true })
  }

  // Build breadcrumb segments from pathname
  const segments = pathname.split("/").filter(Boolean)

  return (
    <header
      className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_20px_rgba(93,63,211,0.04)]"
      role="banner"
    >
      {/* Top row: breadcrumb + tools */}
      <div className="flex items-center justify-between gap-4 border-b border-charcoal-80/8 px-5 py-2.5">
        {/* Breadcrumb */}
        <nav className="min-w-0 flex-1" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-charcoal-80/55">
            <li>
              <Link
                to="/admin"
                className="rounded transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
              >
                admin
              </Link>
            </li>
            {segments.slice(1).map((seg, idx) => (
              <li key={`${seg}-${idx}`} className="flex items-center gap-1.5">
                <ChevronRight className="h-2.5 w-2.5 text-charcoal-80/30" aria-hidden="true" />
                <span className={idx === segments.length - 2 ? "font-semibold text-violet" : ""}>{seg}</span>
              </li>
            ))}
          </ol>
        </nav>

        {/* Operations clock, subtle */}
        <div className="hidden font-mono text-[11px] tabular-nums text-charcoal-80/45 md:block">
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} ·{" "}
          {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </div>
      </div>

      {/* Main row: title + actions */}
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        {/* Title */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-section font-bold tracking-tight text-violet">{meta.title}</h1>
          <p className="mt-0.5 truncate text-micro text-charcoal-80/60">{meta.sub}</p>
        </div>

        {/* Actions cluster */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Search with ⌘K hint */}
          <label htmlFor="admin-search" className="sr-only">Search admin</label>
          <div className="hidden items-center gap-2 rounded-lg border border-charcoal-80/10 bg-mist px-3 py-2 transition focus-within:border-violet/40 focus-within:ring-[3px] focus-within:ring-azure/20 lg:flex">
            <Search className="h-3.5 w-3.5 shrink-0 text-charcoal-80/40" aria-hidden="true" />
            <input
              id="admin-search"
              type="text"
              placeholder="Search orders, products, users…"
              className="w-[220px] bg-transparent text-meta text-violet outline-none placeholder:text-charcoal-80/40"
            />
            <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-charcoal-80/15 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-charcoal-80/55 lg:inline-flex">
              <Command className="h-2.5 w-2.5" aria-hidden="true" />K
            </kbd>
          </div>

          {/* Live site */}
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open live website in a new tab"
            title="View live site"
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/10 bg-white text-charcoal-80/55 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 lg:flex"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
          </Link>

          {/* Support */}
          <button
            type="button"
            onClick={() => navigate("/admin/support")}
            aria-label="Go to Support tickets"
            title="Support"
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/10 bg-white text-charcoal-80/55 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 lg:flex"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Admin pill */}
          <div className="flex items-center gap-2.5 rounded-lg border border-violet/10 bg-violet-pale/50 py-1 pl-1 pr-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.fullName || "Admin"}
                className="h-7 w-7 rounded-md object-cover ring-1 ring-violet/15"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet font-mono text-[11px] font-bold text-white" aria-hidden="true">
                {initials}
              </div>
            )}
            <div className="hidden flex-col lg:flex">
              <span className="text-micro font-semibold leading-none text-violet">
                {user?.fullName?.split(" ")[0] || "Admin"}
              </span>
              <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider leading-none text-charcoal-80/55">
                Administrator
              </span>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/10 bg-white text-charcoal-80/55 transition hover:border-rose-300/50 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40 focus-visible:ring-offset-2"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
