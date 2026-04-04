import { useState, useEffect } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Download,
  Headphones,
  User,
  LogOut,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  Search,
  Menu,
  X,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useNotifications } from "../context/NotificationContext"
import NotificationDropdown from "../components/dashboard/NotificationDropdown"

// ─────────────────────────────────────────────────────────────────────────────
// Navigation structure
// ─────────────────────────────────────────────────────────────────────────────
const navigation = [
  {
    section: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: LayoutDashboard,
        end: true,
        description: "Summary and activity",
      },
    ],
  },
  {
    section: "Library",
    items: [
      {
        label: "My Products",
        to: "/dashboard/products",
        icon: Package,
        description: "Downloads and access",
      },
      {
        label: "Downloads",
        to: "/dashboard/downloads",
        icon: Download,
        description: "File history and logs",
      },
      {
        label: "Order History",
        to: "/dashboard/orders",
        icon: ShoppingBag,
        description: "Purchases and status",
      },
    ],
  },
  {
    section: "Support",
    items: [
      {
        label: "Support",
        to: "/dashboard/support",
        icon: Headphones,
        description: "Help and tickets",
      },
    ],
  },
  {
    section: "Account",
    items: [
      {
        label: "Profile",
        to: "/dashboard/profile",
        icon: User,
        description: "Personal information",
      },
    ],
  },
]

const pageMeta = {
  "/dashboard": {
    title: "Overview",
    subtitle: "Monitor your account, orders, downloads, and recent activity.",
  },
  "/dashboard/products": {
    title: "My Products",
    subtitle: "Access your paid digital products and available downloads.",
  },
  "/dashboard/downloads": {
    title: "Downloads",
    subtitle: "Track your file download history and access logs.",
  },
  "/dashboard/orders": {
    title: "Order History",
    subtitle: "Review your purchases, payment state, and order records.",
  },
  "/dashboard/support": {
    title: "Support",
    subtitle: "Open tickets, get help, and track your support requests.",
  },
  "/dashboard/profile": {
    title: "Profile",
    subtitle: "Manage your account information and personal details.",
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarItem — accepts onNavigate to close mobile drawer on click
// ─────────────────────────────────────────────────────────────────────────────
function SidebarItem({ item, onNavigate }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group relative flex items-start gap-3 rounded-xl px-3 py-3 transition-all duration-200",
          isActive
            ? "bg-[#420060] text-white shadow-[0_12px_28px_rgba(66,0,96,0.18)]"
            : "text-[#634F40] hover:bg-[#f5eff6] hover:text-[#420060]",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
              isActive
                ? "bg-white/14 text-white"
                : "bg-[#f7f1f8] text-[#420060] group-hover:bg-white",
            ].join(" ")}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[14px] font-semibold">{item.label}</span>
              <ChevronRight
                className={[
                  "h-4 w-4 shrink-0 transition-transform",
                  isActive ? "translate-x-0 text-white/90" : "text-[#634F40]/40 group-hover:translate-x-0.5",
                ].join(" ")}
              />
            </div>
            <div
              className={[
                "mt-0.5 truncate text-[11px]",
                isActive ? "text-white/75" : "text-[#634F40]/60",
              ].join(" ")}
            >
              {item.description}
            </div>
          </div>
        </>
      )}
    </NavLink>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardSidebar — shared content rendered in both desktop col + mobile drawer
// ─────────────────────────────────────────────────────────────────────────────
function DashboardSidebar({ user, initials, onLogout, onNavigate }) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-xl border border-[#634F40]/10 bg-white px-4 py-4 shadow-[0_14px_40px_rgba(66,0,96,0.06)]">

      {/* Brand */}
      <div className="border-b border-[#634F40]/10 px-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#420060] to-[#6d28d9] text-white shadow-[0_10px_22px_rgba(66,0,96,0.22)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[18px] font-bold tracking-tight text-[#420060]">
              Member Area
            </div>
            <div className="mt-0.5 text-[12px] text-[#634F40]/65">
              Your digital product hub
            </div>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
        {navigation.map((group) => (
          <div key={group.section} className="mb-6">
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/45">
              {group.section}
            </div>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <SidebarItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* User card */}
      <div className="mt-3 rounded-xl border border-[#634F40]/10 bg-gradient-to-br from-[#fbf8fb] to-[#f7f3fb] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ede4ef] to-[#e0d0e5] text-[13px] font-bold text-[#420060]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-[#420060]">
              {user?.fullName || "Member"}
            </div>
            <div className="truncate text-[12px] text-[#634F40]/70">
              {user?.email || ""}
            </div>
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={onLogout}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-[13px] font-semibold text-red-600 transition-all duration-200 hover:bg-red-50 hover:border-red-300 hover:shadow-sm active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardLayout
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const currentMeta =
    pageMeta[location.pathname] || {
      title: "Dashboard",
      subtitle: "Manage your account and digital products.",
    }

  const initials =
    user?.fullName
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MU"

  function handleLogout() {
    logout()
    navigate("/", { replace: true })
  }

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [sidebarOpen])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Close on ESC key
  useEffect(() => {
    if (!sidebarOpen) return
    const h = (e) => { if (e.key === "Escape") setSidebarOpen(false) }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [sidebarOpen])

  return (
    <section className="min-h-screen bg-[#f7f9f4]">

      {/* ── Mobile sidebar overlay ───────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile sidebar drawer (slides from left) ─────────────────────── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] transform transition-transform duration-300 ease-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="relative flex h-full flex-col p-3">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-[#634F40]/60 shadow-sm transition hover:bg-white hover:text-[#420060]"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
          <DashboardSidebar
            user={user}
            initials={initials}
            onLogout={() => { setSidebarOpen(false); handleLogout() }}
            onNavigate={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-5 lg:px-6">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[300px_1fr]">

          {/* ── Desktop sidebar (hidden on mobile) ──────────────────────── */}
          <div className="hidden lg:block lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <DashboardSidebar user={user} initials={initials} onLogout={handleLogout} />
          </div>

          {/* ── Main area ────────────────────────────────────────────────── */}
          <div className="min-w-0">

            {/* Sticky header */}
            <header className="sticky top-4 z-20 rounded-xl border border-[#634F40]/10 bg-white px-4 py-3.5 shadow-[0_12px_35px_rgba(66,0,96,0.05)] sm:px-5">
              <div className="flex items-center justify-between gap-3">

                {/* Left: hamburger + page title */}
                <div className="flex min-w-0 items-center gap-3">

                  {/* Hamburger — mobile only */}
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#634F40]/10 bg-[#f7f5f8] text-[#420060] transition-all duration-200 hover:bg-[#ede4ef] hover:shadow-sm active:scale-95 lg:hidden"
                    aria-label="Open navigation"
                    aria-expanded={sidebarOpen}
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  {/* Page title */}
                  <div className="min-w-0">
                    <div className="hidden text-[11px] font-medium uppercase tracking-[0.12em] text-[#634F40]/50 sm:block">
                      Dashboard / {currentMeta.title}
                    </div>
                    <h1 className="truncate text-[18px] font-bold tracking-tight text-[#420060] sm:text-[22px]">
                      {currentMeta.title}
                    </h1>
                    <p className="mt-0.5 hidden text-[12px] text-[#634F40]/70 sm:block">
                      {currentMeta.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right cluster */}
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">

                  {/* Search — only on xl+ */}
                  <div className="hidden items-center gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] px-4 py-2.5 xl:flex">
                    <Search className="h-4 w-4 text-[#634F40]/45" />
                    <input
                      type="text"
                      placeholder="Search orders, products..."
                      className="w-[160px] bg-transparent text-[13px] text-[#420060] outline-none placeholder:text-[#634F40]/45"
                    />
                  </div>

                  {/* Help — hidden on mobile */}
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/support")}
                    className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#634F40]/10 bg-white text-[#420060] transition-all duration-200 hover:bg-[#f4eef6] hover:shadow-sm sm:inline-flex"
                    title="Support"
                  >
                    <HelpCircle className="h-4.5 w-4.5" />
                  </button>

                  {/* Notifications */}
                  <NotificationDropdown />

                  {/* User pill — desktop only */}
                  <div className="hidden items-center gap-3 rounded-xl border border-[#634F40]/10 bg-gradient-to-br from-[#faf8fb] to-[#f5f0f8] px-3.5 py-2 lg:flex">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#420060] to-[#2d003f] text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(66,0,96,0.22)]">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold leading-none text-[#420060]">
                        {user?.fullName?.split(" ")[0] || "Member"}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] leading-none text-[#634F40]/55">
                        {user?.email || ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Page content */}
            <main className="mt-4 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </section>
  )
}
