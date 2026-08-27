/* ════════════════════════════════════════════════════════════════════════
   AdminInvoicesPage.jsx · /admin/invoices
   Manual invoices (Tier 4) backed by /api/v1/admin/invoices:
     GET  /            list (status, page, limit)
     POST /            create { serviceOrderId, amount, dueDate, description }
     POST /:id/void    void an unpaid invoice (cancels its pending order)
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  FileText, RefreshCw, Search, X, ExternalLink, AlertCircle, Plus, Ban, Loader2,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"

const STATUS_PILLS = {
  issued:  { label: "Issued",  bg: "bg-azure/10",             text: "text-azure-deep",      ring: "ring-azure/20" },
  paid:    { label: "Paid",    bg: "bg-mint/10",              text: "text-emerald-800",     ring: "ring-mint/20" },
  overdue: { label: "Overdue", bg: "bg-amber/10",             text: "text-amber-700",       ring: "ring-amber/20" },
  void:    { label: "Void",    bg: "bg-charcoal-80/[0.06]",   text: "text-charcoal-80/65",  ring: "ring-charcoal-80/15" },
}

function StatusPill({ status }) {
  const s = STATUS_PILLS[status] || { label: status || "—", bg: "bg-charcoal-80/[0.06]", text: "text-charcoal-80/65", ring: "ring-charcoal-80/15" }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  )
}

function formatCurrency(value, currency = "MXN") {
  const n = Number(value)
  if (!Number.isFinite(n)) return "-"
  return n.toLocaleString("en-US", { style: "currency", currency })
}

function formatDate(iso, withTime = false) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

const INPUT = "w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"

export default function AdminInvoicesPage() {
  const toast = useToast()
  const [invoices, setInvoices] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ serviceOrderId: "", amount: "", dueDate: "", description: "" })
  const [saving, setSaving] = useState(false)
  const [voiding, setVoiding] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (status) params.set("status", status)
      const res = await authFetch(`/api/v1/admin/invoices?${params.toString()}`)
      setInvoices(Array.isArray(res?.data) ? res.data : [])
      if (res?.meta) setMeta(res.meta)
    } catch (err) {
      setError(err?.message || "Failed to load invoices.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [status, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search) return invoices
    const term = search.toLowerCase()
    return invoices.filter((i) =>
      (i.invoiceNumber || "").toLowerCase().includes(term) ||
      (i.order?.orderNumber || "").toLowerCase().includes(term) ||
      (i.order?.customerName || "").toLowerCase().includes(term) ||
      (i.order?.customerEmail || "").toLowerCase().includes(term) ||
      (i.serviceOrderId || "").toLowerCase().includes(term)
    )
  }, [invoices, search])

  const totals = useMemo(() => {
    let outstanding = 0, paid = 0, overdue = 0
    for (const i of invoices) {
      const amt = Number(i.order?.totalAmount ?? i.totalAmount) || 0
      if (i.status === "paid") paid += amt
      else if (i.status === "overdue") { overdue += amt; outstanding += amt }
      else if (i.status === "issued") outstanding += amt
    }
    return { outstanding, paid, overdue, count: meta.total || invoices.length }
  }, [invoices, meta.total])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await authFetch("/api/v1/admin/invoices", {
        method: "POST",
        body: JSON.stringify({
          serviceOrderId: form.serviceOrderId.trim(),
          amount:         Number(form.amount),
          dueDate:        form.dueDate || undefined,
          description:    form.description.trim() || undefined,
        }),
      })
      toast?.success?.("Invoice issued", "The client has been emailed the invoice.")
      setShowForm(false)
      setForm({ serviceOrderId: "", amount: "", dueDate: "", description: "" })
      await load()
    } catch (err) {
      toast?.error?.("Could not issue invoice", err?.message || "Please check the service order ID and amount.")
    } finally {
      setSaving(false)
    }
  }

  async function voidInvoice(inv) {
    if (!window.confirm(`Void invoice ${inv.invoiceNumber}? Its pending order will be cancelled.`)) return
    setVoiding(inv.id)
    try {
      await authFetch(`/api/v1/admin/invoices/${encodeURIComponent(inv.id)}/void`, { method: "POST" })
      toast?.success?.("Invoice voided")
      await load()
    } catch (err) {
      toast?.error?.("Could not void invoice", err?.message || "Paid invoices cannot be voided — refund the order instead.")
    } finally {
      setVoiding("")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Invoices" value={totals.count} accent="violet" />
        <Metric label="Outstanding" value={formatCurrency(totals.outstanding)} accent="charcoal" />
        <Metric label="Overdue" value={formatCurrency(totals.overdue)} accent="amber" />
        <Metric label="Paid" value={formatCurrency(totals.paid)} accent="emerald" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice #, order #, customer, service order…"
              className={`${INPUT} pl-9 pr-9`}
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-charcoal-80/65 hover:bg-charcoal-80/[0.06]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }} aria-label="Filter by status" className="rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15">
            <option value="">All statuses</option>
            <option value="issued">Issued</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
          <button type="button" onClick={load} aria-label="Reload" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/15 bg-white text-charcoal-80/65 hover:border-violet/40 hover:text-violet">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-violet/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> New invoice
        </button>
      </div>

      {showForm ? (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-violet/20 bg-violet-pale/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[12px] font-semibold text-charcoal-80/75">
            Service order ID
            <input required value={form.serviceOrderId} onChange={(e) => setForm({ ...form, serviceOrderId: e.target.value })} className={`${INPUT} mt-1 font-mono`} placeholder="cuid from Service Orders" />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80/75">
            Amount (MXN, IVA included)
            <input required type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${INPUT} mt-1`} />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80/75">
            Due date
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={`${INPUT} mt-1`} />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80/75">
            Description
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${INPUT} mt-1`} placeholder="Milestone 2 · UX research" />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
              Issue invoice
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-charcoal-80/15 bg-white px-3.5 py-2 text-[13px] font-semibold text-charcoal-80/75">Cancel</button>
            <span className="text-[12px] text-charcoal-80/65">A pending order is created for the service order and the client is emailed the invoice.</span>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/5 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-charcoal-80/10 text-left text-[13px]">
            <thead className="bg-charcoal-80/[0.03] text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
              <tr>
                <th scope="col" className="px-4 py-3">Invoice</th>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Amount</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Issued</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Due</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-80/[0.06]">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-charcoal-80/65">Loading invoices…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-charcoal-80/65">No invoices match.</td></tr>
              ) : filtered.map((inv) => (
                <tr key={inv.id} className="transition hover:bg-violet-pale/30">
                  <td className="px-4 py-3">
                    <div className="font-mono text-[12px] font-semibold text-charcoal-80">{inv.invoiceNumber}</div>
                    {inv.order?.id ? (
                      <Link to={`/admin/orders/${inv.order.id}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-violet hover:underline">
                        #{inv.order.orderNumber} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-charcoal-80">{inv.order?.customerName || "—"}</div>
                    <div className="text-[11.5px] text-charcoal-80/65">{inv.order?.customerEmail || ""}</div>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {formatCurrency(inv.order?.totalAmount ?? inv.totalAmount, inv.order?.currency || inv.currency || "MXN")}
                    {Number(inv.lateFeeAmount) > 0 ? <div className="text-[10.5px] text-amber-700">+ {formatCurrency(inv.lateFeeAmount, inv.order?.currency || "MXN")} late fee</div> : null}
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal-80/65 md:table-cell">{formatDate(inv.issuedAt)}</td>
                  <td className="hidden px-4 py-3 text-charcoal-80/65 md:table-cell">{inv.paidAt ? `Paid ${formatDate(inv.paidAt)}` : formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {inv.invoicePdfUrl ? (
                        <a href={inv.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-charcoal-80/15 px-2 py-1 text-[11.5px] font-semibold text-charcoal-80/75 hover:border-violet/40 hover:text-violet">
                          <FileText className="h-3 w-3" aria-hidden="true" /> PDF
                        </a>
                      ) : null}
                      {inv.status !== "paid" && inv.status !== "void" ? (
                        <button
                          type="button"
                          onClick={() => voidInvoice(inv)}
                          disabled={voiding === inv.id}
                          className="inline-flex items-center gap-1 rounded-md border border-rose/30 px-2 py-1 text-[11.5px] font-semibold text-rose-700 hover:bg-rose/5 disabled:opacity-50"
                        >
                          {voiding === inv.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Ban className="h-3 w-3" aria-hidden="true" />} Void
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta.pages > 1 ? (
          <div className="flex items-center justify-between border-t border-charcoal-80/10 px-4 py-2 text-[12px] text-charcoal-80/65">
            <span>Page {meta.page} of {meta.pages} · {meta.total} invoices</span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-charcoal-80/15 px-2 py-1 disabled:opacity-40">Prev</button>
              <button type="button" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-charcoal-80/15 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        ) : null}
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
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/65">{label}</div>
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${ring}`}>
          <FileText className="h-4 w-4" />
        </div>
        <div className="text-[18px] font-extrabold tabular-nums text-charcoal-80">{value}</div>
      </div>
    </div>
  )
}
