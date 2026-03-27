import { useEffect, useState } from "react"
import {
  Briefcase, Plus, RefreshCw, CheckCircle2, Clock3, XCircle,
  Eye, Edit3, Calendar, FolderOpen, ChevronDown, ChevronUp,
  Milestone, Users, AlertCircle, ArrowRight
} from "lucide-react"
import { SectionCard, StatusBadge, EmptyState, SkeletonCard } from "../components/ui/index"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { Link } from "react-router-dom"

const STATUS_OPTIONS = ["new","active","on_hold","completed","cancelled"]

function ServiceOrderCard({ order, onUpdate }) {
  const { showSuccess, showError } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [schedForm, setSchedForm] = useState({ scheduledAt:"", meetingLink:"" })
  const [showSched, setShowSched] = useState(false)
  const [showProject, setShowProject] = useState(false)
  const [projectForm, setProjectForm] = useState({ projectName:"", description:"", dueDate:"" })

  async function changeStatus(newStatus) {
    setUpdating(true)
    try {
      await authFetch(`/api/admin/service-orders/${order.id}`, { method:"PATCH", body: JSON.stringify({ status: newStatus }) })
      onUpdate(order.id, { status: newStatus })
      showSuccess("Status updated")
    } catch (err) { showError(err.message) }
    finally { setUpdating(false) }
  }

  async function handleSchedule(e) {
    e.preventDefault()
    try {
      await authFetch(`/api/admin/service-orders/${order.id}/consultations`, { method:"POST", body: JSON.stringify(schedForm) })
      showSuccess("Consultation scheduled")
      setShowSched(false)
      setSchedForm({ scheduledAt:"", meetingLink:"" })
      onUpdate(order.id, {})
    } catch (err) { showError(err.message) }
  }

  async function handleCreateProject(e) {
    e.preventDefault()
    try {
      await authFetch(`/api/admin/service-orders/${order.id}/project`, { method:"POST", body: JSON.stringify(projectForm) })
      showSuccess("Project created")
      setShowProject(false)
      onUpdate(order.id, {})
    } catch (err) { showError(err.message) }
  }

  const statusColors = {
    new:"bg-[#eef3fb] text-[#2f5ea8]", active:"bg-[#e8f4ea] text-[#3b8f47]",
    on_hold:"bg-[#fff3e2] text-[#b46909]", completed:"bg-[#e5f4e8] text-[#3b8f47]",
    cancelled:"bg-[#f2f2f2] text-[#666]"
  }

  return (
    <div className="rounded-xl border border-[#634F40]/10 bg-white shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-[#420060]">
            {order.service?.title || "Service"}
            {order.servicePackage?.name && (
              <span className="ml-2 text-[12px] font-normal text-[#634F40]/55">— {order.servicePackage.name}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#634F40]/60">
            <span className="font-semibold text-[#420060]">{order.user?.fullName||"—"}</span>
            <span>·</span><span>{order.user?.email}</span>
            <span>·</span><span>Order #{order.order?.orderNumber||order.id?.slice(0,8)}</span>
            <span>·</span><span>{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${statusColors[order.status]||"bg-[#f2f2f2] text-[#666]"}`}>
            {order.status?.replace("_"," ")}
          </span>
          <select value={order.status} onChange={(e) => changeStatus(e.target.value)} disabled={updating}
            className="rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-2.5 py-1.5 text-[11px] font-semibold text-[#420060] outline-none"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
          </select>
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="rounded-xl border border-[#634F40]/12 p-1.5 text-[#634F40]/50 hover:text-[#420060]"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[#634F40]/10 p-5 space-y-4">
          {/* Consultations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-bold text-[#420060] flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Consultations ({order.consultations?.length || 0})
              </span>
              <button type="button" onClick={() => setShowSched(!showSched)}
                className="flex items-center gap-1.5 rounded-xl bg-[#420060] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2d003f]"
              >
                <Plus className="h-3.5 w-3.5" /> Schedule
              </button>
            </div>
            {showSched && (
              <form onSubmit={handleSchedule} className="mb-3 flex flex-wrap gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4">
                <div className="flex-1 min-w-[180px]">
                  <label className="mb-1 block text-[11px] font-semibold text-[#420060]">Date & Time</label>
                  <input type="datetime-local" value={schedForm.scheduledAt} onChange={(e) => setSchedForm(f=>({...f,scheduledAt:e.target.value}))} required
                    className="w-full rounded-xl border border-[#634F40]/15 bg-white px-3 py-2 text-[13px] text-[#420060] outline-none"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="mb-1 block text-[11px] font-semibold text-[#420060]">Meeting Link</label>
                  <input type="url" value={schedForm.meetingLink} onChange={(e) => setSchedForm(f=>({...f,meetingLink:e.target.value}))} placeholder="https://meet.google.com/..."
                    className="w-full rounded-xl border border-[#634F40]/15 bg-white px-3 py-2 text-[13px] text-[#420060] outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="rounded-xl bg-[#420060] px-4 py-2 text-[12px] font-semibold text-white">Save</button>
                </div>
              </form>
            )}
            {(order.consultations||[]).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-[#fafafa] px-4 py-2.5 text-[12px]">
                <Calendar className="h-3.5 w-3.5 text-[#420060]" />
                <span className="font-medium text-[#420060]">{new Date(c.scheduledAt).toLocaleString()}</span>
                {c.meetingLink && <a href={c.meetingLink} target="_blank" rel="noopener noreferrer" className="text-[#4A6CFA] hover:underline">Join</a>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${c.status==="completed"?"bg-[#e8f4ea] text-[#3b8f47]":"bg-[#fff3e2] text-[#b46909]"}`}>{c.status}</span>
              </div>
            ))}
          </div>

          {/* Project */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-bold text-[#420060] flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> Project
              </span>
              {!order.clientProject && (
                <button type="button" onClick={() => setShowProject(!showProject)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#2E2F3A] px-3 py-1.5 text-[11px] font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Project
                </button>
              )}
            </div>
            {showProject && (
              <form onSubmit={handleCreateProject} className="mb-3 flex flex-wrap gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4">
                {[
                  { key:"projectName", label:"Project Name", req:true },
                  { key:"description", label:"Description",  req:false },
                  { key:"dueDate",     label:"Due Date",      type:"date", req:false },
                ].map(({ key, label, type="text", req }) => (
                  <div key={key} className="flex-1 min-w-[180px]">
                    <label className="mb-1 block text-[11px] font-semibold text-[#420060]">{label}</label>
                    <input type={type} required={req} value={projectForm[key]}
                      onChange={(e) => setProjectForm(f=>({...f,[key]:e.target.value}))}
                      className="w-full rounded-xl border border-[#634F40]/15 bg-white px-3 py-2 text-[13px] text-[#420060] outline-none"
                    />
                  </div>
                ))}
                <div className="flex items-end">
                  <button type="submit" className="rounded-xl bg-[#420060] px-4 py-2 text-[12px] font-semibold text-white">Create</button>
                </div>
              </form>
            )}
            {order.clientProject && (
              <div className="rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[#420060] text-[13px]">{order.clientProject.projectName}</div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                    order.clientProject.projectStatus==="completed"?"bg-[#e8f4ea] text-[#3b8f47]":"bg-[#eef3fb] text-[#2f5ea8]"
                  }`}>{order.clientProject.projectStatus?.replace("_"," ")}</span>
                </div>
                {order.clientProject.milestones?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {order.clientProject.milestones.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 text-[12px]">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${m.status==="completed"?"text-[#2FA36B]":"text-[#634F40]/30"}`} />
                        <span className={m.status==="completed"?"line-through text-[#634F40]/40":"text-[#420060]"}>{m.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminServicesPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState("")
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

  useEffect(() => { load() }, [filterStatus])

  function handleOrderUpdate(id, updates) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...updates } : o))
    load() // re-fetch to get nested data
  }

  const counts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = orders.filter((o) => o.status===s).length; return acc }, {})
  const total  = orders.length

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold text-[#420060]">Service Delivery</h2>
          <p className="text-[12px] text-[#634F40]/60">Manage service orders, consultations, and client projects</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/12 bg-white px-4 py-2 text-[12px] font-medium text-[#420060] hover:bg-[#ede4ef]">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label:"Total",     value:total,          color:"text-[#420060]" },
          { label:"New",       value:counts.new||0,   color:"text-[#2f5ea8]" },
          { label:"Active",    value:counts.active||0, color:"text-[#3b8f47]" },
          { label:"On Hold",   value:counts.on_hold||0, color:"text-[#b46909]" },
          { label:"Completed", value:counts.completed||0, color:"text-[#3b8f47]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#634F40]/10 bg-white p-4 shadow-[0_4px_12px_rgba(66,0,96,0.04)]">
            <div className="text-[11px] text-[#634F40]/60">{label}</div>
            <div className={`mt-1 text-[24px] font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {["", ...STATUS_OPTIONS].map((s) => (
          <button key={s} type="button" onClick={() => setFilterStatus(s)}
            className={`rounded-xl px-3.5 py-1.5 text-[12px] font-semibold transition ${
              filterStatus===s ? "bg-[#420060] text-white shadow-[0_4px_12px_rgba(66,0,96,0.20)]"
              : "border border-[#634F40]/12 bg-white text-[#634F40]/65 hover:text-[#420060]"
            }`}
          >{s||"All"}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i)=><SkeletonCard key={i} height="h-[100px]" />)}</div>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Briefcase} title="No service orders" description="Service orders will appear here when clients purchase consulting packages." />
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
