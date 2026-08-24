import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { m } from "framer-motion"
import {
  Download, LayoutDashboard, ArrowRight, Mail, ShoppingBag, Package, Shield,
  Clock3, AlertCircle, Loader2, FileDown, FileText, Check, RefreshCw, KeyRound, LogIn,
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { apiRequest, getStoredToken } from "../lib/api"
import { formatPrice } from "../lib/format"
import { fetchMyOrderById } from "../services/orderService"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"
import { downloadFileById, downloadInvoice, downloadErrorKey } from "../components/product/downloadHelpers"
import Confetti from "../components/motion/Confetti"
import SuccessCheck from "../components/motion/SuccessCheck"

/* ──────────────────────────────────────────────────────────────────────────
 *  CheckoutSuccessPage · roadmap 26 · instant download after payment
 *
 *  Phases
 *    pending  → polls GET /api/orders/:id/status (public probe) every 3 s,
 *               up to ~2 min, until the gateway (Mercado Pago) confirms.
 *    timeout  → "we'll email you" + Check again.
 *    failed   → retry / back to store.
 *    paid     → signed-in owner: order summary + per-file Download buttons
 *               (GET /api/downloads/:productFileId, entitlement-gated) +
 *               receipt PDF (GET /api/orders/:id/invoice.pdf) + dashboard link.
 *               guest (claim-link account): "check your email to claim your
 *               account" — downloads are NOT exposed (API requires auth).
 *  ────────────────────────────────────────────────────────────────────────── */

const HERO_CONFETTI_COLORS = ["#FFFFFF", "#E9C46A", "#34D399", "#B9A6F2", "#7DD3FC"]
const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 40 // ≈ 2 minutes

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.10 } } }

// The success checkmark lives in components/motion/SuccessCheck.jsx — it is the
// same drawing as the one that used to be inlined here, but it honours
// prefers-reduced-motion (renders the final frame instead of animating).

function formatOrderRef({ order, probe, fallbackId }) {
  const number = order?.orderNumber || probe?.orderNumber
  if (number) return `#${number}`
  return fallbackId ? `#${String(fallbackId).slice(0, 12).toUpperCase()}` : ""
}

/* One row per purchased file — streams through the entitlement-gated endpoint. */
function DownloadRow({ dl, state, onDownload }) {
  const { t } = useTranslation("checkout")
  const styles = getFileTypeStyles(dl.fileType || dl.fileName || "")
  const Icon = styles.icon
  const size = dl.fileSizeFormatted || formatFileSize(dl.fileSize) || ""
  const remaining = state.remaining
  const exhausted = remaining !== null && remaining <= 0
  const revoked = dl.entitlementStatus && dl.entitlementStatus !== "active"
  const disabled = state.busy || exhausted || revoked

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.chip}`} aria-hidden="true">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-meta font-semibold text-charcoal" title={dl.fileName}>{dl.fileName}</span>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${styles.chip}`}>{styles.label}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-micro tabular-nums text-charcoal-80/55">
            {size && <span>{size}</span>}
            {dl.version && <><span aria-hidden="true">·</span><span>v{String(dl.version).replace(/^v/i, "")}</span></>}
            <span aria-hidden="true">·</span>
            <span className={exhausted ? "text-rose-600" : ""}>
              {remaining === null ? t("success.unlimited") : t("success.remaining", { count: remaining })}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDownload(dl)}
        disabled={disabled}
        aria-label={t("success.downloadAria", { name: dl.fileName })}
        className={`group inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl px-4 py-2 text-meta font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2 sm:self-center ${
          exhausted || revoked
            ? "cursor-not-allowed bg-charcoal-80/20 text-white"
            : state.done
              ? "border border-mint/40 bg-mint/10 text-mint-600 hover:bg-mint/15"
              : "bg-violet text-white hover:-translate-y-0.5 hover:bg-violet-deep disabled:opacity-60"
        }`}
      >
        {state.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : state.done ? <Check className="h-4 w-4" aria-hidden="true" />
          : <FileDown className="h-4 w-4 transition group-hover:translate-y-0.5" aria-hidden="true" />}
        {revoked ? t("success.revoked")
          : exhausted ? t("success.limitReached")
          : state.busy ? t("success.downloading")
          : state.done ? t("success.downloadAgain")
          : t("success.download")}
      </button>
    </li>
  )
}

export default function CheckoutSuccessPage() {
  const { t } = useTranslation("checkout")
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()
  const { clearCart } = useCart()

  const gateway = searchParams.get("gateway")
  const startPending = searchParams.get("pending") === "true"
  const signedIn = Boolean(getStoredToken())

  const [phase, setPhase] = useState(startPending ? "pending" : "paid")
  const [pollCount, setPollCount] = useState(0)
  const [probe, setProbe] = useState(null)

  const [order, setOrder] = useState(null)
  const [orderLoading, setOrderLoading] = useState(true)
  const [orderError, setOrderError] = useState("")
  const [orderForbidden, setOrderForbidden] = useState(false)

  const [fileState, setFileState] = useState({})   // productFileId → { busy, done, remaining }
  const [downloadError, setDownloadError] = useState("")
  const [receiptBusy, setReceiptBusy] = useState(false)

  useEffect(() => { clearCart() }, [clearCart])

  // Status probe — runs on mount and on every poll tick. Public endpoint, so it
  // also works for guest buyers who are not signed in yet.
  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest(`/api/v1/orders/${encodeURIComponent(orderId)}/status`)
        const d = res?.data
        if (cancelled || !d) return
        setProbe(d)
        if (d.status === "paid") setPhase("paid")
        else if (d.status === "failed" || d.status === "cancelled") setPhase("failed")
        else setPhase((p) => (p === "timeout" ? p : "pending"))
      } catch { /* keep current phase; next tick retries */ }
    })()
    return () => { cancelled = true }
  }, [orderId, pollCount])

  // Poll scheduler — ~2 min max, then hand off to "we'll email you".
  useEffect(() => {
    if (phase !== "pending") return
    if (pollCount >= MAX_POLLS) { setPhase("timeout"); return }
    const timer = setTimeout(() => setPollCount((c) => c + 1), POLL_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [phase, pollCount])

  // Enriched order (items + downloads + invoice) — owner only.
  useEffect(() => {
    if (!orderId || phase !== "paid" || !signedIn) { setOrderLoading(false); return }
    let cancelled = false
    ;(async () => {
      setOrderLoading(true)
      setOrderError("")
      try {
        const data = await fetchMyOrderById(orderId)
        if (cancelled) return
        setOrder(data || null)
        const initial = {}
        for (const dl of data?.downloads || []) {
          initial[dl.productFileId] = { busy: false, done: false, remaining: dl.downloadsRemaining ?? null }
        }
        setFileState(initial)
      } catch (err) {
        if (cancelled) return
        if (err?.code === "FORBIDDEN" || err?.status === 403) setOrderForbidden(true)
        else setOrderError(err?.message || t("success.orderLoadError"))
      } finally {
        if (!cancelled) setOrderLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId, phase, signedIn, t])

  async function handleDownload(dl) {
    const id = dl.productFileId
    setDownloadError("")
    setFileState((s) => ({ ...s, [id]: { ...s[id], busy: true } }))
    try {
      await downloadFileById(id, dl.fileName)
      setFileState((s) => {
        const prev = s[id] || {}
        const remaining = prev.remaining === null || prev.remaining === undefined ? null : Math.max(0, prev.remaining - 1)
        return { ...s, [id]: { busy: false, done: true, remaining } }
      })
    } catch (err) {
      const key = downloadErrorKey(err?.code).split(".").pop()
      const fallback = (typeof err?.toUserMessage === "function" ? err.toUserMessage() : null) || err?.message
      setDownloadError(key ? t(`success.errors.${key}`, fallback) : fallback || t("success.downloadError"))
      setFileState((s) => ({ ...s, [id]: { ...s[id], busy: false } }))
    }
  }

  async function handleReceipt() {
    if (!order?.invoicePdfUrl) return
    setReceiptBusy(true)
    setDownloadError("")
    try { await downloadInvoice(order.invoicePdfUrl, order.orderNumber) }
    catch (err) { setDownloadError(err?.message || t("success.receiptError")) }
    finally { setReceiptBusy(false) }
  }

  const isFailed = phase === "failed"
  const isPending = phase === "pending"
  const isTimeout = phase === "timeout"
  const isPaid = phase === "paid"
  const orderRef = formatOrderRef({ order, probe, fallbackId: orderId })
  const currency = order?.currency || "MXN"
  const items = Array.isArray(order?.items) ? order.items : []
  const downloads = useMemo(() => (Array.isArray(order?.downloads) ? order.downloads : []), [order])
  const subtotal = Number(order?.subtotalAmount ?? order?.subtotal ?? 0)
  const discount = Number(order?.discountAmount ?? order?.discount ?? 0)
  const orderTotal = Number(order?.totalAmount ?? order?.total ?? subtotal)

  // Group downloads by product for the "Your downloads" card.
  const downloadGroups = useMemo(() => {
    const map = new Map()
    for (const dl of downloads) {
      const key = dl.productId || dl.productTitle
      if (!map.has(key)) map.set(key, { title: dl.productTitle, slug: dl.productSlug, files: [] })
      map.get(key).files.push(dl)
    }
    return Array.from(map.values())
  }, [downloads])

  const heroBg = isFailed || isPending || isTimeout ? "#1A1B23" : "#5D3FD3"

  return (
    <div className="bg-mist">
      {/* Hero */}
      <div className="relative py-16 text-center" style={{ backgroundColor: heroBg }}>
        <Confetti fire={isPaid} colors={HERO_CONFETTI_COLORS} />
        <m.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "backOut" }} className="mx-auto inline-flex items-center justify-center">
          {isFailed ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#E5484D] shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              <AlertCircle className="h-12 w-12 text-white" aria-hidden="true" />
            </div>
          ) : isPending || isTimeout ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
              {isPending ? <Loader2 className="h-12 w-12 animate-spin text-white" aria-hidden="true" /> : <Clock3 className="h-12 w-12 text-white" aria-hidden="true" />}
            </div>
          ) : (
            <SuccessCheck size={96} label={t("success.successAria")} />
          )}
        </m.div>

        <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
          <h1 className="mt-6 text-page font-bold text-white">
            {isFailed ? t("success.failedTitle", "Payment Failed")
              : isPending ? t("success.confirming", "Confirming Payment…")
              : isTimeout ? t("success.pendingTimeoutTitle")
              : t("success.title", "Thank you!")}
          </h1>
          <p className="mt-2 text-body text-white/70">
            {isFailed ? t("success.failedSubtitle", "Your payment could not be processed. Please try again.")
              : isPending ? t("success.confirmingSubtitle", "Waiting for payment confirmation. This takes a moment…")
              : isTimeout ? t("success.pendingTimeoutSubtitle")
              : orderRef ? (
                <>
                  {t("success.orderNumber", "Order")}{" "}
                  <span className="font-mono font-bold tabular-nums text-terracotta">{orderRef}</span>
                  {" "}{t("success.confirmed", "confirmed.")}
                </>
              ) : t("success.subtitle")}
          </p>
          {gateway && isPaid && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-micro text-white/70">
              {t("misc.paidVia")} {gateway === "mercadopago" ? "Mercado Pago" : "PayPal"}
            </div>
          )}
        </m.div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {isFailed ? (
          <m.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5 text-center">
            <m.p variants={fadeUp} className="text-body text-charcoal-80/65">{t("misc.noChargeBody")}</m.p>
            <m.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/checkout" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2">
                {t("success.tryAgain")}
              </Link>
              <Link to="/store" className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/20 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2">
                {t("success.backToStore")}
              </Link>
            </m.div>
          </m.div>
        ) : isPending ? (
          <m.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center gap-5 text-center">
            <m.div variants={fadeUp} className="max-w-sm rounded-xl border border-amber/20 bg-amber/8 p-6 text-meta text-amber-700">
              <Clock3 className="mx-auto mb-3 h-8 w-8 text-amber" aria-hidden="true" />
              {t("success.processingMP")}
              {orderRef && <div className="mt-3 font-mono text-micro tabular-nums text-charcoal-80/60">{orderRef}</div>}
            </m.div>
          </m.div>
        ) : isTimeout ? (
          <m.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center gap-5 text-center">
            <m.div variants={fadeUp} className="max-w-md rounded-xl border border-charcoal-80/10 bg-white p-6 text-meta text-charcoal-80/75 shadow-[0_4px_16px_rgba(93,63,211,0.05)]">
              <Mail className="mx-auto mb-3 h-8 w-8 text-violet" aria-hidden="true" />
              {t("success.pendingTimeoutBody")}
              {orderRef && <div className="mt-3 font-mono text-micro tabular-nums text-charcoal-80/60">{orderRef}</div>}
            </m.div>
            <m.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => { setPollCount(0); setPhase("pending") }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("success.checkAgain")}
              </button>
              <Link to="/dashboard/downloads" className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/20 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> {t("success.accessDashboard")}
              </Link>
            </m.div>
          </m.div>
        ) : (
          <m.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5">

            {/* Guest / claim-link buyer — downloads stay behind sign-in */}
            {!signedIn && (
              <m.div variants={fadeUp} className="overflow-hidden rounded-xl border border-violet/20 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.06)]">
                <div className="flex items-start gap-4 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
                    <KeyRound className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-body font-bold text-violet">{t("success.claimTitle")}</h2>
                    <p className="mt-1 text-meta leading-6 text-charcoal-80/70">{t("success.claimBody")}</p>
                    <p className="mt-2 text-micro text-charcoal-80/55">{t("success.claimDownloads")}</p>
                    <Link to="/login" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep">
                      <LogIn className="h-4 w-4" aria-hidden="true" /> {t("success.claimSignIn")}
                    </Link>
                  </div>
                </div>
              </m.div>
            )}

            {signedIn && orderForbidden && (
              <m.div variants={fadeUp} className="flex items-start gap-3 rounded-xl border border-amber/25 bg-amber/8 p-4 text-meta text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t("success.notYourOrder")}
              </m.div>
            )}

            {/* Your downloads — instant */}
            {signedIn && !orderForbidden && (
              <m.div variants={fadeUp} className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
                <div className="flex items-center justify-between border-b border-charcoal-80/10 px-6 py-5">
                  <div>
                    <div className="text-micro font-semibold uppercase tracking-[0.18em] text-charcoal-80/50">{t("success.downloadsTitle")}</div>
                    <p className="mt-1 text-meta text-charcoal-80/65">{t("success.downloadsSubtitle")}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/15 text-mint-600">
                    <Download className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>

                <div className="px-6 py-5">
                  {downloadError && (
                    <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{downloadError}
                    </div>
                  )}
                  {orderLoading ? (
                    <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-violet-pale" />)}</div>
                  ) : orderError ? (
                    <div className="rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700">{orderError}</div>
                  ) : downloadGroups.length === 0 ? (
                    <p className="text-meta text-charcoal-80/55">{t("success.noDownloads")}</p>
                  ) : (
                    <div className="space-y-5">
                      {downloadGroups.map((group) => (
                        <div key={group.slug || group.title}>
                          <h3 className="mb-2 text-meta font-bold text-violet">{group.title}</h3>
                          <ul className="space-y-2">
                            {group.files.map((dl) => (
                              <DownloadRow
                                key={dl.productFileId}
                                dl={dl}
                                state={fileState[dl.productFileId] || { busy: false, done: false, remaining: dl.downloadsRemaining ?? null }}
                                onDownload={handleDownload}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-5 flex items-center gap-2 text-micro text-charcoal-80/60">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-violet/70" aria-hidden="true" />
                    <span>
                      {t("success.redownload")}{" "}
                      <Link to="/dashboard/downloads" className="font-semibold text-violet hover:underline">{t("success.downloadsDashboard")}</Link>.
                    </span>
                  </p>
                </div>
              </m.div>
            )}

            {/* Order summary + receipt */}
            {signedIn && !orderForbidden && (
              <m.div variants={fadeUp} className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-80/10 px-6 py-5">
                  <div>
                    <div className="text-micro font-semibold uppercase tracking-[0.18em] text-charcoal-80/50">{t("success.orderSummary")}</div>
                    {orderRef && <div className="mt-1 font-mono text-body font-bold tabular-nums text-violet">{orderRef}</div>}
                  </div>
                  {order?.invoicePdfUrl ? (
                    <button
                      type="button"
                      onClick={handleReceipt}
                      disabled={receiptBusy}
                      className="inline-flex items-center gap-2 rounded-xl border border-violet/20 px-4 py-2 text-meta font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
                    >
                      {receiptBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                      {t("success.receipt")}
                    </button>
                  ) : !orderLoading && (
                    <span className="inline-flex items-center gap-2 text-micro text-charcoal-80/55">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {t("success.receiptPreparing")}
                    </span>
                  )}
                </div>

                <div className="px-6 py-5">
                  {orderLoading ? (
                    <div className="h-16 animate-pulse rounded-xl bg-violet-pale" />
                  ) : items.length === 0 ? (
                    <p className="text-meta text-charcoal-80/55">{t("success.orderPreparing")}</p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item) => {
                        const qty = Number(item.quantity ?? 1)
                        const unit = Number(item.unitPrice ?? item.price ?? 0)
                        const line = Number(item.lineTotal ?? unit * qty)
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-80/10 bg-mist p-4">
                            <div className="min-w-0 flex-1">
                              <div className="text-meta font-semibold text-violet">{item.title || item.product?.title}</div>
                              <div className="font-mono text-micro tabular-nums text-charcoal-80/55">{t("misc.qty")} {qty}</div>
                            </div>
                            <div className="shrink-0 font-mono text-meta font-bold tabular-nums text-violet">{formatPrice(line, currency)}</div>
                          </div>
                        )
                      })}

                      {(subtotal > 0 || orderTotal > 0) && (
                        <div className="mt-4 space-y-2 border-t border-charcoal-80/10 pt-4 text-meta">
                          <div className="flex justify-between text-charcoal-80/65">
                            <span>{t("success.subtotalLabel")}</span>
                            <span className="font-mono font-semibold tabular-nums text-violet">{formatPrice(subtotal, currency)}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between text-mint">
                              <span>{t("success.discountLabel")}</span>
                              <span className="font-mono font-semibold tabular-nums">−{formatPrice(discount, currency)}</span>
                            </div>
                          )}
                          <div className="flex items-baseline justify-between border-t border-charcoal-80/10 pt-2">
                            <span className="text-body font-bold text-violet">{t("success.totalLabel")}</span>
                            <span className="font-mono text-card font-extrabold tabular-nums text-violet">{formatPrice(orderTotal, currency)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </m.div>
            )}

            {/* Email chip */}
            <m.div variants={fadeUp} className="flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[0_4px_16px_rgba(93,63,211,0.05)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint/15 text-mint">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 text-meta text-charcoal-80/75">{t("success.checkEmail")}</div>
            </m.div>

            {/* What happens next */}
            <m.div variants={fadeUp} className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.05)]">
              <h3 className="mb-4 text-body font-bold text-violet">{t("success.whatNext")}</h3>
              <div className="space-y-4">
                {[
                  { icon: Mail,    key: "email",  done: true },
                  { icon: Package, key: "ready",  done: signedIn },
                  { icon: Shield,  key: "access", done: false },
                ].map(({ icon: Icon, key, done }) => (
                  <div key={key} className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-mint/15 text-mint" : "bg-violet-pale text-violet"}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-meta font-semibold text-violet">{t(`success.next.${key}Title`)}</span>
                        {done && (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-mint text-white" aria-label={t("success.completeAria")}>
                            <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-meta text-charcoal-80/65">{t(`success.next.${key}Desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </m.div>

            {/* Actions */}
            <m.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row">
              <Link to="/dashboard/downloads" className="group flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet py-4 text-meta font-semibold text-white shadow-[0_10px_28px_rgba(93,63,211,0.22)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2">
                <Download className="h-5 w-5" aria-hidden="true" />
                {t("success.downloadResources")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link to="/dashboard" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet/20 py-4 text-meta font-semibold text-violet transition hover:-translate-y-0.5 hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> {t("success.accessDashboard")}
              </Link>
            </m.div>

            <m.div variants={fadeUp} className="flex items-center justify-center">
              <Link to="/store" className="inline-flex items-center gap-1.5 rounded-md text-meta font-medium text-charcoal-80/55 hover:text-violet hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" /> {t("success.continueShopping")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </m.div>
          </m.div>
        )}
      </div>
    </div>
  )
}
