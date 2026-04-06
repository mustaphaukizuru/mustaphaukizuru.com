import { useState, useEffect } from "react"
<<<<<<< HEAD
import { Outlet, NavLink, useLocation, useNavigate, Link } from "react-router-dom"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Download,
  Users,
  LogOut,
  Menu,
  X,
  Globe,
  ShieldCheck,
  Headphones,
  CreditCard,
} from "lucide-react"
import AdminSidebar, { navigation } from "../components/admin/AdminSidebar"
=======
import { Outlet, useLocation } from "react-router-dom"
import { X } from "lucide-react"
import AdminSidebar from "../components/admin/AdminSidebar"
>>>>>>> c8e70b6ca47e7edcf1baef87d63c77467b01a19d
import AdminHeader from "../components/admin/AdminHeader"
import { useAuth } from "../context/AuthContext"

// Bottom tabs for admin mobile — 5 most used
const adminBottomTabs = [
  { label: "Home", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Support", to: "/admin/support", icon: Headphones },
  { label: "Users", to: "/admin/users", icon: Users },
]

const pageMeta = {
  "/admin": { title: "Dashboard", subtitle: "Track revenue, orders, products, downloads, and customer activity." },
  "/admin/orders": { title: "Orders", subtitle: "Review purchases, customer records, and order state updates." },
  "/admin/products": { title: "Products", subtitle: "Manage catalog items, media, files, and publication settings." },
  "/admin/downloads": { title: "Downloads", subtitle: "Monitor digital delivery and member download activity." },
  "/admin/payments": { title: "Payments", subtitle: "Track gateway activity, transaction references, and payment states." },
  "/admin/categories": { title: "Categories", subtitle: "Review category usage and organize your product catalog." },
  "/admin/services": { title: "Services", subtitle: "Manage consulting services, packages, and service order delivery." },
  "/admin/support": { title: "Support Tickets", subtitle: "Handle member requests, reply to tickets, and track resolution." },
  "/admin/pages": { title: "Pages", subtitle: "Manage CMS content, legal pages, and published site content." },
  "/admin/media": { title: "Media Library", subtitle: "Upload and manage images, documents, and digital assets." },
  "/admin/email-templates": { title: "Email Templates", subtitle: "Configure transactional email templates for platform events." },
  "/admin/users": { title: "Users", subtitle: "Review members, admins, roles, and account activity." },
  "/admin/audit": { title: "Audit Log", subtitle: "View append-only records of admin actions and platform events." },
}

function resolveMeta(pathname) {
  if (pageMeta[pathname]) return pageMeta[pathname]
  if (pathname.startsWith("/admin/products/")) return { title: "Product Editor", subtitle: "Create or update product content, media, and downloadable files." }
  if (pathname.startsWith("/admin/orders/")) return { title: "Order Detail", subtitle: "Inspect customer information, items, and order history." }
  if (pathname.startsWith("/admin/support/")) return { title: "Support Thread", subtitle: "Review and reply to this support ticket." }
  return { title: "Admin", subtitle: "Manage your platform operations." }
}

<<<<<<< HEAD
// ── Mobile slide-out menu ──
function AdminMobileMenu({ open, onClose, user, initials, onLogout }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])
=======
export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const currentMeta = resolveMeta(location.pathname)
>>>>>>> c8e70b6ca47e7edcf1baef87d63c77467b01a19d

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
<<<<<<< HEAD
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-[70] w-[300px] max-w-[85vw] bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#634F40]/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#420060] text-xs font-bold text-white">
                {initials}
              </div>
              <div>
                <div className="text-[14px] font-bold text-[#420060]">{user?.fullName || "Admin"}</div>
                <div className="text-[11px] text-[#634F40]/60">Administrator</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#634F40] transition hover:bg-[#f5eff6]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Back to Website */}
          <Link
            to="/"
            onClick={onClose}
            className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-[#420060]/10 bg-[#faf7fb] px-4 py-3 text-[13px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]"
          >
            <Globe className="h-4 w-4" />
            Back to Website
          </Link>

          {/* Nav */}
          <div className="mt-3 flex-1 overflow-y-auto px-4 pb-4">
            {navigation.map((group) => (
              <div key={group.section} className="mb-5">
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/40">
                  {group.section}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          [
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition",
                            isActive
                              ? "bg-[#420060] text-white shadow-[0_8px_20px_rgba(66,0,96,0.15)]"
                              : "text-[#634F40] hover:bg-[#f5eff6]",
                          ].join(" ")
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={`h-[18px] w-[18px] ${isActive ? "text-white" : "text-[#420060]"}`} />
                            {item.label}
                          </>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Logout */}
          <div className="border-t border-[#634F40]/10 px-4 py-4">
            <button
              type="button"
              onClick={() => { onClose(); onLogout() }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-[13px] font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main AdminLayout ──
export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentMeta = resolveMeta(location.pathname)

  const initials = (user?.fullName || "AD")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  function handleLogout() {
    logout()
    navigate("/", { replace: true })
  }

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <section className="min-h-screen bg-[#f7f9f4] pb-20 lg:pb-0">
      <div className="mx-auto max-w-[1700px] px-3 py-3 sm:px-5 lg:px-6 lg:py-4">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[300px_1fr]">

          {/* ── Desktop Sidebar ── */}
          <div className="hidden lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)]">
=======
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
        aria-label="Admin navigation"
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
          <AdminSidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-5 lg:px-6">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[300px_1fr]">

          {/* ── Desktop sidebar (hidden on mobile) ──────────────────────── */}
          <div className="hidden lg:block lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
>>>>>>> c8e70b6ca47e7edcf1baef87d63c77467b01a19d
            <AdminSidebar />
          </div>

          {/* ── Main area ── */}
          <div className="min-w-0">

            {/* ── Mobile Header ── */}
            <header className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-between bg-white/95 px-4 py-3 shadow-[0_2px_12px_rgba(66,0,96,0.06)] backdrop-blur-md lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#420060] text-white shadow-[0_4px_12px_rgba(66,0,96,0.18)]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-[#420060]">{currentMeta.title}</div>
                  <div className="text-[11px] text-[#634F40]/55">Admin Console</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#420060] transition hover:bg-[#f5eff6]"
                  title="Back to Website"
                >
                  <Globe className="h-[18px] w-[18px]" />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#420060] transition hover:bg-[#f5eff6]"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* ── Desktop Header ── */}
            <div className="sticky top-4 z-20 hidden lg:block">
              <AdminHeader
                title={currentMeta.title}
                subtitle={currentMeta.subtitle}
                pathname={location.pathname}
                onMenuOpen={() => setSidebarOpen(true)}
              />
            </div>

            {/* Page content */}
            <main className="mt-3 min-w-0 lg:mt-4">
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      {/* ── Mobile Slide-out Menu ── */}
      <AdminMobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        initials={initials}
        onLogout={handleLogout}
      />

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#634F40]/10 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {adminBottomTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  [
                    "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-center transition-all",
                    isActive ? "text-[#420060]" : "text-[#634F40]/45 hover:text-[#420060]",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                        isActive ? "bg-[#420060] text-white shadow-[0_4px_14px_rgba(66,0,96,0.25)]" : "",
                      ].join(" ")}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <span className={`text-[10px] font-semibold ${isActive ? "text-[#420060]" : ""}`}>
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </nav>
    </section>
  )
}
