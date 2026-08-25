import { useState, useEffect, useMemo } from "react"
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom"
import {
  LayoutDashboard,
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
  Briefcase, Calendar} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"
import NotificationDropdown from "../components/dashboard/NotificationDropdown"
import UpcomingMeetingBanner from "../components/dashboard/UpcomingMeetingBanner"
import ThemeSwitcher from "../components/ui/ThemeSwitcher"

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
 *    - Navigation grouping (consolidated in roadmap step 29 to Overview ·
 *      Orders · Downloads · Consultations · Projects · Support · Profile;
 *      Addresses / Security / Notifications are tabs under Profile)
 *    - Mobile slide-out behavior + body-scroll lock
 *    - Bottom tab bar structure
 *    - All routes
 *    - Logout flow
 *    - NotificationDropdown integration
 *    - User avatar resolution + fallback initials
 *    - pageMeta lookup
 *  ──────────────────────────────────────────────────────────────────── */

// Sub-routes that should light up the "Profile" entry.
const PROFILE_ROUTES = ["/dashboard/profile", "/dashboard/addresses", "/dashboard/2fa", "/dashboard/notifications"]

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

// ── Navigation · roadmap step 29 · consolidated to 7 entries ──
// Addresses / Security / Notifications live as tabs inside Profile
// (see components/dashboard/ProfileTabs). Their routes are unchanged.
// Labels resolve through dashboard.json `nav.*` / `layout.navDesc.*`.
const navigation = [
  {
    sectionKey: "layout.sections.overview",
    items: [
      { labelKey: "nav.overview", descKey: "layout.navDesc.overview", to: "/dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    sectionKey: "layout.sections.library",
    items: [
      { labelKey: "nav.orders", descKey: "layout.navDesc.orders", to: "/dashboard/orders", icon: ShoppingBag },
      { labelKey: "nav.downloads", descKey: "layout.navDesc.downloads", to: "/dashboard/downloads", icon: Download },
    ],
  },
  {
    sectionKey: "layout.sections.work",
    items: [
      { labelKey: "nav.consultations", descKey: "layout.navDesc.consultations", to: "/dashboard/consultations", icon: Calendar },
      { labelKey: "nav.projects", descKey: "layout.navDesc.projects", to: "/dashboard/projects", icon: Briefcase },
      { labelKey: "nav.support", descKey: "layout.navDesc.support", to: "/dashboard/support", icon: Headphones },
    ],
  },
  {
    sectionKey: "layout.sections.account",
    items: [
      { labelKey: "nav.profile", descKey: "layout.navDesc.profile", to: "/dashboard/profile", icon: User, match: PROFILE_ROUTES },
    ],
  },
]

const bottomTabs = [
  { labelKey: "nav.overview", to: "/dashboard", icon: LayoutDashboard, end: true },
  { labelKey: "nav.orders", to: "/dashboard/orders", icon: ShoppingBag },
  { labelKey: "nav.downloads", to: "/dashboard/downloads", icon: Download },
  { labelKey: "nav.support", to: "/dashboard/support", icon: Headphones },
  { labelKey: "nav.profile", to: "/dashboard/profile", icon: User, match: PROFILE_ROUTES },
]

const pageMeta = {
  "/dashboard": { title: "Overview", subtitle: "Monitor your account, orders, downloads, and recent activity." },
  "/dashboard/products": { title: "My Products", subtitle: "Access your paid digital products and available downloads." },
  "/dashboard/downloads": { title: "Downloads", subtitle: "Track your file download history and access logs." },
  "/dashboard/orders": { title: "Order History", subtitle: "Review your purchases, payment state, and order records." },
  "/dashboard/consultations": { title: "Consultations", subtitle: "Manage upcoming bookings, reschedule, or cancel calls." },
  "/dashboard/service-orders": { title: "Service Orders", subtitle: "Track your consulting services, consultations, and project milestones." },
  "/dashboard/addresses": { title: "Addresses", subtitle: "Manage saved billing and invoicing addresses." },
  "/dashboard/2fa": { title: "Security · Two-Factor Auth", subtitle: "Add an extra layer of protection to your account." },
  "/dashboard/notifications": { title: "Notifications", subtitle: "Everything that happened on your account, in one place." },
  "/dashboard/projects": { title: "Projects", subtitle: "Milestones, files, and timeline for every engagement." },
  "/dashboard/support": { title: "Support", subtitle: "Open tickets, get help, and track your support requests." },
  "/dashboard/profile": { title: "Profile", subtitle: "Manage your account information and personal details." },
}

/* ──────────────────────────────────────────────────────────────────────────
 *  SidebarItem · F10.B · 4px Deep Azure left border + Violet Ghost bg on
 *  active. Replaces the prior solid-violet "selected" state.
 *  ──────────────────────────────────────────────────────────────────── */
function SidebarItem({ item }) {
  const { t } = useTranslation("dashboard")
  const { pathname } = useLocation()
  const Icon = item.icon
  const forced = item.match ? item.match.some((p) => pathname.startsWith(p)) : null
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive: navActive }) =>
        [
          "group relative flex items-start gap-3 rounded-xl py-3 transition-all duration-200",
          // F10.B · 4px Deep Azure left border on active. The pl-3 accounts
          // for the 4px left border so the icon remains in the same x-axis
          // position regardless of state.
          (forced ?? navActive)
            ? "bg-violet-pale border-l-[4px] border-l-azure pl-[calc(0.75rem-4px)] pr-3 text-violet shadow-[inset_0_0_0_1px_rgb(var(--color-violet-rgb)/0.06)]"
            : "border-l-[4px] border-l-transparent pl-[calc(0.75rem-4px)] pr-3 text-charcoal-80 hover:bg-violet-ghost hover:text-violet",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2",
        ].join(" ")
      }
    >
      {({ isActive: navActive }) => { const isActive = forced ?? navActive; return (
        <>
          <div
            className={[
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
              isActive ? "bg-violet text-white shadow-[var(--shadow-lift-1)]" : "bg-violet-pale/60 text-violet group-hover:bg-white",
            ].join(" ")}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-meta font-semibold ${isActive ? "text-violet" : ""}`}>
                {t(item.labelKey)}
              </span>
              <ChevronRight
                className={[
                  "h-4 w-4 shrink-0 transition-transform",
                  isActive ? "translate-x-0 text-violet/70" : "text-charcoal-80/40 group-hover:translate-x-0.5",
                ].join(" ")}
                aria-hidden="true"
              />
            </div>
            <div className={["mt-0.5 truncate text-micro", isActive ? "text-violet/70" : "text-charcoal-80/65"].join(" ")}>
              {t(item.descKey)}
            </div>
          </div>
        </>
      ) }}
    </NavLink>
  )
}

// ── Mobile slide-out menu ──
function MobileMenu({ open, onClose, user, initials, onLogout }) {
  const { t } = useTranslation("common")
  const { t: td } = useTranslation("dashboard")
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
                <div className="text-micro text-charcoal-80/65">{user?.email || ""}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("layout.closeMenu")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-charcoal-80 transition hover:bg-violet-ghost focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* {t("layout.backToWebsite")} */}
          <Link
            to="/"
            onClick={onClose}
            className="m-4 flex items-center gap-2.5 rounded-xl border border-violet/10 bg-violet-ghost px-3 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            {t("layout.backToWebsite")}
          </Link>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {navigation.map((group) => (
              <div key={group.sectionKey} className="mb-6">
                <div className="mb-2 px-2 text-micro font-semibold uppercase tracking-[0.14em] text-charcoal-80/65">
                  {td(group.sectionKey)}
                </div>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <SidebarItem key={item.to} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Theme switcher (mobile drawer) — same scoping rules as the
              desktop sidebar control above. */}
          <div className="border-t border-charcoal-80/10 px-4 pt-4">
            <ThemeSwitcher variant="segmented" size="sm" className="w-full justify-between" />
          </div>

          {/* Logout */}
          <div className="p-4">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose/20 bg-white px-4 py-3 text-meta font-semibold text-rose-700 transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30/40 focus-visible:ring-offset-2"
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

  const currentMeta = useMemo(() => {
    if (pageMeta[location.pathname]) return pageMeta[location.pathname]
    const parent = Object.keys(pageMeta).find((p) => p !== "/dashboard" && location.pathname.startsWith(`${p}/`))
    return pageMeta[parent] || { title: "Dashboard", subtitle: "Manage your account and digital products." }
  }, [location.pathname])

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu on route change
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    // `data-dashboard-shell` is the scoping anchor for dashboard-only
    // dark mode (see styles/tokens.css). The public website never has
    // this attribute, so the canonical light brand identity stays
    // intact regardless of the user's stored theme preference. Toggling
    // dark mode (via ThemeSwitcher in the sidebar) flips only the
    // dashboard subtree per Brand v3.1 §00 "Default Mode: Light".
    <section data-dashboard-shell className="min-h-screen bg-mist pb-20 lg:pb-0">
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
              className="flex h-full min-h-0 w-full flex-col rounded-xl border border-charcoal-80/10 bg-white px-4 py-4 shadow-[0_14px_40px_rgb(var(--color-violet-rgb)/0.06)]"
              aria-label={t("layout.navAria")}
            >
              {/* Brand */}
              <div className="border-b border-charcoal-80/10 px-2 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet text-white shadow-[var(--shadow-lift-4)]">
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
                className="mt-3 flex items-center gap-2.5 rounded-xl border border-violet/10 bg-violet-ghost px-3 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t("layout.backToWebsite")}
              </Link>

              {/* Nav */}
              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                {navigation.map((group) => (
                  <div key={group.sectionKey} className="mb-6">
                    <div className="mb-2 px-2 text-micro font-semibold uppercase tracking-[0.14em] text-charcoal-80/65">
                      {t(group.sectionKey)}
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
              <div className="mt-3 rounded-xl border border-charcoal-80/10 bg-violet-pale/40 p-4">
                <div className="flex items-center gap-3">
                  <UserAvatar src={user?.avatarUrl} initials={initials} size={11} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-meta font-semibold text-violet">{user?.fullName || "Member"}</div>
                    <div className="truncate text-micro text-charcoal-80/70">{user?.email || ""}</div>
                  </div>
                </div>
              </div>

              {/* Theme switcher — 3-way Light / Dark / System control.
                  Scoped to the dashboard subtree via data-dashboard-shell
                  on this section's root, so toggling here does NOT alter
                  the public website's canonical light brand. */}
              <div className="mt-3">
                <ThemeSwitcher variant="segmented" size="sm" className="w-full justify-between" />
              </div>

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-rose/20 bg-white px-4 py-3 text-meta font-semibold text-rose-700 transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30/40 focus-visible:ring-offset-2"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </aside>
          </div>

          {/* ── Main area ── */}
          <div className="min-w-0">

            {/* ── Mobile Header ── */}
            <header className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-between border-b border-charcoal-80/10 bg-white px-4 py-3 shadow-[var(--shadow-e2)] lg:hidden">
              <div className="flex items-center gap-3">
                <UserAvatar src={user?.avatarUrl} initials={initials} size={9} className="shadow-[var(--shadow-lift-1)]" />
                <div>
                  <div className="text-body font-bold text-violet">{currentMeta.title}</div>
                  <div className="text-micro text-charcoal-80/65">{t("layout.memberDashboard")}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  aria-label={t("layout.backWebsiteAria")}
                  title={t("layout.backWebsiteAria")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-violet transition hover:bg-violet-ghost focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
                </Link>
                <NotificationDropdown />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label={t("layout.openMenu")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-violet transition hover:bg-violet-ghost focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* ── Desktop Header ── */}
            <header className="sticky top-4 z-20 hidden rounded-xl border border-charcoal-80/10 bg-white px-5 py-4 shadow-[var(--shadow-e6)] lg:block">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="text-micro font-medium uppercase tracking-[0.12em] text-charcoal-80/65">
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
                  <div className="flex items-center gap-3 rounded-xl border border-charcoal-80/10 bg-mist px-4 py-3 transition focus-within:border-violet/40 focus-within:ring-[3px] focus-within:ring-azure/20">
                    <Search className="h-4 w-4 text-charcoal-80/65" aria-hidden="true" />
                    <input
                      id="dashboard-search"
                      type="text"
                      placeholder="Search orders, products..."
                      className="w-[180px] bg-transparent text-meta text-violet outline-none placeholder:text-charcoal-80/65"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/support")}
                    aria-label={t("layout.openSupport")}
                    title="Support"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal-80/10 bg-white text-violet transition hover:bg-violet-pale/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                  >
                    <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                  <NotificationDropdown />
                  <div className="flex items-center gap-3 rounded-xl border border-charcoal-80/10 bg-violet-pale/40 px-3.5 py-2">
                    <UserAvatar src={user?.avatarUrl} initials={initials} size={9} className="shadow-[var(--shadow-lift-1)]" />
                    <div className="min-w-0">
                      <div className="truncate text-meta font-semibold leading-none text-violet">
                        {user?.fullName?.split(" ")[0] || "Member"}
                      </div>
                      <div className="mt-0.5 truncate text-micro leading-none text-charcoal-80/65">
                        {user?.email || ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main id="dashboard-main" className="mt-3 min-w-0 lg:mt-4">
              {/* Pinned banner that auto-appears 15 min before any
                  confirmed meeting and stays until 60 min past start.
                  Renders nothing when there's no imminent meeting —
                  no layout shift on most page loads. */}
              <UpcomingMeetingBanner />
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
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-charcoal-80/10 bg-white shadow-[0_-4px_16px_rgb(var(--color-violet-rgb)/0.06)] lg:hidden" aria-label={t("layout.quickNav")}>
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {bottomTabs.map((tab) => {
            const Icon = tab.icon
            const forced = tab.match ? tab.match.some((p) => location.pathname.startsWith(p)) : null
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                aria-label={t(tab.labelKey)}
                className={({ isActive: navActive }) =>
                  [
                    "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-center transition-all",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1",
                    (forced ?? navActive) ? "text-violet" : "text-charcoal-80/65 hover:text-violet",
                  ].join(" ")
                }
              >
                {({ isActive: navActive }) => { const isActive = forced ?? navActive; return (
                  <>
                    <div
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                        isActive ? "bg-violet text-white shadow-[0_4px_14px_rgb(var(--color-violet-rgb)/0.25)]" : "",
                      ].join(" ")}
                    >
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </div>
                    <span className={`text-micro font-semibold ${isActive ? "text-violet" : ""}`}>
                      {t(tab.labelKey)}
                    </span>
                  </>
                ) }}
              </NavLink>
            )
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" aria-hidden="true" />
      </nav>
    </section>
  )
}
