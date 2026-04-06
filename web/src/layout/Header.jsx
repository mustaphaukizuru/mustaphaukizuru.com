import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  Menu, X, ShoppingCart,
  ChevronDown, LayoutDashboard, ShoppingBag, UserCog, LogOut, Shield,
} from "lucide-react"
import PrimaryButton from "../ui/PrimaryButton"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"
import profilePhoto from "../assets/logos/Ukizuru_Mustapha_ProfilePhoto (1).png"
const navLinks = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Solutions", path: "/solutions" },
  { name: "Services", path: "/services" },
  { name: "Contact", path: "/contact" },
]

// ─────────────────────────────────────────────
// Animation styles (injected once)
// ─────────────────────────────────────────────
const STYLES_ID = "ukz-dropdown-css"

function useDropdownStyles() {
  useEffect(() => {
    if (document.getElementById(STYLES_ID)) return
    const el = document.createElement("style")
    el.id = STYLES_ID
    el.textContent = `
      @keyframes ukzDropIn {
        0%   { opacity:0; transform:translateY(-10px) scale(.97); }
        100% { opacity:1; transform:translateY(0) scale(1); }
      }
      @keyframes ukzDropOut {
        0%   { opacity:1; transform:translateY(0) scale(1); }
        100% { opacity:0; transform:translateY(-8px) scale(.98); }
      }
      @keyframes ukzSlideIn {
        0%   { opacity:0; transform:translateX(-10px); }
        100% { opacity:1; transform:translateX(0); }
      }
      @keyframes ukzPulse {
        0%,100% { box-shadow:0 0 0 0 rgba(52,211,153,.4); }
        50%     { box-shadow:0 0 0 4px rgba(52,211,153,0); }
      }
      @keyframes ukzExpandIn {
        0%   { opacity:0; max-height:0; }
        100% { opacity:1; max-height:500px; }
      }
      @keyframes ukzExpandOut {
        0%   { opacity:1; max-height:500px; }
        100% { opacity:0; max-height:0; }
      }
      .ukz-drop-in   { animation:ukzDropIn .26s cubic-bezier(.22,1,.36,1) forwards; }
      .ukz-drop-out  { animation:ukzDropOut .18s cubic-bezier(.4,0,1,1) forwards; pointer-events:none; }
      .ukz-slide-in  { opacity:0; animation:ukzSlideIn .3s cubic-bezier(.22,1,.36,1) forwards; }
      .ukz-online    { animation:ukzPulse 2.5s ease-in-out infinite; }
      .ukz-expand-in  { animation:ukzExpandIn .3s cubic-bezier(.22,1,.36,1) forwards; overflow:hidden; }
      .ukz-expand-out { animation:ukzExpandOut .22s cubic-bezier(.4,0,1,1) forwards; overflow:hidden; }
      .ukz-menu-item {
        position:relative;
        transition:all .15s ease;
      }
      .ukz-menu-item::after {
        content:'';
        position:absolute;
        left:0; top:50%;
        transform:translateY(-50%) scaleY(0);
        width:3px; height:55%;
        border-radius:0 3px 3px 0;
        background:linear-gradient(180deg,#420060,#7c3aed);
        transition:transform .2s cubic-bezier(.22,1,.36,1);
      }
      .ukz-menu-item:hover::after {
        transform:translateY(-50%) scaleY(1);
      }
    `
    document.head.appendChild(el)
  }, [])
}

// ─────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────
function resolveAvatar(url) {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function UserAvatar({ user, size = 38, ring = false, pulse = true }) {
  const src = resolveAvatar(user?.avatarUrl)
  const initials = (user?.fullName || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {ring && (
        <div className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-[#420060] via-[#7c3aed] to-[#a855f7] opacity-75 blur-[1px]" />
      )}

      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm ${
          ring ? "border-[2.5px] border-white" : "border-2 border-[#420060]/15"
        }`}
        style={{ width: size, height: size, minWidth: size }}
      >
        {src ? (
          <img
            src={src}
            alt={user?.fullName}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.target.style.display = "none"
              if (e.target.nextElementSibling) e.target.nextElementSibling.classList.remove("hidden")
            }}
          />
        ) : null}

        <div
          className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#420060] to-[#7c3aed] ${src ? "hidden" : ""}`}
        >
          <span
            className="font-['Sora'] font-bold leading-none text-white select-none"
            style={{ fontSize: size * 0.36 }}
          >
            {initials}
          </span>
        </div>
      </div>

      <span
        className={`absolute bottom-0 right-0 rounded-full border-2 border-white bg-emerald-400 ${pulse ? "ukz-online" : ""}`}
        style={{ width: Math.max(size * 0.26, 8), height: Math.max(size * 0.26, 8) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Desktop dropdown
// ─────────────────────────────────────────────
const menuItems = [
  { name: "Dashboard",          path: "/dashboard",         icon: LayoutDashboard },
  { name: "My Orders",          path: "/dashboard/orders",  icon: ShoppingBag },
  { name: "Profile & Settings", path: "/dashboard/profile", icon: UserCog },
]

function DesktopUserDropdown() {
  useDropdownStyles()

  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [exiting, setExiting] = useState(false)
  const ref = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const isAdmin = user?.role === "admin"
  const allItems = isAdmin
    ? [{ name: "Admin Panel", path: "/admin", icon: Shield, accent: true }, ...menuItems]
    : menuItems

  function close() {
    if (!open) return
    setExiting(true)
    setTimeout(() => { setOpen(false); setExiting(false) }, 180)
  }

  function toggle() {
    if (open) close()
    else setOpen(true)
  }

  useEffect(() => { if (open) close() }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="group flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 transition-all duration-200 hover:bg-[#420060]/5 active:scale-[0.97]"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <UserAvatar user={user} size={36} ring pulse />
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#634F40]/50 transition-transform duration-300 ease-out ${
            open ? "rotate-180" : "group-hover:translate-y-[1px]"
          }`}
          strokeWidth={2.4}
        />
      </button>

      {(open || exiting) && (
        <div
          className={`absolute right-0 top-[calc(100%+10px)] z-50 w-[272px] origin-top-right rounded-2xl border border-[#e8e0ec] bg-white shadow-[0_20px_60px_-12px_rgba(66,0,96,0.20),0_0_0_1px_rgba(66,0,96,0.04)] ${
            exiting ? "ukz-drop-out" : "ukz-drop-in"
          }`}
          role="menu"
        >
          {/* User card */}
          <div className="relative overflow-hidden rounded-t-2xl border-b border-[#f0e8f3] px-4 pb-4 pt-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[#f9f5fb] to-[#f4f0f7]" />
            <div className="relative flex items-center gap-3">
              <UserAvatar user={user} size={46} ring={false} pulse={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-['Sora'] text-[0.93rem] font-bold text-[#1f2937]">
                  {user?.fullName}
                </p>
                <p className="mt-0.5 truncate text-[0.76rem] text-[#634F40]/55">
                  {user?.email}
                </p>
              </div>
            </div>
            {user?.role && (
              <span className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#420060]/[0.08] px-2.5 py-1 text-[0.67rem] font-semibold uppercase tracking-widest text-[#420060]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#420060]/50" />
                {user.role}
              </span>
            )}
          </div>

          {/* Menu links */}
          <div className="px-2 py-2">
            {allItems.map((item, i) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  role="menuitem"
                  onClick={close}
                  className={`ukz-menu-item ukz-slide-in flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.87rem] font-medium ${
                    item.accent
                      ? "text-[#420060] hover:bg-[#f5eff6]"
                      : "text-[#374151] hover:bg-[#f7f3f9] hover:text-[#420060]"
                  }`}
                  style={{ animationDelay: `${(i + 1) * 55}ms` }}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    item.accent ? "bg-[#420060]/[0.08]" : "bg-[#634F40]/[0.04]"
                  }`}>
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Sign out */}
          <div className="border-t border-[#f0e8f3] px-2 py-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close()
                setTimeout(() => { logout(); navigate("/", { replace: true }) }, 200)
              }}
              className="ukz-menu-item ukz-slide-in flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.87rem] font-medium text-red-500/85 hover:bg-red-50 hover:text-red-600"
              style={{ animationDelay: `${(allItems.length + 1) * 55}ms` }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                <LogOut className="h-4 w-4" strokeWidth={1.9} />
              </span>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Mobile user section — collapsible account menu
// ─────────────────────────────────────────────
function MobileUserSection({ onClose }) {
  useDropdownStyles()

  const { user, isAuthenticated, loading, logout } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [collapsing, setCollapsing] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (loading) return <div className="h-14 animate-pulse rounded-full bg-[#634F40]/8" />

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        onClick={onClose}
        state={{ from: location.pathname + location.search }}
        className="flex items-center justify-center rounded-full border border-[#634F40]/15 bg-white px-6 py-4 text-[1.05rem] font-semibold text-[#1f2937] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        Member Login
      </Link>
    )
  }

  const isAdmin = user?.role === "admin"
  const allItems = isAdmin
    ? [{ name: "Admin Panel", path: "/admin", icon: Shield, accent: true }, ...menuItems]
    : menuItems

  function toggleExpand() {
    if (expanded) {
      setCollapsing(true)
      setTimeout(() => { setExpanded(false); setCollapsing(false) }, 220)
    } else {
      setExpanded(true)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* User card — tap to expand/collapse account links */}
      <button
        type="button"
        onClick={toggleExpand}
        className="relative w-full overflow-hidden rounded-2xl border border-[#e8e0ec] bg-white px-4 py-3.5 text-left shadow-sm transition-all duration-200 active:scale-[0.99]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#f9f5fb] to-[#f4f0f7]" />
        <div className="relative flex items-center gap-3">
          <UserAvatar user={user} size={44} ring pulse={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-['Sora'] text-[0.95rem] font-bold text-[#1f2937]">
              {user?.fullName}
            </p>
            <p className="mt-0.5 truncate text-[0.78rem] text-[#634F40]/50">
              {user?.email}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <span className="rounded-full bg-[#420060] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                Admin
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-[#634F40]/40 transition-transform duration-300 ${
                expanded && !collapsing ? "rotate-180" : ""
              }`}
              strokeWidth={2.2}
            />
          </div>
        </div>
      </button>

      {/* Expandable account links */}
      {(expanded || collapsing) && (
        <div className={collapsing ? "ukz-expand-out" : "ukz-expand-in"}>
          <div className="flex flex-col gap-2">
            {allItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[1.02rem] font-semibold transition-all duration-200 active:scale-[0.98] ${
                    item.accent
                      ? "bg-[#420060] text-white shadow-[0_6px_18px_rgba(66,0,96,0.20)] hover:-translate-y-0.5"
                      : "text-[#374151] hover:bg-[#f1ebf2]"
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    item.accent ? "bg-white/15" : "bg-[#634F40]/[0.05]"
                  }`}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  {item.name}
                </Link>
              )
            })}

            {/* Sign out */}
            <button
              type="button"
              onClick={() => {
                onClose()
                logout()
                navigate("/", { replace: true })
              }}
              className="flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-6 py-3.5 text-[1rem] font-semibold text-red-600 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md active:scale-[0.98]"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.8} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════
// HEADER — original layout
// ═════════════════════════════════════════════
export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { cartCount } = useCart()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  const isActive = (path) => location.pathname === path

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#634F40]/10 bg-[#F7F9F4]/95 backdrop-blur-md shadow-[0_6px_20px_rgba(66,0,96,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#634F40]/15 bg-white shadow-sm">
              <img
                src={profilePhoto}
                alt="Mustapha Ukizuru"
                className="h-full w-full object-cover"
              />
            </div>

            <span className="hidden font-['Sora'] text-[1.1rem] font-bold tracking-tight text-[#420060] sm:inline sm:text-[1.3rem]">
              Mustapha Ukizuru
            </span>
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            <nav className="flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`relative text-[1rem] font-medium transition-colors duration-200 ${
                    isActive(link.path)
                      ? "text-[#420060]"
                      : "text-[#634F40]/75 hover:text-[#420060]"
                  }`}
                >
                  {link.name}
                  <span
                    className={`absolute left-0 -bottom-1 h-[2px] rounded-full bg-[#420060] transition-all duration-300 ${
                      isActive(link.path) ? "w-full" : "w-0"
                    }`}
                  />
                </Link>
              ))}
            </nav>

            <div className="h-8 w-px bg-[#634F40]/15" />

            <div className="flex items-center gap-6">
              <Link
                to="/cart"
                className="relative text-[#634F40]/75 transition duration-200 hover:scale-105 hover:text-[#420060]"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="h-7 w-7" strokeWidth={1.9} />
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#420060] px-1 text-[11px] font-semibold text-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              {loading ? (
                <div className="h-9 w-9 animate-pulse rounded-full bg-[#634F40]/10" />
              ) : isAuthenticated ? (
                <DesktopUserDropdown />
              ) : (
                <Link
                  to="/login"
                  className="text-[1rem] font-medium text-[#634F40]/75 transition duration-200 hover:text-[#420060]"
                >
                  Member Login
                </Link>
              )}

              <Link to="/store">
                <PrimaryButton>Explore Store</PrimaryButton>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-5 lg:hidden">
            <Link
              to="/cart"
              className="relative text-[#634F40]/80 transition duration-200 hover:text-[#420060]"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="h-7 w-7" strokeWidth={1.9} />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#420060] px-1 text-[11px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="text-[#634F40]/80 transition duration-200 hover:text-[#420060]"
              aria-label="Open menu"
            >
              <Menu className="h-8 w-8" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile overlay ── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 lg:hidden ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* ── Mobile sidebar — FULL WIDTH on phones, capped on tablets ── */}
      <aside
        className={`fixed right-0 top-0 z-[70] flex h-dvh w-full flex-col bg-[#F7F9F4] shadow-2xl transition-transform duration-300 ease-out sm:max-w-[400px] lg:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Sidebar header — pinned */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#634F40]/10 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#634F40]/15 bg-white shadow-sm">
              <img
                src={profilePhoto}
                alt="Mustapha Ukizuru"
                className="h-full w-full object-cover"
              />
            </div>

            <span className="font-['Sora'] text-[1.05rem] font-bold tracking-tight text-[#634F40]">
              Mustapha Ukizuru
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/cart"
              className="relative text-[#4b5563] transition duration-200 hover:text-[#420060]"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="h-7 w-7" strokeWidth={1.9} />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#420060] px-1 text-[11px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="text-[#4b5563] transition duration-200 hover:text-[#420060]"
              aria-label="Close menu"
            >
              <X className="h-8 w-8" strokeWidth={1.9} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => {
              const active = isActive(link.path)

              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`rounded-2xl px-4 py-3 text-[1.05rem] font-semibold transition-all duration-200 ${
                    active
                      ? "bg-[#ede4ef] text-[#420060]"
                      : "text-[#374151] hover:bg-[#f1ebf2]"
                  }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>

          <div className="my-6 h-px w-full bg-[#634F40]/12" />

          <div className="flex flex-col gap-4">
            <MobileUserSection onClose={() => setMenuOpen(false)} />

            <Link to="/store" onClick={() => setMenuOpen(false)}>
              <PrimaryButton fullWidth className="py-4 text-[1rem]">
                Explore Store
              </PrimaryButton>
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
