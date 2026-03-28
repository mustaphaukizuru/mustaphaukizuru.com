import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  Menu,
  X,
  ShoppingCart,
  ChevronRight,
  LayoutDashboard,
  ShoppingBag,
  User,
  LogOut,
} from "lucide-react"
import profilePhoto from "../assets/ukizuru-photo.jpg"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"

const navLinks = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Solutions", path: "/solutions" },
  { name: "Services", path: "/services" },
  { name: "Contact", path: "/contact" },
]

function getInitials(fullName) {
  if (!fullName || typeof fullName !== "string") return "MU"
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return "MU"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
}

function getAvatarSrc(user) {
  if (!user?.avatarUrl) return null
  return user.avatarUrl.startsWith("http")
    ? user.avatarUrl
    : `${API_BASE_URL}${user.avatarUrl}`
}

function UserAvatarMenu() {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const avatarSrc = useMemo(() => getAvatarSrc(user), [user])
  const initials = useMemo(() => getInitials(user?.fullName), [user?.fullName])
  const currentPath = `${location.pathname}${location.search}${location.hash}`

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search, location.hash])

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate("/", { replace: true })
  }

  if (loading) {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-[#ede4ef]" />
  }

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        state={{ from: currentPath }}
        className="text-[14px] font-medium text-[#634F40]/70 transition-colors duration-200 hover:text-[#420060]"
      >
        Member Login
      </Link>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 focus:outline-none"
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={user?.fullName || "User avatar"}
            className="h-11 w-11 rounded-full border-2 border-[#420060]/12 object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#420060]/12 bg-gradient-to-br from-[#420060] to-[#2d003f] text-[13px] font-bold text-white shadow-sm">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[80] w-[260px] rounded-xl border border-[#634F40]/10 bg-white p-2 shadow-[0_18px_40px_rgba(66,0,96,0.16)]">
          <div className="flex items-center gap-3 rounded-xl bg-[#f8f4fa] px-3 py-3">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={user?.fullName || "User avatar"}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-[#420060]/10"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#420060] to-[#2d003f] text-[13px] font-bold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#420060]">
                {user?.fullName || "Member"}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            <Link
              to="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#634F40]/80 transition hover:bg-[#f5eff6] hover:text-[#420060]"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>

            <Link
              to="/dashboard/orders"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#634F40]/80 transition hover:bg-[#f5eff6] hover:text-[#420060]"
            >
              <ShoppingBag className="h-4 w-4" />
              My Orders
            </Link>

            <Link
              to="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#634F40]/80 transition hover:bg-[#f5eff6] hover:text-[#420060]"
            >
              <User className="h-4 w-4" />
              Profile & Settings
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileAccountSection({ onClose }) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const avatarSrc = getAvatarSrc(user)
  const initials = getInitials(user?.fullName)
  const currentPath = `${location.pathname}${location.search}${location.hash}`

  const handleLogout = async () => {
    onClose()
    await logout()
    navigate("/", { replace: true })
  }

  if (loading) {
    return <div className="h-14 animate-pulse rounded-xl bg-[#f0eaf2]" />
  }

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        state={{ from: currentPath }}
        onClick={onClose}
        className="flex items-center justify-center rounded-xl border border-[#634F40]/15 bg-white px-5 py-3.5 text-[14px] font-semibold text-[#420060] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        Member Login
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-[#420060]/10 bg-[#f8f4fa] px-4 py-3.5">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={user?.fullName || "User avatar"}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-[#420060]/15"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#420060] to-[#2d003f] text-[13px] font-bold text-white">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-[#420060]">
            {user?.fullName || "Member"}
          </div>
        </div>
      </div>

      <Link
        to="/dashboard"
        onClick={onClose}
        className="flex items-center gap-3 rounded-xl border border-[#634F40]/10 bg-white px-4 py-3 text-[14px] font-semibold text-[#420060] transition hover:bg-[#f5eff6]"
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        Dashboard
      </Link>

      <Link
        to="/dashboard/orders"
        onClick={onClose}
        className="flex items-center gap-3 rounded-xl border border-[#634F40]/10 bg-white px-4 py-3 text-[14px] font-semibold text-[#420060] transition hover:bg-[#f5eff6]"
      >
        <ShoppingBag className="h-4 w-4 shrink-0" />
        My Orders
      </Link>

      <Link
        to="/dashboard/profile"
        onClick={onClose}
        className="flex items-center gap-3 rounded-xl border border-[#634F40]/10 bg-white px-4 py-3 text-[14px] font-semibold text-[#420060] transition hover:bg-[#f5eff6]"
      >
        <User className="h-4 w-4 shrink-0" />
        Profile & Settings
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-[13px] font-semibold text-red-600 transition hover:bg-red-100"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  )
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { cartCount } = useCart()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full bg-[#F7F9F4]/92 backdrop-blur-md transition-shadow duration-300 border-b border-[#634F40]/9 ${
          scrolled ? "shadow-[0_4px_24px_rgba(66,0,96,0.08)]" : "shadow-none"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-[#420060]/12 shadow-sm transition-transform duration-200 group-hover:scale-105">
              <img src={profilePhoto} alt="Mustapha Ukizuru" className="h-full w-full object-cover" />
            </div>
            <span className="text-[1.05rem] font-bold tracking-tight text-[#420060] sm:text-[1.15rem]">
              Mustapha Ukizuru
            </span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            <nav className="flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`relative text-[14px] font-medium transition-colors duration-200 ${
                    isActive(link.path) ? "text-[#420060]" : "text-[#634F40]/70 hover:text-[#420060]"
                  }`}
                >
                  {link.name}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-[2px] rounded-full bg-[#420060] transition-all duration-300 ${
                      isActive(link.path) ? "w-full" : "w-0"
                    }`}
                  />
                </Link>
              ))}
            </nav>

            <div className="h-7 w-px bg-[#634F40]/15" />

            <div className="flex items-center gap-5">
              <Link
                to="/cart"
                className="relative text-[#634F40]/65 transition-all duration-200 hover:scale-110 hover:text-[#420060]"
                aria-label="Cart"
              >
                <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={1.8} />
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#420060] px-1 text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              <UserAvatarMenu />

              <Link
                to="/store"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#420060] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(66,0,96,0.20)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2d003f] hover:shadow-[0_14px_32px_rgba(66,0,96,0.28)]"
              >
                Explore Store
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:hidden">
            <Link to="/cart" className="relative text-[#634F40]/70 hover:text-[#420060]" aria-label="Cart">
              <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#420060] px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/12 text-[#634F40]/70 transition hover:bg-[#ede4ef] hover:text-[#420060]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-black/25 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        className={`fixed right-0 top-0 z-[70] flex h-dvh w-full max-w-[340px] flex-col bg-[#F7F9F4] px-5 pb-8 pt-4 shadow-[-20px_0_60px_rgba(66,0,96,0.12)] transition-transform duration-300 ease-out lg:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-[#420060]/15">
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

        <nav className="mt-8 flex flex-col gap-1.5">
          {navLinks.map((link) => {
            const active = isActive(link.path)
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-all duration-200 ${
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

        <div className="my-6 h-px bg-[#634F40]/10" />

        <div className="flex flex-col gap-3">
          <MobileAccountSection onClose={() => setMenuOpen(false)} />

          <Link
            to="/store"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#420060] px-5 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]"
          >
            Explore Store
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-auto pt-6 text-center text-[11px] text-[#634F40]/40">
          mustaphaukizuru.com
        </div>
      </aside>
    </>
  )
}