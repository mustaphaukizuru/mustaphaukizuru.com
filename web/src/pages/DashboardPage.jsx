import { useEffect, useMemo, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import {
  CreditCard,
  Download,
  Package,
  Sparkles,
  ArrowRight,
  Clock3,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { fetchMyOrders } from "../services/orderService"
import { MetricCard, EmptyState, StatusBadge, SectionCard, SkeletonCard } from "../components/ui/index"


// StatusBadge imported from components/ui/index

export default function DashboardPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true)
        setErrorMessage("")
        const data = await fetchMyOrders()
        setOrders(Array.isArray(data) ? data : [])
      } catch (error) {
        setErrorMessage(error.message || "Failed to load dashboard.")
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />
  }

  const paidOrders = useMemo(
    () => orders.filter((order) => order.status === "paid"),
    [orders]
  )

  const totalSpent = useMemo(
    () =>
      paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    [paidOrders]
  )

  const totalDownloads = useMemo(() => {
    let count = 0
    for (const order of paidOrders) {
      for (const item of order.items || []) {
        count += item.product?.files?.length || 0
      }
    }
    return count
  }, [paidOrders])

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders])

  const recentProducts = useMemo(() => {
    const rows = []

    for (const order of paidOrders) {
      for (const item of order.items || []) {
        if (item.product?.files?.length > 0) {
          rows.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            productId: item.product.id,
            title: item.product.title || item.title || "Product",
            filesCount: item.product.files.length,
            createdAt: order.createdAt,
          })
        }
      }
    }

    return rows.slice(0, 4)
  }, [paidOrders])

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-[132px] animate-pulse rounded-xl border border-[#634F40]/10 bg-white"
            />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="h-[320px] animate-pulse rounded-xl border border-[#634F40]/10 bg-white" />
          <div className="h-[320px] animate-pulse rounded-xl border border-[#634F40]/10 bg-white" />
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ede4ef] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#420060]">
              <Sparkles className="h-3.5 w-3.5" />
              Member Overview
            </div>

            <h2 className="mt-4 text-[24px] font-bold tracking-tight text-[#420060]">
              Welcome back, {user?.fullName || "Member"}
            </h2>

            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#634F40]/75">
              Review your purchases, access available downloads, and keep track of your account activity in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/dashboard/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f]"
            >
              Open My Products
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/dashboard/orders"
              className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/15 px-4 py-3 text-[13px] font-medium text-[#420060] transition hover:bg-[#420060]/5"
            >
              View Orders
            </Link>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Orders Placed"
          value={orders.length}
          subtitle="All recorded purchases"
          icon={CreditCard}
          tone="purple"
        />
        <MetricCard
          title="Paid Downloads"
          value={totalDownloads}
          subtitle="Files currently available"
          icon={Download}
          tone="green"
        />
        <MetricCard
          title="Total Spent"
          value={`$${totalSpent.toFixed(2)}`}
          subtitle="Across paid orders"
          icon={Package}
          tone="amber"
        />
        <MetricCard
          title="Paid Orders"
          value={paidOrders.length}
          subtitle="Completed successful purchases"
          icon={Clock3}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-[#420060]">Recent Orders</h3>
              <p className="mt-1 text-[12px] text-[#634F40]/70">
                Your latest purchase activity and payment status.
              </p>
            </div>

            <Link
              to="/dashboard/orders"
              className="text-[12px] font-medium text-[#420060] hover:underline"
            >
              View all
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-6 text-[13px] text-[#634F40]/70">
              You have not placed any orders yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#420060]">
                        #{order.orderNumber || order.id}
                      </div>
                      <div className="mt-1 text-[12px] text-[#634F40]/70">
                        {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-[14px] font-semibold text-[#420060]">
                        ${Number(order.totalAmount || 0).toFixed(2)}
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-[#420060]">Recent Products</h3>
              <p className="mt-1 text-[12px] text-[#634F40]/70">
                Paid products ready for access and download.
              </p>
            </div>

            <Link
              to="/dashboard/products"
              className="text-[12px] font-medium text-[#420060] hover:underline"
            >
              Open library
            </Link>
          </div>

          {recentProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-6 text-[13px] text-[#634F40]/70">
              No paid downloadable products available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentProducts.map((product, index) => (
                <div
                  key={`${product.orderId}-${product.productId}-${index}`}
                  className="rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4"
                >
                  <div className="text-[14px] font-semibold text-[#420060]">
                    {product.title}
                  </div>
                  <div className="mt-1 text-[12px] text-[#634F40]/70">
                    {product.filesCount} file{product.filesCount > 1 ? "s" : ""} available
                  </div>
                  <div className="mt-1 text-[12px] text-[#634F40]/65">
                    Purchased {new Date(product.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}