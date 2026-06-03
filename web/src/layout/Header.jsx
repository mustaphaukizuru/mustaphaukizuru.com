import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  Menu,
  X,
  ShoppingCart,
  Search,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  ShoppingBag,
  UserCog,
  LogOut,
  Shield,
  Heart,
  Home as HomeIcon,
  User,
  Layers,
  Briefcase,
  Mail,
} from "lucide-react"

import PrimaryButton from "../ui/PrimaryButton"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { useMenu } from "../context/MenuContext"
import { API_BASE_URL } from "../lib/api"
import profilePhoto from "../assets/avatar/avatar-master.png"
import BrandLogo from "../components/BrandLogo"
import LanguageSwitcher from "../components/LanguageSwitcher"
import useFocusTrap from "../hooks/useFocusTrap"
import useBodyScrollLock from "../hooks/useBodyScrollLock"
import { trackEvent } from "../lib/analytics"
import ErrorBoundary from "../components/ErrorBoundary"
import { Loader2 } from "lucide-react"

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

/* Primary navbar links — kept short and audience-facing. Editorial
 * surfaces (Blog, Recommendations) live in the Footer instead, so the
 * header stays focused on what visitors hire Mustapha for.
 *
 * Each link carries a Lucide icon — used by the mobile menu cascade
 * so visitors scan by glyph rather than reading every label. Desktop
 * navbar still renders text-only since the row is dense enough that
 * additional icons add noise instead of clarity. */
const NAV_LINKS = [
  { nameKey: "header.home",      to: "/",          icon: HomeIcon },
  { nameKey: "header.about",     to: "/about",     icon: User,
    prefetch: () => import("../pages/AboutPage") },
  { nameKey: "header.solutions", to: "/solutions", icon: Layers,
    prefetch: () => import("../pages/SolutionsPage") },
  { nameKey: "header.services",  to: "/services",  icon: Briefcase,
    prefetch: () => import("../pages/ServicesPage") },
  { nameKey: "header.contact",   to: "/contact",   icon: Mail,
    prefetch: () => import("../pages/ContactPage") },
]

const USER_MENU_ITEMS = [
  { nameKey: "header.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { nameKey: "header.myOrders", to: "/dashboard/orders", icon: ShoppingBag },
  { nameKey: "header.downloads", to: "/dashboard/downloads", icon: ShoppingBag },
  { nameKey: "header.wishlist", to: "/dashboard/wishlist", icon: Heart },
  { nameKey: "header.profile", to: "/dashboard/profile", icon: UserCog },
]

/* ─────────────────────────── helpers ────────────────────────────────────── */

function resolveAvatar(url) {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function isMac() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.platform || navigator.userAgent || ""
  return /Mac|iPhone|iPad|iPod/i.test(ua)
}

function openSearchPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ukz:open-search"))
  }
}

/**
 * Defensively perform a sign out — calls AuthContext.logout if it exists,
 * then redirects to home. Survives older AuthContext shapes that may
 * have used a different function name.
 */
async function performSignOut(authValue, navigate) {
  try {
    if (authValue && typeof authValue.logout === "function") {
      await authValue.logout()
    } else if (authValue && typeof authValue.signOut === "function") {
      await authValue.signOut()
    } else {
      // Fallback: clear local storage + dispatch the cleared event so any
      // listener (e.g. CartProvider, dashboard guards) can react.
      try { localStorage.removeItem("auth-token") } catch { /* ignore */ }
      try { localStorage.removeItem("auth-user") } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("auth:cleared"))
    }
  } catch {
    // Even if the server call fails, force-clear locally so the UI
    // doesn't claim the user is still signed in.
    try { localStorage.removeItem("auth-token") } catch { /* ignore */ }
    try { localStorage.removeItem("auth-user") } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("auth:cleared"))
  } finally {
    if (typeof navigate === "function") navigate("/")
  }
}

/* ─────────────────────────── components ─────────────────────────────────── */

function UserAvatar({ user, size = 36 }) {
  const src = resolveAvatar(user && user.avatarUrl)
  const initials = ((user && user.fullName) || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet/15 bg-white"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={(user && user.fullName) || "Member"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-mono text-[12px] font-bold text-violet">
          {initials}
        </span>
      )}
    </div>
  )
}

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

/* Search icon button — opens the global SearchPalette modal. */
function SearchIconButton() {
  const shortcut = isMac() ? "⌘K" : "Ctrl K"
  const aria = `Search · ${shortcut}`
  return (
    <button
      type="button"
      onClick={openSearchPalette}
      aria-label={aria}
      title={aria}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-80/75 transition hover:bg-violet/8 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
    >
      <Search className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

function UserMenu() {
  const { t } = useTranslation("common")
  const auth = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()

  const user = auth && auth.user

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await performSignOut(auth, navigate)
  }

  const isAdmin = user && user.role === "admin"
  const items = isAdmin
    ? [{ nameKey: "header.adminPanel", to: "/admin", icon: Shield, accent: true }, ...USER_MENU_ITEMS]
    : USER_MENU_ITEMS

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition hover:bg-violet/6 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
      >
        <UserAvatar user={user} size={36} />
        <ChevronDown
          className={`h-3.5 w-3.5 text-charcoal-80/55 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] origin-top-right overflow-hidden rounded-2xl border border-charcoal-80/8 bg-white shadow-[0_20px_60px_-12px_rgba(93,63,211,0.20),0_0_0_1px_rgba(93,63,211,0.04)]"
        >
          <div className="bg-gradient-to-br from-violet-pale to-white p-4">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-charcoal">
                  {(user && user.fullName) || "Member"}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-charcoal-80/60">
                  {user && user.email}
                </p>
              </div>
            </div>
            {user && user.role ? (
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-violet/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-violet">
                <span className="h-1.5 w-1.5 rounded-full bg-violet/60" />
                {user.role}
              </span>
            ) : null}
          </div>

          <ul className="p-1.5">
            {items.map((item) => {
              const Icon = item.icon
              const itemClass = item.accent
                ? "bg-violet/8 text-violet hover:bg-violet/12"
                : "text-charcoal-80/85 hover:bg-violet-pale/50 hover:text-violet"
              return (
                <li key={item.nameKey}>
                  <Link
                    to={item.to}
                    role="menuitem"
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition ${itemClass}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                    {t(item.nameKey)}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-charcoal-80/6 p-1.5">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium text-rose transition hover:bg-rose/8"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {t("header.signOut")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MobileMenu({ open, onClose }) {
  const { t } = useTranslation("common")
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduce = useReducedMotion()
  const closeButtonRef = useRef(null)
  const panelRef = useRef(null)
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

  // Body-scroll lock via shared hook (ref-counted, handles both html + body).
  useBodyScrollLock(open)

  // Focus trap — Tab/Shift+Tab cycles within the panel, restores focus on close.
  // WCAG 2.1 §2.4.3 compliance.
  useFocusTrap(panelRef, open, { initialFocusRef: closeButtonRef })

  // Esc-to-close (the focus trap handles Tab/Shift+Tab; Esc is separate).
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === "Escape") onClose("esc") }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Reset sign-out phase when menu closes — fresh state on next open.
  useEffect(() => {
    if (!open) setSignOutPhase("idle")
  }, [open])

  /* ──────────────────────────────────────────────────────────────────────
   * Gesture-driven dismiss · "scroll-to-close" pattern
   * ────────────────────────────────────────────────────────────────────
   * When the menu is open and the user tries to scroll, we have three
   * cases to handle:
   *
   *   A. Wheel/touch happens INSIDE the scrollable middle, and the
   *      middle has internal overflow → let it scroll normally.
   *
   *   B. Wheel/touch happens INSIDE the scrollable middle, but the
   *      middle has no overflow (content fits) OR the user is at the
   *      top/bottom boundary and wheel direction wants to continue
   *      past → close the menu and apply the wheel delta to the page
   *      so the gesture flows through smoothly.
   *
   *   C. Wheel/touch happens OUTSIDE the scrollable middle (backdrop,
   *      pinned header, pinned footer) → close the menu and apply the
   *      wheel delta to the page.
   *
   * Touch handling tracks touchstart's Y, then on touchmove computes
   * the delta. A > 6px vertical drag is treated as a scroll intent.
   * (6px chosen empirically — accidental finger jitter sits under 4px;
   * intentional scroll starts at ~10px.)
   *
   * Why this matters: the alternative (keep body locked) makes the
   * menu feel "stuck" — users wheel/swipe and nothing happens, then
   * have to find and tap the X or backdrop. Scroll-to-close turns the
   * natural scroll gesture into a dismissal action, mirroring how
   * top-tier iOS/Android navigation drawers behave.
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
        // Case A — let it scroll inside. No action.
        return
      }
      // Cases B + C — close + propagate.
      onClose("scroll")
      flowScrollToPage(e.deltaY)
    }

    // Touch tracking · reset on every touchstart so each gesture is
    // measured independently. We only care about the cumulative deltaY
    // from touchstart to the first significant touchmove.
    let touchStartY = null
    let touchStartTarget = null
    function handleTouchStart(e) {
      if (e.touches.length !== 1) return
      touchStartY = e.touches[0].clientY
      touchStartTarget = e.target
    }
    function handleTouchMove(e) {
      if (touchStartY == null) return
      const deltaY = touchStartY - e.touches[0].clientY  // positive = swipe up = scroll down
      if (Math.abs(deltaY) < 6) return                   // ignore jitter
      const inScroll = scrollRegionRef.current && scrollRegionRef.current.contains(touchStartTarget)
      if (inScroll && regionCanScroll() && !atBoundaryAgainstWheel(deltaY)) {
        return  // let the inner region's native touch-scroll do its job
      }
      // Close + flow. Reset so we don't double-fire.
      touchStartY = null
      onClose("scroll")
      flowScrollToPage(deltaY)
    }

    // Critical timing fix: defer listener installation by 350ms.
    // Without this, the very touch/tap that OPENED the menu (the tap on
    // the hamburger button) registers as touchstart, then if the user's
    // finger moves even 6px (common on phones), touchmove fires and the
    // brand-new menu auto-closes. The 350ms window covers the touch's
    // natural finger-lift + the menu's slide-in animation (280-360ms),
    // ensuring scroll-to-close only catches DELIBERATE post-open gestures.
    let installTimer = null
    let installed = false
    function install() {
      document.addEventListener("wheel", handleWheel, { passive: true })
      document.addEventListener("touchstart", handleTouchStart, { passive: true })
      document.addEventListener("touchmove", handleTouchMove, { passive: true })
      installed = true
    }
    installTimer = window.setTimeout(install, 350)

    return () => {
      if (installTimer) window.clearTimeout(installTimer)
      if (installed) {
        document.removeEventListener("wheel", handleWheel)
        document.removeEventListener("touchstart", handleTouchStart)
        document.removeEventListener("touchmove", handleTouchMove)
      }
    }
  }, [open, onClose])

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

  // Animation timing — backdrop fade and panel slide are now SYNCHED.
  // Both use 360ms entrance / 280ms exit so they begin and finish in
  // lockstep. The previous mismatch (backdrop 280ms / panel 360ms) made
  // the scrim "lag" behind the slide by 80ms — perceptible as a stutter
  // on slow devices. Matching durations lock the two surfaces together
  // into a single perceived motion event.
  const backdropVariants = {
    open:   { opacity: 1, transition: { duration: reduce ? 0 : 0.36, ease: "linear" } },
    closed: { opacity: 0, transition: { duration: reduce ? 0 : 0.28, ease: "linear" } },
  }

  // Simplified panel slide — no parent-level staggerChildren, no
  // delayChildren, no `when` orchestration. Children are ALWAYS visible
  // the moment the panel renders; the slide animation alone carries the
  // premium feel without risking invisible content.
  const panelVariants = {
    open:   { x: 0,        transition: { duration: reduce ? 0 : 0.36, ease: PREMIUM_EASE } },
    closed: { x: "100%",   transition: { duration: reduce ? 0 : 0.28, ease: PREMIUM_EASE } },
  }

  // ─── Portal render · CRITICAL ───────────────────────────────────────────
  // The menu MUST be portaled to document.body. The Header element itself
  // gets `backdrop-filter: blur(...)` applied once the user scrolls past
  // 30px (the "frosted glass" sticky bar). Per CSS spec, `backdrop-filter`
  // creates a NEW CONTAINING BLOCK for any `position: fixed` descendant —
  // so without a portal, the menu wrapper's `position: fixed; inset: 0`
  // resolves to the *Header's* bounding box (a tiny strip at the top)
  // instead of the viewport. Result: tapping the hamburger on a scrolled
  // page makes the menu "open" only inside the header strip, looking
  // broken (header content vanishes, menu invisible to the user, page
  // content unaffected). Portaling to document.body bypasses the entire
  // ancestor chain, so the fixed positioning always resolves to viewport.
  //
  // Other CSS properties that would have the same effect: transform,
  // filter, perspective, contain (paint/layout/strict), will-change of
  // any of those. Portaling defends against all of them at once.
  // ────────────────────────────────────────────────────────────────────────
  if (typeof document === "undefined") return null
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop · Pattern 2 — own `position: fixed` so it covers
              the entire viewport regardless of any parent's stacking
              context, containing block, or transform. Independent
              motion element so it animates its own opacity without
              being nested inside the panel's coordinate system. */}
          <motion.div
            key="mobile-menu-backdrop"
            variants={backdropVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={() => onClose("backdrop")}
            aria-hidden="true"
            className="fixed inset-0 z-[90] bg-charcoal/55 backdrop-blur-md lg:hidden"
          />

          {/* Panel positioning wrapper · separates the FIXED concern from
              the TRANSFORM concern. When `position: fixed` and `transform`
              live on the same element, some browsers (Safari quirks,
              Chromium with willChange) compute the height inconsistently
              — sometimes ignoring `top+bottom` and falling back to
              content-height. That's the root cause of the
              "Account/Explore Store/Language missing" report: the panel
              was content-height, not viewport-height, so the footer
              region sat BELOW the visible viewport.

              Fix: the outer non-motion div handles `position: fixed` +
              viewport-anchored dimensions (top:0, right:0, bottom:0).
              The inner motion.aside handles only the slide via transform,
              with `h-full w-full` to fill the wrapper. The transform on
              motion.aside no longer affects its own dimensions because
              dimensions are inherited from the unmoving wrapper. */}
          <div
            key="mobile-menu-panel-wrapper"
            className="fixed top-0 right-0 bottom-0 z-[91] flex w-full sm:w-[88vw] sm:max-w-md lg:hidden"
            style={{
              pointerEvents: "none",
              // Explicit dynamic-viewport-height fallback. The browser's
              // computed height from top:0 + bottom:0 SHOULD equal viewport
              // height, but some Safari + Chromium combinations under
              // willChange/transform pressure mis-calculate it. Setting
              // height explicitly via dvh (with vh fallback for legacy
              // browsers) makes the panel dimensions immune to that.
              height: "100dvh",
              maxHeight: "100dvh",
            }}
          >
            <motion.aside
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={t("header.siteNav")}
              variants={panelVariants}
              initial="closed"
              animate="open"
              exit="closed"
              style={{
                pointerEvents: "auto",
                // Belt-and-suspenders: explicit 100% height since the
                // wrapper above is now explicitly height-100dvh. With
                // the wrapper as the height source of truth, the aside's
                // h-full reliably resolves regardless of flex behavior.
                height: "100%",
              }}
              className="flex w-full flex-col overflow-hidden bg-white shadow-[0_30px_80px_-20px_rgba(26,27,35,0.45)]"
            >
        {/* Region 1 · pinned header (logo + close).
            Plain div now — region-level fade-up variants removed to
            guarantee content is always visible the moment the panel
            renders. The slide animation on the panel itself carries
            the premium motion. */}
        <div className="relative shrink-0 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Link to="/" onClick={() => onNavClick("/")} aria-label={t("header.homeAria")} className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-violet shadow-[0_10px_28px_-6px_rgba(93,63,211,0.55)] ring-1 ring-violet/15">
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
                <span className="truncate font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-charcoal-80/55">
                  {t("header.brandTagline", { defaultValue: "Complexity, simplified." })}
                </span>
              </span>
            </Link>
            <motion.button
              ref={closeButtonRef}
              type="button"
              onClick={() => onClose("x_button")}
              aria-label={t("header.closeMenu")}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              transition={{ duration: 0.1 }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-charcoal-80/10 bg-white text-charcoal-80/65 shadow-[0_2px_8px_-2px_rgba(26,27,35,0.08)] transition-colors hover:border-rose/25 hover:bg-rose/5 hover:text-rose focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </motion.button>
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
          <motion.button
            type="button"
            onClick={() => {
              onClose()
              openSearchPalette()
            }}
            whileTap={reduce ? undefined : { scale: 0.985 }}
            transition={{ duration: 0.1 }}
            className="group flex items-center gap-3 rounded-xl border border-charcoal-80/12 bg-charcoal-80/[0.03] px-3.5 py-3 text-left text-[14px] font-medium text-charcoal-80/65 transition-colors duration-200 hover:border-violet/30 hover:bg-violet-pale/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md bg-white shadow-[0_2px_6px_-2px_rgba(26,27,35,0.10)] transition-colors group-hover:bg-violet-pale">
              <Search className="h-3.5 w-3.5 text-charcoal-80/55 transition-colors group-hover:text-violet" strokeWidth={2.2} />
            </span>
            <span className="flex-1 truncate">{t("header.searchPlaceholder")}</span>
            <kbd aria-hidden="true" className="hidden h-5 select-none items-center rounded border border-charcoal-80/12 bg-white px-1.5 font-mono text-[10px] font-bold text-charcoal-80/55 shadow-[0_1px_0_rgba(26,27,35,0.04)] sm:inline-flex">
              ⌘K
            </kbd>
          </motion.button>

          {/* Section eyebrow — frames the nav list and gives the cascade
              a visual anchor at the top of the scroll region. */}
          <div className="mt-1 flex items-center gap-2 px-1">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-charcoal-80/45">
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
          <motion.nav
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
                <motion.div
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
                          <motion.span
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
                              ? "bg-white text-violet shadow-[0_2px_8px_-2px_rgba(93,63,211,0.25)]"
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
                </motion.div>
              )
            })}
          </motion.nav>

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
                <p className="mt-0.5 truncate font-mono text-[11.5px] text-charcoal-80/60">
                  {user && user.email}
                </p>
              </div>

              {signOutPhase === "idle" ? (
                <motion.button
                  type="button"
                  onClick={handleSignOut}
                  aria-label={t("header.signOut")}
                  title={t("header.signOut")}
                  whileTap={reduce ? undefined : { scale: 0.92 }}
                  transition={{ duration: 0.1 }}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose/20 bg-white text-rose transition-colors hover:border-rose/40 hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30 focus-visible:ring-offset-2"
                >
                  <LogOut className="h-4 w-4" />
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleSignOut}
                  aria-label={signOutPhase === "loading" ? t("header.signingOut", { defaultValue: "Signing out…" }) : t("header.signOutConfirm", { defaultValue: "Tap to confirm sign out" })}
                  disabled={signOutPhase === "loading"}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={reduce || signOutPhase === "loading" ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.16, ease: PREMIUM_EASE }}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-rose bg-rose px-3 text-[12px] font-semibold text-white shadow-[0_4px_12px_-2px_rgba(225,29,72,0.35)] transition-colors hover:bg-rose-700 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30 focus-visible:ring-offset-2"
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
                </motion.button>
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
            <motion.div whileTap={reduce ? undefined : { scale: 0.985 }} transition={{ duration: 0.1 }}>
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                onClick={() => onNavClick(isAuthenticated ? "/dashboard" : "/login")}
                className="group inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-charcoal-80/10 bg-white px-4 py-2.5 text-[14px] font-semibold text-charcoal-80/85 shadow-[0_2px_8px_-2px_rgba(26,27,35,0.06)] transition-all hover:border-violet/30 hover:bg-violet-pale/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                {isAuthenticated ? (
                  <LayoutDashboard className="h-4 w-4 transition-transform group-hover:scale-105" />
                ) : (
                  <UserCog className="h-4 w-4 transition-transform group-hover:scale-105" />
                )}
                {isAuthenticated ? t("header.openDashboard") : t("header.account")}
              </Link>
            </motion.div>

            {/* 2 · Explore Store · Innovation Gradient (sole conversion CTA) */}
            <motion.div whileTap={reduce ? undefined : { scale: 0.985 }} transition={{ duration: 0.1 }}>
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
            </motion.div>

            {/* 3 · Languages */}
            <div className="mt-1 flex items-center justify-center pt-1">
              <LanguageSwitcher variant="text" />
            </div>
          </div>
        </div>
      </motion.aside>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
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
    <header role="banner" className="sticky top-0 z-[80] bg-white shadow-[0_1px_0_rgba(26,27,35,0.06)]">
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
  const { mobileOpen, openMobileMenu, closeMobileMenu, toggleMobileMenu } = useMenu()

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
    ? "bg-white/85 backdrop-blur-md shadow-[0_1px_0_rgba(26,27,35,0.06)]"
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
            <img
              src={profilePhoto}
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
            <SearchIconButton />
          </nav>

          {/* Vertical separator (desktop only) */}
          <span
            aria-hidden="true"
            className="hidden h-8 w-px bg-charcoal-80/15 lg:block"
          />

          {/* Language switcher (desktop only) */}
          <span className="hidden lg:inline-flex">
            <LanguageSwitcher />
          </span>

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
              <UserMenu />
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
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-80/80 transition hover:bg-charcoal-80/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 lg:hidden"
          >
            <AnimatePresence initial={false} mode="wait">
              {mobileOpen ? (
                <motion.span
                  key="close-icon"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <X className="h-5 w-5" />
                </motion.span>
              ) : (
                <motion.span
                  key="menu-icon"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Menu className="h-5 w-5" />
                </motion.span>
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
