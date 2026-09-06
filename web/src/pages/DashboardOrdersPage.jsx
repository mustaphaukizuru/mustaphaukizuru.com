import { useMemo, useState } from "react"
import { useTranslation, Trans } from "react-i18next"
import { m, AnimatePresence } from "framer-motion"
import {
  CreditCard, Receipt, Clock3, CheckCircle2, ChevronUp, ChevronDown,
  Eye, FileDown, Search, X, RotateCcw, ShieldCheck, AlertTriangle,
} from "lucide-react"
import { LocalizedLink as Link } from "../components/LocalizedLink"
import { fetchMyOrders, requestOrderRefund } from "../services/orderService"
import { authFetch, API_BASE_URL } from "../lib/api"
import { formatPrice } from "../lib/format"
import { triggerBrowserDownload } from "../services/downloadService"
import { MetricCard } from "../components/ui/index"
import { useToast } from "../context/ToastContext"
import useApiQuery from "../hooks/useApiQuery"

/* ── Refund-window constant — must match REFUND_WINDOW_DAYS in src/services/refundService.js ── */
const REFUND_WINDOW_DAYS = 14

function isWithinRefundWindow(order) {
  if (order?.status !== "paid") return false
  const anchor = order.paidAt || order.createdAt
  if (!anchor) return false
  const ageMs = Date.now() - new Date(anchor).getTime()
  return ageMs <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
}

/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardOrdersPage · F10.C · Batch 6 · I18N · Phase 119D
 *  Strings keyed under `dashboard.orders.*`. Status taxonomy preserved
 *  verbatim — backend enum drives the i18n key directly.
 *  ──────────────────────────────────────────────────────────────────── */

const STATUS_VISUAL = {
  paid:      { bg: "bg-mint/15",         text: "text-mint-700",         ring: "ring-mint/25" },
  pending:   { bg: "bg-amber/10",        text: "text-amber-700",    ring: "ring-amber-300/40" },
  refunded:  { bg: "bg-rose-50",         text: "text-rose-600",     ring: "ring-rose-300/40" },
  cancelled: { bg: "bg-charcoal-80/10",  text: "text-charcoal-80",  ring: "ring-charcoal-80/15" },
  failed:    { bg: "bg-rose-50",         text: "text-rose-600",     ring: "ring-rose-300/40" },
}

/* Tier 4 · due / overdue chip for manual invoices (pending orders only). */
function InvoiceChip({ invoice, status, localeTag }) {
  const { t } = useTranslation("dashboard")
  if (!invoice || status !== "pending" || !invoice.dueDate) return null
  const overdue = invoice.status === "overdue"
  const date = new Date(invoice.dueDate).toLocaleDateString(localeTag, { year: "numeric", month: "short", day: "numeric" })
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-micro font-bold uppercase tracking-wider ring-1 ring-inset ${
        overdue ? "bg-rose-50 text-rose-600 ring-rose-300/40" : "bg-amber/10 text-amber-700 ring-amber-300/40"
      }`}
    >
      <Clock3 className="h-3 w-3" aria-hidden="true" />
      {overdue ? t("orders.invoice.overdue", { date }) : t("orders.invoice.due", { date })}
    </span>
  )
}

function StatusPill({ status }) {
  const { t } = useTranslation("dashboard")
  const visual = STATUS_VISUAL[status] || STATUS_VISUAL.cancelled
  const label = t(`orders.status.${status}`, { defaultValue: status })
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-micro font-bold uppercase tracking-wider ring-1 ring-inset ${visual.bg} ${visual.text} ${visual.ring}`}
      aria-label={t("orders.status.ariaLabel", { label: label.toLowerCase() })}
    >
      {label}
    </span>
  )
}

function SortableHeader({ labelKey, field, sortKey, sortDir, onSort, className = "" }) {
  const { t } = useTranslation("dashboard")
  const active = sortKey === field
  const label = t(`orders.table.headers.${labelKey}`)
  const direction = active ? (sortDir === "asc" ? t("orders.table.sortAsc") : t("orders.table.sortDesc")) : ""
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`group inline-flex items-center gap-1 text-left text-micro font-semibold uppercase tracking-wider transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1 rounded ${
        active ? "text-violet" : "text-charcoal-80/65"
      } ${className}`}
      aria-label={t("orders.table.sortAria", { label, direction })}
    >
      <span>{label}</span>
      <span className="flex flex-col leading-none">
        <ChevronUp className={`h-2.5 w-2.5 transition ${active && sortDir === "asc" ? "text-violet" : "text-charcoal-80/30 group-hover:text-violet/50"}`} aria-hidden="true" />
        <ChevronDown className={`h-2.5 w-2.5 -mt-0.5 transition ${active && sortDir === "desc" ? "text-violet" : "text-charcoal-80/30 group-hover:text-violet/50"}`} aria-hidden="true" />
      </span>
    </button>
  )
}

/* Download invoice — routed through authFetch so 401s trigger session-expired
 * handling and the URL is upgraded to /api/v1 automatically. */
async function downloadInvoice(orderId, t) {
  let res
  try {
    res = await authFetch(`/api/v1/orders/${orderId}/invoice.pdf`, { method: "GET" })
  } catch (err) {
    if (err?.status === 404) throw new Error(t("orders.errors.invoiceMissing"))
    throw new Error(err?.toUserMessage?.() || t("orders.errors.invoiceFailed", { status: err?.status || 0 }))
  }
  const blob = res?.data instanceof Blob ? res.data : null
  if (!blob) throw new Error(t("orders.errors.invoiceMissing"))
  triggerBrowserDownload(blob, `invoice-${orderId}.pdf`)
}

export default function DashboardOrdersPage() {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const { showSuccess, showError } = useToast()
  const { data: orders = [], loading, error: errorMessage } = useApiQuery("orders", () => fetchMyOrders(), {
    select: (data) => (Array.isArray(data) ? data : []),
  })
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState("createdAt")
  const [sortDir, setSortDir] = useState("desc")
  const [busyInvoiceId, setBusyId] = useState("")
  const [invoiceError, setInvErr] = useState("")
  const [refundOrder, setRefundOrder] = useState(null)

  function handleSort(field) {
    if (field === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(field)
      setSortDir("desc")
    }
  }

  async function handleDownloadInvoice(orderId) {
    setInvErr("")
    setBusyId(orderId)
    try {
      await downloadInvoice(orderId, t)
    } catch (e) {
      setInvErr(e.message || t("orders.errors.downloadGeneric"))
    } finally {
      setBusyId("")
    }
  }

  const paidOrders = useMemo(
    () => orders.filter((order) => order.status === "paid"),
    [orders]
  )

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === "pending"),
    [orders]
  )

  const totalSpent = useMemo(
    () => paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
    [paidOrders]
  )

  const filteredAndSorted = useMemo(() => {
    let rows = [...orders]
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      rows = rows.filter((o) =>
        String(o.orderNumber || o.id).toLowerCase().includes(q) ||
        String(o.status || "").toLowerCase().includes(q)
      )
    }
    rows.sort((a, b) => {
      let av, bv
      switch (sortKey) {
        case "orderNumber":
          av = String(a.orderNumber || a.id || "").toLowerCase()
          bv = String(b.orderNumber || b.id || "").toLowerCase()
          break
        case "total":
          av = Number(a.totalAmount || 0); bv = Number(b.totalAmount || 0); break
        case "status":
          av = a.status || ""; bv = b.status || ""; break
        case "createdAt":
        default:
          av = new Date(a.createdAt || 0).getTime()
          bv = new Date(b.createdAt || 0).getTime()
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return rows
  }, [orders, search, sortKey, sortDir])

  if (loading) {
    return (
      <section className="space-y-5" role="status" aria-busy="true" aria-label={t("orders.loading")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-[132px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
          ))}
        </div>
        <div className="h-[360px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {errorMessage && (
        <div className="rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={t("orders.metrics.total")}   value={orders.length}              subtitle={t("orders.metrics.totalSubtitle")}   icon={Receipt}      tone="purple" />
        <MetricCard title={t("orders.metrics.paid")}    value={paidOrders.length}          subtitle={t("orders.metrics.paidSubtitle")}    icon={CheckCircle2} tone="green" />
        <MetricCard title={t("orders.metrics.pending")} value={pendingOrders.length}       subtitle={t("orders.metrics.pendingSubtitle")} icon={Clock3}       tone="amber" />
        <MetricCard title={t("orders.metrics.spent")}   value={formatPrice(totalSpent)}     subtitle={t("orders.metrics.spentSubtitle")}   icon={CreditCard}   tone="blue" />
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e5)]">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-card font-semibold text-violet">{t("orders.table.title")}</h3>
            <p className="mt-1 text-micro text-charcoal-80/70">
              {t("orders.table.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="orders-search" className="sr-only">{t("orders.table.searchLabel")}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
              <input
                id="orders-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("orders.table.searchPlaceholder")}
                className="w-[220px] rounded-xl border border-charcoal-80/15 bg-mist py-2.5 pl-9 pr-8 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("orders.table.clearSearch")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-charcoal-80/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
            <span className="rounded-xl bg-violet-pale/40 px-4 py-2 font-mono text-micro tabular-nums text-charcoal-80/70">
              {t("orders.table.countOf", { shown: filteredAndSorted.length, total: orders.length })}
            </span>
          </div>
        </div>

        {invoiceError && (
          <div className="mb-4 rounded-xl border border-amber/20 bg-amber/10 px-4 py-3 text-meta text-amber-700" role="alert">
            {invoiceError}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-violet/15 bg-violet-pale/30 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-pale text-violet">
              <Receipt className="h-8 w-8" aria-hidden="true" />
            </div>
            <h4 className="mt-4 text-card font-bold text-violet">{t("orders.empty.title")}</h4>
            <p className="mt-1 max-w-sm text-meta text-charcoal-80/65">
              {t("orders.empty.body")}
            </p>
            <Link
              to="/store"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              {t("orders.empty.browseStore")}
            </Link>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-mist p-6 text-center text-meta text-charcoal-80/65">
            {t("orders.empty.noMatch")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-charcoal-80/10">
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Sortable header row */}
                <div className="grid grid-cols-[1.2fr_1.1fr_0.9fr_0.7fr_1fr] gap-3 border-b border-charcoal-80/10 bg-violet-pale/40 px-4 py-3">
                  <SortableHeader labelKey="orderNumber" field="orderNumber" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader labelKey="date"        field="createdAt"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader labelKey="total"       field="total"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader labelKey="status"      field="status"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <span className="text-micro font-semibold uppercase tracking-wider text-charcoal-80/65">{t("orders.table.headers.actions")}</span>
                </div>

                {/* Rows */}
                {filteredAndSorted.map((order) => {
                  const isPaid = order.status === "paid"
                  const isRefunded = order.status === "refunded"
                  const refundRequestable = isWithinRefundWindow(order)
                  const orderRef = order.orderNumber || order.id
                  const itemCount = order.items?.length || 0
                  return (
                    <div
                      key={order.id}
                      className="grid grid-cols-[1.2fr_1.1fr_0.9fr_0.7fr_1fr] gap-3 border-b border-charcoal-80/8 px-4 py-4 text-meta last:border-b-0 transition hover:bg-mist"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold tabular-nums text-violet">
                          #{orderRef}
                        </div>
                        <div className="mt-1 font-mono text-micro tabular-nums text-charcoal-80/65">
                          {t("orders.table.items", { count: itemCount })}
                        </div>
                      </div>

                      <div className="font-mono text-meta tabular-nums text-charcoal-80/80">
                        {new Date(order.createdAt).toLocaleString(localeTag, {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>

                      <div className="font-mono font-bold tabular-nums text-violet">
                        {formatPrice(Number(order.totalAmount || 0), order.currency || "MXN")}
                      </div>

                      <div className="flex flex-col items-start gap-1.5">
                        <StatusPill status={order.status} />
                        <InvoiceChip invoice={order.invoice} status={order.status} localeTag={localeTag} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/dashboard/orders/${order.id}`}
                          aria-label={t("orders.row.viewAria", { number: orderRef })}
                          title={t("orders.row.viewTitle")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-violet/15 bg-white px-3 py-1.5 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("orders.row.view")}
                        </Link>
                        {isPaid && (
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(order.id)}
                            disabled={busyInvoiceId === order.id}
                            aria-label={t("orders.row.invoiceAria", { number: orderRef })}
                            title={t("orders.row.invoiceTitle")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-mint/30 bg-mint/8 px-3 py-1.5 text-micro font-semibold text-mint-700 transition hover:bg-mint/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint/40 focus-visible:ring-offset-2"
                          >
                            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                            {busyInvoiceId === order.id ? t("orders.row.invoiceBusy") : t("orders.row.invoice")}
                          </button>
                        )}
                        {isRefunded && (
                          <span
                            title={t("orders.row.refundedTitle")}
                            aria-label={t("orders.row.refundedAria")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose/20 bg-rose/5 px-3 py-1.5 text-micro font-semibold text-rose-600"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("orders.row.refunded")}
                          </span>
                        )}
                        {refundRequestable && (
                          <button
                            type="button"
                            onClick={() => setRefundOrder(order)}
                            aria-label={t("orders.row.requestRefundAria", { number: orderRef })}
                            title={t("orders.row.requestRefundTitle", { days: REFUND_WINDOW_DAYS })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-micro font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-400/30 focus-visible:ring-offset-2"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("orders.row.requestRefund")}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {refundOrder ? (
          <RefundRequestModal
            order={refundOrder}
            onClose={() => setRefundOrder(null)}
            onSubmitted={(result) => {
              showSuccess(
                t("orders.toast.refundSubmitted", { ticket: result.ticketNumber }),
                t("orders.toast.refundSubmittedTitle"),
              )
              setRefundOrder(null)
            }}
            onError={(message) => showError(message, t("orders.toast.refundErrorTitle"))}
          />
        ) : null}
      </AnimatePresence>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  RefundRequestModal · M16 · scopes its own useTranslation hook.
 *  The policy paragraph uses <Trans> so the inline <Link> + <strong> tags
 *  render properly in both locales without double-escaping.
 *  ──────────────────────────────────────────────────────────────────── */
function RefundRequestModal({ order, onClose, onSubmitted, onError }) {
  const { t } = useTranslation("dashboard")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const reasonChars = reason.trim().length
  const submitDisabled = submitting || reasonChars < 10 || reasonChars > 2000

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg("")
    setSubmitting(true)
    try {
      const result = await requestOrderRefund(order.id, { reason: reason.trim() })
      onSubmitted(result)
    } catch (err) {
      const msg = err?.toUserMessage?.() || err?.message || t("orders.errors.refundFallback")
      setErrorMsg(msg)
      onError?.(msg)
      setSubmitting(false)
    }
  }

  return (
    <m.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-80/55 px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t("orders.refundModal.ariaLabel")}
    >
      <m.form
        onSubmit={handleSubmit}
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_48px_rgb(var(--color-violet-rgb)/0.18)]"
        {...fadeUp}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-charcoal-80/65 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          aria-label={t("orders.refundModal.close")}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-card font-bold text-violet">{t("orders.refundModal.title")}</h2>
            <p className="text-micro text-charcoal-80/70">
              {t("orders.refundModal.subtitle", { number: order.orderNumber || order.id, amount: formatPrice(Number(order.totalAmount || 0), order.currency || "MXN") })}
            </p>
          </div>
        </div>

        {/* Policy reminder · uses <Trans> for the inline <Link> + <strong> tags. */}
        <div className="mt-5 rounded-xl border border-violet/15 bg-violet-pale p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-violet" />
            <div className="text-meta text-violet/85">
              <p className="font-semibold">{t("orders.refundModal.policyHeading")}</p>
              <p className="mt-1">
                <Trans
                  i18nKey="orders.refundModal.policyBody"
                  ns="dashboard"
                  components={{
                    link: <Link to="/refund" target="_blank" className="font-semibold underline-offset-2 hover:underline" />,
                    strong: <strong />,
                  }}
                />
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="refund-reason" className="text-meta font-semibold text-violet">
            {t("orders.refundModal.reasonLabel")} <span className="text-charcoal-80/65 font-normal">{t("orders.refundModal.reasonRequired")}</span>
          </label>
          <textarea
            id="refund-reason"
            rows={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("orders.refundModal.reasonPlaceholder")}
            maxLength={2000}
            className="mt-2 w-full rounded-xl border border-charcoal-80/15 bg-white px-4 py-3 text-meta text-violet outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
          />
          <div className="mt-1 flex items-center justify-between text-micro text-charcoal-80/65">
            <span>{t("orders.refundModal.minHint")}</span>
            <span className={reasonChars > 2000 ? "text-rose-600 font-semibold" : ""}>
              {reasonChars}/2000
            </span>
          </div>
        </div>

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-charcoal-80/15 bg-white px-5 py-2.5 text-meta font-semibold text-charcoal-80 transition hover:bg-violet-pale/40"
          >
            {t("orders.refundModal.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            // Brand v3 §04: hover state for Royal Violet is `violet-deep`,
            // never the retired legacy v2 purple (which was a darker
            // version of the also-retired v1 aubergine). Aligns with all other
            // primary-action buttons across the codebase.
            className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? t("orders.refundModal.submitting") : t("orders.refundModal.submit")}
          </button>
        </div>
      </m.form>
    </m.div>
  )
}
