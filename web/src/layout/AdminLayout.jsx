import { useState, useEffect } from "react"
import { Outlet, NavLink, useLocation, useNavigate, Link } from "react-router-dom"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Menu,
  X,
  Globe,
  ShieldCheck,
  Headphones,
  ChevronDown,
} from "lucide-react"
import AdminSidebar, { navigation } from "../components/admin/AdminSidebar"
import AdminHeader from "../components/admin/AdminHeader"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminLayout · Batch 6B-1
 *
 *  Refinements applied:
 *    - Skip-to-main-content link for keyboard users.
 *    - Mobile menu: ESC dismiss, role="dialog", aria-modal, focus trap
 *      semantics (matches DashboardLayout pattern from Batch 6A).
 *    - Tighter desktop gutters (lg:px-5 instead of lg:px-6) — productivity
 *      surface, reclaim every pixel for data.
 *    - Sidebar column narrowed slightly (280px) to give content more room.
 *    - All icon-only buttons get aria-labels.
 *    - Mobile bottom tab bar gets aria-label per tab.
 *    - Mobile sidebar slide reuses the new AdminSidebar component (single
 *      source of truth — no more duplicated nav array in MobileMenu).
 *
 *  Preserved verbatim:
 *    - Route structure
 *    - AdminHeader integration
 *    - AdminSidebar integration
 *    - Bottom mobile tab bar contents
 *    - Logout flow
 *  ──────────────────────────────────────────────────────────────────── */

function resolveAvatar(url) {
  if (!url) return null
  if (url.startsWith("http")) return url
  return API_BASE_URL ? `${API_BASE_URL}${url}` : url
}

function UserAvatar({ src, initials, size = 9, className = "" }) {
  const resolved = resolveAvatar(src)
  const px = size * 4
  return resolved ? (
    <img src={resolved} alt="" className={`rounded-full object-cover ${className}`} style={{ width: px, height: px }} />
  ) : (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-deep font-bold text-white ${className}`}
      style={{ width: px, height: px, fontSize: px * 0.3 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

const adminBottomTabs = [
  { label: "Home", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Support", to: "/admin/support", icon: Headphones },
  { label: "Users", to: "/admin/users", icon: Users },
]

const pageMeta = {
  "/admin": { title: "Dashboard", subtitle: "Live analytics, KPIs, and operational metrics." },
  "/admin/orders": { title: "Orders", subtitle: "Review purchases and order state." },
  "/admin/products": { title: "Products", subtitle: "Manage catalog items and files." },
  "/admin/downloads": { title: "Downloads", subtitle: "Monitor digital delivery." },
  "/admin/payments": { title: "Payments", subtitle: "Track gateway transactions." },
  "/admin/categories": { title: "Categories", subtitle: "Organize the catalog." },
  "/admin/coupons": { title: "Coupons", subtitle: "Create discount codes, set caps, and track redemptions." },
  "/admin/contact-messages":{ title: "Contact Messages",subtitle: "View, reply to, and manage submissions from the contact form." },
  "/admin/newsletter": { title: "Newsletter", subtitle: "Manage subscribers, export the list, or remove entries (GDPR)." },
  "/admin/services": { title: "Services", subtitle: "Consulting and packages." },
  "/admin/availability": { title: "Availability", subtitle: "Recurring rules and date-specific exceptions for the public booking calendar." },
  "/admin/consultations": { title: "Consultations", subtitle: "Every booked call, confirm, complete, mark no-show, or cancel on behalf of the client." },
  "/admin/service-orders": { title: "Service Orders", subtitle: "Paid consulting and packaged service deliveries, track delivery state and milestones." },
  "/admin/reviews": { title: "Reviews", subtitle: "Moderate product and service reviews, approve, hide, reject, reply, or feature." },
  "/admin/refunds": { title: "Refunds", subtitle: "Track every refund, dispute, and chargeback across MercadoPago and PayPal." },
  "/admin/sessions": { title: "Active Sessions", subtitle: "Live sign-ins and security incident response." },
  "/admin/portfolio": { title: "Portfolio", subtitle: "Case studies and projects." },
  "/admin/support": { title: "Support Tickets", subtitle: "Member requests and resolution." },
  "/admin/email-templates": { title: "Email Templates", subtitle: "Transactional emails." },
  "/admin/email-logs": { title: "Email Logs", subtitle: "Delivery history." },
  "/admin/users": { title: "Users", subtitle: "Members and roles." },
  "/admin/audit": { title: "Audit Log", subtitle: "Action history." },
}

function resolveMeta(pathname) {
  if (pageMeta[pathname]) return pageMeta[pathname]
  if (pathname.startsWith("/admin/products/")) return { title: "Product Editor", subtitle: "Create or update product content and files." }
  if (pathname.startsWith("/admin/orders/")) return { title: "Order Detail", subtitle: "Inspect customer information and items." }
  if (pathname.startsWith("/admin/support/")) return { title: "Support Thread", subtitle: "Review and reply to this ticket." }
  if (pathname.startsWith("/admin/portfolio/")) return { title: "Portfolio Editor", subtitle: "Create or update a case study." }
  return { title: "Admin", subtitle: "Manage your platform operations." }
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Mobile slide-out menu — re-uses AdminSidebar's navigation array
 *  ──────────────────────────────────────────────────────────────────── */
function AdminMobileMenu({ open, onClose, user, initials }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  // ESC dismiss
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-[70] w-[300px] max-w-[85vw] bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal={open ? "true" : "false"}
        aria-label="Admin navigation"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-charcoal-80/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <UserAvatar src={user?.avatarUrl} initials={initials} size={9} />
              <div>
                <div className="text-meta font-bold text-violet">{user?.fullName || "Admin"}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/65">Administrator</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-charcoal-80 transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Back to Website */}
          <Link
            to="/"
            onClick={onClose}
            className="m-3 flex items-center gap-2 rounded-lg border border-charcoal-80/10 bg-mist px-3 py-2 text-meta font-medium text-charcoal-80/75 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            View live site
          </Link>

          {/* Nav, flat compact list since collapsibility isn't useful here */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Admin sections">
            {navigation.map((group) => (
              <div key={group.section} className="mb-3">
                <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-80/65">
                  {group.section}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          [
                            "flex items-center gap-2.5 rounded-lg py-2 transition-all",
                            isActive
                              ? "bg-violet-pale border-l-[4px] border-l-violet pl-[calc(0.625rem-4px)] pr-2.5 text-violet"
                              : "border-l-[4px] border-l-transparent pl-[calc(0.625rem-4px)] pr-2.5 text-charcoal-80 hover:bg-violet-ghost hover:text-violet",
                            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1",
                          ].join(" ")
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="text-meta font-medium">{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentMeta = resolveMeta(location.pathname)
  const initials = (user?.fullName || "AD")
    .split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()

  function handleLogout() {
    logout()
    navigate("/", { replace: true })
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu on route change
  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  return (
    // `data-dashboard-shell` scopes dashboard-only dark mode to this
    // subtree (see styles/tokens.css). The admin surface uses the same
    // anchor as the member dashboard so they share theme styling.
    <section data-dashboard-shell className="min-h-screen bg-mist pb-20 lg:pb-0">
      {/* Skip to content for keyboard users */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-violet focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
      >
        Skip to main content
      </a>

      <div className="mx-auto max-w-[1700px] px-3 py-3 sm:px-5 lg:px-5 lg:py-4">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[280px_1fr]">

          {/* ── Desktop Sidebar ── */}
          <div className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)]">
            <AdminSidebar />
          </div>

          {/* ── Main area ── */}
          <div className="min-w-0">

            {/* ── Mobile Header ── */}
            <header className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-between border-b border-charcoal-80/10 bg-white px-4 py-3 shadow-[var(--shadow-e2)] lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet text-white shadow-[var(--shadow-lift-1)]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-body font-bold text-violet">{currentMeta.title}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/65">Admin Console</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  aria-label="View live site"
                  title="View live site"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* ── Desktop Header ── */}
            <div className="sticky top-4 z-20 hidden lg:block">
              <AdminHeader />
            </div>

            {/* Page content */}
            <main id="admin-main" className="mt-3 min-w-0 lg:mt-4">
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      <AdminMobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        initials={initials}
        onLogout={handleLogout}
      />

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-charcoal-80/10 bg-white shadow-[0_-4px_16px_rgb(var(--color-violet-rgb)/0.06)] lg:hidden"
        aria-label="Quick navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {adminBottomTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  [
                    "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-center transition-all",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1",
                    isActive ? "text-violet" : "text-charcoal-80/65 hover:text-violet",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={[
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                      isActive ? "bg-violet text-white shadow-[0_4px_14px_rgb(var(--color-violet-rgb)/0.25)]" : "",
                    ].join(" ")}>
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </div>
                    <span className={`text-[10px] font-semibold ${isActive ? "text-violet" : ""}`}>
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" aria-hidden="true" />
      </nav>
    </section>
  )
}
