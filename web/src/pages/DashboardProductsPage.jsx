import { useEffect, useMemo, useState } from "react"
import { Download, Package, Sparkles, FileArchive, Clock3 } from "lucide-react"
import { fetchMyOrders } from "../services/orderService"
import { getStoredToken } from "../services/authService"
import { MetricCard, EmptyState, StatusBadge, SectionCard, SkeletonCard } from "../components/ui/index"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"


export default function DashboardProductsPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [downloadingKey, setDownloadingKey] = useState(new Set())

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true)
        setErrorMessage("")
        const data = await fetchMyOrders()
        setOrders(Array.isArray(data) ? data : [])
      } catch (error) {
        setErrorMessage(error.message || "Failed to load products.")
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
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
            title: item.product.title || item.title || "Product",
            slug: item.product.slug,
            images: item.product.images || [],
            files: item.product.files || [],
            quantity: item.quantity,
          })
        }
      }
    }

    return rows
  }, [orders])

  const totalFiles = useMemo(
    () => myProducts.reduce((sum, product) => sum + (product.files?.length || 0), 0),
    [myProducts]
  )

  const recentPurchaseDate = useMemo(() => {
    if (!myProducts.length) return "—"
    const latest = [...myProducts].sort(
      (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)
    )[0]
    return new Date(latest.purchasedAt).toLocaleDateString()
  }, [myProducts])

  const handleDownloadFile = async (productId, file) => {
    const key = `${productId}:${file.id}`
    try {
      setErrorMessage("")
      setSuccessMessage("")

      const token = getStoredToken()

      if (!token) {
        throw new Error("You must be logged in to download this file.")
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
        throw new Error(data.message || "Download failed.")
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
      setSuccessMessage(`Download started: ${filename}`)
    } catch (error) {
      setErrorMessage(error.message || "Download not available.")
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
              className="h-[132px] animate-pulse rounded-xl border border-[#634F40]/10 bg-white"
            />
          ))}
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[240px] animate-pulse rounded-xl border border-[#634F40]/10 bg-white"
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Products Owned"
          value={myProducts.length}
          subtitle="Paid downloadable products"
          icon={Package}
          tone="purple"
        />
        <MetricCard
          title="Files Available"
          value={totalFiles}
          subtitle="Across your purchased products"
          icon={FileArchive}
          tone="green"
        />
        <MetricCard
          title="Latest Purchase"
          value={recentPurchaseDate}
          subtitle="Most recent paid access date"
          icon={Clock3}
          tone="amber"
        />
        <MetricCard
          title="Ready to Download"
          value={totalFiles}
          subtitle="Secure member-only access"
          icon={Download}
          tone="blue"
        />
      </div>

      {myProducts.length === 0 ? (
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] p-6 text-[13px] text-[#634F40]/70">
            No paid downloadable products yet.
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {myProducts.map((product, index) => (
            <div
              key={`${product.orderId}-${product.productId}-${index}`}
              className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_10px_24px_rgba(66,0,96,0.04)]"
            >
              <div className="flex flex-col gap-5 lg:flex-row">
                <div className="h-44 w-full max-w-[220px] overflow-hidden rounded-xl bg-[#f4f1f4]">
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
                    <div className="flex h-full items-center justify-center text-[#634F40]/50">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-[20px] font-bold text-[#420060]">
                        {product.title}
                      </h3>
                      <p className="mt-1 text-[12px] text-[#634F40]/70">
                        Purchased on {new Date(product.purchasedAt).toLocaleString()}
                      </p>
                      <p className="mt-1 text-[12px] text-[#634F40]/70">
                        Order #{product.orderNumber || product.orderId}
                      </p>
                    </div>

                    <div className="rounded-full bg-[#e5f4e8] px-4 py-2 text-[12px] font-semibold text-[#3b8f47]">
                      Paid
                    </div>
                  </div>

                  <div className="mt-5">
                    <h4 className="text-[15px] font-semibold text-[#420060]">
                      Available Files
                    </h4>

                    <div className="mt-3 grid gap-3">
                      {product.files.map((file) => {
                        const key = `${product.productId}:${file.id}`

                        return (
                          <div
                            key={file.id}
                            className="flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="text-[14px] font-medium text-[#420060]">
                                {file.fileName}
                              </div>
                              <div className="mt-1 text-[12px] text-[#634F40]/70">
                                {file.version ? `Version: ${file.version} • ` : ""}
                                {file.isPrimary ? "Primary file" : "Additional file"}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDownloadFile(product.productId, file)}
                              disabled={downloadingKey.has(key)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#420060] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-70"
                            >
                              <Download className="h-4 w-4" />
                              {downloadingKey.has(key) ? "Preparing..." : "Download"}
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