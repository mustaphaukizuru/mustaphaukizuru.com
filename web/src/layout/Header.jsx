import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"
import {
  Menu,
  X,
  ShoppingCart,
  Search,
  ChevronDown,
  LayoutDashboard,
  ShoppingBag,
  UserCog,
  LogOut,
  Shield,
  Heart,
} from "lucide-react"

import PrimaryButton from "../ui/PrimaryButton"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"
import profilePhoto from "../assets/avatar/avatar-master.png"
import BrandLogo from "../components/BrandLogo"
import LanguageSwitcher from "../components/LanguageSwitcher"

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
 * header stays focused on what visitors hire Mustapha for. */
const NAV_LINKS = [
  { nameKey: "header.home", to: "/" },
  { nameKey: "header.about", to: "/about" },
  { nameKey: "header.solutions", to: "/solutions" },
  { nameKey: "header.services", to: "/services" },
  { nameKey: "header.contact", to: "/contact" },
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

  const user = auth && auth.user
  const isAuthenticated = auth && auth.isAuthenticated

  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  async function handleSignOut() {
    onClose()
    await performSignOut(auth, navigate)
  }

  const backdropClass = open ? "opacity-100" : "pointer-events-none opacity-0"
  const panelClass = open ? "translate-x-0" : "translate-x-full"

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-charcoal/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${backdropClass}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("header.siteNav")}
        className={`fixed inset-0 z-[70] flex h-full w-full flex-col gap-6 overflow-y-auto overflow-x-hidden bg-white p-6 shadow-2xl transition-transform duration-300 sm:right-0 sm:top-0 sm:left-auto sm:w-[88vw] sm:max-w-md lg:hidden ${panelClass}`}
      >
        <div className="flex items-center justify-between">
          {/* Mark + name — the wordmark squashes at this size, so we render
              the official M-mark in a violet tile and follow it with the
              brand name as crisp display type. */}
          <Link to="/" onClick={onClose} aria-label={t("header.homeAria")} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet shadow-[0_8px_24px_-6px_rgba(93,63,211,0.45)] ring-1 ring-violet/15">
              <BrandLogo variant="mark" theme="dark" size={20} />
            </span>
            <span className="text-[15px] font-bold leading-tight tracking-tight text-violet">
              {t("header.brandName")}
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("header.closeMenu")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal-80/70 transition hover:bg-charcoal-80/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose()
            openSearchPalette()
          }}
          className="flex items-center gap-3 rounded-xl border border-charcoal-80/10 bg-charcoal-80/[0.03] px-3 py-3 text-left text-[14px] font-medium text-charcoal-80/65 transition hover:border-violet/30 hover:bg-violet-pale/40 hover:text-violet"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t("header.searchPlaceholder")}
        </button>

        <nav aria-label={t("header.primaryMobile")} className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.nameKey}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold transition ${
                  isActive
                    ? "bg-violet-pale text-violet"
                    : "text-charcoal-80/80 hover:bg-violet-pale/50 hover:text-violet"
                }`
              }
            >
              {t(link.nameKey)}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 rounded-2xl bg-violet-pale/60 p-3">
                <UserAvatar user={user} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-charcoal">
                    {(user && user.fullName) || "Member"}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-charcoal-80/60">
                    {user && user.email}
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-charcoal-80/5 px-4 py-2.5 text-[13.5px] font-semibold text-charcoal-80/85 hover:bg-charcoal-80/10"
              >
                <LayoutDashboard className="h-4 w-4" />
                {t("header.openDashboard")}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-rose/25 bg-rose/5 px-4 py-2.5 text-[13.5px] font-semibold text-rose transition hover:bg-rose/10"
              >
                <LogOut className="h-4 w-4" />
                {t("header.signOut")}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full bg-charcoal-80/5 px-4 py-2.5 text-[13.5px] font-semibold text-charcoal-80/85 hover:bg-charcoal-80/10"
            >
              {t("header.account")}
            </Link>
          )}

          <Link to="/store" className="inline-flex items-center justify-center rounded-full">
            <PrimaryButton className="w-full">{t("header.exploreStore")}</PrimaryButton>
          </Link>

          {/* Language switcher (mobile) */}
          <div className="mt-2 flex items-center justify-center border-t border-charcoal-80/8 pt-4">
            <LanguageSwitcher variant="text" />
          </div>
        </div>
      </aside>
    </>
  )
}

/* ─────────────────────────── main Header ────────────────────────────────── */

export default function Header() {
  const { t } = useTranslation("common")
  const { isAuthenticated, loading } = useAuth()
  const { cartCount } = useCart()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)

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

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const headerClass = scrolled
    ? "bg-white/85 backdrop-blur-md shadow-[0_1px_0_rgba(26,27,35,0.06)]"
    : "bg-white/0 backdrop-blur-0"

  return (
    <header
      role="banner"
      className={`sticky top-0 z-50 transition-all duration-300 ${headerClass}`}
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

          {/* Hamburger (mobile) */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("header.openMenu")}
            aria-expanded={mobileOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-80/80 transition hover:bg-charcoal-80/5 lg:hidden"
          >
            <Menu className="h-5 w-5" />
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

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  )
}
