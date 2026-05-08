import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Download, Package, Sparkles, FileArchive, Clock3 } from "lucide-react"
import { fetchMyOrders } from "../services/orderService"
import { getStoredToken } from "../services/authService"
import { MetricCard, EmptyState, StatusBadge, SectionCard, SkeletonCard } from "../components/ui/index"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"

/* I18N · Phase 119B — strings keyed under `dashboard.products.*`.
 * The download flow's "Authorization" header and Content-Disposition
 * parsing stays unchanged — only the user-visible toasts and labels
 * resolve via t(). */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"


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
    const key = `${productId}:${file.id}`
    try {
      setErrorMessage("")
      setSuccessMessage("")

      const token = getStoredToken()

      if (!token) {
        throw new Error(t("products.errors.loginRequired"))
      }

      const downloadUrl = `${API_BASE_URL}/api/downloads/${productId}/file/${file.id}`
      setDownloadingKey((prev) => new Set(prev).add(key))

      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || t("products.errors.downloadFailed"))
      }

      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)

      let filename = file.fileName || "download"
      const disposition = response.headers.get("Content-Disposition")

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) {
          filename = match[1]
        }
      }

      const link = document.createElement("a")
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()

      window.URL.revokeObjectURL(objectUrl)
      setSuccessMessage(t("products.toast.downloadStarted", { filename }))
    } catch (error) {
      setErrorMessage(error.message || t("products.errors.downloadUnavailable"))
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-meta text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-meta text-green-700">
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
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-6 text-meta text-charcoal-80/70">
            {t("products.list.empty")}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {myProducts.map((product, index) => (
            <div
              key={`${product.orderId}-${product.productId}-${index}`}
              className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_10px_24px_rgba(93,63,211,0.04)]"
            >
              <div className="flex flex-col gap-4 sm:gap-5 lg:flex-row">
                <div className="h-full w-full overflow-hidden rounded-xl bg-[#f4f1f4] sm:h-44 ">
                  {product.images?.[0]?.url ? (
                    <img
                      src={
                        product.images[0].url.startsWith("http")
                          ? product.images[0].url
                          : `${API_BASE_URL}${product.images[0].url}`
                      }
                      alt={product.images[0].altText || product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-charcoal-80/50">
                      <Package className="h-10 w-10" />
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

                    <div className="rounded-full bg-[#e5f4e8] px-4 py-2 text-micro font-semibold text-[#3b8f47]">
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
                            className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-[#fafafa] p-4 md:flex-row md:items-center md:justify-between"
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
                              onClick={() => handleDownloadFile(product.productId, file)}
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
          ))}
        </div>
      )}
    </section>
  )
}
