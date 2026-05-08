import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Download, Package, Clock3, FileArchive, RefreshCw, AlertCircle, CheckCircle2,
  Search, X, LayoutGrid, Rows3, Calendar,
} from "lucide-react"
import { Link } from "react-router-dom"
import { MetricCard, EmptyState, SkeletonCard, SectionCard } from "../components/ui/index"
import { fetchMyOrders } from "../services/orderService"
import { API_BASE_URL } from "../lib/api"
import { getStoredToken } from "../services/authService"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"

/* ──────────────────────────────────────────────────────────────────────────
 *  DashboardDownloadsPage · F10.D · Batch 6 · I18N · Phase 119E
 *  Strings keyed under `dashboard.downloads.*`. Sub-components scope
 *  their own useTranslation hooks. Plural rules use i18next suffix
 *  (`_one`/`_other`) for "{N} files" and "{N} downloads left".
 *  ──────────────────────────────────────────────────────────────────── */

function resolveImageUrl(url = "") {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function ProductDownloadCard({ product, onDownload, downloadingKey }) {
  const { t, i18n } = useTranslation("dashboard")
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"
  const cover = product.images?.find((i) => i.imageRole === "cover") || product.images?.[0]
  const coverUrl = resolveImageUrl(cover?.url)

  return (
    <article className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:border-violet/20 hover:shadow-[0_18px_40px_rgba(93,63,211,0.08)]">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
        <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-violet-pale md:h-[120px] md:w-[160px]">
          {coverUrl ? (
            <img src={coverUrl} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-violet/30">
              <Package className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-body font-bold text-violet">{product.title}</h3>
            <span className="font-mono text-micro tabular-nums text-charcoal-80/55">
              · {t("downloads.card.files", { count: product.files.length })}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-micro tabular-nums text-charcoal-80/60">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {t("downloads.card.purchasedOn", { date: new Date(product.purchasedAt).toLocaleDateString(localeTag) })}
            <span>·</span>
            <span>{t("downloads.card.orderNumber", { number: product.orderNumber })}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-charcoal-80/8 bg-[#fafafa] p-4">
        <div className="space-y-2">
          {product.files.map((file) => {
            const styles = getFileTypeStyles(file.fileType || file.fileName || "")
            const TypeIcon = styles.icon
            const sizeDisplay = file.fileSize ? formatFileSize(file.fileSize) : ""
            const key = `${product.productId}:${file.fileId}`
            const isDownloading = downloadingKey === key
            const remaining = typeof file.downloadsRemaining === "number" ? file.downloadsRemaining : null
            const exhausted = remaining !== null && remaining <= 0

            return (
              <div
                key={key}
                className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: styles.background, color: styles.color }}
                    aria-hidden="true"
                  >
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-meta font-semibold text-violet" title={file.fileName}>
                        {file.fileName || styles.label}
                      </span>
                      <span
                        className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
                        style={{ background: styles.background, color: styles.color, borderColor: styles.borderColor }}
                      >
                        {styles.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-micro tabular-nums text-charcoal-80/55">
                      {sizeDisplay && <span>{sizeDisplay}</span>}
                      {sizeDisplay && (file.version || file.isPrimary) && <span aria-hidden="true">·</span>}
                      <span>{file.version ? `v${file.version}` : t("downloads.file.latest")}</span>
                      {file.isPrimary && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-violet">{t("downloads.file.primary")}</span>
                        </>
                      )}
                      {remaining !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className={exhausted ? "text-rose-600" : "text-charcoal-80/55"}>
                            {t("downloads.file.remaining", { count: remaining })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDownload(file)}
                  disabled={isDownloading || exhausted}
                  aria-label={t("downloads.file.downloadAria", { name: file.fileName || styles.label })}
                  className={`group inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2 text-meta font-semibold text-white transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2 sm:self-center ${
                    exhausted
                      ? "bg-charcoal-80/30 cursor-not-allowed"
                      : "bg-violet hover:-translate-y-0.5 hover:bg-violet-deep disabled:opacity-60"
                  }`}
                >
                  <Download className="h-4 w-4 transition group-hover:translate-y-0.5" aria-hidden="true" />
                  {exhausted ? t("downloads.file.limitReached") : isDownloading ? t("downloads.file.preparing") : t("downloads.file.download")}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}

function ListRow({ item, onDownload, downloadingKey }) {
  const { t } = useTranslation("dashboard")
  const key = `${item.productId}:${item.fileId}`
  const isDownloading = downloadingKey === key
  const styles = getFileTypeStyles(item.fileType || item.fileName || "")
  const TypeIcon = styles.icon
  const sizeDisplay = item.fileSize ? formatFileSize(item.fileSize) : ""

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 transition hover:border-violet/20 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: styles.background, color: styles.color }}
          aria-hidden="true"
        >
          <TypeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-meta font-semibold text-violet" title={item.fileName}>
              {item.fileName}
            </span>
            <span
              className="shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
              style={{ background: styles.background, color: styles.color, borderColor: styles.borderColor }}
            >
              {styles.label}
            </span>
          </div>
          <div className="mt-0.5 text-micro text-charcoal-80/70">{item.productTitle}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-micro tabular-nums text-charcoal-80/55">
            <span>{t("downloads.card.orderNumber", { number: item.orderNumber })}</span>
            <span aria-hidden="true">·</span>
            <span>{item.version ? `v${item.version}` : t("downloads.file.latest")}</span>
            {sizeDisplay && (
              <>
                <span aria-hidden="true">·</span>
                <span>{sizeDisplay}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{item.isPrimary ? t("downloads.file.primaryFile") : t("downloads.file.additional")}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="rounded-full bg-mint/15 px-3 py-1 text-micro font-bold uppercase tracking-wider text-mint ring-1 ring-mint/25 ring-inset">
          {t("downloads.file.paid")}
        </span>
        <button
          type="button"
          onClick={() => onDownload(item)}
          disabled={isDownloading}
          aria-label={t("downloads.file.downloadAria", { name: item.fileName })}
          className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {isDownloading ? t("downloads.file.preparing") : t("downloads.file.download")}
        </button>
      </div>
    </div>
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
  const [downloadingKey, setDownloadingKey] = useState("")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState("grid")

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError("")
    try {
      const data = await fetchMyOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || t("downloads.errors.load"))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  // Group entitlements by product (for grid view) AND flatten (for list view)
  const { productGroups, flatItems } = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === "paid")
    const groups = new Map()
    const flat = []

    for (const order of paidOrders) {
      for (const item of order.items || []) {
        const product = item.product
        if (!product?.files?.length) continue

        const productKey = product.id
        if (!groups.has(productKey)) {
          groups.set(productKey, {
            productId: product.id,
            title: product.title || item.title || t("downloads.card.fallbackTitle"),
            images: product.images || [],
            orderNumber: order.orderNumber || order.id,
            purchasedAt: order.createdAt,
            files: [],
          })
        }
        const group = groups.get(productKey)

        for (const file of product.files) {
          if (group.files.some((f) => f.fileId === file.id)) continue

          const fileEntry = {
            fileId: file.id,
            fileName: file.fileName || "download",
            fileType: file.fileType,
            fileSize: file.fileSize,
            version: file.version,
            isPrimary: file.isPrimary,
            downloadsRemaining: file.downloadsRemaining,
            productId: product.id,
            productTitle: product.title || item.title || t("downloads.card.fallbackTitle"),
            orderNumber: order.orderNumber || order.id,
            purchasedAt: order.createdAt,
            key: `${product.id}:${file.id}`,
          }
          group.files.push(fileEntry)
          flat.push(fileEntry)
        }
      }
    }

    return {
      productGroups: Array.from(groups.values()),
      flatItems: flat,
    }
  }, [orders, t])

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return productGroups
    const q = search.toLowerCase().trim()
    return productGroups.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.files.some((f) => (f.fileName || "").toLowerCase().includes(q))
    )
  }, [productGroups, search])

  const filteredFlat = useMemo(() => {
    if (!search.trim()) return flatItems
    const q = search.toLowerCase().trim()
    return flatItems.filter((f) =>
      (f.fileName || "").toLowerCase().includes(q) ||
      (f.productTitle || "").toLowerCase().includes(q)
    )
  }, [flatItems, search])

  const paidCount = useMemo(
    () => orders.filter((o) => o.status === "paid").length,
    [orders]
  )

  const newestDate = useMemo(() => {
    if (!flatItems.length) return ","
    const sorted = [...flatItems].sort(
      (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)
    )
    return new Date(sorted[0].purchasedAt).toLocaleDateString(localeTag)
  }, [flatItems, localeTag])

  async function handleDownload(item) {
    setError("")
    setSuccess("")
    const key = `${item.productId}:${item.fileId}`
    setDownloadingKey(key)

    try {
      const token = getStoredToken()
      if (!token) throw new Error(t("downloads.errors.loginRequired"))

      const url = `${API_BASE_URL}/api/downloads/${item.productId}/file/${item.fileId}`
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || t("downloads.errors.downloadFailed"))
      }

      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)

      let filename = item.fileName
      const disposition = response.headers.get("Content-Disposition")
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match?.[1]) filename = match[1]
      }

      const link = document.createElement("a")
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)

      setSuccess(t("downloads.toast.downloadStarted", { filename }))
    } catch (err) {
      setError(err.message || t("downloads.errors.downloadUnavailable"))
    } finally {
      setDownloadingKey("")
    }
  }

  if (loading) {
    return (
      <section className="space-y-5" role="status" aria-busy="true" aria-label={t("downloads.loading")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[320px]" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-meta text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-mint/30 bg-mint/8 px-4 py-3 text-meta text-mint" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {success}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={t("downloads.metrics.paid")}   value={paidCount}        subtitle={t("downloads.metrics.paidSubtitle")}   icon={Package}      tone="purple" />
        <MetricCard title={t("downloads.metrics.files")}  value={flatItems.length} subtitle={t("downloads.metrics.filesSubtitle")}  icon={FileArchive}  tone="green" />
        <MetricCard title={t("downloads.metrics.latest")} value={newestDate}       subtitle={t("downloads.metrics.latestSubtitle")} icon={Clock3}       tone="amber" />
        <MetricCard title={t("downloads.metrics.ready")}  value={flatItems.length} subtitle={t("downloads.metrics.readySubtitle")}  icon={Download}     tone="blue" />
      </div>

      {/* Download library */}
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
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("downloads.library.clearSearch")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-charcoal-80/40 hover:text-violet"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* View mode toggle */}
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-charcoal-80/12 bg-white">
              {[
                { mode: "grid", Icon: LayoutGrid, labelKey: "downloads.library.gridView" },
                { mode: "list", Icon: Rows3,      labelKey: "downloads.library.listView" },
              ].map(({ mode, Icon, labelKey }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-label={t(labelKey)}
                  aria-pressed={viewMode === mode}
                  className={`flex h-[36px] w-9 items-center justify-center transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset ${
                    viewMode === mode ? "bg-violet text-white" : "text-charcoal-80/55 hover:text-violet"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label={t("downloads.library.refreshAria")}
              className="inline-flex items-center gap-2 rounded-xl border border-charcoal-80/10 bg-[#f7f4f8] px-3 py-2 text-micro font-medium text-violet transition hover:bg-violet-pale disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">{t("downloads.library.refresh")}</span>
            </button>
          </div>
        }
      >
        {productGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-full bg-violet/10 blur-2xl" aria-hidden="true" />
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
                <Download className="h-9 w-9" aria-hidden="true" />
              </div>
            </div>
            <h3 className="mt-6 text-card font-bold text-violet">{t("downloads.empty.title")}</h3>
            <p className="mt-2 max-w-sm text-meta leading-6 text-charcoal-80/65">
              {t("downloads.empty.body")}
            </p>
            <Link
              to="/store"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              {t("downloads.empty.browseStore")}
            </Link>
          </div>
        ) : viewMode === "grid" ? (
          filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-[#fafafa] p-6 text-center text-meta text-charcoal-80/60">
              {t("downloads.empty.noProducts")}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <ProductDownloadCard
                  key={product.productId}
                  product={product}
                  onDownload={handleDownload}
                  downloadingKey={downloadingKey}
                />
              ))}
            </div>
          )
        ) : (
          filteredFlat.length === 0 ? (
            <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-[#fafafa] p-6 text-center text-meta text-charcoal-80/60">
              {t("downloads.empty.noFiles")}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFlat.map((item) => (
                <ListRow
                  key={item.key}
                  item={item}
                  onDownload={handleDownload}
                  downloadingKey={downloadingKey}
                />
              ))}
            </div>
          )
        )}
      </SectionCard>
    </section>
  )
}
