// ─────────────────────────────────────────────────────────────────────────────
// AdminServiceOrdersPage.jsx — manage paid consulting / service orders
//
// Backend: src/routes/adminServiceOrdersRoutes.js
//   GET    /api/v1/admin/service-orders[?status=...]
//   GET    /api/v1/admin/service-orders/:id
//   PATCH  /api/v1/admin/service-orders/:id   (status, internalNotes, etc.)
//   POST   /api/v1/admin/service-orders/:id/consultations
//   POST   /api/v1/admin/service-orders/:id/project
//
// This list view supports: filter by status · refresh · row actions
// (open detail · update status · open project link).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { m } from "framer-motion"
import {
  Briefcase, Filter, RefreshCw, AlertCircle, Loader2, Mail, ExternalLink, Package, Eye,
} from "lucide-react"
import {
  adminListServiceOrders,
  adminUpdateServiceOrder,
} from "../services/serviceOrderService"
import { useToast } from "../context/ToastContext"

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

const STATUS_FILTERS = [
  { value: "", label: "All orders" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
]

const STATUS_STYLE = {
  pending: { bg: "bg-amber/10", text: "text-amber-700", label: "Pending" },
  in_progress: { bg: "bg-azure-pale", text: "text-azure-800", label: "In progress" },
  delivered: { bg: "bg-mint-50", text: "text-mint-700", label: "Delivered" },
  completed: { bg: "bg-mint-50", text: "text-mint-700", label: "Completed" },
  cancelled: { bg: "bg-slate-100", text: "text-steel-700", label: "Cancelled" },
  refunded: { bg: "bg-rose-50", text: "text-rose-700", label: "Refunded" },
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { bg: "bg-slate-100", text: "text-steel-700", label: status || "-" }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  } catch { return "-" }
}

function formatMoney(value, currency = "MXN") {
  if (value == null) return "-"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value))
  } catch { return `$${Number(value).toFixed(2)}` }
}

export default function AdminServiceOrdersPage() {
  const { showSuccess, showError } = useToast()
  const [statusFilter, setStatusFilter] = useState("")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState(null)

  const refresh = async () => {
    setLoading(true); setError("")
    try {
      const r = await adminListServiceOrders(statusFilter ? { status: statusFilter } : {})
      setItems(Array.isArray(r?.data) ? r.data : [])
    } catch (e) {
      setError(e?.message || "Could not load service orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [statusFilter])

  async function patchStatus(id, nextStatus) {
    if (!id || !nextStatus) return
    try {
      setUpdating(id)
      const updated = await adminUpdateServiceOrder(id, { status: nextStatus })
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)))
      showSuccess?.(`Status: ${nextStatus.replace(/_/g, " ")}`, "Order updated")
    } catch (e) {
      showError?.(e?.toUserMessage?.() || e?.message || "Try again", "Update failed")
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <m.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2 text-[12px] text-steel-700">
          <Briefcase className="h-3.5 w-3.5" /> {items.length} order{items.length === 1 ? "" : "s"} {statusFilter ? `· filter: ${statusFilter}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-violet" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-charcoal outline-none transition focus:border-violet"
          >
            {STATUS_FILTERS.map((f) => <option key={f.value || "all"} value={f.value}>{f.label}</option>)}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-charcoal transition hover:bg-mist disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </m.div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-50 bg-rose-50/30 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-violet">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
              <Package className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-semibold text-charcoal">No service orders yet</p>
            <p className="max-w-xs text-[12px] text-steel">
              When a client purchases a packaged service from the Services page, the order shows up here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left lg:table">
              <thead className="border-b border-slate-100 bg-mist/60">
                <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-steel">
                  <th className="px-5 py-3">Order date</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {items.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-100">
                    <td className="px-5 py-3 align-top">
                      <div className="text-charcoal">{formatDate(o.createdAt)}</div>
                      {o.id && <div className="mt-0.5 font-mono text-[10px] text-steel">#{String(o.id).slice(-8)}</div>}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="font-semibold text-violet">{o.user?.fullName || o.user?.email || o.contactEmail || "-"}</div>
                      {o.user?.email && (
                        <a href={`mailto:${o.user.email}`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-azure hover:underline">
                          <Mail className="h-3 w-3" aria-hidden="true" /> {o.user.email}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-charcoal/85">
                      <div className="font-medium">{o.service?.title || o.serviceTitle || "-"}</div>
                      {o.servicePackage?.name && (
                        <div className="mt-0.5 text-[11px] text-steel">{o.servicePackage.name}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <span className="font-mono text-[12px] tabular-nums font-semibold text-charcoal">
                        {formatMoney(o.totalAmount ?? o.amount, o.currency)}
                      </span>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-5 py-3 align-top text-right">
                      <RowActions
                        order={o}
                        updating={updating === o.id}
                        onPatch={(s) => patchStatus(o.id, s)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {items.map((o) => (
                <li key={o.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] text-steel">{formatDate(o.createdAt)}</div>
                      <div className="mt-0.5 truncate text-[13px] font-semibold text-violet">{o.user?.fullName || o.user?.email || "-"}</div>
                      <div className="mt-0.5 truncate text-[12px] text-charcoal/85">{o.service?.title || o.serviceTitle || "-"}</div>
                      <div className="mt-1 font-mono text-[12px] tabular-nums font-semibold text-charcoal">
                        {formatMoney(o.totalAmount ?? o.amount, o.currency)}
                      </div>
                    </div>
                    <StatusPill status={o.status} />
                  </div>
                  <RowActions order={o} updating={updating === o.id} onPatch={(s) => patchStatus(o.id, s)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function RowActions({ order, updating, onPatch }) {
  const status = order.status
  const isFinal = ["completed", "cancelled", "refunded"].includes(status)

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Link
        to={`/admin/service-orders/${order.id}`}
        className="inline-flex items-center gap-1 rounded-md border border-violet/30 bg-violet-pale px-2 py-1 text-[11px] font-semibold text-violet transition hover:bg-violet/15"
      >
        <Eye className="h-3 w-3" aria-hidden="true" /> View
      </Link>
      {order.projectId && (
        <a
          href={`/dashboard/projects/${order.projectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-azure transition hover:bg-azure-pale"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" /> Project
        </a>
      )}
      {!isFinal && (
        <>
          {status !== "in_progress" && (
            <button
              type="button"
              disabled={updating}
              onClick={() => onPatch("in_progress")}
              className="inline-flex items-center gap-1 rounded-md border border-azure/30 bg-azure-pale px-2 py-1 text-[11px] font-semibold text-azure-800 transition hover:bg-azure/20 disabled:opacity-50"
            >
              Start
            </button>
          )}
          {status !== "delivered" && (
            <button
              type="button"
              disabled={updating}
              onClick={() => onPatch("delivered")}
              className="inline-flex items-center gap-1 rounded-md border border-mint/30 bg-mint-50 px-2 py-1 text-[11px] font-semibold text-mint-700 transition hover:bg-mint/20 disabled:opacity-50"
            >
              Deliver
            </button>
          )}
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("completed")}
            className="inline-flex items-center gap-1 rounded-md border border-mint/30 bg-mint-50 px-2 py-1 text-[11px] font-semibold text-mint-700 transition hover:bg-mint/20 disabled:opacity-50"
          >
            Complete
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("cancelled")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-steel-700 transition hover:bg-mist disabled:opacity-50"
          >
            Cancel
          </button>
        </>
      )}
      {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" aria-hidden="true" />}
    </div>
  )
}
