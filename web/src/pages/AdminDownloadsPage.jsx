import { useEffect, useMemo, useState } from "react"
import {
  Download, ArrowDownToLine, PackageOpen, UserRound,
} from "lucide-react"
import { fetchAdminDownloads } from "../services/adminDownloadService"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminDownloadsPage · Batch 6B-4
 *
 *  Refactored to use shared DataTable + StatusPill primitives.
 *
 *  What changed:
 *    - Bespoke download activity grid replaced with sortable DataTable
 *    - Search across user name, email, product title, order #
 *    - Top Products card kept but visually refined to match v3 tokens
 *    - Order status uses StatusPill
 *    - All numerics in JetBrains Mono
 *    - Mojibake "â€¦" / "-" fixed to clean characters
 *
 *  Preserved verbatim:
 *    - fetchAdminDownloads API contract
 *    - 4-card metrics (total / unique products / unique users / top product)
 *    - Top Products list (separate card — better as a ranked list than table)
 *    - "Latest 100 download records" banner copy
 *  ──────────────────────────────────────────────────────────────────── */

export default function AdminDownloadsPage() {
  const [data, setData] = useState({
    downloads: [],
    topProducts: [],
    totalDownloads: 0,
  })
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  async function loadDownloads() {
    try {
      setLoading(true); setErrorMessage("")
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

  useEffect(() => { loadDownloads() }, [])

  const uniqueUsers = useMemo(
    () => new Set((data.downloads || []).map((item) => item.user?.id).filter(Boolean)).size,
    [data.downloads]
  )

  const uniqueProducts = useMemo(
    () => new Set((data.downloads || []).map((item) => item.product?.id).filter(Boolean)).size,
    [data.downloads]
  )

  const columns = useMemo(() => [
    {
      key: "user",
      label: "User",
      sortable: true,
      searchable: true,
      width: "1.4fr",
      getValue: (row) => row.user?.fullName || row.user?.email || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-semibold text-violet">
            {row.user?.fullName || "Unnamed User"}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">
            {row.user?.email || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "product",
      label: "Product",
      sortable: true,
      searchable: true,
      width: "1.5fr",
      getValue: (row) => row.product?.title || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-semibold text-violet">
            {row.product?.title || "Product"}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">
            /store/{row.product?.slug || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "order",
      label: "Order",
      sortable: true,
      searchable: true,
      width: "1.0fr",
      getValue: (row) => row.order?.orderNumber || row.order?.id || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-mono text-meta font-semibold tabular-nums text-violet">
            {row.order?.orderNumber ? `#${row.order.orderNumber}` : "-"}
          </div>
          {row.order?.status && (
            <div className="mt-0.5">
              <StatusPill status={row.order.status} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "When",
      sortable: true,
      width: "1.0fr",
      align: "right",
      getValue: (row) => row.createdAt || "",
      render: (row) => (
        <span className="font-mono text-micro tabular-nums text-charcoal-80/65">
          {row.createdAt ? new Date(row.createdAt).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          }) : "-"}
        </span>
      ),
    },
  ], [])

  return (
    <section className="space-y-5">
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-meta text-rose-700" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Page intro */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-meta text-charcoal-80/70">
          Monitor digital delivery, member access, and top downloaded products.
        </p>
        <span className="font-mono text-micro tabular-nums text-charcoal-80/55">
          Latest 100 download records
        </span>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* Two-column: Top products list + Download activity table */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr]">
        {/* Top products card (kept as ranked list, better than table for top-N) */}
        <div className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-card font-bold text-violet">Top Downloaded Products</h3>
              <p className="mt-0.5 text-micro text-charcoal-80/65">Ranked by recorded download count.</p>
            </div>
            <div className="shrink-0 rounded-xl bg-violet-pale p-2.5 text-violet">
              <Download className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>

          {loading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-[64px] animate-pulse rounded-lg bg-violet-ghost/60" />
              ))}
            </div>
          ) : data.topProducts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-charcoal-80/15 bg-mist px-4 py-6 text-center text-meta text-charcoal-80/65">
              No download data available yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {data.topProducts.map((item, index) => {
                const max = Math.max(...data.topProducts.map((p) => p.downloads || 0), 1)
                const ratio = ((item.downloads || 0) / max) * 100
                return (
                  <div
                    key={item.productId || index}
                    className="rounded-lg border border-charcoal-80/8 bg-mist px-3 py-3 transition hover:border-violet/15 hover:bg-violet-pale/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-pale font-mono text-[11px] font-bold text-violet">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-meta font-semibold text-violet">{item.title}</div>
                        <div className="mt-0.5 truncate font-mono text-[10px] text-charcoal-80/55">
                          {item.productId?.slice(0, 12)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-meta font-bold tabular-nums text-violet">
                          {item.downloads}
                        </div>
                        <div className="text-[10px] text-charcoal-80/55">downloads</div>
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-charcoal-80/8">
                      <div
                        className="h-full rounded-full bg-violet transition-all duration-500"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Activity DataTable */}
        <DataTable
          columns={columns}
          rows={data.downloads}
          rowKey={(row) => row.id}
          loading={loading}
          onRefresh={loadDownloads}
          initialSort={{ key: "createdAt", dir: "desc" }}
          searchPlaceholder="Search user, product, order…"
          emptyState={{
            icon: ArrowDownToLine,
            title: "No download activity",
            description: "Recent downloads will appear here as members access their files.",
          }}
        />
      </div>
    </section>
  )
}
