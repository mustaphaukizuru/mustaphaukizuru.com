import { useState, useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { LocalizedLink as Link, LocalizedNavLink as NavLink } from "../components/LocalizedLink"
import useLocalizedNavigate from "../hooks/useLocalizedNavigate"
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
  X,
  Menu,
  Globe,
  Briefcase, Calendar} from "lucide-react"
import useBodyScrollLock from "../hooks/useBodyScrollLock"
import useFocusTrap from "../hooks/useFocusTrap"
import useSwipeToDismiss from "../hooks/useSwipeToDismiss"
import { useAuth } from "../context/AuthContext"
import useLazyNamespace from "../hooks/useLazyNamespace"
import { API_BASE_URL } from "../lib/api"
import NotificationDropdown from "../components/dashboard/NotificationDropdown"
import UpcomingMeetingBanner from "../components/dashboard/UpcomingMeetingBanner"
import ThemeSwitcher from "../components/ui/ThemeSwitcher"
import LanguageSwitcher from "../components/LanguageSwitcher"
// pathWithLanguage(p, "en") IS the strip, and it is a nine-line module.
// seo/pageSeoEs exports a strip helper that does the same thing, but
// importing it would pull the whole Spanish SEO table into the dashboard
// chunk to run one regex.
import { pathWithLanguage } from "../i18n/utils/pathWithLanguage"
import { Helmet } from "react-helmet-async"
import { siteConfig } from "../seo/siteSeo"

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

/* FOUR tabs, deliberately.
 *
 * Five did not fit: each tab carried a fixed `px-3` and could not shrink, so
 * on a 390px phone the row overflowed its container and clipped the last
 * label ("Profile") against the screen edge. Four tabs at `flex-1` leave
 * ~97px each — room for the widest label ("Downloads"/"Descargas") with a
 * 44px touch target, on the narrowest phone we support.
 *
 * Downloads is the one that moved to the drawer: it is the only tab of the
 * five that is also reachable from an adjacent screen (every order links to
 * its files), whereas Support has no other mobile affordance — the header's
 * help button is `lg:` only. */
const bottomTabs = [
  { labelKey: "nav.overview", to: "/dashboard", icon: LayoutDashboard, end: true },
  { labelKey: "nav.orders", to: "/dashboard/orders", icon: ShoppingBag },
  { labelKey: "nav.support", to: "/dashboard/support", icon: Headphones },
  { labelKey: "nav.profile", to: "/dashboard/profile", icon: User, match: PROFILE_ROUTES },
]

/* ──────────────────────────────────────────────────────────────────────────
 *  PAGE TITLES · D3-1 · one key per route, from the navigation
 *
 *  This was twelve hardcoded English title/subtitle pairs, so a member
 *  reading the dashboard in Spanish got Spanish navigation, Spanish section
 *  labels and Spanish page content under an ENGLISH page heading, on every
 *  one of the twelve routes. (The `/es` tree does not mirror /dashboard —
 *  language here comes from the persisted i18n choice, not the URL — so
 *  there was no prefix to notice this by.)
 *
 *  The titles resolve through `nav.*`, which is the SAME key the sidebar
 *  entry uses, rather than twelve new strings. That is deliberate on two
 *  counts: both locales already have them, and it closes a small
 *  inconsistency the duplicate copy had drifted into — you clicked "Orders"
 *  and landed on a page headed "Order History", clicked "Two-step
 *  verification" and landed on "Security · Two-Factor Auth". One name per
 *  destination.
 *
 *  The `subtitle` half is GONE rather than translated. Tier 1 removed it
 *  from the header (every page renders its own description), so all twelve
 *  were dead strings; translating them would have been twelve Spanish
 *  strings nothing renders.
 *  ──────────────────────────────────────────────────────────────── */
const pageTitleKeys = {
  "/dashboard": "nav.overview",
  "/dashboard/products": "nav.products",
  "/dashboard/downloads": "nav.downloads",
  "/dashboard/orders": "nav.orders",
  "/dashboard/consultations": "nav.consultations",
  "/dashboard/service-orders": "nav.serviceOrders",
  "/dashboard/addresses": "nav.addresses",
  "/dashboard/2fa": "nav.twoFactor",
  "/dashboard/notifications": "nav.notifications",
  "/dashboard/projects": "nav.projects",
  "/dashboard/support": "nav.support",
  "/dashboard/profile": "nav.profile",
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
          // snap-start pairs with snap-proximity on the scroller: a scroll
          // settles on a row boundary rather than leaving one bisected,
          // which is what made a scrollable rail read as a rendering fault.
          "group relative flex snap-start items-start gap-3 rounded-xl py-2.5 transition-all duration-200",
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
            {/* D4-2 · the description is neutral on every row now.
              *
              * The active row used `text-violet/70`, which composites over
              * the violet-pale active background to 3.19:1 — axe flags it on
              * all twelve routes. Raising the opacity would
              * take violet/90 to reach 4.70:1, which is the wrong lever
              * (and Brand v3 says use the darker sibling, not more alpha).
              *
              * The label above already carries the active violet, in
              * semibold. Making the description neutral gives the row one
              * accent instead of two at different strengths, and
              * charcoal-80/65 measures 4.96:1 on violet-pale, 5.32:1 on
              * white and 5.12:1 on violet-ghost — every background this row
              * has. */}
            <div className="mt-0.5 truncate text-micro text-charcoal-80/65">
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
  /* One namespace only. This component used to hold a second `t` bound to
     "common" and reach for `layout.*` through it — but those keys live in
     "dashboard", and common.json has no `layout` object, so the drawer
     rendered the raw key "layout.backToWebsite" to users and handed
     screen readers "layout.navAria" as the dialog name. */
  const { t: td } = useTranslation("dashboard")
  /* Scroll lock + focus management.
   * The hand-rolled `document.body.style.overflow` this replaced had two
   * defects: it clobbered any inline overflow already on <body>, and it
   * released the lock as soon as THIS menu closed even if another overlay
   * (modal, cart drawer) was still open. useBodyScrollLock is ref-counted
   * and locks <html> too, which is what iOS actually honours.
   * useFocusTrap keeps Tab inside the open panel and restores focus to the
   * trigger on close — the header comment claimed a focus trap, but there
   * was none. */
  const panelRef = useRef(null)
  useBodyScrollLock(open)
  useFocusTrap(panelRef, open)
  /* The panel enters from the right, so a decisive rightward drag closes
     it — the same gesture, and the same shared hook, as the public site's
     drawer. Without this the only way out was the X or the backdrop. */
  useSwipeToDismiss(panelRef, open, onClose)

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
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        /* inert (React 19) — a closed drawer sits off-screen but stayed in
           the tab order and in the accessibility tree, so keyboard users
           tabbed into invisible links and screen readers announced a menu
           that is not there. */
        inert={!open}
        className={`fixed inset-y-0 right-0 z-[70] flex w-[300px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal={open ? "true" : "false"}
        aria-label={td("layout.navAria")}
      >
        {/* D2-6 · min-h-0 on both, and it is not cosmetic.
         *
         * A flex child in a column will not shrink below its content height
         * unless told it may. So `flex-1 overflow-y-auto` on the nav never
         * actually scrolled: the nav kept its full height, this container
         * grew to fit it, and the panel measured 1898px tall inside an 812px
         * viewport — with the theme control at y=1780 and SIGN OUT at y=1838,
         * both permanently off-screen and unreachable, because a fixed panel
         * does not scroll with the page.
         *
         * The desktop rail has always had `min-h-0` on its aside, which is
         * why the same structure works there. Measured, not guessed: the
         * panel is 812px now and the footer is visible. */}
        <div className="flex h-full min-h-0 flex-col">
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
              aria-label={td("layout.closeMenu")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-charcoal-80 transition hover:bg-violet-ghost focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* {td("layout.backToWebsite")} */}
          <Link
            to="/"
            onClick={onClose}
            className="m-4 flex items-center gap-2.5 rounded-xl border border-violet/10 bg-violet-ghost px-3 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            {td("layout.backToWebsite")}
          </Link>

          {/* Nav */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {navigation.map((group) => (
              <div key={group.sectionKey} className="mb-4 last:mb-0">
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

          {/* Theme and language (mobile drawer) — the theme control keeps the
              same scoping rules as the desktop sidebar one above. Language
              sits beside it rather than in the mobile header, which is
              already at four controls across 375px. */}
          <div className="space-y-2.5 border-t border-charcoal-80/10 px-4 pt-4">
            <ThemeSwitcher variant="segmented" size="sm" className="w-full justify-between" />
            <div className="flex items-center justify-between">
              <span className="text-micro font-semibold uppercase tracking-[0.14em] text-charcoal-80/65">
                {td("layout.language")}
              </span>
              <LanguageSwitcher variant="text" />
            </div>
          </div>

          {/* Logout */}
          <div className="p-4">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose/20 bg-white px-4 py-3 text-meta font-semibold text-rose-700 transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30/40 focus-visible:ring-offset-2"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {td("layout.logout")}
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
  const navigate = useLocalizedNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  /* The two detail routes (`orders/:id`, `projects/:id`) resolve to their
     parent's title through the prefix match; `/dashboard` is excluded from
     that search or it would match everything.

     Deliberately not memoised. The `i18nReady` guard below sits after every
     hook — it has to, or the hook order would change between renders — so a
     memo here still RUNS on the renders where the `dashboard` bundle has not
     arrived yet. react-i18next hands back a referentially stable `t`, so
     deps of `[location.pathname, t]` never invalidate once the bundle lands
     and the cached value stays the raw key: the heading and the tab title
     both rendered the literal string "nav.orders" until this was unwrapped.
     Twelve object lookups and one t() per render is not worth a cache that
     can be wrong. */
  /* The /es prefix comes off before the lookup: the map is written in
     unprefixed form and the tree is mounted at both /dashboard and
     /es/dashboard (D3-3), so keying on the raw pathname made every Spanish
     route miss and fall through to "Panel de miembro". */
  const routePath = pathWithLanguage(location.pathname, "en")
  const titleKey = pageTitleKeys[routePath]
    || pageTitleKeys[Object.keys(pageTitleKeys)
      .find((p) => p !== "/dashboard" && routePath.startsWith(`${p}/`))]
  const pageTitle = t(titleKey || "layout.memberDashboard")

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

  // T5-5 · `dashboard` is route-scoped now (LAZY_NAMESPACES in
  // i18n/resources.js): 50 KB per language that no public page reads. It is
  // fetched here and this tree waits for it, because the project does not use
  // Suspense for translations and rendering early paints raw keys.
  //
  // The guard sits AFTER every hook, not at the top: an early return above
  // them would change the hook order between renders.
  const i18nReady = useLazyNamespace("dashboard")
  if (!i18nReady) return null

  return (
    // `data-dashboard-shell` is the scoping anchor for dashboard-only
    // dark mode (see styles/tokens.css). The public website never has
    // this attribute, so the canonical light brand identity stays
    // intact regardless of the user's stored theme preference. Toggling
    // dark mode (via ThemeSwitcher in the sidebar) flips only the
    // dashboard subtree per Brand v3.1 §00 "Default Mode: Light".
    <section data-dashboard-shell className="min-h-screen bg-mist pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      {/* D3-1 · a browser tab you can tell apart.
       *
       * SeoRouteManager runs globally and titles every route, but
       * `/dashboard` appears in pageSeo.js only under `noindexPrefixes` —
       * there is no staticSeoByRoute entry for any of the twelve routes. So
       * all twelve fell through to siteConfig.defaultTitle, and a member
       * with orders, projects and support open in three tabs saw the same
       * 84-character marketing title on all three.
       *
       * Helmet resolves to the deepest instance, so this wins over
       * SeoRouteManager without touching it — and it belongs here rather
       * than in pageSeo.js because the title has to be translated, and this
       * is the only tree that has the `dashboard` namespace loaded. Putting
       * it in the global manager would pull 56 KB of dashboard strings into
       * every public page load to title a page the public never sees.
       *
       * Title first, brand second: the tab strip truncates from the right. */}
      <Helmet>
        <title>{`${pageTitle} · ${siteConfig.siteName}`}</title>
      </Helmet>

      {/* Skip-to-content for keyboard users */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-violet focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
      >
        {t("layout.skipMain")}
      </a>

      <div className="mx-auto max-w-[1700px] px-3 py-3 sm:px-5 lg:px-6 lg:py-4">
        {/* D1-4 · a narrower rail between lg and xl.
             *
             * The sidebar appears at lg (1024px) and took 300px of it, which
             * left the content column 650px — measured — and that is also
             * where DashboardPage used to split its cards in two, so each
             * card got ~310px and titles wrapped onto two lines. The rail
             * gets its full 300px back at xl, where there is room for it. */}
        <div className="grid gap-4 lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[264px_1fr] xl:grid-cols-[300px_1fr]">

          {/* ── Desktop Sidebar ── */}
          <div className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)]">
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

              {/* Nav
               *
               * The fade at the bottom is the affordance: when the rail is
               * short enough for this to scroll, a row cut by the scroller's
               * edge reads as a rendering fault rather than as "there is
               * more below". mask-image would be tidier but is not in the
               * gradient token set.
               */}
              <div className="relative mt-4 min-h-0 flex-1">
                <div className="h-full snap-y snap-proximity overflow-y-auto pr-1">
                {navigation.map((group) => (
                  <div key={group.sectionKey} className="mb-4 last:mb-0">
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
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-xl bg-gradient-to-t from-white to-transparent"
                  aria-hidden="true"
                />
              </div>

              {/* Footer · one card (D1-3)
               *
               * This was three stacked blocks — user card, theme switcher,
               * logout — at 190px with their margins, pinned below a nav that
               * needs 642px. On a 600px-tall window the nav got 201px of that
               * and hid 441px of itself; at 800px it hid 241px and sliced the
               * "Projects" row in half, 40px of it below the scroller's edge.
               * Measured at five viewport heights.
               *
               * Folded into one ~110px card: logout moves onto the avatar row
               * as a 44px icon button, the theme control sits under it.
               * Nothing is lost — Light / Dark / System are all still here —
               * and the nav now fits WITHOUT SCROLLING at 1920x950, the window
               * the report came from.
               */}
              <div className="mt-3 rounded-xl border border-charcoal-80/10 bg-violet-pale/40 p-3">
                <div className="flex items-center gap-2.5">
                  <UserAvatar src={user?.avatarUrl} initials={initials} size={9} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-meta font-semibold text-violet">{user?.fullName || "Member"}</div>
                    <div className="truncate text-micro text-charcoal-80/70">{user?.email || ""}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label={t("layout.logout")}
                    title={t("layout.logout")}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose/20 bg-white text-rose-700 transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30 focus-visible:ring-offset-2"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {/* Scoped to the dashboard subtree via data-dashboard-shell on
                    this section's root, so toggling here does NOT alter the
                    public website's canonical light brand. */}
                <ThemeSwitcher variant="segmented" size="sm" className="mt-2.5 w-full justify-between" />
              </div>
            </aside>
          </div>

          {/* ── Main area ── */}
          <div className="min-w-0">

            {/* ── Mobile Header ── (and 768-1023, deliberately)
             *
             * D2-5 · the band between 768 and 1023 gets the phone treatment:
             * this header, the drawer and the bottom tab bar. That was
             * questioned and kept.
             *
             * The rail needs 264px and the content column needs ~650px
             * before two cards stop wrapping their titles, so the two-column
             * shell does not pay for itself under ~940px. A 768-1023 tablet
             * given the desktop shell would get a 480px content column,
             * which is worse than a single wide column with thumb-reachable
             * navigation at the bottom of the screen — and a tablet is held,
             * so the bottom bar is the right affordance there anyway.
             */}
            <header className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-between border-b border-charcoal-80/10 bg-white px-4 py-3 shadow-[var(--shadow-e2)] lg:hidden">
              <div className="flex items-center gap-3">
                <UserAvatar src={user?.avatarUrl} initials={initials} size={9} className="shadow-[var(--shadow-lift-1)]" />
                <div>
                  <div className="text-body font-bold text-violet">{pageTitle}</div>
                  <div className="text-micro text-charcoal-80/65">{t("layout.memberDashboard")}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  aria-label={t("layout.backWebsiteAria")}
                  title={t("layout.backWebsiteAria")}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-violet transition hover:bg-violet-ghost focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Globe className="h-[18px] w-[18px]" aria-hidden="true" />
                </Link>
                <NotificationDropdown />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label={t("layout.openMenu")}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-violet transition hover:bg-violet-ghost focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* ── Desktop Header ── (D1-1, D1-2, D4-1)
             *
             * THE WRAPPER IS THE FIX FOR THE BLEED. The header used to be
             * `sticky top-4`, which parks it 16px below the viewport edge and
             * leaves a 16px window that scrolling cards slide through in full
             * view — measured with elementFromPoint(x, 12) returning page
             * content, and visible in the screenshot that started this. The
             * WRAPPER is what sticks now, at top-0, and it carries the page's
             * own 16px gap as its own padding on a `bg-mist` ground. So the
             * gap is painted, the card still sits 16px down, and nothing shows
             * through. `-mt-4` cancels the grid container's padding, so the
             * resting layout is unchanged.
             *
             * ONE ROW, FROM lg UP. It was `flex-col ... xl:flex-row`, so
             * between 1024 and 1280 the title block and the toolbar stacked:
             * 184px of sticky header on a 600px-tall laptop — 31% of the
             * screen, measured. Now a single row that holds at every width.
             *
             * WHAT WENT, AND WHY
             *   · the subtitle — every page renders its own heading and
             *     description; this was a second, more generic copy, and it
             *     cost 40px of every screen permanently.
             *   · the <h1> — the PAGE owns the h1. Two per document is what
             *     the a11y probe found at all four viewports; a breadcrumb is
             *     not the document's heading.
             *   · the search box — no state, no handler, no form. It did
             *     nothing, and being the widest thing here it is what forced
             *     the wrap. Orders and Downloads already have their own
             *     WORKING search inputs over the data they hold; a global one
             *     needs a backend endpoint that does not exist, which is a
             *     feature rather than a layout fix.
             */}
            <div className="sticky top-0 z-20 hidden -mt-4 bg-mist pt-4 lg:block">
              <header className="flex items-center gap-4 rounded-xl border border-charcoal-80/10 bg-white px-5 py-3 shadow-[var(--shadow-e6)]">
                <div className="min-w-0 flex-1">
                  <div className="text-micro font-medium uppercase tracking-[0.12em] text-charcoal-80/65">
                    {t("layout.breadcrumbRoot")}
                  </div>
                  {/* D4-1 · the h1 lives HERE, and only here.
                   *
                   * The probe found two per page — this one and the page's —
                   * on all four viewports. Removing this one was tried first
                   * and was worse: NINE of the fourteen dashboard pages have
                   * no heading of their own (Consultations, Downloads,
                   * Products and Profile have no visible title at all), so
                   * the documents ended up with none.
                   *
                   * The layout already knows the page title from pageTitleKeys and
                   * renders it on every route, so it is the one place that can
                   * guarantee exactly one. The three pages that had their own
                   * h1 are now h2 under it, which is also the hierarchy the
                   * heading-order probe wanted. */}
                  <h1 className="truncate text-card font-bold tracking-tight text-violet">
                    {pageTitle}
                  </h1>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* D3-3 · the dashboard had no language control at all.
                      It did not need one while /dashboard was English-only;
                      now that /es/dashboard exists, this is the only screen a
                      signed-in member lives on, and switching should not mean
                      going back out to a marketing page to find the toggle.
                      The `text` variant is ~44px wide and costs the header no
                      height, which D1-2 spent real effort reclaiming. */}
                  <LanguageSwitcher variant="text" className="me-1" />
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/support")}
                    aria-label={t("layout.openSupport")}
                    title={t("layout.openSupport")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal-80/10 bg-white text-violet transition hover:bg-violet-pale/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                  >
                    <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                  <NotificationDropdown />
                  {/* The name appears from xl and the email from 2xl: between
                      1024 and 1279 the content column is only 650px wide, and
                      an email address is the least useful thing in a header
                      belonging to the person already signed in. */}
                  <div className="flex items-center gap-2.5 rounded-xl border border-charcoal-80/10 bg-violet-pale/40 px-3 py-2">
                    <UserAvatar src={user?.avatarUrl} initials={initials} size={9} className="shadow-[var(--shadow-lift-1)]" />
                    <div className="hidden min-w-0 xl:block">
                      <div className="truncate text-meta font-semibold leading-tight text-violet">
                        {user?.fullName?.split(" ")[0] || "Member"}
                      </div>
                      <div className="mt-0.5 hidden truncate text-micro leading-tight text-charcoal-80/65 2xl:block">
                        {user?.email || ""}
                      </div>
                    </div>
                  </div>
                </div>
              </header>
            </div>

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
        <div className="mx-auto flex max-w-lg items-stretch px-1 py-1.5">
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
                    // flex-1 + min-w-0 is what stops the row overflowing: every
                    // tab shares the width equally and its label may ellipsise
                    // rather than push its neighbour off-screen.
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition-all",
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
                    <span className={`max-w-full truncate text-micro font-semibold ${isActive ? "text-violet" : ""}`}>
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
