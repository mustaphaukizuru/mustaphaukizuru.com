/* eslint-disable react-refresh/only-export-components -- exports performSignOut/UserAvatar used by MobileMenu */
// ════════════════════════════════════════════════════════════════════════════
// layout/header/AccountMenu.jsx · desktop avatar dropdown (role="menu")
// ────────────────────────────────────────────────────────────────────────────
// Non-modal popover anchored to the avatar button: outside-click + Escape
// close it, route change closes it. Also home to the two account helpers the
// MobileMenu shares (UserAvatar, performSignOut).
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ChevronDown, LogOut, Shield } from "lucide-react"

import { useAuth } from "../../context/AuthContext"
import { API_BASE_URL } from "../../lib/api"
import { USER_MENU_ITEMS } from "./navLinks"

function resolveAvatar(url) {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

/**
 * Defensively perform a sign out — calls AuthContext.logout if it exists,
 * then redirects to home. Survives older AuthContext shapes that may
 * have used a different function name.
 */
export async function performSignOut(authValue, navigate) {
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

export function UserAvatar({ user, size = 36 }) {
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

export default function AccountMenu() {
  const { t } = useTranslation("common")
  const auth = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()

  const user = auth && auth.user

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu on route change
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
        className="cursor-pointer group inline-flex items-center gap-1.5 rounded-full p-0.5 pr-2 transition hover:bg-violet/6 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
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
                    className={`cursor-pointer flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition ${itemClass}`}
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
              className="cursor-pointer flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium text-rose transition hover:bg-rose/8"
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
