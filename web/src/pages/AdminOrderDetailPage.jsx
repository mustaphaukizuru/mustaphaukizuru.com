import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CreditCard, Package, User } from "lucide-react"
import { fetchAdminOrderById, updateAdminOrderStatus } from "../services/adminOrderService"

const STATUS_OPTIONS = ["pending", "paid", "failed", "cancelled", "refunded"]

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  async function loadOrder() {
    try {
      setLoading(true)
      setErrorMessage("")
      const data = await fetchAdminOrderById(id)
      setOrder(data)
    } catch (error) {
      setErrorMessage(error.message || "Failed to load order details.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
  }, [id])

  async function handleStatusChange(nextStatus) {
    try {
      setErrorMessage("")
      setSuccessMessage("")
      await updateAdminOrderStatus(id, nextStatus)
      await loadOrder()
      setSuccessMessage(`Order updated to ${nextStatus}.`)
    } catch (error) {
      setErrorMessage(error.message || "Failed to update order status.")
    }
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <p className="text-[13px] text-[#634F40]/70">Loading order details...</p>
        </div>
      </section>
    )
  }

  if (!order) {
    return (
      <section className="space-y-5">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <p className="text-[13px] text-[#634F40]/70">Order not found.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/15 px-4 py-2.5 text-[13px] font-medium text-[#420060] transition hover:bg-[#420060]/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>

        <select
          value={order.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-xl border border-[#634F40]/10 bg-white px-4 py-3 text-[13px] text-[#420060] outline-none"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] uppercase tracking-[0.12em] text-[#634F40]/55">
                Order Record
              </div>
              <h2 className="mt-2 text-[28px] font-bold tracking-tight text-[#420060]">
                #{order.orderNumber || order.id}
              </h2>
              <p className="mt-2 text-[13px] text-[#634F40]/70">
                Created {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="rounded-full bg-[#ede4ef] px-4 py-2 text-[12px] font-semibold capitalize text-[#420060]">
              {order.status}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-[#fbf8fb] p-4">
              <div className="text-[12px] text-[#634F40]/65">Total</div>
              <div className="mt-2 text-[22px] font-bold text-[#420060]">
                ${Number(order.totalAmount || 0).toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-[#fbf8fb] p-4">
              <div className="text-[12px] text-[#634F40]/65">Items</div>
              <div className="mt-2 text-[22px] font-bold text-[#420060]">
                {order.items?.length || 0}
              </div>
            </div>

            <div className="rounded-xl bg-[#fbf8fb] p-4">
              <div className="text-[12px] text-[#634F40]/65">Customer Email</div>
              <div className="mt-2 text-[14px] font-semibold text-[#420060] break-all">
                {order.customerEmail || "—"}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-[18px] font-semibold text-[#420060]">Order Items</h3>

            <div className="mt-4 space-y-3">
              {(order.items || []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-[#420060]">
                        {item.product?.title || item.title || "Product"}
                      </div>
                      <div className="mt-1 text-[12px] text-[#634F40]/70">
                        Qty: {item.quantity}
                      </div>
                      {item.product?.slug ? (
                        <div className="mt-1 text-[12px] text-[#634F40]/60">
                          /store/{item.product.slug}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-[14px] font-semibold text-[#420060]">
                      ${Number(item.lineTotal || item.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#ede4ef] p-3 text-[#420060]">
                <User className="h-4 w-4" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#420060]">Customer</h3>
            </div>

            <div className="mt-4 space-y-3 text-[13px]">
              <div>
                <div className="text-[#634F40]/60">Name</div>
                <div className="mt-1 font-semibold text-[#420060]">
                  {order.customerName || "—"}
                </div>
              </div>
              <div>
                <div className="text-[#634F40]/60">Email</div>
                <div className="mt-1 font-semibold text-[#420060] break-all">
                  {order.customerEmail || "—"}
                </div>
              </div>
              <div>
                <div className="text-[#634F40]/60">User Account</div>
                <div className="mt-1 font-semibold text-[#420060]">
                  {order.user?.fullName || order.user?.email || "Guest / not linked"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#eef3fb] p-3 text-[#2f5ea8]">
                <CreditCard className="h-4 w-4" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#420060]">Payments</h3>
            </div>

            <div className="mt-4 space-y-3">
              {(order.payments || []).length === 0 ? (
                <div className="rounded-xl bg-[#fbf8fb] px-4 py-4 text-[13px] text-[#634F40]/70">
                  No payment records found.
                </div>
              ) : (
                order.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4"
                  >
                    <div className="text-[14px] font-semibold capitalize text-[#420060]">
                      {payment.paymentGateway}
                    </div>
                    <div className="mt-2 text-[12px] text-[#634F40]/70">
                      Status: {payment.paymentStatus}
                    </div>
                    <div className="mt-1 text-[12px] text-[#634F40]/70 break-all">
                      Ref: {payment.gatewayTransactionId || payment.gatewaySessionId || "—"}
                    </div>
                    <div className="mt-1 text-[12px] text-[#634F40]/70">
                      Amount: ${Number(payment.amount || 0).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#e8f4ea] p-3 text-[#3b8f47]">
                <Package className="h-4 w-4" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#420060]">Metadata</h3>
            </div>

            <div className="mt-4 space-y-3 text-[13px]">
              <div>
                <div className="text-[#634F40]/60">Order ID</div>
                <div className="mt-1 font-semibold text-[#420060] break-all">{order.id}</div>
              </div>
              <div>
                <div className="text-[#634F40]/60">Created At</div>
                <div className="mt-1 font-semibold text-[#420060]">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[#634F40]/60">Updated At</div>
                <div className="mt-1 font-semibold text-[#420060]">
                  {new Date(order.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}