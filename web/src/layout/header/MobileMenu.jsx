// ════════════════════════════════════════════════════════════════════════════
// layout/header/MobileMenu.jsx · full-height navigation drawer (< lg)
// ────────────────────────────────────────────────────────────────────────────
// Built on the canonical <Drawer>. This file keeps only what is specific to
// the menu: telemetry, scroll-to-close gestures, the staggered nav cascade,
// the 2-tap sign-out and the pinned footer CTAs.
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { m, useReducedMotion } from "framer-motion"
import {
  X,
  Search,
  ChevronRight,
  LayoutDashboard,
  ShoppingBag,
  UserCog,
  LogOut,
  Loader2,
} from "lucide-react"

import { Drawer } from "../../components/ui/Drawer"
import PrimaryButton from "../../ui/PrimaryButton"
import { useAuth } from "../../context/AuthContext"
import BrandLogo from "../../components/BrandLogo"
import LanguageSwitcher from "../../components/LanguageSwitcher"
import { trackEvent } from "../../lib/analytics"
import { NAV_LINKS } from "./navLinks"
import { UserAvatar, performSignOut } from "./AccountMenu"
import { openSearchPalette } from "./SearchTrigger"
import useSwipeToDismiss from "../../hooks/useSwipeToDismiss"

export default function MobileMenu({ open, onClose }) {
  const { t } = useTranslation("common")
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduce = useReducedMotion()
  const closeButtonRef = useRef(null)
  // Ref to the scrollable middle region. The wheel/touch listeners check
  // this to decide whether a scroll gesture should be handled INSIDE the
  // menu (let the inner region scroll normally) or should close the menu
  // and flow the scroll through to the page.
  const scrollRegionRef = useRef(null)

  const user = auth && auth.user
  const isAuthenticated = auth && auth.isAuthenticated

  // Sign-out state — two-tap confirmation + loading spinner.
  // signOutPhase: "idle" → "confirm" (first tap, awaiting confirm) → "loading" (committed)
  const [signOutPhase, setSignOutPhase] = useState("idle")

  // Telemetry · fire menu_open when the menu opens. One event per open
  // cycle (open=false → open=true transition), not per re-render.
  useEffect(() => {
    if (!open) return
    try { trackEvent("menu_open", { path: location.pathname }) } catch { /* analytics best-effort */ }
  }, [open, location.pathname])

  // Close on route change.
  useEffect(() => {
    if (open) onClose("route_change")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Body-scroll lock, focus trap (initial focus on the close button, restore
  // on close), Escape-to-close and the body portal are all owned by the
  // canonical <Drawer> (components/ui/Drawer) — see the render below.

  // Reset sign-out phase when menu closes — fresh state on next open.
  useEffect(() => {
    if (!open) setSignOutPhase("idle")
  }, [open])

  /* ──────────────────────────────────────────────────────────────────────
   * Gesture-driven dismiss
   * ────────────────────────────────────────────────────────────────────
   * WHEEL (pointer devices only, and this menu only renders < lg):
   *   The page behind is scroll-locked, so a wheel over the backdrop or
   *   over a non-scrollable part of the panel would do nothing and feel
   *   stuck. In that case we close and hand the delta to the page.
   *   A wheel inside the scrollable middle scrolls it normally.
   *
   * TOUCH: closing on a vertical swipe was removed deliberately.
   *   It made the menu unusable on phones in two ways:
   *     · when the nav list fits without overflow (the common case on
   *       taller phones) `regionCanScroll()` is false, so ANY 6px swipe
   *       closed the menu the moment the user tried to scan it;
   *     · the same touch that tapped the hamburger kept its identity —
   *       a few px of thumb travel after the tap fired touchmove and
   *       dismissed the freshly-opened menu, which reads as "the menu
   *       doesn't open".
   *   No mainstream navigation drawer closes on a vertical scroll.
   *   Vertical swipes now do what users expect (scroll the list), and
   *   dismissal is a horizontal swipe (below), the backdrop, X, or Esc.
   * ──────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return undefined

    // Helper · does the scrollable middle have internal overflow right now?
    function regionCanScroll() {
      const el = scrollRegionRef.current
      if (!el) return false
      return el.scrollHeight > el.clientHeight + 1
    }

    // Helper · is the wheel direction trying to scroll past the boundary?
    function atBoundaryAgainstWheel(deltaY) {
      const el = scrollRegionRef.current
      if (!el) return true
      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      return (deltaY < 0 && atTop) || (deltaY > 0 && atBottom)
    }

    // After we close the menu, the body's overflow lock is removed in the
    // cleanup of the lock effect. Wait one frame so the page is actually
    // scrollable, then apply the delta. `behavior: "instant"` overrides
    // the global `scroll-behavior: smooth` on <html> so the gesture
    // translates 1:1 to the page — feels like the menu was never there.
    function flowScrollToPage(deltaY) {
      requestAnimationFrame(() => {
        window.scrollBy({ top: deltaY, left: 0, behavior: "instant" })
      })
    }

    function handleWheel(e) {
      const target = e.target
      const inScroll = scrollRegionRef.current && scrollRegionRef.current.contains(target)
      if (inScroll && regionCanScroll() && !atBoundaryAgainstWheel(e.deltaY)) {
        // Let it scroll inside. No action.
        return
      }
      onClose("scroll")
      flowScrollToPage(e.deltaY)
    }

    // Still deferred: a trackpad's momentum from the scroll that preceded
    // the tap can otherwise land on the freshly-opened menu.
    let installTimer = null
    let installed = false
    function install() {
      document.addEventListener("wheel", handleWheel, { passive: true })
      installed = true
    }
    installTimer = window.setTimeout(install, 350)

    return () => {
      if (installTimer) window.clearTimeout(installTimer)
      if (installed) document.removeEventListener("wheel", handleWheel)
    }
  }, [open, onClose])

  /* Swipe-to-dismiss · the gesture users expect from a drawer. The panel
   * enters from the right, so a decisive rightward drag closes it. The
   * mechanics (horizontal-intent gate, panel-scoped passive listeners) live
   * in the shared hook, which the dashboard drawer uses too. */
  const panelRef = useRef(null)
  useSwipeToDismiss(panelRef, open, onClose)

  // Sign-out · 2-tap confirmation pattern + loading state.
  //
  // Tap 1 (phase: idle → confirm) — shows inline "Tap again to confirm"
  // hint, auto-resets after 4s if user doesn't follow through.
  // Tap 2 (phase: confirm → loading) — shows spinner, awaits API,
  // closes menu only AFTER auth state is cleared. Prevents the
  // "menu closes but user is still logged in" race where the next
  // page-load shows stale auth state.
  const signOutResetTimer = useRef(null)
  const handleSignOut = useCallback(async () => {
    if (signOutPhase === "idle") {
      setSignOutPhase("confirm")
      // Auto-reset after 4s so users who tapped accidentally aren't
      // stuck in the "confirm" state. 4s mirrors common "are you sure?"
      // confirmation timeouts in iOS / Material.
      if (signOutResetTimer.current) window.clearTimeout(signOutResetTimer.current)
      signOutResetTimer.current = window.setTimeout(() => {
        setSignOutPhase("idle")
      }, 4000)
      return
    }
    if (signOutPhase === "confirm") {
      setSignOutPhase("loading")
      if (signOutResetTimer.current) window.clearTimeout(signOutResetTimer.current)
      try {
        try { trackEvent("menu_sign_out", { confirmed: true }) } catch { /* best-effort */ }
        await performSignOut(auth, navigate)
        onClose("sign_out")
      } catch {
        // Surface failure by returning to confirm state — user can retry.
        setSignOutPhase("confirm")
      }
    }
  }, [signOutPhase, auth, navigate, onClose])

  // Cleanup the auto-reset timer on unmount to avoid orphaned state.
  useEffect(() => {
    return () => {
      if (signOutResetTimer.current) window.clearTimeout(signOutResetTimer.current)
    }
  }, [])

  // Telemetry helper for nav-item clicks. Wrapping NavLink onClick so
  // each tap fires `menu_nav_click` with the route as a property.
  const onNavClick = useCallback((to) => {
    try { trackEvent("menu_nav_click", { to }) } catch { /* best-effort */ }
    onClose("nav_click")
  }, [onClose])

  /* ──────────────────────────────────────────────────────────────────────
   * Premium-mobile-menu interaction model · 7 patterns from the
   * top-tier UX reference, adapted to a single React component:
   *
   *   1. Trigger morph        — hamburger ↔ X via AnimatePresence swap
   *      (lives in the main Header below, see the Menu/X block)
   *   2. Backdrop scrim + blur — charcoal/55 + backdrop-blur-md isolates
   *      the user's focus on the menu and signals the page is paused
   *   3. Staggered cascade    — nav items fade-up sequentially (50ms apart)
   *      guiding the eye top→bottom; loads feel organic, not abrupt
   *   4. Elastic slide        — cubic-bezier(0.25, 1, 0.5, 1) — starts
   *      rapidly, decelerates with a subtle settle; feels physical
   *   5. Accordion expansion  — n/a for this flat top-level menu
   *   6. Active-tab morph     — NavLink active state already morphs
   *      background to violet-pale + violet text
   *   7. Haptic feedback      — n/a in web context (iOS only via native)
   *
   * Reduced motion: every animation collapses to a 0-duration snap so
   * users with vestibular sensitivity see the same end state without
   * any movement — Framer's useReducedMotion drives this automatically.
   * ──────────────────────────────────────────────────────────────────── */

  // Animation variants. cubic-bezier(0.25, 1, 0.5, 1) — the "premium ease"
  // from the reference: starts fast, decelerates smoothly, settles softly.
  const PREMIUM_EASE = [0.25, 1, 0.5, 1]

  // Backdrop fade and panel slide are SYNCHED: 360ms entrance / 280ms exit
  // so they begin and finish in lockstep (a mismatch reads as a stutter on
  // slow devices). Reduced motion collapses both to a near-instant fade.
  //
  // The Drawer portals to document.body — the Header gets `backdrop-filter`
  // once scrolled, which per spec creates a new containing block for any
  // `position: fixed` descendant; portaling sidesteps that entirely. The
  // Drawer also splits the `fixed` wrapper from the `transform` node so
  // Safari/Chromium never mis-compute the panel height.
  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="none"
      bare
      zIndex={90}
      ariaLabel={t("header.siteNav")}
      initialFocusRef={closeButtonRef}
      panelRef={panelRef}
      wrapperClassName="lg:hidden"
      backdropClassName="bg-charcoal/55 backdrop-blur-md"
      className="sm:w-[88vw] sm:max-w-md bg-white shadow-[0_30px_80px_-20px_rgb(var(--color-charcoal-rgb)/0.45)]"
      transition={{ enter: 0.36, exit: 0.28, ease: PREMIUM_EASE }}
    >
        {/* Region 1 · pinned header (logo + close).
            Plain div now — region-level fade-up variants removed to
            guarantee content is always visible the moment the panel
            renders. The slide animation on the panel itself carries
            the premium motion. */}
        <div className="relative shrink-0 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Link to="/" onClick={() => onNavClick("/")} aria-label={t("header.homeAria")} className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-violet shadow-[0_10px_28px_-6px_rgb(var(--color-violet-rgb)/0.55)] ring-1 ring-violet/15">
                <BrandLogo variant="mark" theme="dark" size={22} />
                {/* Subtle live-pulse dot — communicates "site is live /
                    accepting work" at a glance. Sits just outside the
                    tile to avoid competing with the logo. */}
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span aria-hidden="true" className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-70" />
                  <span aria-hidden="true" className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint ring-2 ring-white" />
                </span>
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15.5px] font-bold leading-tight tracking-tight text-violet">
                  {t("header.brandName")}
                </span>
                <span className="truncate font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-charcoal-80/65">
                  {t("header.brandTagline", { defaultValue: "Complexity, simplified." })}
                </span>
              </span>
            </Link>
            <m.button
              ref={closeButtonRef}
              type="button"
              onClick={() => onClose("x_button")}
              aria-label={t("header.closeMenu")}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              transition={{ duration: 0.1 }}
              className="cursor-pointer inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-charcoal-80/10 bg-white text-charcoal-80/65 shadow-[0_2px_8px_-2px_rgb(var(--color-charcoal-rgb)/0.08)] transition-colors hover:border-rose/25 hover:bg-rose/5 hover:text-rose focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </m.button>
          </div>
          {/* Brand-seam — 2px Innovation gradient line, fades right.
              Sits just inside the bottom of the header card so the panel
              reads as having a "brand stripe" without a hard divider. */}
          <div aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-violet via-azure/60 to-transparent sm:inset-x-6" />
        </div>

        {/* Region 2 · scrollable middle (search + nav links).
            min-h-0 is mandatory for nested flex containers — without it
            flex-1 + overflow-y-auto inflates the parent on Firefox/Safari.
            The `ref` is consumed by the wheel/touch handlers (above) to
            decide whether a scroll gesture should scroll the menu
            internally or close the menu and flow through to the page. */}
        <div ref={scrollRegionRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Search trigger — looks like a real input field, behaves
              like a button. Opens the global SearchPalette via the
              `ukz:open-search` event. whileTap gives the press a
              tactile depress feel. */}
          <m.button
            type="button"
            onClick={() => {
              onClose()
              openSearchPalette()
            }}
            whileTap={reduce ? undefined : { scale: 0.985 }}
            transition={{ duration: 0.1 }}
            className="cursor-pointer group flex items-center gap-3 rounded-xl border border-charcoal-80/12 bg-charcoal-80/[0.03] px-3.5 py-3 text-left text-[14px] font-medium text-charcoal-80/65 transition-colors duration-200 hover:border-violet/30 hover:bg-violet-pale/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md bg-white shadow-[0_2px_6px_-2px_rgb(var(--color-charcoal-rgb)/0.10)] transition-colors group-hover:bg-violet-pale">
              <Search className="h-3.5 w-3.5 text-charcoal-80/65 transition-colors group-hover:text-violet" strokeWidth={2.2} />
            </span>
            <span className="flex-1 truncate">{t("header.searchPlaceholder")}</span>
            <kbd aria-hidden="true" className="hidden h-5 select-none items-center rounded border border-charcoal-80/12 bg-white px-1.5 font-mono text-[10px] font-bold text-charcoal-80/65 shadow-[0_1px_0_rgb(var(--color-charcoal-rgb)/0.04)] sm:inline-flex">
              ⌘K
            </kbd>
          </m.button>

          {/* Section eyebrow — frames the nav list and gives the cascade
              a visual anchor at the top of the scroll region. */}
          <div className="mt-1 flex items-center gap-2 px-1">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-charcoal-80/65">
              {t("header.navigateEyebrow", { defaultValue: "Navigate" })}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-charcoal-80/12 via-charcoal-80/8 to-transparent" />
          </div>

          {/* Nav · icon-led list with motion-shared active indicator + per-
              item cascade. Each row carries its Lucide icon, a label, and
              an end-aligned chevron that visualizes "drills into a route".
              Active row gets a 3px violet bar on the left whose `layoutId`
              tells Framer to morph it between rows on route change — that
              produces the silky "active marker glides between items"
              effect users expect from premium navigation. */}
          <m.nav
            aria-label={t("header.primaryMobile")}
            className="flex flex-col gap-0.5"
            variants={{
              open:   { transition: { staggerChildren: reduce ? 0 : 0.035, delayChildren: reduce ? 0 : 0.04 } },
              closed: { transition: { staggerChildren: 0 } },
            }}
            initial="closed"
            animate="open"
            exit="closed"
          >
            {NAV_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <m.div
                  key={link.nameKey}
                  variants={{
                    open:   { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.32, ease: PREMIUM_EASE } },
                    closed: { opacity: 0, x: reduce ? 0 : 12 },
                  }}
                  whileTap={reduce ? undefined : { scale: 0.985 }}
                  transition={{ duration: 0.12 }}
                  className="relative"
                >
                  <NavLink
                    to={link.to}
                    end={link.to === "/"}
                    onClick={() => onNavClick(link.to)}
                    onMouseEnter={link.prefetch}
                    onFocus={link.prefetch}
                    className={({ isActive }) =>
                      `group relative flex min-h-[48px] items-center gap-3 overflow-hidden rounded-xl pl-4 pr-3 py-2.5 text-[15px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1 ${
                        isActive
                          ? "bg-violet-pale text-violet"
                          : "text-charcoal-80/85 hover:bg-violet-pale/45 hover:text-violet"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active indicator · motion.shared layoutId.
                            When the route changes, Framer animates this
                            element from the OLD active row's position to
                            the NEW active row's position — silky morph. */}
                        {isActive && !reduce ? (
                          <m.span
                            layoutId="mobile-nav-active-bar"
                            aria-hidden="true"
                            className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-violet"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        ) : isActive ? (
                          <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-violet" />
                        ) : null}

                        {/* Icon · tinted to match the row state. Inactive
                            rows use a low-opacity violet so the glyph
                            reads as supporting texture; active rows use
                            full violet to match the label. */}
                        <span
                          aria-hidden="true"
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
                            isActive
                              ? "bg-white text-violet shadow-[0_2px_8px_-2px_rgb(var(--color-violet-rgb)/0.25)]"
                              : "bg-violet-pale/50 text-violet/70 group-hover:bg-white group-hover:text-violet"
                          }`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </span>

                        <span className="flex-1 truncate">{t(link.nameKey)}</span>

                        {/* Trailing chevron · subtle drill-in cue.
                            Slides 2px to the right on hover for tactile
                            "this opens a page" feedback. */}
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-all duration-200 ${
                            isActive
                              ? "translate-x-0 text-violet/60"
                              : "text-charcoal-80/35 group-hover:translate-x-0.5 group-hover:text-violet/60"
                          }`}
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </NavLink>
                </m.div>
              )
            })}
          </m.nav>

          {/* Authenticated user summary lives in the scroll region so the
              footer CTAs stay tight even with a long display name.
              ────────────────────────────────────────────────────────
              Sign-out UX upgrade — 2-tap confirmation + loading state:
              · Tap 1 (idle → confirm): rose pill expands to show
                "Tap again to sign out" — visible commitment cue
              · Tap 2 (confirm → loading): spinner appears, API runs,
                menu closes only AFTER auth state is cleared (no race)
              · 4s auto-reset returns to idle if user wanders away
              Prevents accidental sign-outs on shared devices and the
              "menu closed but session not actually cleared" race. */}
          {isAuthenticated ? (
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-violet/10 bg-violet-pale/60 p-3">
              <UserAvatar user={user} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-charcoal">
                  {(user && user.fullName) || "Member"}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11.5px] text-charcoal-80/65">
                  {user && user.email}
                </p>
              </div>

              {signOutPhase === "idle" ? (
                <m.button
                  type="button"
                  onClick={handleSignOut}
                  aria-label={t("header.signOut")}
                  title={t("header.signOut")}
                  whileTap={reduce ? undefined : { scale: 0.92 }}
                  transition={{ duration: 0.1 }}
                  className="cursor-pointer inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose/20 bg-white text-rose transition-colors hover:border-rose/40 hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30 focus-visible:ring-offset-2"
                >
                  <LogOut className="h-4 w-4" />
                </m.button>
              ) : (
                <m.button
                  type="button"
                  onClick={handleSignOut}
                  aria-label={signOutPhase === "loading" ? t("header.signingOut", { defaultValue: "Signing out…" }) : t("header.signOutConfirm", { defaultValue: "Tap to confirm sign out" })}
                  disabled={signOutPhase === "loading"}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={reduce || signOutPhase === "loading" ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.16, ease: PREMIUM_EASE }}
                  className="cursor-pointer inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-rose bg-rose px-3 text-[12px] font-semibold text-white shadow-[0_4px_12px_-2px_rgb(var(--color-rose-rgb)/0.35)] transition-colors hover:bg-rose-700 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30 focus-visible:ring-offset-2"
                >
                  {signOutPhase === "loading" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{t("header.signingOut", { defaultValue: "Signing out…" })}</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="h-3.5 w-3.5" />
                      <span>{t("header.confirmSignOut", { defaultValue: "Tap to confirm" })}</span>
                    </>
                  )}
                </m.button>
              )}
            </div>
          ) : null}
        </div>

        {/* Region 3 · pinned footer · ALWAYS visible.
            • Account/Dashboard + sign-out (or Account link for guests)
            • Explore Store CTA (Innovation Gradient, brand-anchor conversion)
            • Language switcher
            paddingBottom uses env(safe-area-inset-bottom) so the home-indicator
            on iOS does not cover the CTAs. */}
        <div
          className="relative shrink-0 border-t border-charcoal-80/8 bg-white px-5 pt-4 sm:px-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
        >
          {/* Brand-seam mirror — same Innovation-gradient line as the top
              header, fading from azure → violet → transparent (reversed)
              so the panel feels bookended. */}
          <div aria-hidden="true" className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-azure/60 to-violet sm:inset-x-6" />

          {/* Footer always = 3 buttons (Account · Explore Store · Languages).
              Shape stays constant across auth states — the only difference
              is the Account button's label + destination (login when out,
              dashboard when in). Sign-out moved into the profile card
              above so it's still discoverable without competing for
              footer real estate. */}
          <div className="flex flex-col gap-2.5">
            {/* 1 · Account / Dashboard */}
            <m.div whileTap={reduce ? undefined : { scale: 0.985 }} transition={{ duration: 0.1 }}>
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                onClick={() => onNavClick(isAuthenticated ? "/dashboard" : "/login")}
                className="group inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-charcoal-80/10 bg-white px-4 py-2.5 text-[14px] font-semibold text-charcoal-80/85 shadow-[0_2px_8px_-2px_rgb(var(--color-charcoal-rgb)/0.06)] transition-all hover:border-violet/30 hover:bg-violet-pale/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                {isAuthenticated ? (
                  <LayoutDashboard className="h-4 w-4 transition-transform group-hover:scale-105" />
                ) : (
                  <UserCog className="h-4 w-4 transition-transform group-hover:scale-105" />
                )}
                {isAuthenticated ? t("header.openDashboard") : t("header.account")}
              </Link>
            </m.div>

            {/* 2 · Explore Store · Innovation Gradient (sole conversion CTA) */}
            <m.div whileTap={reduce ? undefined : { scale: 0.985 }} transition={{ duration: 0.1 }}>
              <Link
                to="/store"
                onClick={() => onNavClick("/store")}
                className="inline-flex w-full rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <PrimaryButton className="w-full !min-h-[48px] !text-[14px]">
                  <ShoppingBag className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t("header.exploreStore")}
                </PrimaryButton>
              </Link>
            </m.div>

            {/* 3 · Languages */}
            <div className="mt-1 flex items-center justify-center pt-1">
              <LanguageSwitcher variant="text" />
            </div>
          </div>
        </div>
    </Drawer>
  )
}
