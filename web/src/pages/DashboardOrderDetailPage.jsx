import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Package, Loader2, AlertCircle, FileDown } from "lucide-react"
import { fetchMyOrderById } from "../services/orderService"
import { authFetch, API_BASE_URL } from "../lib/api"
import { formatPrice } from "../lib/format"
import { triggerBrowserDownload } from "../services/downloadService"

/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardOrderDetailPage · member-side single-order view.
 *  Wired to the Order History "View" button (route: /dashboard/orders/:orderId).
 *  Reuses the existing fetchMyOrderById service — no new backend work.
 *  ────────────────────────────────────────────────────────────────────── */

function statusPillClass(status) {
  if (status === "paid") return "bg-mint/15 text-mint"
  if (status === "pending") return "bg-amber/15 text-amber-700"
  if (status === "failed" || status === "cancelled") return "bg-rose/15 text-rose-700"
  return "bg-charcoal-80/10 text-charcoal-80/65"
}

function resolveImg(item) {
  const product = item.product
  if (!product) return null
  if (Array.isArray(product.images) && product.images.length > 0) {
    const primary =
      product.images.find((i) => i?.isPrimary) ||
      product.images.find((i) => i?.imageRole === "cover") ||
      product.images.find((i) => i?.url)
    if (primary?.url) {
      return primary.url.startsWith("http")
        ? primary.url
        : `${API_BASE_URL}${primary.url}`
    }
  }
  return null
}

export default function DashboardOrderDetailPage() {
  const { t } = useTranslation("dashboard")
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!orderId) return undefined
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const data = await fetchMyOrderById(orderId)
        if (!cancelled) setOrder(data || null)
      } catch (err) {
        if (!cancelled) setError(err?.message || t("orderDetail.errorLoading", "Could not load order details."))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId, t])

  async function handleInvoice() {
    if (!orderId) return
    try {
      const res = await authFetch(`/api/v1/orders/${orderId}/invoice.pdf`, { method: "GET" })
      const blob = res?.data instanceof Blob ? res.data : null
      if (!blob) throw new Error(t("orderDetail.invoiceUnavailable", "Invoice not available."))
      triggerBrowserDownload(blob, `invoice-${orderId}.pdf`)
    } catch (err) {
      setError(
        err?.toUserMessage?.() ||
        err?.message ||
        t("orderDetail.invoiceUnavailable", "Invoice not available."),
      )
    }
  }

  if (loading) {
    return (
      <section className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet" aria-hidden="true" />
      </section>
    )
  }

  if (error || !order) {
    return (
      <section className="space-y-4">
        <Link
          to="/dashboard/orders"
          className="inline-flex items-center gap-1.5 text-meta font-medium text-charcoal-80/60 transition hover:text-violet"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("orderDetail.backToOrders", "Back to Order History")}
        </Link>
        <div className="flex items-start gap-3 rounded-xl border border-rose/30 bg-rose/5 px-4 py-3 text-meta text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error || t("orderDetail.notFound", "Order not found.")}</span>
        </div>
      </section>
    )
  }

  const items = Array.isArray(order.items) ? order.items : []
  const subtotal = Number(order.subtotal ?? 0)
  const discount = Number(order.discount ?? 0)
  const total = Number(order.total ?? subtotal)
  const orderRef = order.orderNumber ? `#${order.orderNumber}` : `#${String(order.id).slice(0, 12).toUpperCase()}`
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : ""

  return (
    <section className="space-y-5">
      <Link
        to="/dashboard/orders"
        className="inline-flex items-center gap-1.5 text-meta font-medium text-charcoal-80/60 transition hover:text-violet"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("orderDetail.backToOrders", "Back to Order History")}
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.14em] text-charcoal-80/45">
              {t("orderDetail.title", "Order")}
            </p>
            <h1 className="mt-1 font-mono text-section font-bold text-violet">{orderRef}</h1>
            {createdAt && (
              <p className="mt-1 text-meta text-charcoal-80/60">{createdAt}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-micro font-semibold uppercase tracking-wide ${statusPillClass(order.status)}`}>
              {order.status || "—"}
            </span>
            <button
              type="button"
              onClick={handleInvoice}
              className="inline-flex items-center gap-2 rounded-lg border border-violet/15 bg-white px-3 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              {t("orderDetail.invoice", "Invoice")}
            </button>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
        <h2 className="text-card font-bold text-violet">
          {t("orderDetail.items", "Items")}
        </h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const img = resolveImg(item)
            const qty = Number(item.quantity ?? 1)
            const price = Number(item.priceSnapshot ?? item.price ?? 0)
            const title = item.titleSnapshot || item.product?.title || item.title || "—"
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border border-charcoal-80/8 bg-[#fafafa] p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-violet-pale">
                  {img ? (
                    <img src={img} alt={title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-violet/30">
                      <Package className="h-6 w-6" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-meta font-semibold text-violet">{title}</div>
                  <div className="text-micro text-charcoal-80/55">
                    <span className="font-mono tabular-nums">×{qty}</span>
                  </div>
                </div>
                <div className="shrink-0 font-mono text-meta font-bold tabular-nums text-violet">
                  {formatPrice(price * qty, order.currency || "MXN")}
                </div>
              </li>
            )
          })}
        </ul>

        {/* Totals */}
        <div className="mt-5 space-y-2 border-t border-charcoal-80/10 pt-4">
          <div className="flex justify-between text-meta text-charcoal-80/65">
            <span>{t("orderDetail.subtotal", "Subtotal")}</span>
            <span className="font-mono font-semibold tabular-nums text-violet">{formatPrice(subtotal, order.currency || "MXN")}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-meta text-mint">
              <span>{t("orderDetail.discount", "Discount")}</span>
              <span className="font-mono font-semibold tabular-nums">−{formatPrice(discount, order.currency || "MXN")}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-charcoal-80/10 pt-3">
            <span className="text-body font-bold text-violet">{t("orderDetail.total", "Total")}</span>
            <span className="font-mono text-section font-extrabold tabular-nums text-violet">{formatPrice(total, order.currency || "MXN")}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
