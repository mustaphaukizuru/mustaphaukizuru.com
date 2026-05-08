import { useEffect, useMemo, useState } from "react"
import {
  Briefcase, Plus, RefreshCw, CheckCircle2, ChevronDown, ChevronUp,
  Calendar, FolderOpen, AlertCircle, Users, X,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import {
  Field, FormInput, FormSelect, inputClass,
} from "../components/admin/Field"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminServicesPage · Batch 6B-5
 *
 *  Service order cards with expandable sections for consultations and
 *  client projects. Cards stay (right pattern for nested operational
 *  workflow) but get full primitive + accessibility treatment.
 *
 *  What changed:
 *    - Bespoke 5-card metric strip replaced with shared <MetricCard />
 *    - Bespoke statusColors map replaced with <StatusPill />
 *    - Nested consultation form refactored to use FormInput primitives
 *    - Nested project form refactored to use FormInput primitives
 *    - Filter pills get focus rings + aria-pressed
 *    - Expand toggle gets aria-expanded + aria-controls
 *    - Order # in mono with tabular-nums
 *    - Consultation status pill uses StatusPill (completed/pending)
 *    - Project status pill uses StatusPill
 *    - Refresh button gets spinning animation
 *
 *  Preserved verbatim:
 *    - All authFetch endpoints (/api/admin/service-orders/...)
 *    - changeStatus + handleSchedule + handleCreateProject flows
 *    - STATUS_OPTIONS taxonomy
 *    - Order update bubbling (onUpdate -> reload nested data)
 *  ──────────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS = ["new", "active", "on_hold", "completed", "cancelled"]

/* ──────────────────────────────────────────────────────────────────────── */

function ServiceOrderCard({ order, onUpdate }) {
  const { showSuccess, showError } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [showSched, setShowSched] = useState(false)
  const [schedForm, setSchedForm] = useState({ scheduledAt: "", meetingLink: "" })
  const [showProject, setShowProject] = useState(false)
  const [projectForm, setProjectForm] = useState({ projectName: "", description: "", dueDate: "" })

  const expandedId = `order-details-${order.id}`

  async function changeStatus(newStatus) {
    setUpdating(true)
    try {
      await authFetch(`/api/admin/service-orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      onUpdate(order.id, { status: newStatus })
      showSuccess("Status updated")
    } catch (err) {
      showError(err.message || "Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  async function handleSchedule(e) {
    e.preventDefault()
    if (!schedForm.scheduledAt) return
    try {
      await authFetch(`/api/admin/service-orders/${order.id}/consultations`, {
        method: "POST",
        body: JSON.stringify(schedForm),
      })
      showSuccess("Consultation scheduled")
      setShowSched(false)
      setSchedForm({ scheduledAt: "", meetingLink: "" })
      onUpdate(order.id, {})
    } catch (err) {
      showError(err.message || "Failed to schedule")
    }
  }

  async function handleCreateProject(e) {
    e.preventDefault()
    if (!projectForm.projectName.trim()) return
    try {
      await authFetch(`/api/admin/service-orders/${order.id}/project`, {
        method: "POST",
        body: JSON.stringify(projectForm),
      })
      showSuccess("Project created")
      setShowProject(false)
      setProjectForm({ projectName: "", description: "", dueDate: "" })
      onUpdate(order.id, {})
    } catch (err) {
      showError(err.message || "Failed to create project")
    }
  }

  return (
    <article className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:border-violet/15">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <div className="text-card font-bold text-violet">
            {order.service?.title || "Service"}
            {order.servicePackage?.name && (
              <span className="ml-2 font-mono text-micro font-normal text-charcoal-80/55">
                · {order.servicePackage.name}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-charcoal-80/65">
            <span className="font-semibold text-violet">{order.user?.fullName || "-"}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px]">{order.user?.email}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px] tabular-nums">
              #{order.order?.orderNumber || (order.id ? String(order.id).slice(0, 8) : "-")}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px] tabular-nums">
              {new Date(order.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusPill status={order.status} />
          <select
            value={order.status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={updating}
            aria-label={`Update status for order ${order.order?.orderNumber || order.id}`}
            className="rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5 font-mono text-[11px] font-semibold text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={expandedId}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white text-charcoal-80/65 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div id={expandedId} className="space-y-5 border-t border-charcoal-80/10 p-5">
          {/* Consultations */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-1.5 text-meta font-bold text-violet">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                Consultations
                <span className="font-mono text-[11px] tabular-nums text-charcoal-80/55">
                  ({order.consultations?.length || 0})
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setShowSched(!showSched)}
                aria-expanded={showSched}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                {showSched ? <X className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                {showSched ? "Cancel" : "Schedule"}
              </button>
            </div>

            {showSched && (
              <form onSubmit={handleSchedule} className="mb-3 grid gap-3 rounded-lg border border-charcoal-80/12 bg-[#fafafa] p-4 sm:grid-cols-2">
                <FormInput
                  label="Date & Time"
                  required
                  type="datetime-local"
                  value={schedForm.scheduledAt}
                  onChange={(e) => setSchedForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                />
                <FormInput
                  label="Meeting Link"
                  type="url"
                  value={schedForm.meetingLink}
                  onChange={(e) => setSchedForm((f) => ({ ...f, meetingLink: e.target.value }))}
                  placeholder="https://meet.google.com/..."
                />
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
                  >
                    Save consultation
                  </button>
                </div>
              </form>
            )}

            {order.consultations && order.consultations.length > 0 ? (
              <ul className="space-y-2">
                {order.consultations.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg border border-charcoal-80/8 bg-[#fafafa] px-4 py-2.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-violet" aria-hidden="true" />
                    <span className="font-mono text-micro tabular-nums text-violet">
                      {new Date(c.scheduledAt).toLocaleString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {c.meetingLink && (
                      <a
                        href={c.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-micro font-semibold text-azure transition hover:underline focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
                      >
                        Join
                      </a>
                    )}
                    <span className="ml-auto">
                      <StatusPill status={c.status === "completed" ? "completed" : "pending"} label={c.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : !showSched ? (
              <div className="rounded-lg border border-dashed border-charcoal-80/15 bg-[#fafafa] px-4 py-3 text-center text-micro text-charcoal-80/55">
                No consultations scheduled.
              </div>
            ) : null}
          </div>

          {/* Project */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-1.5 text-meta font-bold text-violet">
                <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Project
              </h4>
              {!order.clientProject && (
                <button
                  type="button"
                  onClick={() => setShowProject(!showProject)}
                  aria-expanded={showProject}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal-80 px-3 py-1.5 text-micro font-semibold text-white transition hover:bg-charcoal-80/85 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
                >
                  {showProject ? <X className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                  {showProject ? "Cancel" : "Create Project"}
                </button>
              )}
            </div>

            {showProject && (
              <form onSubmit={handleCreateProject} className="mb-3 grid gap-3 rounded-lg border border-charcoal-80/12 bg-[#fafafa] p-4 sm:grid-cols-2">
                <FormInput
                  label="Project Name"
                  required
                  value={projectForm.projectName}
                  onChange={(e) => setProjectForm((f) => ({ ...f, projectName: e.target.value }))}
                />
                <FormInput
                  label="Due Date"
                  type="date"
                  value={projectForm.dueDate}
                  onChange={(e) => setProjectForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
                <div className="sm:col-span-2">
                  <Field label="Description">
                    {(id) => (
                      <textarea
                        id={id}
                        rows={2}
                        value={projectForm.description}
                        onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Brief project description"
                        className={inputClass()}
                      />
                    )}
                  </Field>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
                  >
                    Create project
                  </button>
                </div>
              </form>
            )}

            {order.clientProject ? (
              <div className="rounded-lg border border-charcoal-80/8 bg-[#fafafa] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-meta text-violet">{order.clientProject.projectName}</div>
                  <StatusPill
                    status={order.clientProject.projectStatus === "completed" ? "completed" : "open"}
                    label={order.clientProject.projectStatus?.replace("_", " ")}
                  />
                </div>
                {order.clientProject.milestones && order.clientProject.milestones.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {order.clientProject.milestones.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-micro">
                        <CheckCircle2
                          className={`h-3 w-3 shrink-0 ${m.status === "completed" ? "text-mint" : "text-charcoal-80/30"}`}
                          aria-hidden="true"
                        />
                        <span className={m.status === "completed" ? "text-charcoal-80/40 line-through" : "text-violet"}>
                          {m.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : !showProject ? (
              <div className="rounded-lg border border-dashed border-charcoal-80/15 bg-[#fafafa] px-4 py-3 text-center text-micro text-charcoal-80/55">
                No project created yet.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </article>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

export default function AdminServicesPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const q = filterStatus ? `?status=${filterStatus}` : ""
      const res = await authFetch(`/api/admin/service-orders${q}`)
      setOrders(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || "Failed to load service orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [filterStatus])

  function handleOrderUpdate(id, updates) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...updates } : o))
    load()
  }

  const counts = useMemo(() => STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length
    return acc
  }, {}), [orders])

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-charcoal-80/70">
          Manage service orders, consultations, and client projects.
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
          className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-2 text-micro font-medium text-violet transition hover:border-violet/20 hover:bg-violet-pale disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Total" value={orders.length} icon={Briefcase} tone="purple" />
        <MetricCard title="New" value={counts.new || 0} icon={Plus} tone="blue" />
        <MetricCard title="Active" value={counts.active || 0} icon={Users} tone="green" />
        <MetricCard title="On Hold" value={counts.on_hold || 0} icon={AlertCircle} tone="amber" />
        <MetricCard title="Completed" value={counts.completed || 0} icon={CheckCircle2} tone="green" />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter by status">
        {["", ...STATUS_OPTIONS].map((s) => {
          const active = filterStatus === s
          return (
            <button
              key={s || "all"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                active
                  ? "bg-violet text-white shadow-[0_4px_12px_rgba(93,63,211,0.20)]"
                  : "border border-charcoal-80/12 bg-white text-charcoal-80/65 hover:border-violet/20 hover:bg-violet-pale hover:text-violet"
              }`}
            >
              {s ? s.replace("_", " ") : "All"}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-meta text-amber-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Orders */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} height="h-[120px]" />)}</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-80/15 bg-white px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
            <Briefcase className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-card font-bold text-violet">No service orders</h3>
          <p className="mt-1 max-w-sm text-meta text-charcoal-80/65">
            Service orders will appear here when clients purchase consulting packages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <ServiceOrderCard key={order.id} order={order} onUpdate={handleOrderUpdate} />
          ))}
        </div>
      )}
    </section>
  )
}
