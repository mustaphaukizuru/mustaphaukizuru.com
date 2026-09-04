import { useCallback, useEffect, useMemo, useState } from "react"
import { m, AnimatePresence } from "framer-motion"
import { Link } from "react-router-dom"
import {
  Inbox, Search, X, Mail, MessageSquare, ClipboardList, CalendarCheck,
  Filter, AlertCircle, ExternalLink, RefreshCw, UserCheck, ShoppingCart,
  ChevronLeft, ChevronRight,
} from "lucide-react"

import { authFetch } from "../lib/api"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

/**
 * AdminLeadsPage — unified leads inbox (Tier 3).
 *
 * Reads /api/v1/admin/leads (merged view over ContactMessage,
 * DiagnosticSubmission, NewsletterSubscriber and Consultation keyed by
 * email) and /api/v1/admin/leads/:email for the timeline drawer.
 *
 * The API only merges the newest 500 rows of each source, so the total
 * shown is "recent leads", not all-time. Search happens server-side.
 */

const SOURCE_META = {
  contact:    { label: "Contact",    icon: MessageSquare, chip: "bg-azure/10 text-azure-deep", to: "/admin/contact-messages" },
  diagnostic: { label: "Diagnostic", icon: ClipboardList, chip: "bg-violet/10 text-violet",  to: "/admin/diagnostic" },
  newsletter: { label: "Newsletter", icon: Mail,          chip: "bg-mint/15 text-mint-700",   to: "/admin/newsletter" },
  booking:    { label: "Booking",    icon: CalendarCheck, chip: "bg-amber-100 text-amber-800", to: "/admin/consultations" },
}
const SOURCES = Object.keys(SOURCE_META)

function fmtDate(iso) {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch { return String(iso) }
}

function timeAgo(iso) {
  if (!iso) return ""
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

function SourceChip({ source }) {
  const meta = SOURCE_META[source]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  )
}

/** One-line summary of the latest / timeline event, per source. */
function eventSummary(ev) {
  switch (ev.source) {
    case "contact":    return ev.subject ? `“${ev.subject}”` : ev.preview || "Contact message"
    case "diagnostic": return `${ev.tier || "?"} · ${ev.score ?? "?"}/100${ev.audience ? ` · ${ev.audience}` : ""}`
    case "newsletter": return `${ev.status || "?"}${ev.via ? ` · via ${ev.via}` : ""}`
    case "booking":    return `${ev.status || "?"} · ${fmtDate(ev.scheduledAt)}`
    default:           return ""
  }
}

const EVENT_PILL = {
  new: "open", read: "pending", replied: "completed",
  pending: "pending", subscribed: "active", unsubscribed: "cancelled",
  confirmed: "active", completed: "completed", cancelled: "cancelled", no_show: "failed",
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, pages: 1, capPerSource: 500 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)   // { lead, timeline } | null
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debounced, sourceFilter])

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" })
      if (sourceFilter !== "all") params.set("source", sourceFilter)
      if (debounced) params.set("q", debounced)
      const resp = await authFetch(`/api/v1/admin/leads?${params.toString()}`)
      setLeads(Array.isArray(resp?.data) ? resp.data : [])
      setMeta(resp?.meta || { total: 0, page: 1, limit: 25, pages: 1, capPerSource: 500 })
    } catch (e) {
      setError(e?.message || "Failed to load leads.")
    } finally {
      setLoading(false)
    }
  }, [page, sourceFilter, debounced])

  useEffect(() => { load() }, [load])

  async function openLead(lead) {
    setSelected({ lead, timeline: [] })
    setDetailLoading(true)
    try {
      const resp = await authFetch(`/api/v1/admin/leads/${encodeURIComponent(lead.email)}`)
      if (resp?.data) setSelected(resp.data)
    } catch (e) {
      console.warn("[Leads] timeline failed:", e)
    } finally {
      setDetailLoading(false)
    }
  }

  const stats = useMemo(() => {
    const s = { customers: 0, multi: 0 }
    for (const l of leads) {
      if (l.user?.ordersPaid > 0) s.customers++
      if (l.sources.length > 1) s.multi++
    }
    return s
  }, [leads])

  const columns = useMemo(() => [
    {
      key: "who",
      label: "Lead",
      width: "1.6fr",
      sortable: true,
      getValue: (row) => row.name || row.email,
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-charcoal">{row.name || <span className="italic text-charcoal-80/65">(no name)</span>}</div>
          <div className="truncate font-mono text-[11px] text-charcoal-80/65">{row.email}</div>
        </div>
      ),
    },
    {
      key: "sources",
      label: "Sources",
      width: "1.6fr",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.sources.map((s) => <SourceChip key={s} source={s} />)}
        </div>
      ),
    },
    {
      key: "latest",
      label: "Latest",
      width: "1.6fr",
      sortable: false,
      render: (row) => row.latest ? (
        <div className="min-w-0">
          <div className="truncate text-meta text-charcoal">{eventSummary(row.latest)}</div>
          <div className="font-mono text-micro text-charcoal-80/65">{SOURCE_META[row.latest.source]?.label}</div>
        </div>
      ) : <span className="text-charcoal-80/65">-</span>,
    },
    {
      key: "account",
      label: "Account",
      width: "0.9fr",
      sortable: true,
      getValue: (row) => (row.user ? 1 + (row.user.ordersPaid || 0) : 0),
      render: (row) => row.user ? (
        <div className="flex items-center gap-1.5 text-meta text-charcoal">
          <UserCheck className="h-3.5 w-3.5 text-mint-700" aria-hidden="true" />
          {row.user.ordersPaid > 0
            ? <span className="font-semibold">{row.user.ordersPaid} paid</span>
            : <span className="text-charcoal-80/65">member</span>}
        </div>
      ) : <span className="text-micro text-charcoal-80/65">no account</span>,
    },
    {
      key: "lastActivityAt",
      label: "Last activity",
      width: "0.8fr",
      sortable: true,
      getValue: (row) => row.lastActivityAt || "",
      render: (row) => (
        <span className="font-mono text-micro text-charcoal-80/65" title={fmtDate(row.lastActivityAt)}>
          {timeAgo(row.lastActivityAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "0.4fr",
      align: "right",
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openLead(row) }}
          aria-label={`Open lead ${row.email}`}
          className="rounded-lg p-1.5 text-charcoal-80/65 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ),
    },
  ], [])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Leads (recent window)" value={meta.total} subtitle={`Newest ${meta.capPerSource} rows per source`} icon={Inbox} tone="purple" />
        <MetricCard title="Customers on this page" value={stats.customers} subtitle="Leads with ≥ 1 paid order" icon={ShoppingCart} tone="green" />
        <MetricCard title="Multi-touch on this page" value={stats.multi} subtitle="Seen on 2+ sources" icon={Filter} tone="blue" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-charcoal-80/65" aria-hidden="true" />
          {["all", ...SOURCES].map((s) => {
            const active = sourceFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSourceFilter(s)}
                aria-pressed={active}
                className={`rounded-lg px-3 py-1.5 text-micro font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
                  active ? "bg-violet text-white" : "text-charcoal-80/65 hover:bg-violet-pale hover:text-violet"
                }`}
              >
                {s === "all" ? "All" : SOURCE_META[s].label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-80/65" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              aria-label="Search leads"
              className="h-9 w-72 rounded-xl border border-charcoal-80/15 bg-mist pl-9 pr-3 text-meta text-charcoal outline-none placeholder:text-charcoal-80/65 focus:border-violet/40 focus-visible:ring-[3px] focus-visible:ring-azure/30"
            />
          </div>
          <button
            type="button"
            onClick={load}
            aria-label="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-charcoal-80/15 text-charcoal-80/65 transition hover:border-violet/30 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose/30 bg-rose/5 p-4 text-meta text-rose">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={leads}
        rowKey={(row) => row.email}
        loading={loading}
        pageSize={25}
        pageSizeOptions={[25]}
        emptyState={{
          icon: Inbox,
          title: "No leads",
          description: debounced || sourceFilter !== "all"
            ? "Try clearing the filters or search."
            : "Contact messages, self-audits, newsletter sign-ups and bookings will show up here.",
        }}
      />

      {/* Server-side pagination (DataTable paginates only the current page) */}
      {meta.pages > 1 && (
        <nav className="flex items-center justify-between rounded-2xl border border-charcoal-80/10 bg-white px-4 py-2" aria-label="Leads pages">
          <span className="font-mono text-micro text-charcoal-80/65">Page {meta.page} of {meta.pages} · {meta.total} leads</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="rounded-lg p-1.5 text-charcoal-80/65 transition hover:bg-violet-pale hover:text-violet disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={page >= meta.pages}
              onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
              aria-label="Next page"
              className="rounded-lg p-1.5 text-charcoal-80/65 transition hover:bg-violet-pale hover:text-violet disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-detail-heading"
          >
            <div className="absolute inset-0 bg-charcoal/45 backdrop-blur-[2px]" onClick={() => setSelected(null)} aria-hidden="true" />
            <m.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.18)]"
            >
              <header className="flex items-start justify-between gap-3 border-b border-charcoal-80/10 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <h2 id="lead-detail-heading" className="truncate text-card font-bold text-charcoal">
                    {selected.lead.name || selected.lead.email}
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] text-charcoal-80/65">
                    <a href={`mailto:${selected.lead.email}`} className="underline underline-offset-2 hover:text-violet">{selected.lead.email}</a>
                    {selected.lead.firstSeenAt && ` · first seen ${fmtDate(selected.lead.firstSeenAt)}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.lead.sources.map((s) => <SourceChip key={s} source={s} />)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-charcoal-80/65 transition hover:bg-mist hover:text-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Account */}
                <section>
                  <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-charcoal-80/65">Account</h3>
                  {selected.lead.user ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-charcoal-80/10 bg-mist px-4 py-3 text-meta text-charcoal">
                      <UserCheck className="h-4 w-4 text-mint-700" aria-hidden="true" />
                      <span>Member{selected.lead.user.createdAt ? ` since ${fmtDate(selected.lead.user.createdAt)}` : ""}</span>
                      <span className="font-semibold">{selected.lead.user.ordersPaid} paid order{selected.lead.user.ordersPaid === 1 ? "" : "s"}</span>
                      <Link to={`/admin/users?q=${encodeURIComponent(selected.lead.email)}`} className="ml-auto inline-flex items-center gap-1 text-violet underline underline-offset-2">
                        Open user <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-charcoal-80/15 px-4 py-3 text-meta text-charcoal-80/65">No account yet.</p>
                  )}
                </section>

                {/* Timeline */}
                <section>
                  <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-charcoal-80/65">Timeline</h3>
                  {detailLoading ? (
                    <p className="text-meta text-charcoal-80/65">Loading…</p>
                  ) : selected.timeline.length === 0 ? (
                    <p className="text-meta text-charcoal-80/65">No events in the recent window.</p>
                  ) : (
                    <ol className="relative space-y-4 border-l border-charcoal-80/10 pl-5">
                      {selected.timeline.map((ev) => {
                        const meta = SOURCE_META[ev.source]
                        const Icon = meta?.icon || Inbox
                        const pill = ev.status ? EVENT_PILL[ev.status] : null
                        return (
                          <li key={`${ev.source}-${ev.id}`} className="relative">
                            <span className="absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-charcoal-80/15">
                              <Icon className="h-2.5 w-2.5 text-charcoal-80/65" aria-hidden="true" />
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <SourceChip source={ev.source} />
                              {pill && <StatusPill status={pill} label={ev.status.replace("_", " ")} />}
                              <span className="ml-auto font-mono text-micro text-charcoal-80/65" title={fmtDate(ev.at)}>{timeAgo(ev.at)}</span>
                            </div>
                            <p className="mt-1 text-meta text-charcoal">{eventSummary(ev)}</p>
                            {ev.source === "contact" && ev.preview && (
                              <p className="mt-0.5 line-clamp-2 text-micro text-charcoal-80/65">{ev.preview}</p>
                            )}
                            {ev.source === "diagnostic" && ev.organization && (
                              <p className="mt-0.5 text-micro text-charcoal-80/65">{ev.organization}</p>
                            )}
                            {meta && (
                              <Link to={meta.to} className="mt-1 inline-flex items-center gap-1 text-micro text-violet underline underline-offset-2">
                                Open in {meta.label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </section>
              </div>
            </m.aside>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
