/* ════════════════════════════════════════════════════════════════════════
   AdminRefundsPage.jsx · /admin/refunds
   Refund ledger backed by /api/v1/admin/refunds (M15).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Receipt, RefreshCw, Search, X, ExternalLink, Filter, AlertCircle,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"

const STATUS_PILLS = {
  succeeded: { label: "Succeeded", bg: "bg-mint/10", text: "text-emerald-800", ring: "ring-mint/20" },
  pending: { label: "Pending", bg: "bg-amber/10", text: "text-amber-700", ring: "ring-amber/20" },
  failed: { label: "Failed", bg: "bg-rose/10", text: "text-rose-700", ring: "ring-red-200" },
  cancelled: { label: "Cancelled", bg: "bg-charcoal-80/[0.06]", text: "text-charcoal-80/65", ring: "ring-charcoal-80/15" },
  disputed: { label: "Disputed", bg: "bg-purple-50", text: "text-purple-700", ring: "ring-purple-200" },
}

const GATEWAY_LABELS = {
  mercadopago: "MercadoPago",
  paypal: "PayPal",
  manual: "Manual",
}

function StatusPill({ status }) {
  const s = STATUS_PILLS[status] || STATUS_PILLS.pending
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  )
}

function formatCurrency(value, currency = "USD") {
  if (value == null) return "-"
  const n = Number(value)
  if (!Number.isFinite(n)) return "-"
  return n.toLocaleString("en-US", { style: "currency", currency })
}

function formatDate(iso) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [gateway, setGateway] = useState("")
  const [status, setStatus] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (gateway) params.set("gateway", gateway)
      if (status) params.set("status", status)
      const res = await apiRequest(`/api/v1/admin/refunds?${params.toString()}`)
      setRefunds(res.refunds || res.data || [])
    } catch (err) {
      setError(err?.message || "Failed to load refunds.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load()   }, [gateway, status])

  const filtered = useMemo(() => {
    if (!search) return refunds
    const term = search.toLowerCase()
    return refunds.filter((r) =>
      (r.order?.id || r.orderId || "").toLowerCase().includes(term) ||
      (r.order?.number || "").toString().toLowerCase().includes(term) ||
      (r.gatewayRefundId || "").toLowerCase().includes(term) ||
      (r.user?.email || "").toLowerCase().includes(term) ||
      (r.reason || "").toLowerCase().includes(term)
    )
  }, [refunds, search])

  const totals = useMemo(() => {
    let total = 0, pending = 0, succeeded = 0
    for (const r of refunds) {
      const amt = Number(r.amount) || 0
      total += amt
      if (r.status === "pending") pending += amt
      if (r.status === "succeeded") succeeded += amt
    }
    return { total, pending, succeeded, count: refunds.length }
  }, [refunds])

  return (
    <div className="flex flex-col gap-6">
      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Refunds" value={totals.count} accent="violet" />
        <Metric label="Total volume" value={formatCurrency(totals.total)} accent="charcoal" />
        <Metric label="Successfully refunded" value={formatCurrency(totals.succeeded)} accent="emerald" />
        <Metric label="Pending" value={formatCurrency(totals.pending)} accent="amber" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order, gateway ID, customer, reason…"
              className="w-full rounded-lg border border-charcoal-80/15 bg-white py-2 pl-9 pr-9 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-charcoal-80/45 hover:bg-charcoal-80/[0.06]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <select value={gateway} onChange={(e) => setGateway(e.target.value)} aria-label="Filter by gateway" className="rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15">
            <option value="">All gateways</option>
            <option value="mercadopago">MercadoPago</option>
            <option value="paypal">PayPal</option>
            <option value="manual">Manual</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="disputed">Disputed</option>
          </select>
          <button type="button" onClick={load} aria-label="Reload" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/15 bg-white text-charcoal-80/65 hover:border-violet/40 hover:text-violet">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
        <table className="min-w-full divide-y divide-charcoal-80/10 text-left text-[13px]">
          <thead className="bg-charcoal-80/[0.03] text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">
            <tr>
              <th scope="col" className="px-4 py-3">Order</th>
              <th scope="col" className="hidden px-4 py-3 sm:table-cell">Gateway</th>
              <th scope="col" className="px-4 py-3">Amount</th>
              <th scope="col" className="hidden px-4 py-3 lg:table-cell">Reason</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="hidden px-4 py-3 md:table-cell">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-80/[0.06]">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-charcoal-80/55">Loading refunds…</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-rose-700">{error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-charcoal-80/55">No refunds match.</td></tr>
            ) : filtered.map((r) => {
              const orderId = r.order?.id || r.orderId
              return (
                <tr key={r.id} className="transition hover:bg-violet-pale/30">
                  <td className="px-4 py-3">
                    {orderId ? (
                      <Link to={`/admin/orders/${orderId}`} className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-violet hover:underline">
                        #{r.order?.number ?? orderId.slice(0, 8)}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : "-"}
                    {r.user?.email ? <div className="text-[11.5px] text-charcoal-80/55">{r.user.email}</div> : null}
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal-80/70 sm:table-cell">
                    {GATEWAY_LABELS[r.gateway] || r.gateway || "-"}
                    {r.gatewayRefundId ? <div className="font-mono text-[10.5px] text-charcoal-80/45">{r.gatewayRefundId}</div> : null}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{formatCurrency(r.amount, r.currency || "USD")}</td>
                  <td className="hidden px-4 py-3 text-charcoal-80/70 lg:table-cell"><span className="line-clamp-1 max-w-[260px]">{r.reason || "-"}</span></td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="hidden px-4 py-3 text-charcoal-80/55 md:table-cell">{formatDate(r.createdAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Metric({ label, value, accent }) {
  const ring = {
    violet: "bg-violet-pale text-violet",
    emerald: "bg-mint/10 text-emerald-700",
    amber: "bg-amber/10 text-amber-700",
    charcoal: "bg-charcoal-80/[0.06] text-charcoal-80/75",
  }[accent] || "bg-violet-pale text-violet"
  return (
    <div className="rounded-2xl border border-charcoal-80/10 bg-white p-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">{label}</div>
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${ring}`}>
          <Receipt className="h-4 w-4" />
        </div>
        <div className="text-[18px] font-extrabold tabular-nums text-charcoal-80">{value}</div>
      </div>
    </div>
  )
}
