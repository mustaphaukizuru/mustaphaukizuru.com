import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { LocalizedLink as Link } from "../components/LocalizedLink"
import {
  Download, Package, Clock3, FileArchive, RefreshCw, AlertCircle, CheckCircle2,
  Search, X, Calendar, FileText, Loader2, ShoppingBag, Sparkles, ExternalLink, KeyRound, Copy, Check,
} from "lucide-react"
import { MetricCard, SectionCard } from "../components/ui/index"
import Skeleton from "../components/ui/SkeletonPrimitives"
import { authFetch, API_BASE_URL, hasStoredSession } from "../lib/api"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"
import { downloadFileById, downloadInvoice, downloadErrorKey } from "../components/product/downloadHelpers"
import SuccessCheck from "../components/motion/SuccessCheck"

/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardDownloadsPage · roadmap 26 · grouped by order
 *
 *  Data: GET /api/downloads/my/library → { orders: [{ orderNumber, purchasedAt,
 *  invoicePdfUrl, products: [{ title, latestVersion, updatedAt, files: [{
 *  fileId, fileName, fileType, fileSize, version, downloadsRemaining,
 *  maxDownloadsPerUser, downloadsUsed }] }] }] }
 *
 *  Downloads stream through GET /api/downloads/:productFileId which enforces
 *  the entitlement + per-file cap (DownloadLog.productFileId).
 *  ────────────────────────────────────────────────────────────────────────── */

/* T3 · licence tier + key for a purchased product. The key is shown in
 * full (it is the buyer's own) with a one-click copy. */
function LicenseBadge({ tier, licenseKey }) {
  const { t } = useTranslation("dashboard")
  const [copied, setCopied] = useState(false)
  const tierLabel = tier ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}` : null

  async function copy() {
    if (!licenseKey) return
    try {
      await navigator.clipboard.writeText(licenseKey)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked — the key is still visible */ }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {tierLabel && (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-pale px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-violet">
          <KeyRound className="h-3 w-3" aria-hidden="true" />
          {t("downloads.file.licenseTier", { tier: tierLabel })}
        </span>
      )}
      {licenseKey && (
        <button
          type="button"
          onClick={copy}
          aria-label={`${t("downloads.file.licenseKey")}: ${licenseKey}. ${t("downloads.file.copyKey")}`}
          title={t("downloads.file.copyKey")}
          className="inline-flex items-center gap-1 rounded-md border border-charcoal-80/12 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-charcoal transition hover:border-violet/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
        >
          {licenseKey}
          {copied ? <Check className="h-3 w-3 text-mint-600" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
          <span className="sr-only">{copied ? t("downloads.file.keyCopied") : t("downloads.file.copyKey")}</span>
        </button>
      )}
    </div>
  )
}

function resolveImageUrl(url = "") {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

async function fetchDownloadLibrary() {
  const res = await authFetch("/api/v1/downloads/my/library", { method: "GET" })
  const orders = res?.data?.orders
  return Array.isArray(orders) ? orders : []
}

function FileRow({ file, product, state, onDownload }) {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const styles = getFileTypeStyles(file.fileType || file.fileName || "")
  const TypeIcon = styles.icon
  const sizeDisplay = file.fileSize ? formatFileSize(file.fileSize) : ""
  const remaining = state.remaining
  const exhausted = remaining !== null && remaining <= 0
  const revoked = product.entitlementStatus && product.entitlementStatus !== "active"
  const isLatest = !file.version || !product.latestVersion || String(file.version) === String(product.latestVersion)
  const uploaded = file.uploadedAt ? new Date(file.uploadedAt) : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: styles.background, color: styles.color }} aria-hidden="true">
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-meta font-semibold text-violet" title={file.fileName}>{file.fileName || styles.label}</span>
            <span className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase" style={{ background: styles.background, color: styles.color, borderColor: styles.borderColor }}>
              {styles.label}
            </span>
            {file.isPrimary && <span className="shrink-0 rounded-md bg-violet-pale px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet">{t("downloads.file.primary")}</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-micro tabular-nums text-charcoal-80/65">
            {sizeDisplay && <span>{sizeDisplay}</span>}
            {sizeDisplay && <span aria-hidden="true">·</span>}
            <span className={isLatest ? "text-mint-600" : ""}>
              {file.version ? t("downloads.file.version", { version: String(file.version).replace(/^v/i, "") }) : t("downloads.file.latest")}
              {file.version && isLatest ? ` · ${t("downloads.file.latest")}` : ""}
            </span>
            {uploaded && !Number.isNaN(uploaded.getTime()) && (
              <><span aria-hidden="true">·</span><span>{t("downloads.file.updatedOn", { date: uploaded.toLocaleDateString(localeTag) })}</span></>
            )}
            <span aria-hidden="true">·</span>
            <span className={exhausted ? "text-rose-600" : ""}>
              {remaining === null
                ? t("downloads.file.unlimited")
                : file.maxDownloadsPerUser != null
                  ? t("downloads.file.used", { used: Math.max(0, file.maxDownloadsPerUser - remaining), max: file.maxDownloadsPerUser })
                  : t("downloads.file.remaining", { count: remaining })}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDownload(file)}
        disabled={state.busy || exhausted || revoked}
        aria-label={t("downloads.file.downloadAria", { name: file.fileName || styles.label })}
        className={`group inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2 text-meta font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2 sm:self-center ${
          exhausted || revoked
            ? "cursor-not-allowed bg-charcoal-80/25 text-white"
            : state.done
              ? "border border-mint/40 bg-mint/10 text-mint-600 hover:bg-mint/15"
              : "bg-violet text-white hover:-translate-y-0.5 hover:bg-violet-deep disabled:opacity-60"
        }`}
      >
        {/* Fixed 16px slot: idle → busy → done never changes the icon box, so
            the button never reflows as the download state advances. */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
          {state.busy
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : state.done
              ? <SuccessCheck size={16} tone="inline" />
              : <Download className="h-4 w-4 transition group-hover:translate-y-0.5" />}
        </span>
        {revoked ? t("downloads.file.revoked")
          : exhausted ? t("downloads.file.limitReached")
          : state.busy ? t("downloads.file.preparing")
          : state.done ? t("downloads.file.redownload")
          : t("downloads.file.download")}
      </button>
    </div>
  )
}

function OrderCard({ order, fileState, onDownload, onReceipt, receiptBusy }) {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const fileCount = order.products.reduce((n, p) => n + p.files.length, 0)

  return (
    <article className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e3)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-80/10 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-mono text-body font-bold tabular-nums text-violet">{t("downloads.order.title", { number: order.orderNumber })}</h3>
            <span className="font-mono text-micro tabular-nums text-charcoal-80/65">· {t("downloads.card.files", { count: fileCount })}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-micro tabular-nums text-charcoal-80/65">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {t("downloads.card.purchasedOn", { date: new Date(order.purchasedAt).toLocaleDateString(localeTag) })}
          </div>
        </div>
        {order.invoicePdfUrl && (
          <button
            type="button"
            onClick={() => onReceipt(order)}
            disabled={receiptBusy === order.orderId}
            className="inline-flex items-center gap-2 rounded-xl border border-violet/20 px-3 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            {receiptBusy === order.orderId ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("downloads.order.receipt")}
          </button>
        )}
      </header>

      <div className="divide-y divide-charcoal-80/8 bg-mist">
        {order.products.map((product) => {
          const coverUrl = resolveImageUrl(product.imageUrl)
          const updated = product.updatedAt ? new Date(product.updatedAt) : null
          return (
            <div key={product.productId} className="p-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="h-14 w-[72px] shrink-0 overflow-hidden rounded-lg bg-violet-pale">
                  {coverUrl ? (
                    <img src={coverUrl} alt={product.imageAlt || product.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-violet/30"><Package className="h-6 w-6" aria-hidden="true" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-meta font-bold text-violet">{product.title}</h4>
                    {product.latestVersion && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-mint/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-mint-600 ring-1 ring-mint/25">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {t("downloads.file.latestVersion")} v{String(product.latestVersion).replace(/^v/i, "")}
                      </span>
                    )}
                  </div>
                  {(product.licenseTier || product.licenseKey) && (
                    <LicenseBadge tier={product.licenseTier} licenseKey={product.licenseKey} />
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-micro tabular-nums text-charcoal-80/65">
                    {updated && !Number.isNaN(updated.getTime()) && <span>{t("downloads.file.updatedOn", { date: updated.toLocaleDateString(localeTag) })}</span>}
                    {product.slug && (
                      <>
                        <span aria-hidden="true">·</span>
                        <Link to={`/store/${product.slug}`} className="inline-flex items-center gap-1 text-violet hover:underline">
                          {t("downloads.order.viewProduct")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {product.files.map((file) => (
                  <FileRow
                    key={file.fileId}
                    file={file}
                    product={product}
                    state={fileState[file.fileId] || { busy: false, done: false, remaining: file.downloadsRemaining ?? null }}
                    onDownload={onDownload}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Loading state · roadmap step 35 — skeletons, not spinners
 *
 *  Every block below mirrors the *exact* box model of the real component it
 *  stands in for (MetricCard · SectionCard header · OrderCard header ·
 *  product row · FileRow), so nothing reflows when the library resolves.
 *  Shimmer comes from the canonical <Skeleton> block — one CSS-only sweep,
 *  static under `prefers-reduced-motion`, no JS.
 *  ────────────────────────────────────────────────────────────────────────── */

/* Mirrors <MetricCard> — border + p-4/sm:p-5, label · value · subtitle. */
function MetricSkeleton() {
  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[var(--shadow-e3)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton w="w-2/3" h="h-3" rounded="full" />
          <Skeleton w="w-1/2" h="h-7" rounded="md" className="mt-1.5 sm:mt-2" />
          <Skeleton w="w-3/4" h="h-2.5" rounded="full" tone="muted" className="mt-1.5 sm:mt-2" />
        </div>
        <Skeleton w="w-10" h="h-10" rounded="lg" className="shrink-0" />
      </div>
    </div>
  )
}

/* Mirrors <FileRow> — icon chip · two meta lines · download button. */
function FileRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Skeleton w="w-9" h="h-9" rounded="lg" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton w="w-1/2" h="h-4" rounded="full" />
          <Skeleton w="w-3/4" h="h-3" rounded="full" tone="muted" className="mt-1.5" />
        </div>
      </div>
      <Skeleton w="w-[132px]" h="h-[38px]" rounded="lg" className="shrink-0 self-start sm:self-center" />
    </div>
  )
}

/* Mirrors one product block inside <OrderCard> — cover · title · file rows. */
function ProductSkeleton({ files = 2 }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <Skeleton w="w-[72px]" h="h-14" rounded="lg" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton w="w-2/5" h="h-4" rounded="full" />
          <Skeleton w="w-1/3" h="h-3" rounded="full" tone="muted" className="mt-1.5" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: files }).map((_, i) => <FileRowSkeleton key={i} />)}
      </div>
    </div>
  )
}

/* Mirrors <OrderCard> — header (order no · date · receipt) + product blocks. */
function OrderCardSkeleton({ products = 1, files = 2 }) {
  return (
    <article className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e3)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal-80/10 px-5 py-4">
        <div className="min-w-0 flex-1">
          <Skeleton w="w-1/3" h="h-5" rounded="full" />
          <Skeleton w="w-1/4" h="h-3" rounded="full" tone="muted" className="mt-1" />
        </div>
        <Skeleton w="w-[112px]" h="h-[38px]" rounded="lg" className="shrink-0" />
      </header>
      <div className="divide-y divide-charcoal-80/8 bg-mist">
        {Array.from({ length: products }).map((_, i) => <ProductSkeleton key={i} files={files} />)}
      </div>
    </article>
  )
}

/* Full-page placeholder. Reuses the real <SectionCard> shell so the header,
 * borders and padding are pixel-identical to the loaded view. */
function LibrarySkeleton({ title, subtitle, label }) {
  return (
    <section className="space-y-5" role="status" aria-busy="true" aria-label={label}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <MetricSkeleton key={i} />)}
      </div>

      <SectionCard
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton w="w-[200px]" h="h-[36px]" rounded="lg" />
            <Skeleton w="w-[104px]" h="h-[36px]" rounded="lg" />
          </div>
        }
      >
        <div className="space-y-4">
          <OrderCardSkeleton products={1} files={2} />
          <OrderCardSkeleton products={1} files={1} />
        </div>
      </SectionCard>
    </section>
  )
}

export default function DashboardDownloadsPage() {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [search, setSearch] = useState("")
  const [fileState, setFileState] = useState({})
  const [receiptBusy, setReceiptBusy] = useState("")

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError("")
    try {
      const data = await fetchDownloadLibrary()
      setOrders(data)
      const next = {}
      for (const o of data) for (const p of o.products) for (const f of p.files) {
        next[f.fileId] = { busy: false, done: false, remaining: f.downloadsRemaining ?? null }
      }
      setFileState(next)
    } catch (err) {
      setError(err?.message || t("downloads.errors.load"))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allFiles = useMemo(
    () => orders.flatMap((o) => o.products.flatMap((p) => p.files)),
    [orders],
  )

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders
      .map((o) => ({
        ...o,
        products: o.products.filter((p) =>
          (p.title || "").toLowerCase().includes(q) ||
          p.files.some((f) => (f.fileName || "").toLowerCase().includes(q)),
        ),
      }))
      .filter((o) => o.products.length > 0 || String(o.orderNumber || "").toLowerCase().includes(q))
  }, [orders, search])

  const readyCount = useMemo(
    () => allFiles.filter((f) => f.downloadsRemaining === null || f.downloadsRemaining > 0).length,
    [allFiles],
  )
  const newestDate = orders.length ? new Date(orders[0].purchasedAt).toLocaleDateString(localeTag) : "—"

  async function handleDownload(file) {
    setError("")
    setSuccess("")
    const id = file.fileId
    setFileState((s) => ({ ...s, [id]: { ...s[id], busy: true } }))
    try {
      if (!hasStoredSession()) throw new Error(t("downloads.errors.loginRequired"))
      const filename = await downloadFileById(id, file.fileName)
      setFileState((s) => {
        const prev = s[id] || {}
        const remaining = prev.remaining == null ? null : Math.max(0, prev.remaining - 1)
        return { ...s, [id]: { busy: false, done: true, remaining } }
      })
      setSuccess(t("downloads.toast.downloadStarted", { filename: filename || file.fileName }))
    } catch (err) {
      const key = downloadErrorKey(err?.code)
      const fallback = (typeof err?.toUserMessage === "function" ? err.toUserMessage() : null)
                    || err?.message || t("downloads.errors.downloadUnavailable")
      setError(key ? t(key, fallback) : fallback)
      setFileState((s) => ({ ...s, [id]: { ...s[id], busy: false } }))
    }
  }

  async function handleReceipt(order) {
    setError("")
    setReceiptBusy(order.orderId)
    try { await downloadInvoice(order.invoicePdfUrl, order.orderNumber) }
    catch (err) { setError(err?.message || t("downloads.errors.downloadFailed")) }
    finally { setReceiptBusy("") }
  }

  if (loading) {
    return (
      <LibrarySkeleton
        title={t("downloads.library.title")}
        subtitle={t("downloads.library.subtitle")}
        label={t("downloads.loading")}
      />
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-mint/30 bg-mint/8 px-4 py-3 text-meta text-mint-700" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={t("downloads.metrics.paid")}   value={orders.length}   subtitle={t("downloads.metrics.paidSubtitle")}   icon={ShoppingBag} tone="purple" />
        <MetricCard title={t("downloads.metrics.files")}  value={allFiles.length} subtitle={t("downloads.metrics.filesSubtitle")}  icon={FileArchive} tone="green" />
        <MetricCard title={t("downloads.metrics.latest")} value={newestDate}      subtitle={t("downloads.metrics.latestSubtitle")} icon={Clock3}      tone="amber" />
        <MetricCard title={t("downloads.metrics.ready")}  value={readyCount}      subtitle={t("downloads.metrics.readySubtitle")}  icon={Download}    tone="blue" />
      </div>

      <SectionCard
        title={t("downloads.library.title")}
        subtitle={t("downloads.library.subtitle")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="downloads-search" className="sr-only">{t("downloads.library.searchLabel")}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
              <input
                id="downloads-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("downloads.library.searchPlaceholder")}
                className="h-[36px] w-[200px] rounded-xl border border-charcoal-80/15 bg-white pl-8 pr-7 text-micro text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label={t("downloads.library.clearSearch")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-charcoal-80/40 hover:text-violet">
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label={t("downloads.library.refreshAria")}
              className="inline-flex items-center gap-2 rounded-xl border border-charcoal-80/10 bg-violet-pale/40 px-3 py-2 text-micro font-medium text-violet transition hover:bg-violet-pale disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">{t("downloads.library.refresh")}</span>
            </button>
          </div>
        }
      >
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-violet/10 blur-2xl" aria-hidden="true" />
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
                <Download className="h-9 w-9" aria-hidden="true" />
              </div>
            </div>
            <h3 className="mt-6 text-card font-bold text-violet">{t("downloads.empty.title")}</h3>
            <p className="mt-2 max-w-sm text-meta leading-6 text-charcoal-80/65">{t("downloads.empty.body")}</p>
            <Link to="/store" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2">
              {t("downloads.empty.browseStore")}
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-mist p-6 text-center text-meta text-charcoal-80/65">
            {t("downloads.empty.noProducts")}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.orderId}
                order={order}
                fileState={fileState}
                onDownload={handleDownload}
                onReceipt={handleReceipt}
                receiptBusy={receiptBusy}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  )
}
