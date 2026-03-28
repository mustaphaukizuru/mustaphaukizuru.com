import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Eye } from "lucide-react"
import { fetchAdminOrders, updateAdminOrderStatus } from "../services/adminOrderService"
import { MetricCard, EmptyState, StatusBadge, SectionCard, SkeletonCard } from "../components/ui/index"

const STATUS_OPTIONS = ["pending", "paid", "failed", "cancelled", "refunded"]

function AdminStatusBadge({ value }) {
  const map = {
    paid: "bg-[#e5f4e8] text-[#3b8f47]",
    pending: "bg-[#fff3e2] text-[#b46909]",
    failed: "bg-red-50 text-red-600",
    cancelled: "bg-[#f2f2f2] text-[#666]",
    refunded: "bg-[#eef2ff] text-[#4f46e5]",
  }

  return (
    <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${map[value] || "bg-[#f2f2f2] text-[#666]"}`}>
      {value}
    </span>
  )
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [updatingId, setUpdatingId] = useState("")

  async function loadOrders() {
    try {
      setLoading(true)
      setErrorMessage("")
      const data = await fetchAdminOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      setErrorMessage(error.message || "Failed to load orders.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const metrics = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid").length
    const pending = orders.filter((o) => o.status === "pending").length
    const revenue = orders
      .filter((o) => o.status === "paid")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)

    return {
      total: orders.length,
      paid,
      pending,
      revenue,
    }
  }, [orders])

  async function handleStatusChange(orderId, nextStatus) {
    try {
      setUpdatingId(orderId)
      setErrorMessage("")
      await updateAdminOrderStatus(orderId, nextStatus)
      await loadOrders()
    } catch (error) {
      setErrorMessage(error.message || "Failed to update order status.")
    } finally {
      setUpdatingId("")
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-[18px] font-semibold text-[#420060]">Order Table</h2>
        <p className="mt-1 text-[12px] text-[#634F40]/70">
          Review orders, update statuses, and inspect order details.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Orders" value={metrics.total} />
        <MetricCard title="Paid Orders" value={metrics.paid} accent="text-[#3b8f47]" />
        <MetricCard title="Pending Orders" value={metrics.pending} accent="text-[#b46909]" />
        <MetricCard title="Revenue" value={`$${metrics.revenue.toFixed(2)}`} />
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
        {loading ? (
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] px-4 py-12 text-center text-[13px] text-[#634F40]/70">
            Loading orders...
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#634F40]/10">
            <div className="grid grid-cols-[1.3fr_1.2fr_0.45fr_0.6fr_0.7fr_0.5fr] gap-3 border-b border-[#634F40]/10 bg-[#fbf8fb] px-4 py-3 text-[12px] font-semibold text-[#634F40]/75">
              <div>Order</div>
              <div>Customer</div>
              <div>Items</div>
              <div>Total</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            {orders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1.3fr_1.2fr_0.45fr_0.6fr_0.7fr_0.5fr] gap-3 border-b border-[#634F40]/8 px-4 py-4 text-[13px] last:border-b-0"
              >
                <div>
                  <div className="font-semibold text-[#420060]">
                    #{order.orderNumber || order.id}
                  </div>
                  <div className="mt-1 text-[12px] text-[#634F40]/70">
                    {new Date(order.createdAt).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="font-medium text-[#634F40]">
                    {order.customerName || "Customer"}
                  </div>
                  <div className="mt-1 text-[12px] text-[#634F40]/70">
                    {order.customerEmail || "—"}
                  </div>
                </div>

                <div className="text-[#634F40]">{order.items?.length || 0}</div>

                <div className="font-semibold text-[#420060]">
                  ${Number(order.totalAmount || 0).toFixed(2)}
                </div>

                <div className="space-y-2">
                  <AdminStatusBadge value={order.status} />
                  <select
                    value={order.status}
                    disabled={updatingId === order.id}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="block rounded-xl border border-[#634F40]/10 bg-white px-3 py-2 text-[12px] text-[#634F40] outline-none"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Link
                    to={`/admin/orders/${order.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/15 px-4 py-2.5 text-[13px] font-medium text-[#420060] transition hover:bg-[#420060]/5"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}