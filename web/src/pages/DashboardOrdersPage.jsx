import { useEffect, useMemo, useState } from "react"
import { CreditCard, Receipt, Clock3, CheckCircle2 } from "lucide-react"
import { fetchMyOrders } from "../services/orderService"
import { MetricCard, EmptyState, SectionCard, SkeletonCard } from "../components/ui/index"

function StatusBadge({ status }) {
  const map = {
    paid: "bg-[#e5f4e8] text-[#3b8f47]",
    pending: "bg-[#fff3e2] text-[#b46909]",
    failed: "bg-red-50 text-red-600",
    cancelled: "bg-[#f2f2f2] text-[#666]",
    refunded: "bg-[#eef2ff] text-[#4f46e5]",
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${
        map[status] || "bg-[#f2f2f2] text-[#666]"
      }`}
    >
      {status}
    </span>
  )
}

export default function DashboardOrdersPage() {
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
        setErrorMessage(error.message || "Failed to load order history.")
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  const paidOrders = useMemo(
    () => orders.filter((order) => order.status === "paid"),
    [orders]
  )

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === "pending"),
    [orders]
  )

  const totalSpent = useMemo(
    () =>
      paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    [paidOrders]
  )

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

        <div className="h-[360px] animate-pulse rounded-xl border border-[#634F40]/10 bg-white" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Orders"
          value={orders.length}
          subtitle="All recorded purchases"
          icon={Receipt}
          tone="purple"
        />
        <MetricCard
          title="Paid Orders"
          value={paidOrders.length}
          subtitle="Completed successful orders"
          icon={CheckCircle2}
          tone="green"
        />
        <MetricCard
          title="Pending Orders"
          value={pendingOrders.length}
          subtitle="Awaiting completion"
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          title="Total Spent"
          value={`$${totalSpent.toFixed(2)}`}
          subtitle="Across paid purchases"
          icon={CreditCard}
          tone="blue"
        />
      </div>

      <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-semibold text-[#420060]">All Orders</h3>
            <p className="mt-1 text-[12px] text-[#634F40]/70">
              Your most recent orders appear first.
            </p>
          </div>

          <div className="rounded-xl bg-[#fbf8fb] px-4 py-2 text-[12px] text-[#634F40]/70">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-6 text-[13px] text-[#634F40]/70">
            You have not placed any orders yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#634F40]/10">
            <div className="grid grid-cols-[1.15fr_1fr_0.7fr_0.8fr] gap-3 border-b border-[#634F40]/10 bg-[#fbf8fb] px-4 py-3 text-[12px] font-semibold text-[#634F40]/75">
              <div>Order</div>
              <div>Date</div>
              <div>Total</div>
              <div>Status</div>
            </div>

            {orders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1.15fr_1fr_0.7fr_0.8fr] gap-3 border-b border-[#634F40]/8 px-4 py-4 text-[13px] last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#420060]">
                    #{order.orderNumber || order.id}
                  </div>
                  <div className="mt-1 text-[12px] text-[#634F40]/65">
                    {order.items?.length || 0} item{order.items?.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="text-[#634F40]/80">
                  {new Date(order.createdAt).toLocaleString()}
                </div>

                <div className="font-semibold text-[#420060]">
                  ${Number(order.totalAmount || 0).toFixed(2)}
                </div>

                <div>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}