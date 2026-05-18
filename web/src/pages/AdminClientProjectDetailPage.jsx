import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft, Save, Plus, Trash2, Upload, FileText, Download, Loader2,
  AlertCircle, Hourglass, Clock, CheckCircle2, X,
} from "lucide-react"
import {
  fetchAdminProject, updateAdminProject, createAdminProject,
  createMilestone, updateMilestone, deleteMilestone,
  uploadProjectFile, deleteProjectFile,
} from "../services/clientProjectService"
import { useToast } from "../context/ToastContext"
import { SkeletonCard } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import { API_BASE_URL } from "../lib/api"

const PROJECT_STATUSES = ["planning", "in_progress", "review", "completed", "cancelled"]
const MILESTONE_STATUSES = ["pending", "in_progress", "completed"]

const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : ""
const fileUrl = (path) => path ? (path.startsWith("http") ? path : `${(API_BASE_URL || "").replace(/\/$/, "")}${path}`) : "#"

const MILESTONE_ICON = { pending: Hourglass, in_progress: Clock, completed: CheckCircle2 }

export default function AdminClientProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const isNew = id === "new"

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef(null)

  // Editable form state
  const [form, setForm] = useState({
    serviceOrderId: "", userId: "", projectName: "",
    description: "", projectStatus: "planning",
    startDate: "", dueDate: "",
  })

  // New-milestone draft
  const [newMs, setNewMs] = useState({ title: "", description: "", dueDate: "" })

  async function load() {
    if (isNew) return
    setLoading(true); setError("")
    try {
      const data = await fetchAdminProject(id)
      if (!data) { setError("Project not found"); return }
      if (import.meta.env.DEV) console.info("[ClientProject] loaded", data.id)
      setProject(data)
      setForm({
        serviceOrderId: data.serviceOrderId || "",
        userId: data.userId || "",
        projectName: data.projectName || "",
        description: data.description || "",
        projectStatus: data.projectStatus || "planning",
        startDate: fmtDate(data.startDate),
        dueDate: fmtDate(data.dueDate),
      })
    } catch (err) {
      console.error("[ClientProject] load failed:", err)
      setError(err.message || "Could not load project")
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      if (isNew) {
        const created = await createAdminProject(form)
        showSuccess(`Project "${created.projectName}" created`)
        navigate(`/admin/client-projects/${created.id}`, { replace: true })
      } else {
        await updateAdminProject(id, form)
        showSuccess("Project saved")
        load()
      }
    } catch (err) {
      console.error("[ClientProject] save failed:", err)
      showError(err.message || "Save failed")
    } finally { setSaving(false) }
  }

  async function handleAddMilestone() {
    if (!newMs.title.trim()) { showError("Milestone title is required"); return }
    try {
      await createMilestone(id, newMs)
      showSuccess("Milestone added")
      setNewMs({ title: "", description: "", dueDate: "" })
      load()
    } catch (err) {
      console.error("[Milestone] add failed:", err)
      showError(err.message || "Could not add milestone")
    }
  }

  async function handleMilestoneStatus(m, nextStatus) {
    try {
      await updateMilestone(id, m.id, { status: nextStatus })
      showSuccess(nextStatus === "completed" ? "Milestone completed (client emailed)" : `Milestone marked ${nextStatus}`)
      load()
    } catch (err) {
      console.error("[Milestone] status failed:", err)
      showError(err.message || "Could not update milestone")
    }
  }

  async function handleMilestoneDelete(m) {
    if (!window.confirm(`Delete milestone "${m.title}"?`)) return
    try {
      await deleteMilestone(id, m.id)
      showSuccess("Milestone deleted")
      load()
    } catch (err) { showError(err.message || "Could not delete milestone") }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadProjectFile(id, file)
      showSuccess(`Uploaded ${file.name}`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      load()
    } catch (err) {
      console.error("[ProjectFile] upload failed:", err)
      showError(err.message || "Upload failed")
    }
  }

  async function handleFileDelete(f) {
    if (!window.confirm(`Delete "${f.fileName}"?\n\nThe client will lose access immediately.`)) return
    try {
      await deleteProjectFile(id, f.id)
      showSuccess("File deleted")
      load()
    } catch (err) { showError(err.message || "Could not delete file") }
  }

  if (loading) return <section><SkeletonCard height="h-[400px]" /></section>

  return (
    <section className="space-y-6">
      <Link to="/admin/client-projects" className="inline-flex items-center gap-1 text-meta text-violet hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Project metadata */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-card font-bold text-violet">{isNew ? "New project" : project?.projectName}</h1>
          {!isNew && project && <StatusPill status={project.projectStatus} />}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {isNew && (
            <>
              <Field label="Service Order ID" required>
                <Input value={form.serviceOrderId} onChange={(v) => setForm({ ...form, serviceOrderId: v })} placeholder="cuid from /admin/service-orders" />
              </Field>
              <Field label="Client User ID" required>
                <Input value={form.userId} onChange={(v) => setForm({ ...form, userId: v })} placeholder="cuid from /admin/users" />
              </Field>
            </>
          )}
          <Field label="Project name" required>
            <Input value={form.projectName} onChange={(v) => setForm({ ...form, projectName: v })} />
          </Field>
          <Field label="Status">
            <select
              value={form.projectStatus}
              onChange={(e) => setForm({ ...form, projectStatus: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
            >
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button" onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(93,63,211,0.18)] transition hover:bg-violet-deep disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Create project" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Milestones */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-card font-bold text-violet">Milestones</h2>
              <p className="mt-0.5 text-meta text-charcoal-80/65">{project.milestones.length} total</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {project.milestones.map((m) => {
              const Icon = MILESTONE_ICON[m.status] || Hourglass
              return (
                <div key={m.id} className="flex items-start gap-3 rounded-lg border border-charcoal-80/10 bg-white px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-pale text-violet">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-meta font-semibold text-charcoal-80">{m.title}</h4>
                      <StatusPill status={m.status} />
                    </div>
                    {m.description && <p className="mt-1 text-micro text-charcoal-80/65">{m.description}</p>}
                    <div className="mt-1.5 font-mono text-[11px] text-charcoal-80/45">
                      {m.dueDate && <>Due {new Date(m.dueDate).toLocaleDateString()} · </>}
                      {m.completedAt && <>Completed {new Date(m.completedAt).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <select
                      value={m.status}
                      onChange={(e) => handleMilestoneStatus(m, e.target.value)}
                      className="rounded-md border border-charcoal-80/15 bg-white px-2 py-1 text-[11px] text-charcoal-80 focus:border-violet focus:outline-none"
                    >
                      {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      type="button" onClick={() => handleMilestoneDelete(m)}
                      className="rounded-md border border-rose/20 bg-white p-1.5 text-rose-700 transition hover:bg-rose/10"
                      aria-label={`Delete ${m.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
            {project.milestones.length === 0 && (
              <div className="rounded-lg border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-4 text-center text-meta text-charcoal-80/55">
                No milestones yet. Add the first one below.
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2 rounded-lg border border-violet/15 bg-violet-pale/30 p-3 md:grid-cols-[1fr_1fr_140px_auto]">
            <input
              type="text" placeholder="Milestone title" value={newMs.title}
              onChange={(e) => setNewMs({ ...newMs, title: e.target.value })}
              className="rounded-md border border-charcoal-80/15 bg-white px-3 py-2 text-sm focus:border-violet focus:outline-none"
            />
            <input
              type="text" placeholder="Optional description" value={newMs.description}
              onChange={(e) => setNewMs({ ...newMs, description: e.target.value })}
              className="rounded-md border border-charcoal-80/15 bg-white px-3 py-2 text-sm focus:border-violet focus:outline-none"
            />
            <input
              type="date" value={newMs.dueDate}
              onChange={(e) => setNewMs({ ...newMs, dueDate: e.target.value })}
              className="rounded-md border border-charcoal-80/15 bg-white px-3 py-2 text-sm focus:border-violet focus:outline-none"
            />
            <button
              type="button" onClick={handleAddMilestone}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-violet px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-deep"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
      )}

      {/* Files */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-card font-bold text-violet">Deliverables</h2>
              <p className="mt-0.5 text-meta text-charcoal-80/65">{project.files.length} file{project.files.length === 1 ? "" : "s"} · max 50 MB each</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-deep">
              <Upload className="h-4 w-4" /> Upload file
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {project.files.length === 0 && (
              <div className="rounded-lg border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-4 text-center text-meta text-charcoal-80/55">
                No files uploaded yet.
              </div>
            )}
            {project.files.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-charcoal-80/10 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-pale text-violet">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-meta font-semibold text-charcoal-80">{f.fileName}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-charcoal-80/55">
                      {f.fileType || "file"} · {new Date(f.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={fileUrl(f.filePath)} target="_blank" rel="noopener noreferrer"
                    className="rounded-md border border-violet/15 bg-white p-1.5 text-violet hover:bg-violet-pale"
                    aria-label={`Download ${f.fileName}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button" onClick={() => handleFileDelete(f)}
                    className="rounded-md border border-rose/20 bg-white p-1.5 text-rose-700 transition hover:bg-rose/10"
                    aria-label={`Delete ${f.fileName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/* ── small inline helpers (avoid extra component files) ──────────────── */
function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
function Input({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
    />
  )
}
