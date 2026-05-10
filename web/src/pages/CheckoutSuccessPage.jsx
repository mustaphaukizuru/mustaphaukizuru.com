import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  Download, LayoutDashboard, ArrowRight,
  Mail, ShoppingBag, Star, Package, Shield, Sparkles, Clock3,
  AlertCircle, Loader2, FileDown, ExternalLink,
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { authFetch, API_BASE_URL } from "../lib/api"
import { formatPrice } from "../lib/format"
import { fetchMyOrderById } from "../services/orderService"
import { getFileTypeStyles } from "../lib/fileTypeIcons"

/* ──────────────────────────────────────────────────────────────────────────
 *  CheckoutSuccessPage · F08.C · Batch 5
 *
 *  Refinements applied:
 *    - Animated SVG checkmark with Framer Motion path-draw (~300 ms,
 *      ease-out-expo). Replaces the static Lucide CheckCircle2 icon for the
 *      success hero.
 *    - "Thank you!" title + "Order #ORD-XXX confirmed" line with order
 *      number in JetBrains Mono.
 *    - NEW: Order summary card fetches the order via fetchMyOrderById(orderId)
 *      from B04 enriched endpoint. Shows line items + price.
 *    - NEW: Per-digital-file "Download now" button per item using the
 *      enriched downloads[] array returned by B04. Falls back to "Available
 *      in dashboard" when the list isn't included.
 *    - "Access in dashboard" secondary CTA → /dashboard/downloads
 *      (previously linked to /dashboard/products).
 *    - "Check your email for confirmation and receipt" note kept and
 *      restyled into a single info chip.
 *
 *  Preserved verbatim:
 *    - clearCart() on mount
 *    - MercadoPago "pending" polling logic via /api/mercadopago/status
 *    - Failed / Polling / Paid status branches
 *    - Search-param-driven gateway display
 *  ──────────────────────────────────────────────────────────────────── */

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.10 } } }

/* ──────────────────────────────────────────────────────────────────────────
 *  AnimatedCheckmark · F08.C · path-draw SVG checkmark, ease-out-expo
 *  Sized to fit a 96×96 container. Stroke draws over ~300 ms.
 *  ──────────────────────────────────────────────────────────────────── */
function AnimatedCheckmark({ size = 96 }) {
  const { t } = useTranslation("checkout")
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={t("success.successAria")}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Solid green disc background */}
      <motion.circle
        cx="48"
        cy="48"
        r="44"
        fill="var(--color-mint)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Path-drawn checkmark */}
      <motion.path
        d="M30 50 L43 63 L66 36"
        fill="none"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.30, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
      />
    </motion.svg>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Format the order reference exactly as spec: ORD-YYYYMMDD-XXX
 *  Falls back to the raw orderId if no createdAt exists.
 *  ──────────────────────────────────────────────────────────────────── */
function formatOrderRef(order, fallbackId) {
  if (!order && fallbackId) return `#${String(fallbackId).slice(0, 12).toUpperCase()}`
  if (!order) return ""
  if (order.orderNumber) return `#${order.orderNumber}`
  const created = order.createdAt ? new Date(order.createdAt) : null
  if (created && !isNaN(created.getTime())) {
    const yyyy = created.getFullYear()
    const mm = String(created.getMonth() + 1).padStart(2, "0")
    const dd = String(created.getDate()).padStart(2, "0")
    const tail = String(order.id || fallbackId || "").slice(0, 6).toUpperCase()
    return `#ORD-${yyyy}${mm}${dd}-${tail}`
  }
  return `#${String(order.id || fallbackId || "").slice(0, 12).toUpperCase()}`
}

export default function CheckoutSuccessPage() {
  const { t } = useTranslation("checkout")
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()
  const { clearCart } = useCart()

  const gateway = searchParams.get("gateway")
  const isPending = searchParams.get("pending") === "true"

  const [orderStatus, setOrderStatus] = useState(isPending ? "pending" : "paid")
  const [polling, setPolling] = useState(isPending)
  const [pollCount, setPollCount] = useState(0)

  // F08.C · order detail state
  const [order, setOrder] = useState(null)
  const [orderLoading, setOrderLoading] = useState(true)
  const [orderError, setOrderError] = useState("")

  // Clear cart on mount
  useEffect(() => { clearCart() }, [clearCart])

  // PRESERVED · MercadoPago pending polling
  useEffect(() => {
    if (!isPending || !orderId || !polling) return
    if (pollCount >= 10) { setPolling(false); return }

    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/mercadopago/status/${orderId}`)
        const status = res?.data?.status
        if (status === "paid") {
          setOrderStatus("paid")
          setPolling(false)
        } else if (status === "failed" || status === "cancelled") {
          setOrderStatus("failed")
          setPolling(false)
        } else {
          setPollCount((c) => c + 1)
        }
      } catch {
        setPollCount((c) => c + 1)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [isPending, orderId, polling, pollCount])

  // F08.C · fetch full order once status reaches "paid"
  useEffect(() => {
    if (!orderId || orderStatus !== "paid") return
    let cancelled = false
    ;(async () => {
      setOrderLoading(true)
      setOrderError("")
      try {
        const data = await fetchMyOrderById(orderId)
        if (!cancelled) setOrder(data || null)
      } catch (err) {
        if (!cancelled) setOrderError(err?.message || "Could not load order details.")
      } finally {
        if (!cancelled) setOrderLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId, orderStatus])

  const isPaid = orderStatus === "paid"
  const isFailed = orderStatus === "failed"

  const orderRef = formatOrderRef(order, orderId)
  const items = Array.isArray(order?.items) ? order.items : []
  const downloads = Array.isArray(order?.downloads) ? order.downloads : []
  const subtotal = Number(order?.subtotal ?? 0)
  const discount = Number(order?.discount ?? 0)
  const orderTotal = Number(order?.total ?? subtotal)

  // Build a map of productId → downloads[] for per-item button rendering
  const downloadsByProduct = downloads.reduce((acc, d) => {
    const pid = d.productId || d.product?.id
    if (!pid) return acc
    if (!acc[pid]) acc[pid] = []
    acc[pid].push(d)
    return acc
  }, {})

  return (
    <div className="bg-mist">
      {/* Hero band — inline backgroundColor guarantees the right dark/violet
          surface even if Tailwind's JIT misses the dynamic class names. */}
      <div
        className="py-16 text-center"
        style={{
          backgroundColor: isFailed ? "#1A1B23" : polling ? "#1A1B23" : "#5D3FD3",
        }}
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "backOut" }}
          className="mx-auto inline-flex items-center justify-center"
        >
          {isFailed ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#E5484D] shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              <AlertCircle className="h-12 w-12 text-white" aria-hidden="true" />
            </div>
          ) : polling ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F59E0B] shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              <Loader2 className="h-12 w-12 animate-spin text-white" aria-hidden="true" />
            </div>
          ) : (
            <AnimatedCheckmark size={96} />
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
          <h1 className="mt-6 text-page font-bold text-white">
            {isFailed ? t("success.failedTitle", "Payment Failed") : polling ? t("success.confirming", "Confirming Payment…") : t("success.title", "Thank you!")}
          </h1>
          <p className="mt-2 text-body text-white/70">
            {isFailed ? t("success.failedSubtitle", "Your payment could not be processed. Please try again.") :
             polling ? t("success.confirmingSubtitle", "Waiting for payment confirmation. This takes a moment…") :
                         orderRef ? (
                           <>
                             {t("success.orderNumber", "Order")}{" "}
                             <span className="font-mono font-bold tabular-nums text-terracotta">{orderRef}</span>
                             {" "}{t("success.confirmed", "confirmed.")}
                           </>
                         ) : t("success.subtitle", "Your order is confirmed and your digital products are ready.")}
          </p>
          {gateway && !isFailed && !polling && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-micro text-white/70">
              {t("misc.paidVia")} {gateway === "mercadopago" ? "Mercado Pago" : "PayPal"}
            </div>
          )}
        </motion.div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {isFailed ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5 text-center">
            <motion.p variants={fadeUp} className="text-body text-charcoal-80/65">
              {t("misc.noChargeBody")}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/checkout"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                {t("success.tryAgain")}
              </Link>
              <Link
                to="/store"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/20 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                {t("success.backToStore")}
              </Link>
            </motion.div>
          </motion.div>
        ) : polling ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center gap-5 text-center">
            <motion.div variants={fadeUp} className="rounded-xl border border-[#F59E0B]/20 bg-[#fffbeb] p-6 text-meta text-[#92400e] max-w-sm">
              <Clock3 className="mx-auto mb-3 h-8 w-8 text-[#F59E0B]" aria-hidden="true" />
              {t("success.processingMP")}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5">

            {/* F08.C · Email confirmation note (unified into one chip) */}
            <motion.div
              variants={fadeUp}
              className="flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[0_4px_16px_rgba(93,63,211,0.05)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint/15 text-mint">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 text-meta text-charcoal-80/75">
                {t("success.checkEmail")}
              </div>
            </motion.div>

            {/* F08.C · Order summary card (NEW) */}
            <motion.div variants={fadeUp} className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
              <div className="flex items-center justify-between border-b border-charcoal-80/10 px-6 py-5">
                <div>
                  <div className="text-micro font-semibold uppercase tracking-[0.18em] text-charcoal-80/50">{t("success.orderSummary")}</div>
                  {orderRef && (
                    <div className="mt-1 font-mono text-body font-bold tabular-nums text-violet">{orderRef}</div>
                  )}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>

              <div className="px-6 py-5">
                {orderLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-16 animate-pulse rounded-xl bg-violet-pale" />
                    ))}
                  </div>
                ) : orderError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-meta text-red-700">
                    {orderError}
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-meta text-charcoal-80/55">
                    {t("success.orderPreparing")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => {
                      const productId = item.productId || item.product?.id
                      const title = item.title || item.product?.title || "Item"
                      const qty = Number(item.quantity ?? 1)
                      const price = Number(item.price ?? item.unitPrice ?? 0)
                      const dls = downloadsByProduct[productId] || []

                      return (
                        <div key={item.id || productId} className="rounded-xl border border-charcoal-80/10 bg-mist p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-meta font-semibold text-violet">{title}</div>
                              <div className="text-micro text-charcoal-80/55">
                                <span className="font-mono tabular-nums">{t("misc.qty")} {qty}</span>
                              </div>
                            </div>
                            <div className="shrink-0 font-mono text-meta font-bold tabular-nums text-violet">
                              {formatPrice(price * qty, order?.currency || "MXN")}
                            </div>
                          </div>

                          {/* F08.C · Per-file Download buttons */}
                          {dls.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {dls.map((dl) => {
                                const styles = getFileTypeStyles(dl.fileType || dl.fileName || "")
                                const url = dl.downloadUrl?.startsWith("http")
                                  ? dl.downloadUrl
                                  : `${API_BASE_URL}${dl.downloadUrl || ""}`
                                return (
                                  <a
                                    key={dl.id || dl.fileId || dl.fileName}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-micro font-semibold transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(93,63,211,0.10)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                                    style={{ borderColor: styles.borderColor, color: styles.color }}
                                    aria-label={`Download ${dl.fileName || dl.fileType}`}
                                  >
                                    <span
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold uppercase"
                                      style={{ background: styles.background, color: styles.color }}
                                    >
                                      {styles.label?.slice(0, 3) || "FILE"}
                                    </span>
                                    <span className="max-w-[200px] truncate">{dl.fileName || styles.label}</span>
                                    <FileDown className="h-3.5 w-3.5 transition group-hover:translate-y-0.5" aria-hidden="true" />
                                  </a>
                                )
                              })}
                            </div>
                          )}

                          {dls.length === 0 && downloads.length === 0 && (
                            <p className="mt-2 text-micro text-charcoal-80/55">
                              {t("success.availableIn")}{" "}
                              <Link to="/dashboard/downloads" className="font-semibold text-violet hover:underline">
                                {t("success.downloadsDashboard")}
                              </Link>.
                            </p>
                          )}
                        </div>
                      )
                    })}

                    {/* Totals strip */}
                    {(subtotal > 0 || orderTotal > 0) && (
                      <div className="mt-4 space-y-2 border-t border-charcoal-80/10 pt-4 text-meta">
                        <div className="flex justify-between text-charcoal-80/65">
                          <span>{t("success.subtotalLabel")}</span>
                          <span className="font-mono font-semibold tabular-nums text-violet">
                            {formatPrice(subtotal, order?.currency || "MXN")}
                          </span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-mint">
                            <span>{t("success.discountLabel")}</span>
                            <span className="font-mono font-semibold tabular-nums">−{formatPrice(discount, order?.currency || "MXN")}</span>
                          </div>
                        )}
                        <div className="flex items-baseline justify-between border-t border-charcoal-80/10 pt-2">
                          <span className="text-body font-bold text-violet">{t("success.totalLabel")}</span>
                          <span className="font-mono text-card font-extrabold tabular-nums text-violet">
                            {formatPrice(orderTotal, order?.currency || "MXN")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* What happens next */}
            <motion.div variants={fadeUp} className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.05)]">
              <h3 className="mb-4 text-body font-bold text-violet">{t("success.whatNext")}</h3>
              <div className="space-y-4">
                {[
                  { icon: Mail, title: "Confirmation Email Sent", desc: "Check your inbox for the order confirmation and receipt.", done: true },
                  { icon: Package, title: "Products Ready to Download", desc: "Your digital products are available immediately in your dashboard.", done: true },
                  { icon: Shield, title: "Lifetime Access", desc: "Access your purchased products anytime from your dashboard.", done: false },
                ].map(({ icon: Icon, title, desc, done }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-mint/15 text-mint" : "bg-violet-pale text-violet"}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-meta font-semibold text-violet">{title}</span>
                        {done && (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-mint text-white" aria-label={t("success.completeAria")}>
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-meta text-charcoal-80/65">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* F08.C · Actions, primary download / secondary dashboard */}
            <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/dashboard/downloads"
                className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet py-4 text-meta font-semibold text-white shadow-[0_10px_28px_rgba(93,63,211,0.22)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                {t("success.downloadResources")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link
                to="/dashboard"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet/20 py-4 text-meta font-semibold text-violet transition hover:-translate-y-0.5 hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> {t("success.accessDashboard")}
              </Link>
            </motion.div>

            {/* Rating */}
            <motion.div variants={fadeUp} className="flex flex-col items-center gap-4 rounded-xl border border-charcoal-80/10 bg-white p-5 text-center">
              <div className="flex gap-1 text-terracotta">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-5 w-5 fill-current" aria-hidden="true" />)}
              </div>
              <p className="text-meta text-charcoal-80/65">
                {t("success.purchaseThanks", "Thank you for your purchase! We hope the resources support your work and goals.")}
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="flex items-center justify-center">
              <Link
                to="/store"
                className="inline-flex items-center gap-1.5 rounded-md text-meta font-medium text-charcoal-80/55 hover:text-violet hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" /> {t("success.continueShopping")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
