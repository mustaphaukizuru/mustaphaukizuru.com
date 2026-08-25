import { useEffect, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { m, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, CreditCard, Package, User, RotateCcw, AlertTriangle,
  CheckCircle2, X, ShieldAlert, Clock, FileText,
} from "lucide-react"
import { fetchAdminOrderById, updateAdminOrderStatus } from "../services/adminOrderService"
import {
  fetchRefundEligibility,
  issueAdminRefund,
  fetchRefundsForOrder,
} from "../services/adminRefundService"
import { useToast } from "../context/ToastContext"

const STATUS_OPTIONS = ["pending", "paid", "failed", "cancelled", "refunded"]

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminOrderDetailPage · M15 (Refund flow)
 *
 *  Adds:
 *    • Refund history card (most recent first, with provider + amount).
 *    • Refund button — disabled unless eligibility says ANY item is refundable.
 *    • Refund modal — full-order refund only (reason + confirm), per-item
 *      ineligibility warning, override confirmation for downloaded items.
 *
 *  Aesthetic preserved exactly:
 *    Primary var(--color-violet) (`text-violet`) · violet-pale tints · rounded-xl cards
 *    · soft 10/24 shadow · Lucide icons · Framer Motion fadeUp/stagger.
 *  ──────────────────────────────────────────────────────────────────── */

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
}

function formatMoney(amount, currency = "MXN") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, maximumFractionDigits: 2,
    }).format(Number(amount))
  } catch {
    return `$${Number(amount || 0).toFixed(2)} ${currency}`
  }
}

export default function AdminOrderDetailPage() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showSuccess, showError } = useToast()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Refund flow state
  const [refundHistory, setRefundHistory] = useState([])
  const [eligibility, setEligibility] = useState(null)
  const [eligibilityLoading, setElLoading] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  // M16 — auto-open the refund modal when navigated from a refund_request
  // support ticket with ?action=refund. Runs once after the order has loaded
  // and only if the order is still in 'paid' state.
  const [autoRefundHandled, setAutoRefundHandled] = useState(false)

  async function loadOrder() {
    try {
      setLoading(true)
      setErrorMessage("")
      const [orderData, refunds] = await Promise.all([
        fetchAdminOrderById(id),
        fetchRefundsForOrder(id).catch(() => []),
      ])
      setOrder(orderData)
      setRefundHistory(refunds)
    } catch (error) {
      setErrorMessage(error.message || "Failed to load order details.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
  }, [id])

  // M16 — open the refund modal automatically when arriving from
  // AdminSupportPage with ?action=refund. We wait for the order to load
  // and only fire once.
  useEffect(() => {
    if (autoRefundHandled) return
    if (!order) return
    if (searchParams.get("action") !== "refund") return
    if (order.status !== "paid") {
      // Surface a friendly note if admin clicked the deep-link on an order
      // that's no longer paid (already refunded, cancelled, etc).
      setErrorMessage(`Refund modal not available, order is in '${order.status}' state.`)
      setAutoRefundHandled(true)
      return
    }
    setAutoRefundHandled(true)
    openRefundModal()
    // Strip the action param so a refresh doesn't reopen the modal.
    const next = new URLSearchParams(searchParams)
    next.delete("action")
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, autoRefundHandled])

  async function handleStatusChange(nextStatus) {
    try {
      setErrorMessage("")
      setSuccessMessage("")
      await updateAdminOrderStatus(id, nextStatus)
      showSuccess(`Order marked ${nextStatus.replace(/_/g, " ")}`)
      try { await loadOrder() } catch (re) { console.warn("[OrderDetail] reload failed:", re) }
      setSuccessMessage(`Order updated to ${nextStatus}.`)
    } catch (error) {
      console.error("[OrderDetail] status update failed:", error)
      const msg = error.message || "Failed to update order status."
      setErrorMessage(msg)
      showError(msg, "Could not update order")
    }
  }

  async function openRefundModal() {
    try {
      setElLoading(true)
      const data = await fetchRefundEligibility(id)
      setEligibility(data)
      setRefundModalOpen(true)
    } catch (e) {
      const msg = e.message || "Could not load refund eligibility."
      showError(msg, "Refund unavailable")
    } finally {
      setElLoading(false)
    }
  }

  function closeRefundModal() {
    setRefundModalOpen(false)
    setEligibility(null)
  }

  async function handleRefundSubmitted(result) {
    showSuccess(`Full refund of ${formatMoney(result.amount, order?.currency)} issued`)
    setRefundModalOpen(false)
    setEligibility(null)
    await loadOrder()
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
          <p className="text-meta text-charcoal-80/70">Loading order details...</p>
        </div>
      </section>
    )
  }

  if (!order) {
    return (
      <section className="space-y-5">
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
          <p className="text-meta text-charcoal-80/70">Order not found.</p>
        </div>
      </section>
    )
  }

  const canShowRefundButton = order.status === "paid"

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-2 rounded-xl border border-violet/15 px-4 py-2.5 text-meta font-medium text-violet transition hover:bg-violet/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>

        <div className="flex items-center gap-3 flex-wrap">
          {canShowRefundButton ? (
            <button
              type="button"
              onClick={openRefundModal}
              disabled={eligibilityLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-2.5 text-meta font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-400/30"
            >
              <RotateCcw className="h-4 w-4" />
              {eligibilityLoading ? "Checking…" : "Issue refund"}
            </button>
          ) : null}

          <select
            value={order.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-xl border border-charcoal-80/10 bg-white px-4 py-3 text-meta text-violet outline-none"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-mint/20 bg-mint/10 px-4 py-3 text-meta text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-micro uppercase tracking-[0.12em] text-charcoal-80/65">
                Order Record
              </div>
              <h2 className="mt-2 text-page font-bold tracking-tight text-violet">
                #{order.orderNumber || order.id}
              </h2>
              <p className="mt-2 text-meta text-charcoal-80/70">
                Created {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="rounded-full bg-violet-pale px-4 py-2 text-micro font-semibold capitalize text-violet">
              {order.status}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-violet-pale/40 p-4">
              <div className="text-micro text-charcoal-80/65">Total</div>
              <div className="mt-2 text-section font-bold text-violet">
                ${Number(order.totalAmount || 0).toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-violet-pale/40 p-4">
              <div className="text-micro text-charcoal-80/65">Items</div>
              <div className="mt-2 text-section font-bold text-violet">
                {order.items?.length || 0}
              </div>
            </div>

            <div className="rounded-xl bg-violet-pale/40 p-4">
              <div className="text-micro text-charcoal-80/65">Customer Email</div>
              <div className="mt-2 text-meta font-semibold text-violet break-all">
                {order.customerEmail || "-"}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-card font-semibold text-violet">Order Items</h3>

            <div className="mt-4 space-y-3">
              {(order.items || []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-charcoal-80/10 bg-mist p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-body font-semibold text-violet">
                        {item.product?.title || item.title || "Product"}
                      </div>
                      <div className="mt-1 text-micro text-charcoal-80/70">
                        Qty: {item.quantity}
                      </div>
                      {item.product?.slug ? (
                        <div className="mt-1 text-micro text-charcoal-80/65">
                          /store/{item.product.slug}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-meta font-semibold text-violet">
                      ${Number(item.lineTotal || item.price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-pale p-3 text-violet">
                <User className="h-4 w-4" />
              </div>
              <h3 className="text-card font-semibold text-violet">Customer</h3>
            </div>

            <div className="mt-4 space-y-3 text-meta">
              <div>
                <div className="text-charcoal-80/65">Name</div>
                <div className="mt-1 font-semibold text-violet">
                  {order.customerName || "-"}
                </div>
              </div>
              <div>
                <div className="text-charcoal-80/65">Email</div>
                <div className="mt-1 font-semibold text-violet break-all">
                  {order.customerEmail || "-"}
                </div>
              </div>
              <div>
                <div className="text-charcoal-80/65">User Account</div>
                <div className="mt-1 font-semibold text-violet">
                  {order.user?.fullName || order.user?.email || "Guest / not linked"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-azure-pale p-3 text-azure-800">
                <CreditCard className="h-4 w-4" />
              </div>
              <h3 className="text-card font-semibold text-violet">Payments</h3>
            </div>

            <div className="mt-4 space-y-3">
              {(order.payments || []).length === 0 ? (
                <div className="rounded-xl bg-violet-pale/40 px-4 py-4 text-meta text-charcoal-80/70">
                  No payment records found.
                </div>
              ) : (
                order.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border border-charcoal-80/10 bg-mist p-4"
                  >
                    <div className="text-meta font-semibold capitalize text-violet">
                      {payment.paymentGateway}
                    </div>
                    <div className="mt-2 text-micro text-charcoal-80/70">
                      Status: {payment.paymentStatus}
                    </div>
                    <div className="mt-1 text-micro text-charcoal-80/70 break-all">
                      Ref: {payment.gatewayTransactionId || payment.gatewaySessionId || "-"}
                    </div>
                    <div className="mt-1 text-micro text-charcoal-80/70">
                      Amount: ${Number(payment.amount || 0).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <RefundHistoryCard refunds={refundHistory} currency={order.currency} />

          <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-mint/12 p-3 text-emerald-700">
                <Package className="h-4 w-4" />
              </div>
              <h3 className="text-card font-semibold text-violet">Metadata</h3>
            </div>

            <div className="mt-4 space-y-3 text-meta">
              <div>
                <div className="text-charcoal-80/65">Order ID</div>
                <div className="mt-1 font-semibold text-violet break-all">{order.id}</div>
              </div>
              <div>
                <div className="text-charcoal-80/65">Created At</div>
                <div className="mt-1 font-semibold text-violet">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-charcoal-80/65">Updated At</div>
                <div className="mt-1 font-semibold text-violet">
                  {new Date(order.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {refundModalOpen && eligibility ? (
          <RefundModal
            eligibility={eligibility}
            orderId={order.id}
            currency={order.currency}
            onClose={closeRefundModal}
            onSubmitted={handleRefundSubmitted}
          />
        ) : null}
      </AnimatePresence>
    </section>
  )
}

/* ─────────────────────── Refund history card ───────────────────────────── */

function RefundHistoryCard({ refunds, currency }) {
  if (!refunds || refunds.length === 0) {
    return (
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
            <RotateCcw className="h-4 w-4" />
          </div>
          <h3 className="text-card font-semibold text-violet">Refund History</h3>
        </div>
        <p className="mt-4 text-meta text-charcoal-80/65">No refunds recorded for this order.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgb(var(--color-violet-rgb)/0.04)]">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
          <RotateCcw className="h-4 w-4" />
        </div>
        <h3 className="text-card font-semibold text-violet">Refund History</h3>
      </div>

      <ul className="mt-4 space-y-3">
        {refunds.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-charcoal-80/10 bg-mist p-4"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-meta font-semibold text-violet">
                {formatMoney(r.amount, currency || "MXN")}
              </div>
              <span className={`rounded-full px-3 py-1 text-micro font-semibold capitalize ${
                r.refundStatus === "succeeded" ? "bg-mint/15 text-mint-700" :
                r.refundStatus === "failed" ? "bg-rose-50 text-rose-600" :
                                                  "bg-amber/10 text-amber-700"
              }`}>
                {r.refundStatus}
              </span>
            </div>
            <div className="mt-2 grid gap-1 text-micro text-charcoal-80/70">
              <div>Provider: <span className="font-semibold capitalize text-violet">{r.provider || "-"}</span></div>
              {r.reason ? <div className="break-words">Reason: {r.reason}</div> : null}
              <div>
                {r.processedAt
                  ? `Processed ${new Date(r.processedAt).toLocaleString()}`
                  : `Created ${new Date(r.createdAt).toLocaleString()}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─────────────────────────── Refund modal ──────────────────────────────── */

function RefundModal({ eligibility, orderId, currency, onClose, onSubmitted }) {
  const [reason, setReason] = useState("")
  const [force, setForce] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const blockedItems = useMemo(
    () => eligibility.items.filter((i) => !i.eligible),
    [eligibility.items],
  )


  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg("")
    setSubmitting(true)
    try {
      // Full refund only — the service always refunds the remaining balance.
      const result = await issueAdminRefund(orderId, {
        reason: reason.trim() || null,
        force,
      })
      onSubmitted({
        ...result,
        amount: result.amount || eligibility.refundableAmount,
      })
    } catch (err) {
      setErrorMsg(err.message || "Refund failed")
      setSubmitting(false)
    }
  }

  const hasBlocked = blockedItems.length > 0
  const submitDisabled =
    submitting ||
    !!eligibility.reason ||
    !confirmed ||
    (hasBlocked && !force)

  return (
    <m.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-80/55 px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Issue refund"
    >
      <m.form
        onSubmit={handleSubmit}
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_48px_rgb(var(--color-violet-rgb)/0.18)]"
        {...fadeUp}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-charcoal-80/65 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-card font-bold text-violet">Issue Refund</h2>
            <p className="text-micro text-charcoal-80/70">
              Order #{eligibility.orderNumber || eligibility.orderId} · {formatMoney(eligibility.totalAmount, currency)}
            </p>
          </div>
        </div>

        {/* Eligibility summary */}
        {eligibility.reason ? (
          <div className="mt-5 rounded-xl border border-rose/20 bg-rose/5 p-4 text-meta text-rose-700 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Refund blocked</div>
              <div className="mt-1">{eligibility.reason}</div>
            </div>
          </div>
        ) : null}

        {!eligibility.withinWindow ? (
          <div className="mt-5 rounded-xl border border-amber/20 bg-amber/10 p-4 text-meta text-amber-700 flex items-start gap-3">
            <Clock className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Outside the {eligibility.refundWindowDays}-day refund window</div>
              <div className="mt-1">
                Window expired {new Date(eligibility.paidWindowExpiresAt).toLocaleDateString()}.
                Issuing a refund anyway is allowed but will be flagged in the audit log.
              </div>
            </div>
          </div>
        ) : null}

        {hasBlocked ? (
          <div className="mt-5 rounded-xl border border-amber/20 bg-amber/10 p-4 text-meta text-amber-700">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-semibold">
                  {blockedItems.length} item{blockedItems.length === 1 ? "" : "s"} already downloaded
                </div>
                <div className="mt-1">
                  Per the Option A refund policy, downloaded items are not eligible for self-service refund.
                  Override only if you have a strong customer-service reason.
                </div>
                <ul className="mt-3 space-y-1 text-micro">
                  {blockedItems.map((b) => (
                    <li key={b.orderItemId} className="font-medium">
                      • {b.title}, {b.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {/* Refundable balance summary */}
        <dl className="mt-5 grid grid-cols-3 gap-3 text-meta">
          <div className="rounded-xl bg-violet-pale/40 p-4">
            <dt className="text-micro text-charcoal-80/65">Order total</dt>
            <dd className="mt-1 font-bold text-violet">{formatMoney(eligibility.totalAmount, currency)}</dd>
          </div>
          <div className="rounded-xl bg-violet-pale/40 p-4">
            <dt className="text-micro text-charcoal-80/65">Already refunded</dt>
            <dd className="mt-1 font-bold text-violet">{formatMoney(eligibility.alreadyRefunded, currency)}</dd>
          </div>
          <div className="rounded-xl bg-mint/10 p-4">
            <dt className="text-micro text-charcoal-80/65">Refundable</dt>
            <dd className="mt-1 font-bold text-mint-700">{formatMoney(eligibility.refundableAmount, currency)}</dd>
          </div>
        </dl>

        {/* Full refund summary */}
        <div className="mt-5 rounded-xl border border-violet/20 bg-violet-pale/40 p-4">
          <div className="text-meta font-semibold text-violet">Refund order (full)</div>
          <div className="mt-1 text-micro text-charcoal-80/65">
            {formatMoney(eligibility.refundableAmount, currency)} will be returned to the customer.
            All download access for this order will be revoked. Partial refunds are not supported.
          </div>
          {eligibility.items.length ? (
            <ul className="mt-3 space-y-1 text-micro text-charcoal-80/80">
              {eligibility.items.map((item) => (
                <li key={item.orderItemId} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {item.title}
                    {item.itemType !== "product" ? " · service" : ""}
                    {!item.eligible ? <span className="ml-1 font-semibold text-amber-700">⚠ {item.reason}</span> : null}
                  </span>
                  <span className="font-mono tabular-nums">Qty {item.quantity} · {formatMoney(item.lineTotal, currency)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Reason */}
        <div className="mt-5">
          <label htmlFor="refund-reason" className="text-meta font-semibold text-violet">
            Reason <span className="text-charcoal-80/65 font-normal">(audit + customer email)</span>
          </label>
          <textarea
            id="refund-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer reported a defective file. Approved per policy section 3."
            className="mt-2 w-full rounded-xl border border-charcoal-80/15 bg-white px-4 py-3 text-meta text-violet outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
            maxLength={1000}
          />
        </div>

        {/* Override toggle */}
        {hasBlocked ? (
          <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber/20 bg-amber/10 p-4">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
            />
            <span className="text-meta text-amber-700">
              <span className="font-semibold">Override Option A, refund downloaded items anyway.</span>
              <br />
              I confirm this is a customer-service exception. The override and bypassed items will be recorded in the audit log.
            </span>
          </label>
        ) : null}

        {/* Confirmation */}
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-charcoal-80/15 bg-white p-4">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-charcoal-80/30 text-violet focus:ring-violet"
          />
          <span className="text-meta text-charcoal-80">
            I confirm a <span className="font-semibold">full refund of {formatMoney(eligibility.refundableAmount, currency)}</span> for this order. This cannot be undone.
          </span>
        </label>

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700">
            {errorMsg}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-charcoal-80/15 bg-white px-5 py-2.5 text-meta font-semibold text-charcoal-80 transition hover:bg-violet-pale/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-400/40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? "Processing…" : "Refund order (full)"}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 text-micro text-charcoal-80/65">
          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            Funds are returned to the original payment method via{" "}
            <span className="font-semibold capitalize">
              {(eligibility.payments[0]?.gateway) || "the original gateway"}
            </span>
            . All customer downloads for this order will be revoked immediately.
          </p>
        </div>
      </m.form>
    </m.div>
  )
}
