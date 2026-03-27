import { useEffect, useMemo, useState } from "react"
import { Download, Package, Clock3, FileArchive, RefreshCw, AlertCircle } from "lucide-react"
import { MetricCard, EmptyState, SkeletonCard, SectionCard, StatusBadge } from "../components/ui/index"
import { fetchMyOrders } from "../services/orderService"
import { API_BASE_URL } from "../lib/api"
import { getStoredToken } from "../services/authService"

// ─────────────────────────────────────────────────────────────────────────────
// Download history page — separate from My Products
// Shows entitled files, download history, and access state
// ─────────────────────────────────────────────────────────────────────────────

function DownloadRow({ item, onDownload, downloadingKey }) {
  const key = `${item.productId}:${item.fileId}`
  const isDownloading = downloadingKey === key

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
          <FileArchive className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#420060]">{item.fileName}</div>
          <div className="mt-0.5 text-[12px] text-[#634F40]/70">{item.productTitle}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#634F40]/55">
            <span>Order #{item.orderNumber}</span>
            <span>·</span>
            <span>{item.version ? `v${item.version}` : "Latest"}</span>
            <span>·</span>
            <span>{item.isPrimary ? "Primary file" : "Additional"}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="rounded-full bg-[#e5f4e8] px-3 py-1 text-[11px] font-semibold text-[#3b8f47]">
          Paid
        </span>

        <button
          type="button"
          onClick={() => onDownload(item)}
          disabled={isDownloading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {isDownloading ? "Preparing..." : "Download"}
        </button>
      </div>
    </div>
  )
}

export default function DashboardDownloadsPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [downloadingKey, setDownloadingKey] = useState("")

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError("")
    try {
      const data = await fetchMyOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || "Failed to load downloads.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  // Build a flat list of entitlements from paid orders
  const downloadItems = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === "paid")
    const rows = []
    for (const order of paidOrders) {
      for (const item of order.items || []) {
        const product = item.product
        if (!product?.files?.length) continue
        for (const file of product.files) {
          rows.push({
            key: `${product.id}:${file.id}`,
            productId: product.id,
            fileId: file.id,
            productTitle: product.title || item.title || "Product",
            fileName: file.fileName || "download",
            version: file.version,
            isPrimary: file.isPrimary,
            orderNumber: order.orderNumber || order.id,
            purchasedAt: order.createdAt,
          })
        }
      }
    }
    return rows
  }, [orders])

  const paidCount = useMemo(
    () => orders.filter((o) => o.status === "paid").length,
    [orders]
  )

  const newestDate = useMemo(() => {
    if (!downloadItems.length) return "—"
    const sorted = [...downloadItems].sort(
      (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)
    )
    return new Date(sorted[0].purchasedAt).toLocaleDateString()
  }, [downloadItems])

  async function handleDownload(item) {
    setError("")
    setSuccess("")
    const key = `${item.productId}:${item.fileId}`
    setDownloadingKey(key)

    try {
      const token = getStoredToken()
      if (!token) throw new Error("You must be logged in to download.")

      const url = `${API_BASE_URL}/api/downloads/${item.productId}/file/${item.fileId}`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || "Download failed.")
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

      setSuccess(`Download started: ${filename}`)
    } catch (err) {
      setError(err.message || "Download not available.")
    } finally {
      setDownloadingKey("")
    }
  }

  if (loading) {
    return (
      <section className="space-y-5">
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
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-700">
          {success}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Paid Orders"
          value={paidCount}
          subtitle="Orders with download access"
          icon={Package}
          tone="purple"
        />
        <MetricCard
          title="Files Available"
          value={downloadItems.length}
          subtitle="Downloadable files across products"
          icon={FileArchive}
          tone="green"
        />
        <MetricCard
          title="Latest Access"
          value={newestDate}
          subtitle="Most recent purchase date"
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          title="Ready to Download"
          value={downloadItems.length}
          subtitle="Secure member-only access"
          icon={Download}
          tone="blue"
        />
      </div>

      {/* Download list */}
      <SectionCard
        title="Your Download Library"
        subtitle="All files available from your paid orders."
        action={
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/10 bg-[#f7f4f8] px-4 py-2 text-[12px] font-medium text-[#420060] transition hover:bg-[#ede4ef] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      >
        {downloadItems.length === 0 ? (
          <EmptyState
            icon={Download}
            title="No downloads available yet"
            description="Purchase a digital product and it will appear here for secure download access."
          />
        ) : (
          <div className="space-y-3">
            {downloadItems.map((item) => (
              <DownloadRow
                key={item.key}
                item={item}
                onDownload={handleDownload}
                downloadingKey={downloadingKey}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  )
}
