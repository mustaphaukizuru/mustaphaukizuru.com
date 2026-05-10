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
import { motion } from "framer-motion"
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
  pending: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", label: "Pending" },
  in_progress: { bg: "bg-[#E0F2FE]", text: "text-[#075985]", label: "In progress" },
  delivered: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", label: "Delivered" },
  completed: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", label: "Completed" },
  cancelled: { bg: "bg-[#EFF1F5]", text: "text-[#475569]", label: "Cancelled" },
  refunded: { bg: "bg-[#FFE4E6]", text: "text-[#9F1239]", label: "Refunded" },
}

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { bg: "bg-[#EFF1F5]", text: "text-[#475569]", label: status || "-" }
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
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2 text-[12px] text-[#475569]">
          <Briefcase className="h-3.5 w-3.5" /> {items.length} order{items.length === 1 ? "" : "s"} {statusFilter ? `· filter: ${statusFilter}` : ""}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#5D3FD3]" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#DCDCE4] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1B23] outline-none transition focus:border-[#5D3FD3]"
          >
            {STATUS_FILTERS.map((f) => <option key={f.value || "all"} value={f.value}>{f.label}</option>)}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCDCE4] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1B23] transition hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[#FFE4E6] bg-[#FFE4E6]/30 px-4 py-3 text-[13px] text-[#9F1239]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#EFF1F5] bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        {loading ? (
          <div className="flex items-center justify-center px-6 py-16 text-[#5D3FD3]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EDE9FB] text-[#5D3FD3]">
              <Package className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-semibold text-[#1A1B23]">No service orders yet</p>
            <p className="max-w-xs text-[12px] text-[#64748B]">
              When a client purchases a packaged service from the Services page, the order shows up here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left lg:table">
              <thead className="border-b border-[#EFF1F5] bg-[#F8FAFC]/60">
                <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                  <th className="px-5 py-3">Order date</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Value</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFF1F5] text-[13px]">
                {items.map((o) => (
                  <tr key={o.id} className="hover:bg-[#FAFBFC]">
                    <td className="px-5 py-3 align-top">
                      <div className="text-[#1A1B23]">{formatDate(o.createdAt)}</div>
                      {o.id && <div className="mt-0.5 font-mono text-[10px] text-[#64748B]">#{String(o.id).slice(-8)}</div>}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="font-semibold text-[#5D3FD3]">{o.user?.fullName || o.user?.email || o.contactEmail || "-"}</div>
                      {o.user?.email && (
                        <a href={`mailto:${o.user.email}`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#0284C7] hover:underline">
                          <Mail className="h-3 w-3" aria-hidden="true" /> {o.user.email}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top text-[#1A1B23]/85">
                      <div className="font-medium">{o.service?.title || o.serviceTitle || "-"}</div>
                      {o.servicePackage?.name && (
                        <div className="mt-0.5 text-[11px] text-[#64748B]">{o.servicePackage.name}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <span className="font-mono text-[12px] tabular-nums font-semibold text-[#1A1B23]">
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
            <ul className="divide-y divide-[#EFF1F5] lg:hidden">
              {items.map((o) => (
                <li key={o.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] text-[#64748B]">{formatDate(o.createdAt)}</div>
                      <div className="mt-0.5 truncate text-[13px] font-semibold text-[#5D3FD3]">{o.user?.fullName || o.user?.email || "-"}</div>
                      <div className="mt-0.5 truncate text-[12px] text-[#1A1B23]/85">{o.service?.title || o.serviceTitle || "-"}</div>
                      <div className="mt-1 font-mono text-[12px] tabular-nums font-semibold text-[#1A1B23]">
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
        className="inline-flex items-center gap-1 rounded-md border border-[#5D3FD3]/30 bg-[#EDE9FB] px-2 py-1 text-[11px] font-semibold text-[#5D3FD3] transition hover:bg-[#5D3FD3]/15"
      >
        <Eye className="h-3 w-3" aria-hidden="true" /> View
      </Link>
      {order.projectId && (
        <a
          href={`/dashboard/projects/${order.projectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[#DCDCE4] bg-white px-2 py-1 text-[11px] font-semibold text-[#0284C7] transition hover:bg-[#E0F2FE]"
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
              className="inline-flex items-center gap-1 rounded-md border border-[#0284C7]/30 bg-[#E0F2FE] px-2 py-1 text-[11px] font-semibold text-[#075985] transition hover:bg-[#0284C7]/20 disabled:opacity-50"
            >
              Start
            </button>
          )}
          {status !== "delivered" && (
            <button
              type="button"
              disabled={updating}
              onClick={() => onPatch("delivered")}
              className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/30 bg-[#D1FAE5] px-2 py-1 text-[11px] font-semibold text-[#065F46] transition hover:bg-[#10B981]/20 disabled:opacity-50"
            >
              Deliver
            </button>
          )}
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("completed")}
            className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/30 bg-[#D1FAE5] px-2 py-1 text-[11px] font-semibold text-[#065F46] transition hover:bg-[#10B981]/20 disabled:opacity-50"
          >
            Complete
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onPatch("cancelled")}
            className="inline-flex items-center gap-1 rounded-md border border-[#DCDCE4] bg-white px-2 py-1 text-[11px] font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            Cancel
          </button>
        </>
      )}
      {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5D3FD3]" aria-hidden="true" />}
    </div>
  )
}
