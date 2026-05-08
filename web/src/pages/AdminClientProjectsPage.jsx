import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Briefcase, Plus, AlertCircle, Calendar, User as UserIcon } from "lucide-react"
import { fetchAdminProjects, deleteAdminProject } from "../services/clientProjectService"
import { useToast } from "../context/ToastContext"
import { MetricCard, AlertBanner, SkeletonCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "-"

export default function AdminClientProjectsPage() {
  const { showSuccess, showError } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const rows = await fetchAdminProjects()
      if (import.meta.env.DEV) console.info("[ClientProjects] loaded", rows.length, "rows")
      setItems(rows)
    } catch (err) {
      console.error("[ClientProjects] load failed:", err)
      const msg = err.message || "Could not load projects."
      setError(msg)
      showError(msg, "Could not load projects")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function onDelete(row) {
    if (!window.confirm(`Delete project "${row.projectName}"?\n\nThis cannot be undone, all milestones and files will be removed.`)) return
    try {
      await deleteAdminProject(row.id)
      showSuccess(`Project "${row.projectName}" deleted`)
      load()
    } catch (err) {
      console.error("[ClientProjects] delete failed:", err)
      showError(err.message || "Could not delete project")
    }
  }

  const metrics = useMemo(() => ({
    total: items.length,
    active: items.filter((p) => ["planning", "in_progress", "review"].includes(p.projectStatus)).length,
    completed: items.filter((p) => p.projectStatus === "completed").length,
  }), [items])

  const columns = useMemo(() => [
    {
      key: "projectName", label: "Project", sortable: true, searchable: true, width: "1.6fr",
      getValue: (row) => row.projectName || "",
      render: (row) => (
        <div className="min-w-0">
          <Link to={`/admin/client-projects/${row.id}`} className="truncate text-meta font-semibold text-violet hover:underline">
            {row.projectName}
          </Link>
          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">
            <UserIcon className="inline h-3 w-3 mr-1" />{row.user?.fullName || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "projectStatus", label: "Status", sortable: true, width: "0.8fr",
      getValue: (row) => row.projectStatus || "",
      render: (row) => <StatusPill status={row.projectStatus} />,
    },
    {
      key: "milestones", label: "Progress", sortable: false, width: "0.9fr",
      render: (row) => {
        const total = row.milestones?.length || 0
        const done = row.milestones?.filter((m) => m.status === "completed").length || 0
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        return (
          <div className="font-mono text-[11px] tabular-nums text-charcoal-80/65">
            {done}/{total} <span className="ml-1 text-charcoal-80/45">({pct}%)</span>
          </div>
        )
      },
    },
    {
      key: "dueDate", label: "Due", sortable: true, width: "0.8fr",
      getValue: (row) => row.dueDate || "",
      render: (row) => <span className="font-mono text-micro text-charcoal-80/55">{fmtDate(row.dueDate)}</span>,
    },
    {
      key: "actions", label: "", width: "1fr", align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to={`/admin/client-projects/${row.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-violet/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet transition hover:bg-violet-pale"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(row) }}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  if (loading && items.length === 0) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">{[1,2,3].map((i) => <SkeletonCard key={i} />)}</div>
        <SkeletonCard height="h-[400px]" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <AlertBanner type="error" message={error} onDismiss={() => setError("")} />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Total" value={metrics.total} icon={Briefcase} tone="purple" />
        <MetricCard title="Active" value={metrics.active} icon={Calendar} tone="blue" />
        <MetricCard title="Completed" value={metrics.completed} icon={Briefcase} tone="green" />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-card font-bold text-violet">Client projects</h2>
          <p className="mt-0.5 text-meta text-charcoal-80/65">
            One project per ServiceOrder. Manage milestones and deliverables from each project's detail page.
          </p>
        </div>
        <Link
          to="/admin/client-projects/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(93,63,211,0.18)] transition hover:-translate-y-0.5 hover:bg-violet-deep"
        >
          <Plus className="h-4 w-4" /> New project
        </Link>
      </div>

      <DataTable
        columns={columns} rows={items} rowKey={(row) => row.id} loading={loading}
        onRefresh={load} initialSort={{ key: "dueDate", dir: "asc" }}
        searchPlaceholder="Search by project or client name…"
        emptyState={{ icon: Briefcase, title: "No client projects yet", description: "Create one from a ServiceOrder to start tracking milestones and deliverables." }}
      />
    </section>
  )
}
