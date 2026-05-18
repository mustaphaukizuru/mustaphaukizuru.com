import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Download, Package, Sparkles, FileArchive, Clock3 } from "lucide-react"
import { fetchMyOrders } from "../services/orderService"
import { streamFileDownload, triggerBrowserDownload } from "../services/downloadService"
import { API_BASE_URL } from "../lib/api"
import { MetricCard, EmptyState, StatusBadge, SectionCard, SkeletonCard } from "../components/ui/index"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"

/* I18N · Phase 119B — strings keyed under `dashboard.products.*`.
 * The download flow's "Authorization" header and Content-Disposition
 * parsing stays unchanged — only the user-visible toasts and labels
 * resolve via t().
 *
 * Bug fix · Member-dashboard parity with DashboardDownloadsPage:
 *   1. Use centralized API_BASE_URL from lib/api so production base
 *      URL resolution is identical to the working downloads page
 *      (avoids "Failed to fetch" caused by trailing-slash drift or
 *      a stale localhost fallback in production builds).
 *   2. Resolve product cover image by scanning images[] for
 *      isPrimary / imageRole==="cover" / first usable URL — same
 *      contract as cart, checkout, and downloads.
 *   3. Add onError fallback so a broken upload still renders the
 *      Package icon instead of a torn image.
 *   4. Defensive validation on download IDs to surface a clear
 *      error instead of a confusing fetch failure when the data
 *      shape is partial.
 */

function resolveProductImage(product) {
  if (!Array.isArray(product?.images) || product.images.length === 0) return null
  const primary =
    product.images.find((img) => img?.isPrimary) ||
    product.images.find((img) => img?.imageRole === "cover") ||
    product.images.find((img) => img?.url)
  if (!primary?.url) return null
  return primary.url.startsWith("http") ? primary.url : `${API_BASE_URL}${primary.url}`
}


export default function DashboardProductsPage() {
  const { t, i18n } = useTranslation("dashboard")
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [downloadingKey, setDownloadingKey] = useState(new Set())

  // Locale tag for date formatting · es → es-MX, otherwise en-US.
  const localeTag = i18n.language === "es" ? "es-MX" : "en-US"

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true)
        setErrorMessage("")
        const data = await fetchMyOrders()
        setOrders(Array.isArray(data) ? data : [])
      } catch (error) {
        setErrorMessage(error.message || t("products.errors.load"))
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const myProducts = useMemo(() => {
    const paidOrders = orders.filter((order) => order.status === "paid")
    const rows = []

    for (const order of paidOrders) {
      for (const item of order.items || []) {
        if (item.product?.files?.length > 0) {
          rows.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            purchasedAt: order.createdAt,
            productId: item.product.id,
            title: item.product.title || item.title || t("products.list.fallbackTitle"),
            slug: item.product.slug,
            images: item.product.images || [],
            files: item.product.files || [],
            quantity: item.quantity,
          })
        }
      }
    }

    return rows
  }, [orders, t])

  const totalFiles = useMemo(
    () => myProducts.reduce((sum, product) => sum + (product.files?.length || 0), 0),
    [myProducts]
  )

  const recentPurchaseDate = useMemo(() => {
    if (!myProducts.length) return ","
    const latest = [...myProducts].sort(
      (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)
    )[0]
    return new Date(latest.purchasedAt).toLocaleDateString(localeTag)
  }, [myProducts, localeTag])

  const handleDownloadFile = async (productId, file) => {
    // Defensive ID validation — when the data path is partial (e.g. an
    // order item missing its product relation), productId or file.id can
    // be undefined and the fetch URL collapses to ".../undefined/file/...".
    // That request resolves to a 404 (or a CORS-blocked response on some
    // hosts) and bubbles up as the cryptic "Failed to fetch". Surface a
    // clean message instead and bail out before the network call.
    if (!productId || !file?.id) {
      setErrorMessage(t("products.errors.downloadUnavailable"))
      return
    }

    const key = `${productId}:${file.id}`
    try {
      setErrorMessage("")
      setSuccessMessage("")
      setDownloadingKey((prev) => new Set(prev).add(key))

      // Centralised download path — adds Authorization, /api/v1 prefix,
      // session-expired auto-handling, and AppError-with-friendly-message
      // mapping (matches the DashboardDownloadsPage flow that worked).
      const { blob, filename } = await streamFileDownload(productId, file.id)
      triggerBrowserDownload(blob, filename || file.fileName || "download")
      setSuccessMessage(t("products.toast.downloadStarted", { filename: filename || file.fileName }))
    } catch (error) {
      setErrorMessage(
        error?.toUserMessage?.() ||
        error?.message ||
        t("products.errors.downloadUnavailable"),
      )
    } finally {
      setDownloadingKey((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-[132px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white"
            />
          ))}
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[240px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white"
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t("products.metrics.owned")}
          value={myProducts.length}
          subtitle={t("products.metrics.ownedSubtitle")}
          icon={Package}
          tone="purple"
        />
        <MetricCard
          title={t("products.metrics.files")}
          value={totalFiles}
          subtitle={t("products.metrics.filesSubtitle")}
          icon={FileArchive}
          tone="green"
        />
        <MetricCard
          title={t("products.metrics.latest")}
          value={recentPurchaseDate}
          subtitle={t("products.metrics.latestSubtitle")}
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          title={t("products.metrics.ready")}
          value={totalFiles}
          subtitle={t("products.metrics.readySubtitle")}
          icon={Download}
          tone="blue"
        />
      </div>

      {myProducts.length === 0 ? (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgba(93,63,211,0.04)]">
          <div className="rounded-xl border border-dashed border-violet/20 bg-violet-pale/30 p-6 text-meta text-charcoal-80/70">
            {t("products.list.empty")}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {myProducts.map((product, index) => (
            <ProductRow
              key={`${product.orderId}-${product.productId}-${index}`}
              product={product}
              localeTag={localeTag}
              t={t}
              downloadingKey={downloadingKey}
              onDownload={handleDownloadFile}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  ProductRow — extracted so the cover-image hook (img-broken state) lives
 *  per-card. Without per-row state, a single broken image would mask the
 *  fallback for every other card.
 *  ────────────────────────────────────────────────────────────────────── */
function ProductRow({ product, localeTag, t, downloadingKey, onDownload }) {
  const [imgBroken, setImgBroken] = useState(false)
  const coverUrl = resolveProductImage(product)
  const showImage = coverUrl && !imgBroken

  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgba(93,63,211,0.04)]">
      <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row">
        <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-violet-pale lg:h-44 lg:w-60">
          {showImage ? (
            <img
              src={coverUrl}
              alt={product.images?.[0]?.altText || product.title}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-violet/30">
              <Package className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h3 className="text-subsection font-bold text-violet">
                {product.title}
              </h3>
              <p className="mt-1 text-micro text-charcoal-80/70">
                {t("products.list.purchasedOn", { date: new Date(product.purchasedAt).toLocaleString(localeTag) })}
              </p>
              <p className="mt-1 text-micro text-charcoal-80/70">
                {t("products.list.orderNumber", { number: product.orderNumber || product.orderId })}
              </p>
            </div>

            <div className="rounded-full bg-mint-100 px-4 py-2 text-micro font-semibold text-mint-800">
              {t("products.list.paid")}
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-body font-semibold text-violet">
              {t("products.list.availableFiles")}
            </h4>

            <div className="mt-3 grid gap-3">
              {product.files.map((file) => {
                const key = `${product.productId}:${file.id}`

                // F04 · A+B — Resolve icon, label, and tone from the file
                // so member's "My Products" view matches the public/admin
                // visual language.
                const styles = getFileTypeStyles(file.fileType || file.fileName || "")
                const TypeIcon = styles.icon
                const sizeDisplay = file.fileSize ? formatFileSize(file.fileSize) : ""
                const versionValue = file.version ? String(file.version).replace(/^v/i, "").replace(/v$/i, "") : ""

                return (
                  <div
                    key={file.id}
                    className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-mist p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.chip}`}
                        aria-hidden="true"
                      >
                        <TypeIcon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-meta font-medium text-violet" title={file.fileName}>
                            {file.fileName}
                          </span>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${styles.chip}`}
                          >
                            {styles.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/70">
                          {file.version && <span>{t("products.file.version", { value: versionValue })}</span>}
                          {file.version && sizeDisplay && <span>·</span>}
                          {sizeDisplay && <span className="font-mono tabular-nums">{sizeDisplay}</span>}
                          {(file.version || sizeDisplay) && <span>·</span>}
                          <span>{file.isPrimary ? t("products.file.primary") : t("products.file.additional")}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDownload(product.productId, file)}
                      disabled={downloadingKey.has(key)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-70"
                    >
                      <Download className="h-4 w-4" />
                      {downloadingKey.has(key) ? t("products.file.preparing") : t("products.file.download")}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
