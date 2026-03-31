import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Menu, X, ShoppingCart, ChevronRight, LayoutDashboard, ShoppingBag, User, LogOut, Shield } from "lucide-react"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import UserMenu from "../components/UserMenu"
import { API_BASE_URL } from "../lib/api"
import profilePhoto from "../assets/ukizuru-photo.jpg"

// ─────────────────────────────────────────────────────────────────────────────
// Navigation links
// ─────────────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { name: "Home",      path: "/" },
  { name: "About",     path: "/about" },
  { name: "Solutions", path: "/solutions" },
  { name: "Services",  path: "/services" },
  { name: "Contact",   path: "/contact" },
]

// ─────────────────────────────────────────────────────────────────────────────
// MobileUserSection — shown in the slide-in menu
// ─────────────────────────────────────────────────────────────────────────────
function MobileUserSection({ onClose }) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    onClose()
    logout()
    navigate("/", { replace: true })
  }

  if (loading) return <div className="h-14 animate-pulse rounded-xl bg-[#f0eaf2]" />

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        onClick={onClose}
        state={{ from: location.pathname + location.search }}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#420060] px-5 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]"
      >
        Member Login
      </Link>
    )
  }

  const isAdmin = user?.role === "admin"
  const initials = user?.fullName?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U"
  const avatarUrl = user?.avatarUrl
    ? (user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_BASE_URL}${user.avatarUrl}`)
    : null

  return (
    <div className="flex flex-col gap-2">
      {/* User card */}
      <div className="flex items-center gap-3 rounded-xl border border-[#420060]/10 bg-[#f8f4fa] px-4 py-3.5">
        {avatarUrl ? (
          <img src={avatarUrl} alt={user?.fullName} className="h-10 w-10 rounded-full object-cover ring-2 ring-[#420060]/15" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#420060] to-[#2d003f] text-[13px] font-bold text-white">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-[#420060]">{user?.fullName}</div>
          <div className="truncate text-[11px] text-[#634F40]/60">{user?.email}</div>
        </div>
        {isAdmin && (
          <span className="shrink-0 rounded-full bg-[#420060] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Admin
          </span>
        )}
      </div>

      {/* Nav links */}
      {isAdmin && (
        <MobileLink to="/admin" icon={Shield} label="Admin Panel" onClick={onClose} accent />
      )}
      <MobileLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={onClose} />
      <MobileLink to="/dashboard/orders" icon={ShoppingBag} label="My Orders" onClick={onClose} />
      <MobileLink to="/dashboard/profile" icon={User} label="Profile & Settings" onClick={onClose} />

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-[13px] font-semibold text-red-600 transition hover:bg-red-100"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </button>
    </div>
  )
}

function MobileLink({ to, icon: Icon, label, onClick, accent }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-semibold transition ${
        accent
          ? "bg-[#420060] text-white shadow-[0_6px_18px_rgba(66,0,96,0.20)]"
          : "border border-[#634F40]/10 bg-white text-[#420060] hover:bg-[#f5eff6]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Header component
// ─────────────────────────────────────────────────────────────────────────────
export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { cartCount } = useCart()

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)

  return (
    <>
      {/* ── Desktop / scroll header ──────────────────────────────────────────── */}
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-b border-[#634F40]/10 bg-[#F7F9F4]/95 shadow-[0_4px_24px_rgba(66,0,96,0.08)] backdrop-blur-md"
          : "border-b border-transparent bg-[#F7F9F4]/85 backdrop-blur-sm"
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">

          {/* Logo */}
          <Link to="/" className="group flex shrink-0 items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-[#420060]/12 shadow-sm transition-all duration-300 group-hover:border-[#420060]/35 group-hover:shadow-[0_4px_14px_rgba(66,0,96,0.18)] group-hover:scale-105">
              <img src={profilePhoto} alt="Mustapha Ukizuru" className="h-full w-full object-cover" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[1.05rem] font-bold leading-none tracking-tight text-[#420060]">
                Mustapha Ukizuru
              </div>
              <div className="mt-0.2 text-[8px] font-medium uppercase tracking-[0.18em] text-[#634F40]/45">
                Technology Consultant
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.path)
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`relative rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition-all duration-200 ${
                    active
                      ? "bg-[#420060] text-white shadow-[0_6px_16px_rgba(66,0,96,0.22)]"
                      : "text-[#634F40]/75 hover:bg-[#f5eff6] hover:text-[#420060]"
                  }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>

          {/* Desktop right cluster */}
          <div className="hidden items-center gap-3 lg:flex">
            {/* Cart */}
            <Link
              to="/cart"
              aria-label="Cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#634F40]/10 bg-white text-[#634F40]/65 shadow-sm transition-all hover:border-[#420060]/20 hover:bg-[#f5eff6] hover:text-[#420060]"
            >
              <ShoppingCart className="h-5 w-5" strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#420060] px-1 text-[10px] font-bold text-white shadow-sm">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Auth-aware user menu */}
            <UserMenu />
          </div>

          {/* Mobile: cart + hamburger */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <Link
              to="/cart"
              aria-label="Cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/10 bg-white text-[#634F40]/65 transition hover:bg-[#f5eff6] hover:text-[#420060]"
            >
              <ShoppingCart className="h-4.5 w-4.5" strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#420060] px-1 text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/12 bg-white text-[#634F40]/70 transition hover:bg-[#ede4ef] hover:text-[#420060]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile overlay ────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* ── Mobile drawer ─────────────────────────────────────────────────────── */}
      <aside className={`fixed right-0 top-0 z-[70] flex h-dvh w-full max-w-[360px] flex-col bg-[#F7F9F4] shadow-[-24px_0_80px_rgba(66,0,96,0.15)] transition-transform duration-300 ease-out lg:hidden ${
        menuOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-[#634F40]/8 px-5 py-4">
          <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5">
            <div className="h-8 w-8 overflow-hidden rounded-full border border-[#420060]/15">
              <img src={profilePhoto} alt="Mustapha Ukizuru" className="h-full w-full object-cover" />
            </div>
            <span className="text-[0.9rem] font-bold text-[#420060]">Mustapha Ukizuru</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/12 text-[#634F40]/60 transition hover:bg-[#ede4ef] hover:text-[#420060]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Navigation links */}
          <nav className="mb-6 flex flex-col gap-1.5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/40">
              Navigation
            </div>
            {NAV_LINKS.map((link) => {
              const active = isActive(link.path)
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold transition-all ${
                    active
                      ? "bg-[#420060] text-white shadow-[0_8px_20px_rgba(66,0,96,0.20)]"
                      : "text-[#634F40] hover:bg-[#f5eff6] hover:text-[#420060]"
                  }`}
                >
                  {link.name}
                  <ChevronRight className={`h-4 w-4 ${active ? "text-white/70" : "text-[#634F40]/30"}`} />
                </Link>
              )
            })}
          </nav>

          {/* Divider */}
          <div className="mb-5 h-px bg-[#634F40]/10" />

          {/* Auth section */}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/40">
            Account
          </div>
          <MobileUserSection onClose={() => setMenuOpen(false)} />
        </div>

        <div className="border-t border-[#634F40]/8 px-5 py-4 text-center text-[11px] text-[#634F40]/35">
          mustaphaukizuru.com
        </div>
      </aside>
    </>
  )
}
