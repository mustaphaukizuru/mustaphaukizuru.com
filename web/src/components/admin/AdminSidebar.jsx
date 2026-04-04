import { NavLink, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Download,
  CreditCard,
  FolderKanban,
  Users,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Headphones,
  FileText,
  Image,
  Mail,
  ClipboardList,
  Briefcase,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"

// ─────────────────────────────────────────────────────────────────────────────
// Full admin navigation — aligned to Role-Permission matrix and PAD
// ─────────────────────────────────────────────────────────────────────────────
const navigation = [
  {
    section: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/admin",
        icon: LayoutDashboard,
        end: true,
        description: "Summary and live metrics",
      },
    ],
  },
  {
    section: "Commerce",
    items: [
      {
        label: "Orders",
        to: "/admin/orders",
        icon: ShoppingCart,
        description: "Purchases and fulfillment",
      },
      {
        label: "Products",
        to: "/admin/products",
        icon: Package,
        description: "Catalog and files",
      },
      {
        label: "Downloads",
        to: "/admin/downloads",
        icon: Download,
        description: "Digital delivery activity",
      },
      {
        label: "Payments",
        to: "/admin/payments",
        icon: CreditCard,
        description: "Transactions and status",
      },
      {
        label: "Categories",
        to: "/admin/categories",
        icon: FolderKanban,
        description: "Product taxonomy",
      },
    ],
  },
  {
    section: "Services",
    items: [
      {
        label: "Services",
        to: "/admin/services",
        icon: Briefcase,
        description: "Consulting and delivery",
      },
    ],
  },
  {
    section: "Support",
    items: [
      {
        label: "Support Tickets",
        to: "/admin/support",
        icon: Headphones,
        description: "Customer requests",
      },
    ],
  },
  {
    section: "Content",
    items: [
      {
        label: "Pages",
        to: "/admin/pages",
        icon: FileText,
        description: "CMS and legal content",
      },
      {
        label: "Media Library",
        to: "/admin/media",
        icon: Image,
        description: "Uploads and assets",
      },
      {
        label: "Email Templates",
        to: "/admin/email-templates",
        icon: Mail,
        description: "Transactional emails",
      },
    ],
  },
  {
    section: "Management",
    items: [
      {
        label: "Users",
        to: "/admin/users",
        icon: Users,
        description: "Accounts and roles",
      },
      {
        label: "Audit Log",
        to: "/admin/audit",
        icon: ClipboardList,
        description: "Admin action history",
      },
    ],
  },
]

function SidebarItem({ item, onClose }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
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
                  isActive
                    ? "translate-x-0 text-white/90"
                    : "text-[#634F40]/40 group-hover:translate-x-0.5",
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

// onClose is passed from AdminLayout when rendering inside the mobile drawer
export default function AdminSidebar({ onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = (user?.fullName || "AD")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  function handleLogout() {
    if (onClose) onClose()
    logout()
    navigate("/", { replace: true })
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-xl border border-[#634F40]/10 bg-white px-4 py-4 shadow-[0_14px_40px_rgba(66,0,96,0.06)]">

      {/* Brand */}
      <div className="border-b border-[#634F40]/10 px-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#420060] to-[#6d28d9] text-white shadow-[0_10px_22px_rgba(66,0,96,0.22)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[20px] font-bold tracking-tight text-[#420060]">
              Admin Console
            </div>
            <div className="mt-0.5 text-[12px] text-[#634F40]/65">
              Platform operations
            </div>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <div className="mt-4 flex-1 overflow-y-auto pr-1 no-scrollbar">
        {navigation.map((group) => (
          <div key={group.section} className="mb-5">
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#634F40]/45">
              {group.section}
            </div>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <SidebarItem key={item.to} item={item} onClose={onClose} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Admin card */}
      <div className="mt-3 rounded-xl border border-[#634F40]/10 bg-gradient-to-br from-[#fbf8fb] to-[#f7f3fb] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ede4ef] to-[#e0d0e5] text-[13px] font-bold text-[#420060]">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-[#420060]">
              {user?.fullName || "Admin"}
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
        onClick={handleLogout}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-[13px] font-semibold text-red-600 transition-all duration-200 hover:bg-red-50 hover:border-red-300 hover:shadow-sm active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  )
}
