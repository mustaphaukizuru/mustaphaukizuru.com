import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, NavLink, useLocation } from "react-router-dom"
import { AnimatePresence, m } from "framer-motion"
import { Menu, X, ShoppingCart } from "lucide-react"

import PrimaryButton from "../ui/PrimaryButton"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { useMenu } from "../context/MenuContext"
import profilePhoto96 from "../assets/avatar/avatar-master-96.webp"
import profilePhoto192 from "../assets/avatar/avatar-master-192.webp"
import LanguageSwitcher from "../components/LanguageSwitcher"
import ErrorBoundary from "../components/ErrorBoundary"
import { NAV_LINKS } from "./header/navLinks"
import SearchTrigger from "./header/SearchTrigger"
import AccountMenu from "./header/AccountMenu"
import MobileMenu from "./header/MobileMenu"

/**
 * Header · V2.3 — wired {t("header.signOut")}
 *
 * Layout (desktop ≥ lg):
 *   [Photo + Name · LEFT]        [ Home About Solutions Services Contact 🔍 | 🛒 Account [{t("header.exploreStore")}] · RIGHT ]
 *
 * V2.3 changes:
 *   • {t("header.signOut")} now calls `logout()` from AuthContext and redirects home
 *     instead of dispatching an unhandled custom event.
 *   • Mobile menu also gets a {t("header.signOut")} row when authenticated, for parity.
 *
 * Behaviour preserved:
 *   • Search button dispatches `ukz:open-search` (handled by SearchPalette).
 *   • ⌘K / Ctrl+K shortcut still works globally.
 *   • Sticky transparent → solid at 30 px scroll, 2 px violet progress bar.
 */

/* Sub-components live in ./header/:
 *   · navLinks.js     — NAV_LINKS / USER_MENU_ITEMS data
 *   · SearchTrigger   — desktop search icon (+ openSearchPalette helper)
 *   · AccountMenu     — avatar dropdown (+ UserAvatar, performSignOut)
 *   · MobileMenu      — < lg navigation Drawer
 * Header itself keeps the sticky bar, desktop nav and composition. */

function CartBadge({ count }) {
  if (!count) return null
  const display = count > 9 ? "9+" : count
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 font-mono text-[10px] font-bold text-charcoal shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
    >
      {display}
    </span>
  )
}

/* ─────────────────────────── main Header ────────────────────────────────── */

// Minimal safety-net fallback rendered when the Header subtree throws.
// Preserves the most-essential affordances (brand link home + Sign in)
// so a Header crash doesn't strand the user with an unbranded, unnavigable
// page. Intentionally avoids any Framer Motion / context dependencies that
// could re-trigger the same error.
function HeaderFallback() {
  return (
    <header role="banner" className="sticky top-0 z-[80] bg-white shadow-[0_1px_0_rgb(var(--color-charcoal-rgb)/0.06)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <a href="/" className="text-[16px] font-bold tracking-tight text-violet sm:text-[18px]">
          Mustapha Ukizuru
        </a>
        <a href="/login" className="rounded-md px-3 py-1.5 text-[14px] font-semibold text-charcoal-80/85 hover:text-violet">
          Sign in
        </a>
      </div>
    </header>
  )
}

function HeaderInner() {
  const { t } = useTranslation("common")
  const { isAuthenticated, loading } = useAuth()
  const { cartCount } = useCart()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)
  // Menu state lifted to MenuContext (see web/src/context/MenuContext.jsx).
  // Other components (e.g., a future "Open menu" inline CTA on a 404 page)
  // can now call openMobileMenu() without prop-drilling through Header.
  const { mobileOpen, openMobileMenu, closeMobileMenu } = useMenu()

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY || 0
      setScrolled(y > 30)
      const docH = document.documentElement.scrollHeight - window.innerHeight
      setScrollPct(docH > 0 ? Math.min(100, (y / docH) * 100) : 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Note: route-change close is now handled inside MobileMenu itself
  // via the useEffect that depends on location.pathname — keeps the
  // close-on-nav logic co-located with the menu component.

  const headerClass = scrolled
    ? "bg-white/85 backdrop-blur-md shadow-[0_1px_0_rgb(var(--color-charcoal-rgb)/0.06)]"
    : "bg-white/0 backdrop-blur-0"

  return (
    // z-[80] on the Header — guarantees the hamburger button stays
    // clickable from any scroll position. Heroes / content sections
    // sometimes use z-40..z-50 for their own sticky bits; bumping the
    // Header to z-80 ensures the hamburger always wins when scrolled.
    // Still below the mobile menu wrapper (z-90/91) so the open menu
    // overlays this Header correctly.
    <header
      role="banner"
      className={`sticky top-0 z-[80] transition-all duration-300 ${headerClass}`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* LEFT, photo + name */}
        <Link
          to="/"
          aria-label={t("header.homeAria")}
          className="flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-charcoal-80/15 bg-white shadow-sm">
            {/* The container is 44px (h-11). The old import was the 400x400
                PNG master at 36 KB, shipped at full size on EVERY page --
                Lighthouse counted ~35 KB of it as waste on /about alone.
                96w covers 2x, 192w covers 3x; both are WebP, which every
                browser this app supports can decode. */}
            <img
              src={profilePhoto96}
              srcSet={`${profilePhoto96} 96w, ${profilePhoto192} 192w`}
              sizes="44px"
              width={44}
              height={44}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          </span>
          <span className="hidden text-[16px] font-bold leading-tight tracking-tight text-violet sm:block sm:text-[18px]">
            {t("header.brandName")}
          </span>
        </Link>

        {/* RIGHT, nav · search · separator · cart · account · CTA · hamburger */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Nav links (desktop only) */}
          <nav
            aria-label={t("header.primaryAria")}
            className="hidden items-center gap-1 lg:flex"
          >
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.nameKey}
                to={link.to}
                end={link.to === "/"}
                onMouseEnter={link.prefetch}
                onFocus={link.prefetch}
                className={({ isActive }) =>
                  `group relative inline-flex items-center rounded-md px-3 py-2 text-[15px] font-medium transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                    isActive
                      ? "text-violet"
                      : "text-charcoal-80/75 hover:text-violet"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {t(link.nameKey)}
                    <span
                      className={`pointer-events-none absolute bottom-1 left-3 right-3 h-[2px] origin-left rounded-full bg-violet transition-transform duration-300 ${
                        isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                      aria-hidden="true"
                    />
                  </>
                )}
              </NavLink>
            ))}

            {/* Search icon, last item in the nav, before the separator */}
            <SearchTrigger />
          </nav>

          {/* Vertical separator (desktop only) */}
          <span
            aria-hidden="true"
            className="hidden h-8 w-px bg-charcoal-80/15 lg:block"
          />

          {/* Cart */}
          <Link
            to="/cart"
            aria-label={
              cartCount
                ? `Cart · ${cartCount} item${cartCount === 1 ? "" : "s"}`
                : "Cart"
            }
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-80/75 transition hover:bg-violet/8 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <ShoppingCart
              className="h-[20px] w-[20px]"
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <CartBadge count={cartCount} />
          </Link>

          {/* Auth zone (desktop only) */}
          {loading ? (
            <div className="hidden h-9 w-9 animate-pulse rounded-full bg-charcoal-80/10 lg:block" />
          ) : isAuthenticated ? (
            <span className="hidden lg:inline-flex">
              <AccountMenu />
            </span>
          ) : (
            <Link
              to="/login"
              state={{ from: location.pathname + location.search }}
              className="hidden rounded-md px-2 py-1 text-[14px] font-semibold text-charcoal-80/80 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 lg:inline-flex"
            >
              {t("header.account")}
            </Link>
          )}

          {/* Primary CTA, {t("header.exploreStore")} (desktop only) */}
          <Link
            to="/store"
            className="hidden rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 lg:inline-flex"
          >
            <PrimaryButton className="!h-10 !px-5 !text-[14px]">
              {t("header.exploreStore")}
            </PrimaryButton>
          </Link>

          {/* Language switcher (desktop only) — compact globe dropdown at the
              far-right edge, after the primary CTA. */}
          <span className="hidden lg:inline-flex">
            <LanguageSwitcher variant="dropdown" />
          </span>

          {/* Hamburger (mobile) — Pattern 1 · Trigger morph.
              Tapping the hamburger morphs the three lines into an X by
              swapping Menu↔X icons via AnimatePresence with a 0.18s
              cross-fade + 90° rotation. Provides instant visual
              confirmation that the menu state changed. The button itself
              toggles between opening and closing the menu so users can
              tap-to-close from the same affordance they used to open. */}
          <button
            type="button"
            onClick={() => (mobileOpen ? closeMobileMenu("toggle") : openMobileMenu())}
            aria-label={mobileOpen ? t("header.closeMenu") : t("header.openMenu")}
            aria-expanded={mobileOpen}
            className="cursor-pointer relative inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-80/80 transition hover:bg-charcoal-80/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 lg:hidden"
          >
            <AnimatePresence initial={false} mode="wait">
              {mobileOpen ? (
                <m.span
                  key="close-icon"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <X className="h-5 w-5" />
                </m.span>
              ) : (
                <m.span
                  key="menu-icon"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Menu className="h-5 w-5" />
                </m.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Scroll progress strip */}
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-charcoal-80/0">
        <div
          className="h-full origin-left bg-violet transition-transform duration-150"
          style={{ transform: `scaleX(${scrollPct / 100})` }}
          aria-hidden="true"
        />
      </div>

      {/* MobileMenu receives the context-bound closer directly — so any
          dismiss reason (x_button, backdrop, esc, scroll, sign_out,
          route_change, nav_click, toggle) flows through to MenuContext
          for telemetry attribution. */}
      <MobileMenu open={mobileOpen} onClose={closeMobileMenu} />
    </header>
  )
}

// Exported Header — wraps HeaderInner in an ErrorBoundary so any crash
// inside the Header (Framer Motion runtime errors, auth-context exceptions,
// i18n missing-key errors, MobileMenu sub-component crashes) falls back
// to a minimal usable header instead of taking down the entire page.
//
// The fallback gives the user a clear brand link home + Sign in path,
// and ErrorBoundary's built-in Sentry capture means we still get the
// telemetry for the underlying failure.
export default function Header() {
  return (
    <ErrorBoundary fallback={<HeaderFallback />}>
      <HeaderInner />
    </ErrorBoundary>
  )
}
