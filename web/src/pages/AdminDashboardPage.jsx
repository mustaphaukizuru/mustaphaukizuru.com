import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  CreditCard,
  ShoppingCart,
  Package,
  Users,
  Download,
  RefreshCw,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  Plus,
  Eye,
  Edit3,
  Headphones,
  FileText,
} from "lucide-react"
import { fetchAdminDashboardStats } from "../services/adminDashboardService"

function safeNum(val, fb = 0) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fb
}

function pct(part, total) {
  const t = safeNum(total)
  return t > 0 ? ((safeNum(part) / t) * 100).toFixed(1) : "0.0"
}

function StatCard({ title, value, subtitle, icon: Icon, tone = "purple", link }) {
  const tones = {
    purple: "bg-[#ede4ef] text-[#420060]",
    green: "bg-[#e8f4ea] text-[#3b8f47]",
    amber: "bg-[#f6efe3] text-[#9c5c00]",
    blue: "bg-[#eef3fb] text-[#2f5ea8]",
    red: "bg-red-50 text-red-600",
  }

  const inner = (
    <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.04)] transition hover:shadow-[0_8px_24px_rgba(66,0,96,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#634F40]/70">{title}</p>
          <h2 className="mt-2 text-[26px] font-bold leading-none text-[#420060]">
            {value}
          </h2>
          <p className="mt-1.5 text-[12px] text-[#634F40]/55">{subtitle}</p>
        </div>
        <div className={`shrink-0 rounded-xl p-3 ${tones[tone] || tones.purple}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )

  return link ? <Link to={link}>{inner}</Link> : inner
}

function StatusBar({ label, icon: Icon, value, total, colorClass }) {
  const pct2 = Math.min(
    100,
    safeNum(total) > 0 ? (safeNum(value) / safeNum(total)) * 100 : 0
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <div className="flex items-center gap-2 text-[#634F40]/70">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </div>
        <span className="font-semibold text-[#420060]">{safeNum(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#ede4ef]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct2}%` }}
        />
      </div>
    </div>
  )
}

function QuickActions() {
  const actions = [
    {
      label: "Add Product",
      to: "/admin/products/new",
      icon: Plus,
      color: "bg-[#420060] text-white",
    },
    {
      label: "View Orders",
      to: "/admin/orders",
      icon: ShoppingCart,
      color: "bg-white border border-[#634F40]/12 text-[#420060]",
    },
    {
      label: "Downloads",
      to: "/admin/downloads",
      icon: Download,
      color: "bg-white border border-[#634F40]/12 text-[#420060]",
    },
    {
      label: "Support",
      to: "/admin/support",
      icon: Headphones,
      color: "bg-white border border-[#634F40]/12 text-[#420060]",
    },
    {
      label: "Pages",
      to: "/admin/pages",
      icon: FileText,
      color: "bg-white border border-[#634F40]/12 text-[#420060]",
    },
    {
      label: "Users",
      to: "/admin/users",
      icon: Users,
      color: "bg-white border border-[#634F40]/12 text-[#420060]",
    },
  ]

  return (
    <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
      <h3 className="mb-4 text-[15px] font-bold text-[#420060]">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map(({ label, to, icon: Icon, color }) => (
          <Link
            key={label}
            to={to}
            className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center text-[11px] font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${color}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  async function load(silent = false) {
    if (!silent) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError("")

    try {
      const res = await fetchAdminDashboardStats()
      setData(res ?? {})
    } catch (err) {
      setError(err?.message || "Dashboard failed to load.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = data?.stats ?? {}
  const topProducts = Array.isArray(data?.topProducts) ? data.topProducts : []
  const recentOrders = Array.isArray(data?.recentOrders) ? data.recentOrders : []

  const revenue = safeNum(stats.revenue)
  const totalOrders = safeNum(stats.totalOrders)
  const activeProducts = safeNum(stats.activeProducts)
  const totalProducts = safeNum(stats.totalProducts)
  const totalUsers = safeNum(stats.totalUsers)
  const totalDownloads = safeNum(stats.totalDownloads)
  const paidOrders = safeNum(stats.paidOrders)
  const pendingOrders = safeNum(stats.pendingOrders)
  const failedOrders = safeNum(stats.failedOrders)
  const refundedOrders = safeNum(stats.refundedOrders)

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[116px] animate-pulse rounded-xl border border-[#634F40]/10 bg-white"
            />
          ))}
        </div>
        <div className="h-[80px] animate-pulse rounded-xl bg-white" />
        <div className="grid gap-5 xl:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-[220px] animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">Dashboard could not load</div>
            <div className="mt-1 text-amber-700/80">{error}</div>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-700 hover:bg-amber-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { t: "Total Revenue", v: "—", i: CreditCard },
            { t: "Total Orders", v: "—", i: ShoppingCart },
            { t: "Active Products", v: "—", i: Package },
            { t: "Users", v: "—", i: Users },
            { t: "Downloads", v: "—", i: Download },
          ].map(({ t, v, i }) => (
            <StatCard key={t} title={t} value={v} subtitle="Unavailable" icon={i} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-[#420060]">Overview</h2>
          <p className="text-[12px] text-[#634F40]/60">
            Platform performance and activity summary
          </p>
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/12 bg-white px-4 py-2 text-[12px] font-medium text-[#420060] transition hover:bg-[#ede4ef] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Revenue"
          value={`$${revenue.toFixed(2)}`}
          subtitle="From paid orders"
          icon={CreditCard}
          tone="purple"
          link="/admin/orders"
        />
        <StatCard
          title="Total Orders"
          value={totalOrders}
          subtitle="All transactions"
          icon={ShoppingCart}
          tone="blue"
          link="/admin/orders"
        />
        <StatCard
          title="Active Products"
          value={activeProducts}
          subtitle={`${totalProducts} total`}
          icon={Package}
          tone="amber"
          link="/admin/products"
        />
        <StatCard
          title="Registered Users"
          value={totalUsers}
          subtitle="Member accounts"
          icon={Users}
          tone="green"
          link="/admin/users"
        />
        <StatCard
          title="Downloads"
          value={totalDownloads}
          subtitle="Digital deliveries"
          icon={Download}
          tone="purple"
          link="/admin/downloads"
        />
      </div>

      <QuickActions />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-[17px] font-semibold text-[#420060]">Order Distribution</h3>
            <Link
              to="/admin/orders"
              className="flex items-center gap-1 text-[12px] text-[#420060] hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            <StatusBar
              label="Paid"
              icon={CheckCircle2}
              value={paidOrders}
              total={totalOrders}
              colorClass="bg-[#2FA36B]"
            />
            <StatusBar
              label="Pending"
              icon={Clock}
              value={pendingOrders}
              total={totalOrders}
              colorClass="bg-[#F59E0B]"
            />
            <StatusBar
              label="Failed"
              icon={XCircle}
              value={failedOrders}
              total={totalOrders}
              colorClass="bg-[#E5484D]"
            />
            <StatusBar
              label="Refunded"
              icon={RotateCcw}
              value={refundedOrders}
              total={totalOrders}
              colorClass="bg-[#4f46e5]"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
          <h3 className="mb-5 text-[17px] font-semibold text-[#420060]">Platform Health</h3>
          <div className="space-y-3 text-[13px]">
            {[
              {
                label: "Conversion Rate",
                value: `${pct(paidOrders, totalOrders)}%`,
                color: "text-[#2FA36B]",
              },
              {
                label: "Downloads / Orders",
                value: totalOrders > 0 ? (totalDownloads / totalOrders).toFixed(2) : "0.00",
                color: "text-[#420060]",
              },
              {
                label: "Failure Rate",
                value: `${pct(failedOrders, totalOrders)}%`,
                color: "text-[#E5484D]",
              },
              {
                label: "Refund Rate",
                value: `${pct(refundedOrders, totalOrders)}%`,
                color: "text-[#4f46e5]",
              },
              {
                label: "Active Products",
                value: `${pct(activeProducts, totalProducts)}% of catalog`,
                color: "text-[#420060]",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-[#634F40]/8 bg-[#fafafa] px-4 py-3"
              >
                <span className="text-[#634F40]/70">{label}</span>
                <span className={`font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold text-[#420060]">
            Top Performing Products
          </h3>
          <Link
            to="/admin/products"
            className="flex items-center gap-1 text-[12px] text-[#420060] hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {topProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-6 text-center text-[13px] text-[#634F40]/60">
            No product sales data yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#634F40]/10">
            <div className="grid grid-cols-[auto_1fr_0.5fr_0.5fr_0.5fr_auto] border-b border-[#634F40]/10 bg-[#fbf8fb] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#634F40]/50">
              <span className="w-8 text-center">#</span>
              <span>Product</span>
              <span>Sales</span>
              <span>Revenue</span>
              <span>DL</span>
              <span>Actions</span>
            </div>

            {topProducts.map((p, i) => (
              <div
                key={p?.productId || i}
                className="grid grid-cols-[auto_1fr_0.5fr_0.5fr_0.5fr_auto] items-center gap-3 border-b border-[#634F40]/8 px-4 py-3.5 text-[13px] last:border-b-0"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#ede4ef] text-[11px] font-bold text-[#420060]">
                  {i + 1}
                </div>
                <div className="min-w-0 truncate font-semibold text-[#420060]">
                  {p?.name || "—"}
                </div>
                <div className="text-[#634F40]/65">{safeNum(p?.sales)}</div>
                <div className="font-bold text-[#420060]">
                  ${safeNum(p?.revenue).toFixed(2)}
                </div>
                <div className="text-[#634F40]/65">{safeNum(p?.downloads)}</div>
                <div className="flex items-center gap-1">
                  {p?.productId ? (
                    <Link
                      to={`/admin/products/${p.productId}/edit`}
                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#634F40]/12 text-[#634F40]/50 transition hover:border-[#420060]/25 hover:text-[#420060]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold text-[#420060]">Recent Orders</h3>
          <Link
            to="/admin/orders"
            className="flex items-center gap-1 text-[12px] text-[#420060] hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-6 text-center text-[13px] text-[#634F40]/60">
            No recent orders.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#634F40]/10">
            <div className="grid grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] border-b border-[#634F40]/10 bg-[#fbf8fb] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#634F40]/50">
              <span>Order</span>
              <span>Customer</span>
              <span>Total</span>
              <span>Status</span>
              <span />
            </div>

            {recentOrders.map((o, i) => {
              if (!o) return null

              const statusColors = {
                paid: "bg-[#e5f4e8] text-[#3b8f47]",
                pending: "bg-[#fff3e2] text-[#b46909]",
                failed: "bg-red-50 text-red-600",
                refunded: "bg-[#eef2ff] text-[#4f46e5]",
                cancelled: "bg-[#f2f2f2] text-[#666]",
              }

              return (
                <div
                  key={o.id || i}
                  className="grid grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] items-center gap-3 border-b border-[#634F40]/8 px-4 py-3.5 text-[13px] last:border-b-0"
                >
                  <div className="truncate font-semibold text-[#420060]">
                    #{o.orderNumber || (o.id?.slice(0, 8) ?? "—")}
                  </div>
                  <div className="truncate text-[#634F40]/70">
                    {o.customerName || "—"}
                  </div>
                  <div className="font-semibold text-[#420060]">
                    ${safeNum(o.totalAmount).toFixed(2)}
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                        statusColors[o.status] || statusColors.pending
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/orders/${o.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#634F40]/12 text-[#634F40]/50 transition hover:border-[#420060]/25 hover:text-[#420060]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}