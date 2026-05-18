import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Eye, ShoppingCart, CheckCircle2, Clock3, DollarSign, AlertCircle,
} from "lucide-react"
import { fetchAdminOrders, updateAdminOrderStatus } from "../services/adminOrderService"
import { useToast } from "../context/ToastContext"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminOrdersPage · Batch 6B-2
 *
 *  Refactored to use the shared <DataTable /> + <StatusPill /> primitives.
 *
 *  What changed:
 *    - Bespoke `<table>` markup replaced with <DataTable /> (sortable,
 *      sticky headers, pagination, search, all from the primitive)
 *    - Local AdminStatusBadge removed — uses shared StatusPill
 *    - Search filters across order #, customer name, customer email
 *    - Initial sort: createdAt desc (most recent first)
 *    - Mono numerics (order #, total, dates)
 *    - Inline status update select preserved with toast on change
 *    - Empty state directs admin to investigate why no orders exist
 *
 *  Preserved verbatim:
 *    - fetchAdminOrders + updateAdminOrderStatus API contracts
 *    - All 5 status options (pending/paid/failed/cancelled/refunded)
 *    - Metric cards (total / paid / pending / revenue)
 *  ──────────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS = ["pending", "paid", "failed", "cancelled", "refunded"]

export default function AdminOrdersPage() {
  const { showSuccess, showError } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setError] = useState("")
  const [updatingId, setUpdatingId] = useState("")

  async function loadOrders() {
    try {
      setLoading(true); setError("")
      const data = await fetchAdminOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      setError(error.message || "Failed to load orders.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  const metrics = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid").length
    const pending = orders.filter((o) => o.status === "pending").length
    const revenue = orders
      .filter((o) => o.status === "paid")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
    return { total: orders.length, paid, pending, revenue }
  }, [orders])

  async function handleStatusChange(orderId, nextStatus) {
    try {
      setUpdatingId(orderId); setError("")
      await updateAdminOrderStatus(orderId, nextStatus)
      showSuccess(`Order marked ${nextStatus.replace(/_/g, " ")}`)
      try { await loadOrders() } catch (re) { console.warn("[Orders] reload failed:", re) }
    } catch (error) {
      console.error("[Orders] status update failed:", error)
      const msg = error.message || "Failed to update order status."
      setError(msg)
      showError(msg, "Could not update order")
    } finally {
      setUpdatingId("")
    }
  }

  const columns = useMemo(() => [
    {
      key: "orderNumber",
      label: "Order",
      sortable: true,
      searchable: true,
      width: "1.4fr",
      getValue: (row) => row.orderNumber || row.id,
      render: (row) => (
        <div className="min-w-0">
          <div className="font-mono text-meta font-semibold tabular-nums text-violet">
            #{row.orderNumber || String(row.id).slice(0, 8)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-charcoal-80/55">
            {new Date(row.createdAt).toLocaleString(undefined, {
              year: "numeric", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      sortable: true,
      searchable: true,
      width: "1.3fr",
      getValue: (row) => row.customerName || row.customerEmail || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-medium text-charcoal-80">
            {row.customerName || "Customer"}
          </div>
          <div className="mt-0.5 truncate text-micro text-charcoal-80/65">
            {row.customerEmail || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "items",
      label: "Items",
      sortable: true,
      width: "0.5fr",
      align: "center",
      getValue: (row) => row.items?.length || 0,
      render: (row) => (
        <span className="font-mono text-meta tabular-nums text-charcoal-80/85">
          {row.items?.length || 0}
        </span>
      ),
    },
    {
      key: "totalAmount",
      label: "Total",
      sortable: true,
      width: "0.8fr",
      align: "right",
      getValue: (row) => Number(row.totalAmount || 0),
      render: (row) => (
        <span className="font-mono text-meta font-bold tabular-nums text-violet">
          ${Number(row.totalAmount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "1.2fr",
      getValue: (row) => row.status,
      render: (row) => (
        <div className="flex flex-col gap-1.5">
          <StatusPill status={row.status} />
          <select
            value={row.status}
            disabled={updatingId === row.id}
            onChange={(e) => handleStatusChange(row.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Update status for order ${row.orderNumber || row.id}`}
            className="rounded border border-charcoal-80/12 bg-white px-2 py-1 font-mono text-[10px] tabular-nums text-charcoal-80/85 outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "0.6fr",
      align: "right",
      render: (row) => (
        <Link
          to={`/admin/orders/${row.id}`}
          aria-label={`View order ${row.orderNumber || row.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet/15 bg-white px-3 py-1.5 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          View
        </Link>
      ),
    },
  ], [updatingId])

  return (
    <section className="space-y-5">
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {errorMessage}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Orders" value={metrics.total} icon={ShoppingCart} tone="purple" />
        <MetricCard title="Paid Orders" value={metrics.paid} icon={CheckCircle2} tone="green" />
        <MetricCard title="Pending Orders" value={metrics.pending} icon={Clock3} tone="amber" />
        <MetricCard title="Revenue" value={`$${metrics.revenue.toFixed(2)}`} icon={DollarSign} tone="blue" />
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={loadOrders}
        initialSort={{ key: "orderNumber", dir: "desc" }}
        searchPlaceholder="Search by order #, customer..."
        emptyState={{
          icon: ShoppingCart,
          title: "No orders yet",
          description: "Orders will appear here when customers complete a purchase.",
        }}
      />
    </section>
  )
}
