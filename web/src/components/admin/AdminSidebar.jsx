/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
import { useEffect, useState, useMemo } from "react"
import { NavLink, useNavigate, Link } from "react-router-dom"
import ThemeSwitcher from "../ui/ThemeSwitcher"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Download,
  CreditCard,
  FolderKanban,
  Users,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Headphones,
  Mail,
  MailOpen,
  ClipboardList,
  Briefcase,
  FolderOpen,
  Globe,
  BookUser, TrendingUp,
  Tag,
  MessageSquare,
  Calendar,
  CalendarCheck,
  ClipboardCheck,
  Star,
  Receipt,
  Activity,
  Newspaper,
  Megaphone,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { API_BASE_URL, authFetch } from "../../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminSidebar · F10.G · Batch 6B-1
 *
 *  Refinements applied:
 *    - 4px Royal Violet (`border-l-violet`) left border + Violet Ghost
 *      (`bg-violet-pale`) row on active per F10.G spec.
 *    - Collapsible groups (Commerce, Services, Content, Management) with
 *      collapsed/expanded state persisted in localStorage.
 *    - Count badges per group when relevant (e.g. "Orders (12)" pulls open
 *      orders from /api/v1/admin/dashboard, "Support (3)" pulls open
 *      tickets). Falls back silently if endpoints unavailable.
 *    - Smooth chevron rotation when groups collapse/expand.
 *    - Compact mode: smaller item padding, denser hierarchy for
 *      productivity surface.
 *    - Sticky brand header + footer (admin card + logout) with scrollable
 *      navigation between.
 *    - Focus rings, ARIA labels, keyboard navigation.
 *
 *  Preserved verbatim:
 *    - All routes and their grouping
 *    - Logout flow
 *    - Avatar resolution + fallback initials
 *    - `navigation` named export so AdminLayout can re-use it
 *  ──────────────────────────────────────────────────────────────────── */

function resolveAvatar(url) {
  if (!url) return null
  if (url.startsWith("http")) return url
  return API_BASE_URL ? `${API_BASE_URL}${url}` : url
}

const navigation = [
  /* Every group is expanded by default so operators see the full surface
   * area at a glance. `collapsible` is kept on a couple of high-volume
   * sections (Commerce, Management) so power users can fold them away —
   * we never collapse anything by default. */
  {
    section: "Overview",
    collapsible: false,
    items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true, description: "Live analytics & KPIs" },
    ],
  },
  {
    section: "Commerce",
    collapsible: false,
    countKey: "openOrders",
    items: [
      { label: "Orders", to: "/admin/orders", icon: ShoppingCart, description: "Purchases and fulfillment" },
      { label: "Products", to: "/admin/products", icon: Package, description: "Catalog and files" },
      { label: "Downloads", to: "/admin/downloads", icon: Download, description: "Digital delivery" },
      { label: "Payments", to: "/admin/payments", icon: CreditCard, description: "Transactions & status" },
      { label: "Categories", to: "/admin/categories", icon: FolderKanban, description: "Product taxonomy" },
      { label: "Coupons", to: "/admin/coupons", icon: Tag, description: "Discount codes & redemptions" },
      { label: "Reviews", to: "/admin/reviews", icon: Star, description: "Moderate product reviews" },
      { label: "Refunds", to: "/admin/refunds", icon: Receipt, description: "Refund ledger & disputes" },
    ],
  },
  {
    section: "Services",
    collapsible: false,
    items: [
      { label: "Services", to: "/admin/services", icon: Briefcase, description: "Consulting & delivery" },
      { label: "Service Orders", to: "/admin/service-orders", icon: ClipboardCheck, description: "Paid service deliveries" },
      { label: "Client Projects", to: "/admin/client-projects", icon: Briefcase, description: "Milestones, files, timeline" },
      { label: "Availability", to: "/admin/availability", icon: Calendar, description: "Booking calendar rules" },
      { label: "Consultations", to: "/admin/consultations", icon: CalendarCheck, description: "Booked calls & status" },
    ],
  },
  {
    section: "Editorial",
    collapsible: false,
    items: [
      { label: "Blog", to: "/admin/blog", icon: Newspaper, description: "Posts, categories, tags" },
      { label: "Portfolio", to: "/admin/portfolio", icon: FolderOpen, description: "Case studies & gallery" },
      { label: "Bio CMS", to: "/admin/bio", icon: BookUser, description: "Experience · certificates · skills" },
    ],
  },
  {
    section: "Support",
    collapsible: false,
    countKey: "openTickets",
    items: [
      { label: "Support Tickets", to: "/admin/support", icon: Headphones, description: "Member requests" },
      { label: "Contact Messages", to: "/admin/contact-messages", icon: MessageSquare, description: "Contact form submissions" },
      { label: "Newsletter", to: "/admin/newsletter", icon: Mail, description: "Subscribers & exports" },
    ],
  },
  {
    section: "Content",
    collapsible: false,
    items: [
    ],
  },
  {
    section: "Marketing",
    collapsible: false,
    items: [
      { label: "Campaigns", to: "/admin/campaigns", icon: Megaphone, description: "Marketing emails & broadcasts" },
      { label: "Email Templates", to: "/admin/email-templates", icon: Mail, description: "Transactional emails" },
      { label: "Email Logs", to: "/admin/email-logs", icon: MailOpen, description: "Delivery history" },
    ],
  },
  {
    section: "Management",
    collapsible: false,
    items: [
      { label: "Users", to: "/admin/users", icon: Users, description: "Accounts & roles" },
      { label: "Sessions", to: "/admin/sessions", icon: Activity, description: "Active sign-ins & security" },
      { label: "Analytics", to: "/admin/analytics", icon: TrendingUp, description: "Privacy-first traffic & events" },
      { label: "Audit Log",       to: "/admin/audit",       icon: ClipboardList, description: "Action history" },
      { label: "Self-Audit Leads", to: "/admin/diagnostic",  icon: ClipboardList, description: "Maturity audit submissions" },
    ],
  },
]

export { navigation }

const STORAGE_KEY = "admin_sidebar_collapsed_groups_v1"

/* ──────────────────────────────────────────────────────────────────────────
 *  SidebarItem · F10.G · 4px Royal Violet left border + Violet Ghost bg
 *  ──────────────────────────────────────────────────────────────────── */
function SidebarItem({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        [
          "group relative flex items-center gap-3 rounded-lg py-2.5 transition-all duration-150",
          // 4px Royal Violet left border on active per F10.G
          isActive
            ? "bg-violet-pale border-l-[4px] border-l-violet pl-[calc(0.625rem-4px)] pr-2.5 text-violet shadow-[inset_0_0_0_1px_rgba(93,63,211,0.06)]"
            : "border-l-[4px] border-l-transparent pl-[calc(0.625rem-4px)] pr-2.5 text-charcoal-80 hover:bg-violet-ghost hover:text-violet",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`h-[16px] w-[16px] shrink-0 ${isActive ? "text-violet" : "text-charcoal-80/55 group-hover:text-violet"}`} aria-hidden="true" />
          <span className={`min-w-0 flex-1 truncate text-meta ${isActive ? "font-semibold" : "font-medium"}`}>
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  CollapsibleGroup · F10.G · group with collapse/expand chevron
 *  + optional count badge
 *  ──────────────────────────────────────────────────────────────────── */
function CollapsibleGroup({ group, collapsed, onToggle, count }) {
  if (!group.collapsible) {
    return (
      <div className="mb-4">
        <div className="mb-1.5 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-80/45">
          <span>{group.section}</span>
          {count > 0 && (
            <span className="rounded-full bg-violet px-1.5 font-mono text-[9px] font-bold tabular-nums text-white">
              {count}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          {group.items.map((item) => <SidebarItem key={item.to} item={item} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={`group-${group.section}`}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-80/45 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
      >
        <span className="flex items-center gap-2">
          {group.section}
          {count > 0 && (
            <span className="rounded-full bg-violet px-1.5 font-mono text-[9px] font-bold tabular-nums text-white">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${collapsed ? "-rotate-90" : "rotate-0"}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={`group-${group.section}`}
        className={`overflow-hidden transition-all duration-200 ease-out ${
          collapsed ? "max-h-0 opacity-0" : "mt-1 max-h-[400px] opacity-100"
        }`}
      >
        <div className="space-y-0.5">
          {group.items.map((item) => <SidebarItem key={item.to} item={item} />)}
        </div>
      </div>
    </div>
  )
}

export default function AdminSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = (user?.fullName || "AD")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  // Persist group collapse state
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })

  function toggleGroup(section) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  // F10.G · pull badge counts from dashboard endpoint, fail silently
  const [counts, setCounts] = useState({ openOrders: 0, openTickets: 0 })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch("/api/v1/admin/dashboard")
        const stats = res?.data?.stats || res?.stats || {}
        if (!cancelled) {
          setCounts({
            openOrders: Number(stats.pendingOrders || 0),
            openTickets: Number(stats.openTickets || 0),
          })
        }
      } catch {
        // silent — badges stay at 0 if endpoint shape differs
      }
    })()
    return () => { cancelled = true }
  }, [])

  function handleLogout() {
    logout()
    navigate("/", { replace: true })
  }

  const avatarSrc = useMemo(() => resolveAvatar(user?.avatarUrl), [user?.avatarUrl])

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col rounded-xl border border-charcoal-80/10 bg-white shadow-[0_14px_40px_rgba(93,63,211,0.06)]"
      aria-label="Admin navigation"
    >
      {/* Brand · sticky top */}
      <div className="border-b border-charcoal-80/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet text-white shadow-[0_8px_18px_rgba(93,63,211,0.22)]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-card font-bold tracking-tight text-violet">Admin Console</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-charcoal-80/55">v1.0 · Operations</div>
          </div>
        </div>

        <Link
          to="/"
          className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-charcoal-80/10 bg-mist px-3 py-2 text-meta font-medium text-charcoal-80/75 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          View live site
        </Link>
      </div>

      {/* Nav · scrollable */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Admin sections">
        {navigation.map((group) => (
          <CollapsibleGroup
            key={group.section}
            group={group}
            collapsed={collapsedGroups.has(group.section)}
            onToggle={() => toggleGroup(group.section)}
            count={group.countKey ? counts[group.countKey] : 0}
          />
        ))}
      </nav>

      {/* Admin card + logout · sticky bottom */}
      <div className="border-t border-charcoal-80/10 p-3">
        <div className="rounded-lg border border-charcoal-80/8 bg-mist p-3">
          <div className="flex items-center gap-2.5">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet text-meta font-bold text-white" aria-hidden="true">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-meta font-semibold text-violet">{user?.fullName || "Admin"}</div>
              <div className="truncate text-micro text-charcoal-80/65">{user?.email || ""}</div>
            </div>
          </div>
          {/* Theme switcher — scoped to the admin shell via the
              data-dashboard-shell attribute on AdminLayout. Toggling dark
              here flips ONLY the admin subtree; the public website stays
              on the canonical light brand per Brand v3.1 §00. */}
          <div className="mt-2.5">
            <ThemeSwitcher variant="segmented" size="sm" className="w-full justify-between" />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-charcoal-80/10 bg-white px-3 py-2 text-micro font-semibold text-charcoal-80/75 transition hover:border-rose/30 hover:bg-rose/10 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30/40 focus-visible:ring-offset-2"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
