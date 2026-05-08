import { useState, useEffect } from "react"
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom"
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Download,
  Headphones,
  User,
  LogOut,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  Search,
  X,
  Menu,
  Globe,
  Heart,
  MapPin, Briefcase, Calendar} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"
import NotificationDropdown from "../components/dashboard/NotificationDropdown"

import { useTranslation } from "react-i18next"
/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardLayout · F10.B · Batch 6
 *
 *  Refinements applied:
 *    - Active sidebar item now uses 4px Deep Azure left border + Violet
 *      Ghost background (`bg-violet-pale`) per F10.B spec, replacing the
 *      heavier solid violet fill.
 *    - Inactive items get a subtle hover bg with a soft transition.
 *    - Mobile menu uses the same active-state treatment for consistency.
 *    - Bottom mobile tab bar active state matches with violet pale + filled
 *      icon container.
 *    - Search input gets Deep Azure focus ring per a11y guidelines.
 *    - All icon-only buttons get aria-labels (mobile menu close, support,
 *      mobile menu toggle, etc.).
 *    - Skip-to-main-content link added for keyboard users.
 *
 *  Preserved verbatim:
 *    - Navigation grouping and sections (Overview · Library · Support · Account)
 *    - Mobile slide-out behavior + body-scroll lock
 *    - Bottom tab bar structure
 *    - All routes
 *    - Logout flow
 *    - NotificationDropdown integration
 *    - User avatar resolution + fallback initials
 *    - pageMeta lookup
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
    <img
      src={resolved}
      alt=""
      className={`rounded-full object-cover ${className}`}
      style={{ width: px, height: px }}
    />
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

// ── Navigation ──
const navigation = [
  {
    section: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, end: true, description: "Summary and activity" },
    ],
  },
  {
    section: "Library",
    items: [
      { label: "My Products", to: "/dashboard/products", icon: Package, description: "Downloads and access" },
      { label: "Downloads", to: "/dashboard/downloads", icon: Download, description: "File history and logs" },
      { label: "Order History", to: "/dashboard/orders", icon: ShoppingBag, description: "Purchases and status" },
      { label: "Service Orders", to: "/dashboard/service-orders", icon: Briefcase, description: "Consulting services" },
      { label: "Wishlist", to: "/dashboard/wishlist", icon: Heart, description: "Saved for later" },
    ],
  },
  {
    section: "Bookings",
    items: [
      { label: "Consultations", to: "/dashboard/consultations", icon: Calendar, description: "Upcoming and past calls" },
      { label: "Projects", to: "/dashboard/projects", icon: Briefcase, description: "Milestones, files, timeline" },
    ],
  },
  {
    section: "Support",
    items: [
      { label: "Support", to: "/dashboard/support", icon: Headphones, description: "Help and tickets" },
    ],
  },
  {
    section: "Account",
    items: [
      { label: "Profile", to: "/dashboard/profile", icon: User, description: "Personal information" },
      { label: "Addresses", to: "/dashboard/addresses", icon: MapPin, description: "Saved billing addresses" },
      { label: "Security", to: "/dashboard/2fa", icon: ShieldCheck, description: "Two-factor authentication" },
    ],
  },
]

const bottomTabs = [
  { label: "Home", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "Products", to: "/dashboard/products", icon: Package },
  { label: "Orders", to: "/dashboard/orders", icon: ShoppingBag },
  { label: "Downloads", to: "/dashboard/downloads", icon: Download },
  { label: "Profile", to: "/dashboard/profile", icon: User },
]

const pageMeta = {
  "/dashboard": { title: "Overview", subtitle: "Monitor your account, orders, downloads, and recent activity." },
  "/dashboard/products": { title: "My Products", subtitle: "Access your paid digital products and available downloads." },
  "/dashboard/downloads": { title: "Downloads", subtitle: "Track your file download history and access logs." },
  "/dashboard/orders": { title: "Order History", subtitle: "Review your purchases, payment state, and order records." },
  "/dashboard/consultations": { title: "Consultations", subtitle: "Manage upcoming bookings, reschedule, or cancel calls." },
  "/dashboard/service-orders": { title: "Service Orders", subtitle: "Track your consulting services, consultations, and project milestones." },
  "/dashboard/wishlist": { title: "Wishlist", subtitle: "Products you've saved for later." },
  "/dashboard/addresses": { title: "Addresses", subtitle: "Manage saved billing and invoicing addresses." },
  "/dashboard/2fa": { title: "Security · Two-Factor Auth", subtitle: "Add an extra layer of protection to your account." },
  "/dashboard/support": { title: "Support", subtitle: "Open tickets, get help, and track your support requests." },
  "/dashboard/profile": { title: "Profile", subtitle: "Manage your account information and personal details." },
}

/* ──────────────────────────────────────────────────────────────────────────
 *  SidebarItem · F10.B · 4px Deep Azure left border + Violet Ghost bg on
 *  active. Replaces the prior solid-violet "selected" state.
 *  ──────────────────────────────────────────────────────────────────── */
function SidebarItem({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "group relative flex items-start gap-3 rounded-xl py-3 transition-all duration-200",
          // F10.B · 4px Deep Azure left border on active. The pl-3 accounts
          // for the 4px left border so the icon remains in the same x-axis
          // position regardless of state.
          isActive
            ? "bg-violet-pale border-l-[4px] border-l-azure pl-[calc(0.75rem-4px)] pr-3 text-violet shadow-[inset_0_0_0_1px_rgba(93,63,211,0.06)]"
            : "border-l-[4px] border-l-transparent pl-[calc(0.75rem-4px)] pr-3 text-charcoal-80 hover:bg-[#f5eff6] hover:text-violet",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
              isActive ? "bg-violet text-white shadow-[0_4px_12px_rgba(93,63,211,0.18)]" : "bg-[#f7f1f8] text-violet group-hover:bg-white",
            ].join(" ")}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-meta font-semibold ${isActive ? "text-violet" : ""}`}>
                {item.label}
              </span>
              <ChevronRight
                className={[
                  "h-4 w-4 shrink-0 transition-transform",
                  isActive ? "translate-x-0 text-violet/70" : "text-charcoal-80/40 group-hover:translate-x-0.5",
                ].join(" ")}
                aria-hidden="true"
              />
            </div>
            <div className={["mt-0.5 truncate text-micro", isActive ? "text-violet/70" : "text-charcoal-80/60"].join(" ")}>
              {item.description}
            </div>
          </div>
        </>
      )}
    </NavLink>
  )
}

// ── Mobile slide-out menu ──
function MobileMenu({ open, onClose, user, initials, onLogout }) {
  const { t } = useTranslation("common")
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  // ESC to close
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
        aria-label={t("layout.navAria")}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-charcoal-80/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <UserAvatar src={user?.avatarUrl} initials={initials} size={10} />
              <div>
                <div className="text-meta font-bold text-violet">{user?.fullName || "Member"}</div>
                <div className="text-micro text-charcoal-80/60">{user?.email || ""}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("layout.closeMenu")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-charcoal-80 transition hover:bg-[#f5eff6] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* {t("layout.backToWebsite")} */}
          <Link
            to="/"
            onClick={onClose}
            className="m-4 flex items-center gap-2.5 rounded-xl border border-violet/10 bg-[#F5F2FE] px-3 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            {t("layout.backToWebsite")}
          </Link>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {navigation.map((group) => (
              <div key={group.section} className="mb-6">
                <div className="mb-2 px-2 text-micro font-semibold uppercase tracking-[0.14em] text-charcoal-80/45">
                  {group.section}
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <SidebarItem key={item.to} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-charcoal-80/10 p-4">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-meta font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-300/40 focus-visible:ring-offset-2"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function DashboardLayout() {
  const { t } = useTranslation("dashboard")
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentMeta = pageMeta[location.pathname] || {
    title: "Dashboard",
    subtitle: "Manage your account and digital products.",
  }

  const initials = user?.fullName
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "MU"

  function handleLogout() {
    logout()
    navigate("/", { replace: true })
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <section className="min-h-screen bg-mist pb-20 lg:pb-0">
      {/* Skip-to-content for keyboard users */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-violet focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
      >
        {t("layout.skipMain")}
      </a>

      <div className="mx-auto max-w-[1700px] px-3 py-3 sm:px-5 lg:px-6 lg:py-4">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[300px_1fr]">

          {/* ── Desktop Sidebar ── */}
          <div className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)]">
            <aside
              className="flex h-full min-h-0 w-full flex-col rounded-xl border border-charcoal-80/10 bg-white px-4 py-4 shadow-[0_14px_40px_rgba(93,63,211,0.06)]"
              aria-label={t("layout.navAria")}
            >
              {/* Brand */}
              <div className="border-b border-charcoal-80/10 px-2 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet text-white shadow-[0_10px_22px_rgba(93,63,211,0.18)]">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-card font-bold tracking-tight text-violet">{t("layout.memberArea")}</div>
                    <div className="mt-0.5 text-micro text-charcoal-80/65">{t("layout.memberAreaSubtitle")}</div>
                  </div>
                </div>
              </div>

              {/* {t("layout.backToWebsite")} */}
              <Link
                to="/"
                className="mt-3 flex items-center gap-2.5 rounded-xl border border-violet/10 bg-[#F5F2FE] px-3 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t("layout.backToWebsite")}
              </Link>

              {/* Nav */}
              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                {navigation.map((group) => (
                  <div key={group.section} className="mb-6">
                    <div className="mb-2 px-2 text-micro font-semibold uppercase tracking-[0.14em] text-charcoal-80/45">
                      {group.section}
                    </div>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <SidebarItem key={item.to} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* User card */}
              <div className="mt-3 rounded-xl border border-charcoal-80/10 bg-[#fbf8fb] p-4">
                <div className="flex items-center gap-3">
                  <UserAvatar src={user?.avatarUrl} initials={initials} size={11} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-meta font-semibold text-violet">{user?.fullName || "Member"}</div>
                    <div className="truncate text-micro text-charcoal-80/70">{user?.email || ""}</div>
                  </div>
                </div>
              </div>

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-meta font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-red-300/40 focus-visible:ring-offset-2"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </aside>
          </div>

          {/* ── Main area ── */}
          <div className="min-w-0">

            {/* ── Mobile Header ── */}
            <header className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-between border-b border-charcoal-80/10 bg-white px-4 py-3 shadow-[0_2px_12px_rgba(93,63,211,0.06)] lg:hidden">
              <div className="flex items-center gap-3">
                <UserAvatar src={user?.avatarUrl} initials={initials} size={9} className="shadow-[0_4px_12px_rgba(93,63,211,0.22)]" />
                <div>
                  <div className="text-body font-bold text-violet">{currentMeta.title}</div>
                  <div className="text-micro text-charcoal-80/55">{t("layout.memberDashboard")}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  aria-label={t("layout.backWebsiteAria")}
                  title={t("layout.backWebsiteAria")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-violet transition hover:bg-[#f5eff6] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
                </Link>
                <NotificationDropdown />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label={t("layout.openMenu")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-violet transition hover:bg-[#f5eff6] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* ── Desktop Header ── */}
            <header className="sticky top-4 z-20 hidden rounded-xl border border-charcoal-80/10 bg-white px-5 py-4 shadow-[0_12px_35px_rgba(93,63,211,0.05)] lg:block">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="text-micro font-medium uppercase tracking-[0.12em] text-charcoal-80/50">
                    Dashboard / {currentMeta.title}
                  </div>
                  <div className="mt-2">
                    <h1 className="truncate text-section font-bold tracking-tight text-violet">
                      {currentMeta.title}
                    </h1>
                    <p className="mt-0.5 text-micro text-charcoal-80/70">{currentMeta.subtitle}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="dashboard-search" className="sr-only">{t("layout.searchDashboard")}</label>
                  <div className="flex items-center gap-3 rounded-xl border border-charcoal-80/10 bg-[#fafafa] px-4 py-3 transition focus-within:border-violet/40 focus-within:ring-[3px] focus-within:ring-azure/20">
                    <Search className="h-4 w-4 text-charcoal-80/45" aria-hidden="true" />
                    <input
                      id="dashboard-search"
                      type="text"
                      placeholder="Search orders, products..."
                      className="w-[180px] bg-transparent text-meta text-violet outline-none placeholder:text-charcoal-80/45"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/support")}
                    aria-label={t("layout.openSupport")}
                    title="Support"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal-80/10 bg-white text-violet transition hover:bg-[#f4eef6] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                  >
                    <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                  <NotificationDropdown />
                  <div className="flex items-center gap-3 rounded-xl border border-charcoal-80/10 bg-[#faf8fb] px-3.5 py-2">
                    <UserAvatar src={user?.avatarUrl} initials={initials} size={9} className="shadow-[0_4px_10px_rgba(93,63,211,0.22)]" />
                    <div className="min-w-0">
                      <div className="truncate text-meta font-semibold leading-none text-violet">
                        {user?.fullName?.split(" ")[0] || "Member"}
                      </div>
                      <div className="mt-0.5 truncate text-micro leading-none text-charcoal-80/55">
                        {user?.email || ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main id="dashboard-main" className="mt-3 min-w-0 lg:mt-4">
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      {/* ── Mobile Slide-out Menu ── */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        initials={initials}
        onLogout={handleLogout}
      />

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-charcoal-80/10 bg-white shadow-[0_-4px_16px_rgba(93,63,211,0.06)] lg:hidden" aria-label={t("layout.quickNav")}>
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                aria-label={tab.label}
                className={({ isActive }) =>
                  [
                    "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-center transition-all",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1",
                    isActive ? "text-violet" : "text-charcoal-80/45 hover:text-violet",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                        isActive ? "bg-violet text-white shadow-[0_4px_14px_rgba(93,63,211,0.25)]" : "",
                      ].join(" ")}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </div>
                    <span className={`text-micro font-semibold ${isActive ? "text-violet" : ""}`}>
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
