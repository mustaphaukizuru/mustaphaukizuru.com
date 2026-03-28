import { useEffect, useMemo, useState } from "react"
import { Download, ArrowDownToLine, PackageOpen, UserRound } from "lucide-react"
import { fetchAdminDownloads } from "../services/adminDownloadService"
import { MetricCard, EmptyState, StatusBadge, SectionCard, SkeletonCard } from "../components/ui/index"


export default function AdminDownloadsPage() {
  const [data, setData] = useState({
    downloads: [],
    topProducts: [],
    totalDownloads: 0,
  })
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    async function loadDownloads() {
      try {
        setLoading(true)
        setErrorMessage("")
        const result = await fetchAdminDownloads()
        setData({
          downloads: Array.isArray(result?.downloads) ? result.downloads : [],
          topProducts: Array.isArray(result?.topProducts) ? result.topProducts : [],
          totalDownloads: Number(result?.totalDownloads || 0),
        })
      } catch (error) {
        setErrorMessage(error.message || "Failed to load downloads.")
      } finally {
        setLoading(false)
      }
    }

    loadDownloads()
  }, [])

  const uniqueUsers = useMemo(() => {
    return new Set((data.downloads || []).map((item) => item.user?.id).filter(Boolean)).size
  }, [data.downloads])

  const uniqueProducts = useMemo(() => {
    return new Set((data.downloads || []).map((item) => item.product?.id).filter(Boolean)).size
  }, [data.downloads])

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[#420060]">Download Activity</h2>
          <p className="mt-1 text-[12px] text-[#634F40]/70">
            Monitor digital delivery, member access, and top downloaded products.
          </p>
        </div>

        <div className="rounded-xl bg-[#fbf8fb] px-4 py-2 text-[12px] text-[#634F40]/70">
          Latest 100 download records
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Downloads"
          value={data.totalDownloads}
          subtitle="All recorded delivery events"
          icon={Download}
          tone="purple"
        />
        <MetricCard
          title="Unique Products"
          value={uniqueProducts}
          subtitle="Products with download activity"
          icon={PackageOpen}
          tone="green"
        />
        <MetricCard
          title="Active Users"
          value={uniqueUsers}
          subtitle="Users who downloaded files"
          icon={UserRound}
          tone="blue"
        />
        <MetricCard
          title="Top Product Downloads"
          value={data.topProducts?.[0]?.downloads || 0}
          subtitle={data.topProducts?.[0]?.title || "No data yet"}
          icon={ArrowDownToLine}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-[#420060]">Top Downloaded Products</h3>
              <p className="mt-1 text-[12px] text-[#634F40]/70">
                Ranked by recorded download count.
              </p>
            </div>

            <div className="rounded-xl bg-[#ede4ef] p-3 text-[#420060]">
              <Download className="h-4.5 w-4.5" />
            </div>
          </div>

          {loading ? (
            <div className="mt-5 space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-[72px] animate-pulse rounded-xl border border-[#634F40]/10 bg-[#fbf8fb]"
                />
              ))}
            </div>
          ) : data.topProducts.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] px-4 py-6 text-[13px] text-[#634F40]/70">
              No download data available yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {data.topProducts.map((item, index) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between rounded-xl border border-[#634F40]/10 bg-[#fbf8fb] px-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#420060]">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-[#420060]">
                          {item.title}
                        </div>
                        <div className="mt-1 text-[12px] text-[#634F40]/65">
                          Product ID: {item.productId}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[18px] font-bold text-[#420060]">{item.downloads}</div>
                    <div className="text-[11px] text-[#634F40]/60">downloads</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_10px_24px_rgba(66,0,96,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-semibold text-[#420060]">Recent Download Activity</h3>
              <p className="mt-1 text-[12px] text-[#634F40]/70">
                Latest digital delivery events linked to products and orders.
              </p>
            </div>

            <div className="rounded-xl bg-[#eef3fb] p-3 text-[#2f5ea8]">
              <ArrowDownToLine className="h-4.5 w-4.5" />
            </div>
          </div>

          {loading ? (
            <div className="mt-5 space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-[68px] animate-pulse rounded-xl border border-[#634F40]/10 bg-[#fbf8fb]"
                />
              ))}
            </div>
          ) : data.downloads.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#d9ccd9] bg-[#fbf9fb] px-4 py-6 text-[13px] text-[#634F40]/70">
              No recent download activity found.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-[#634F40]/10">
              <div className="grid grid-cols-[1fr_1fr_0.8fr_1fr] gap-3 border-b border-[#634F40]/10 bg-[#fbf8fb] px-4 py-3 text-[12px] font-semibold text-[#634F40]/75">
                <div>User</div>
                <div>Product</div>
                <div>Order</div>
                <div>Date</div>
              </div>

              {data.downloads.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_1fr_0.8fr_1fr] gap-3 border-b border-[#634F40]/8 px-4 py-4 text-[13px] last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#420060]">
                      {item.user?.fullName || "Unnamed User"}
                    </div>
                    <div className="mt-1 truncate text-[12px] text-[#634F40]/65">
                      {item.user?.email || "—"}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#420060]">
                      {item.product?.title || "Product"}
                    </div>
                    <div className="mt-1 truncate text-[12px] text-[#634F40]/65">
                      {item.product?.slug || "—"}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#420060]">
                      {item.order?.orderNumber || item.order?.id || "—"}
                    </div>
                    <div className="mt-1 text-[12px] text-[#634F40]/65">
                      {item.order?.status || "—"}
                    </div>
                  </div>

                  <div className="text-[12px] text-[#634F40]/75">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}