import { useEffect, useMemo, useState } from "react"
import {
  CreditCard, CheckCircle2, Clock3, XCircle,
} from "lucide-react"
import { MetricCard, AlertBanner, SkeletonCard } from "../components/ui/index"
import { fetchAdminPayments } from "../services/adminPaymentService"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminPaymentsPage · Batch 6B-2
 *
 *  Refactored to use the shared <DataTable /> + <StatusPill /> primitives.
 *
 *  What changed:
 *    - Local GatewayBadge inlined as a small render helper but uses the
 *      shared StatusPill machinery (gateway taxonomy added to STATUS_MAP)
 *    - Bespoke <table> markup replaced with <DataTable />
 *    - Search across order #, customer name, email
 *    - Sortable on amount, status, date, gateway
 *    - Mono numerics on amount + dates
 *
 *  Preserved verbatim:
 *    - fetchAdminPayments API contract (returns { payments, metrics })
 *    - Metric cards (total / paid / pending / failed)
 *  ──────────────────────────────────────────────────────────────────── */

export default function AdminPaymentsPage() {
  const [data, setData] = useState({ payments: [], metrics: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const result = await fetchAdminPayments()
      setData(result)
    } catch (err) {
      setError(err.message || "Failed to load payments.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const { payments = [], metrics = {} } = data

  const columns = useMemo(() => [
    {
      key: "orderNumber",
      label: "Order",
      sortable: true,
      searchable: true,
      width: "1.0fr",
      getValue: (row) => row.order?.orderNumber || row.orderId || "",
      render: (row) => (
        <span className="font-mono text-meta font-semibold tabular-nums text-violet">
          #{row.order?.orderNumber || (row.orderId ? String(row.orderId).slice(0, 8) : "-")}
        </span>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      sortable: true,
      searchable: true,
      width: "1.4fr",
      getValue: (row) => row.user?.fullName || row.user?.email || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-medium text-charcoal-80">
            {row.user?.fullName || "-"}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/65">
            {row.user?.email || ""}
          </div>
        </div>
      ),
    },
    {
      key: "gateway",
      label: "Gateway",
      sortable: true,
      width: "1.0fr",
      getValue: (row) => row.paymentGateway || "",
      render: (row) => row.paymentGateway ? <StatusPill status={row.paymentGateway} /> : <span className="text-charcoal-80/65">-</span>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      width: "0.8fr",
      align: "right",
      getValue: (row) => Number(row.amount || 0),
      render: (row) => (
        <span className="font-mono text-meta font-bold tabular-nums text-violet">
          ${Number(row.amount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "0.9fr",
      getValue: (row) => row.paymentStatus,
      render: (row) => <StatusPill status={row.paymentStatus} />,
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      width: "0.9fr",
      align: "right",
      getValue: (row) => row.paidAt || row.createdAt,
      render: (row) => (
        <span className="font-mono text-micro tabular-nums text-charcoal-80/65">
          {new Date(row.paidAt || row.createdAt).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          })}
        </span>
      ),
    },
  ], [])

  if (loading && payments.length === 0) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[400px]" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <AlertBanner type="error" message={error} onDismiss={() => setError("")} />

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={metrics.total ?? 0} icon={CreditCard} tone="purple" />
        <MetricCard title="Paid" value={metrics.paid ?? 0} icon={CheckCircle2} tone="green" />
        <MetricCard title="Pending" value={metrics.pending ?? 0} icon={Clock3} tone="amber" />
        <MetricCard title="Failed" value={metrics.failed ?? 0} icon={XCircle} tone="red" />
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        rows={payments}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={load}
        initialSort={{ key: "date", dir: "desc" }}
        searchPlaceholder="Search by order # or customer…"
        emptyState={{
          icon: CreditCard,
          title: "No payments yet",
          description: "Payment records will appear here once transactions are processed.",
        }}
      />
    </section>
  )
}
