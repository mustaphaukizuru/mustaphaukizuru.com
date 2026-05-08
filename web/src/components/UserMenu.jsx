import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import {
  LayoutDashboard, User, LogOut, Shield,
  ChevronDown, ShoppingBag, Bell,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"
import { useTranslation } from "react-i18next"

// ─────────────────────────────────────────────────────────────────────────────
// UserMenu — auth-aware avatar + dropdown
// Reads from AuthContext (already eagerly initialized — zero flicker)
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ user, size = "md" }) {
  const [imgError, setImgError] = useState(false)
  const initials = user?.fullName
    ?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U"

  const sizeClass = {
    sm: "h-8 w-8 text-micro",
    md: "h-9 w-9 text-micro",
    lg: "h-11 w-11 text-meta",
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
        className={`${sizeClass} rounded-full object-cover ring-2 ring-violet/15 ring-offset-1`}
      />
    )
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-deep font-bold text-white shadow-[0_4px_12px_rgba(93,63,211,0.25)]`}>
      {initials}
    </div>
  )
}

export default function UserMenu({ variant = "header" }) {
  const { t } = useTranslation("common")
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
    return <div className="h-9 w-9 animate-pulse rounded-full bg-violet-pale" />
  }

    // ── NOT authenticated ────────────────────────────────────────────────────
  if (!isAuthenticated) {
    const returnTo = location.pathname + location.search
    return (
      <Link
        to="/login"
        state={{ from: returnTo }}
        className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white shadow-[0_6px_18px_rgba(93,63,211,0.22)] transition-all hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_10px_24px_rgba(93,63,211,0.28)]"
      >
        {t("userMenu.memberLogin")}
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
        className="group flex items-center gap-2.5 rounded-xl border border-charcoal-80/10 bg-white px-3 py-2 shadow-sm transition-all hover:border-violet/20 hover:shadow-[0_4px_14px_rgba(93,63,211,0.10)]"
      >
        <Avatar user={user} size="sm" />
        <div className="hidden flex-col items-start md:flex">
          <span className="max-w-[120px] truncate text-meta font-semibold text-violet leading-none">
            {user?.fullName?.split(" ")[0] || "Account"}
          </span>
          <span className="text-micro text-charcoal-80/50 leading-none mt-0.5 capitalize">
            {isAdmin ? "Admin" : "Member"}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-charcoal-80/45 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[200] w-64 overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_20px_60px_rgba(93,63,211,0.14)]">
          {/* User info header */}
          <div className="flex items-center gap-3 border-b border-charcoal-80/8 bg-[#faf8fb] px-4 py-4">
            <Avatar user={user} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-meta font-semibold text-violet">
                {user?.fullName || "Member"}
              </div>
              <div className="truncate text-micro text-charcoal-80/60">{user?.email}</div>
              {isAdmin && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-white">
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
                label={t("userMenu.adminPanel")}
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
              label={t("userMenu.myOrders")}
              desc="Purchase history"
              onClick={() => setOpen(false)}
            />
            <DropItem
              to="/dashboard/profile"
              icon={User}
              label={t("userMenu.profileSettings")}
              desc="Account information"
              onClick={() => setOpen(false)}
            />
          </nav>

          {/* Divider + logout */}
          <div className="border-t border-charcoal-80/8 p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-meta font-medium text-red-600 transition hover:bg-red-50"
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
          ? "bg-violet text-white"
          : "bg-[#f0eaf2] text-violet group-hover:bg-violet-pale"
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-meta font-semibold text-violet">{label}</div>
        <div className="text-micro text-charcoal-80/55">{desc}</div>
      </div>
    </Link>
  )
}
