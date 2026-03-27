import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, User, LogOut, Shield,
  ChevronDown, ShoppingBag, Bell,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// UserMenu — auth-aware avatar + dropdown
// Reads from AuthContext (already eagerly initialized — zero flicker)
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ user, size = "md" }) {
  const [imgError, setImgError] = useState(false)
  const initials = user?.fullName
    ?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U"

  const sizeClass = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-9 w-9 text-[12px]",
    lg: "h-11 w-11 text-[14px]",
  }[size]

  const avatarUrl = user?.avatarUrl
    ? (user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_BASE_URL}${user.avatarUrl}`)
    : null

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={user?.fullName || "User"}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-[#420060]/15 ring-offset-1`}
      />
    )
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-[#420060] to-[#2d003f] font-bold text-white shadow-[0_4px_12px_rgba(66,0,96,0.25)]`}>
      {initials}
    </div>
  )
}

export default function UserMenu({ variant = "header" }) {
  const { user, logout, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!menuRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    function handler(e) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  function handleLogout() {
    setOpen(false)
    logout()
    navigate("/", { replace: true })
  }

  // During initial auth check — show placeholder to avoid layout shift
  if (loading) {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-[#ede4ef]" />
  }

    // ── NOT authenticated ────────────────────────────────────────────────────
  if (!isAuthenticated) {
    const returnTo = location.pathname + location.search
    return (
      <Link
        to="/login"
        state={{ from: returnTo }}
        className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(66,0,96,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#2d003f] hover:shadow-[0_10px_24px_rgba(66,0,96,0.28)]"
      >
        Member Login
      </Link>
    )
  }

  const isAdmin = user?.role === "admin"

  // ── Authenticated — avatar + dropdown ───────────────────────────────────
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="group flex items-center gap-2.5 rounded-xl border border-[#634F40]/10 bg-white px-3 py-2 shadow-sm transition-all hover:border-[#420060]/20 hover:shadow-[0_4px_14px_rgba(66,0,96,0.10)]"
      >
        <Avatar user={user} size="sm" />
        <div className="hidden flex-col items-start md:flex">
          <span className="max-w-[120px] truncate text-[13px] font-semibold text-[#420060] leading-none">
            {user?.fullName?.split(" ")[0] || "Account"}
          </span>
          <span className="text-[10px] text-[#634F40]/50 leading-none mt-0.5 capitalize">
            {isAdmin ? "Admin" : "Member"}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#634F40]/45 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[200] w-64 overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_20px_60px_rgba(66,0,96,0.14)]">
          {/* User info header */}
          <div className="flex items-center gap-3 border-b border-[#634F40]/8 bg-[#faf8fb] px-4 py-4">
            <Avatar user={user} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold text-[#420060]">
                {user?.fullName || "Member"}
              </div>
              <div className="truncate text-[11px] text-[#634F40]/60">{user?.email}</div>
              {isAdmin && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#420060] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  <Shield className="h-2.5 w-2.5" /> Admin
                </span>
              )}
            </div>
          </div>

          {/* Nav items */}
          <nav className="p-2">
            {isAdmin && (
              <DropItem
                to="/admin"
                icon={Shield}
                label="Admin Panel"
                desc="Manage platform"
                accent
                onClick={() => setOpen(false)}
              />
            )}
            <DropItem
              to="/dashboard"
              icon={LayoutDashboard}
              label="Dashboard"
              desc="Overview & activity"
              onClick={() => setOpen(false)}
            />
            <DropItem
              to="/dashboard/orders"
              icon={ShoppingBag}
              label="My Orders"
              desc="Purchase history"
              onClick={() => setOpen(false)}
            />
            <DropItem
              to="/dashboard/profile"
              icon={User}
              label="Profile & Settings"
              desc="Account information"
              onClick={() => setOpen(false)}
            />
          </nav>

          {/* Divider + logout */}
          <div className="border-t border-[#634F40]/8 p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-50">
                <LogOut className="h-3.5 w-3.5" />
              </div>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DropItem({ to, icon: Icon, label, desc, accent, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-[#f7f4f8] ${accent ? "mb-1" : ""}`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
        accent
          ? "bg-[#420060] text-white"
          : "bg-[#f0eaf2] text-[#420060] group-hover:bg-[#ede4ef]"
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[#420060]">{label}</div>
        <div className="text-[11px] text-[#634F40]/55">{desc}</div>
      </div>
    </Link>
  )
}
