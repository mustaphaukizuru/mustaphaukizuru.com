import { useLocation, useNavigate } from "react-router-dom"
import { Search, HelpCircle, LogOut, Home } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { Link } from "react-router-dom"
import { API_BASE_URL } from "../../lib/api"

const PAGE_META = {
  "/admin":               { title: "Dashboard",        sub: "Platform overview and live metrics" },
  "/admin/orders":        { title: "Orders",           sub: "Purchases, fulfillment, and status" },
  "/admin/products":      { title: "Products",         sub: "Catalog, media, and publication" },
  "/admin/products/new":  { title: "New Product",      sub: "Create a new digital product" },
  "/admin/downloads":     { title: "Downloads",        sub: "Digital delivery and download activity" },
  "/admin/payments":      { title: "Payments",         sub: "Transactions, gateways, and status" },
  "/admin/categories":    { title: "Categories",       sub: "Product taxonomy and organization" },
  "/admin/services":      { title: "Services",         sub: "Consulting and service delivery" },
  "/admin/support":       { title: "Support Tickets",  sub: "Member requests and resolution" },
  "/admin/pages":         { title: "CMS Pages",        sub: "Content, legal, and published pages" },
  "/admin/media":         { title: "Media Library",    sub: "Images, documents, and assets" },
  "/admin/email-templates": { title: "Email Templates", sub: "Transactional email configuration" },
  "/admin/users":         { title: "Users",            sub: "Members, roles, and account state" },
  "/admin/audit":         { title: "Audit Log",        sub: "Admin actions and platform events" },
}

export default function AdminHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const meta = PAGE_META[pathname]
    || (pathname.includes("/products/") && pathname.includes("/edit")
        ? { title: "Edit Product", sub: "Update product details and media" }
        : { title: "Admin", sub: "Manage your platform" })

  const initials = user?.fullName?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "A"
  const avatarUrl = user?.avatarUrl
    ? (user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_BASE_URL}${user.avatarUrl}`)
    : null

  function handleLogout() {
    logout()
    navigate("/", { replace: true })
  }

  return (
    <header className="sticky top-4 z-20 mb-4 overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_8px_30px_rgba(66,0,96,0.06)]">
      <div className="flex items-center justify-between gap-4 px-6 py-4">

        {/* Left — page title */}
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/45">
            Admin / {meta.title}
          </div>
          <h1 className="mt-1 truncate text-[20px] font-bold text-[#420060]">{meta.title}</h1>
          <p className="mt-0.5 text-[12px] text-[#634F40]/60">{meta.sub}</p>
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2.5">
          {/* Search */}
          <div className="hidden items-center gap-2.5 rounded-xl border border-[#634F40]/10 bg-[#fafafa] px-3.5 py-2.5 lg:flex">
            <Search className="h-4 w-4 shrink-0 text-[#634F40]/40" />
            <input
              type="text"
              placeholder="Search…"
              className="w-[160px] bg-transparent text-[13px] text-[#420060] outline-none placeholder:text-[#634F40]/40"
            />
          </div>

          {/* View site */}
          <Link
            to="/"
            target="_blank"
            title="View public site"
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#634F40]/10 bg-white text-[#634F40]/55 transition hover:border-[#420060]/20 hover:bg-[#f5eff6] hover:text-[#420060] lg:flex"
          >
            <Home className="h-4 w-4" />
          </Link>

          {/* Support */}
          <button
            type="button"
            onClick={() => navigate("/admin/support")}
            title="Support"
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#634F40]/10 bg-white text-[#634F40]/55 transition hover:border-[#420060]/20 hover:bg-[#f5eff6] hover:text-[#420060] lg:flex"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Admin avatar pill */}
          <div className="flex items-center gap-2.5 rounded-xl border border-[#420060]/10 bg-[#faf7fb] px-3 py-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user?.fullName} className="h-8 w-8 rounded-full object-cover ring-2 ring-[#420060]/15" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#420060] to-[#2d003f] text-[11px] font-bold text-white">
                {initials}
              </div>
            )}
            <div className="hidden flex-col lg:flex">
              <span className="text-[12px] font-semibold text-[#420060] leading-none">
                {user?.fullName?.split(" ")[0] || "Admin"}
              </span>
              <span className="text-[10px] text-[#634F40]/55 leading-none mt-0.5">Administrator</span>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
