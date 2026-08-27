import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft, Save, Plus, Trash2, Upload, Download, Loader2,
  AlertCircle, Hourglass, Clock, CheckCircle2, Eye, ThumbsUp, Send, Check, RotateCcw, MessageSquare,
  Link2, Copy,
} from "lucide-react"
import {
  fetchAdminProject, updateAdminProject, createAdminProject, createAdminPortalLink,
  createMilestone, updateMilestone, deleteMilestone,
  uploadProjectFile, deleteProjectFile,
  postAdminProjectComment, toggleAdminCommentResolved,
} from "../services/clientProjectService"
import { useToast } from "../context/ToastContext"
import { SkeletonCard, Checkbox } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import { API_BASE_URL } from "../lib/api"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"

const PROJECT_STATUSES = ["planning", "in_progress", "review", "completed", "cancelled"]
const MILESTONE_STATUSES = [
  { value: "pending",         label: "Pending" },
  { value: "in_progress",     label: "In progress" },
  { value: "awaiting_client", label: "Awaiting client review" },
  { value: "approved",        label: "Approved by client" },
  { value: "completed",       label: "Completed" },
]

const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : ""
const fmtWhen = (d) => d ? new Date(d).toLocaleString() : ""
// Files are private: never link the raw path (app.js 403s /files/projects/*).
// Go through the admin streaming endpoint; the session cookie authenticates.
const fileUrl = (projectId, file) =>
  `${(API_BASE_URL || "").replace(/\/$/, "")}/api/v1/admin/client-projects/${projectId}/files/${file.id}/download`

const MILESTONE_ICON = { pending: Hourglass, in_progress: Clock, awaiting_client: Eye, approved: ThumbsUp, completed: CheckCircle2 }
const SELECT_CLASS = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"

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
    startDate: "", dueDate: "", previewUrl: "",
    requiresNda: false, ndaVersion: "",
  })

  // Tier 4 · magic-link portal
  const [portalLink, setPortalLink] = useState(null)
  const [mintingLink, setMintingLink] = useState(false)

  async function handlePortalLink() {
    setMintingLink(true)
    try {
      const data = await createAdminPortalLink(id)
      setPortalLink(data)
      showSuccess("Portal link ready — copy it and send it to the client")
    } catch (err) {
      console.error("[ClientProject] portal link failed:", err)
      showError(err.message || "Could not create the portal link")
    } finally { setMintingLink(false) }
  }
  async function copyPortalLink() {
    try { await navigator.clipboard.writeText(portalLink.url); showSuccess("Link copied") }
    catch { showError("Copy failed — select the link and copy it manually") }
  }

  // New-milestone draft
  const [newMs, setNewMs] = useState({ title: "", description: "", dueDate: "" })
  // Upload options
  const [uploadOpts, setUploadOpts] = useState({ milestoneId: "", isDeliverable: true })

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
        previewUrl: data.previewUrl || "",
        requiresNda: Boolean(data.requiresNda),
        ndaVersion: data.ndaVersion || "",
      })
    } catch (err) {
      console.error("[ClientProject] load failed:", err)
      setError(err.message || "Could not load project")
    } finally { setLoading(false) }
  }
  useEffect(() => { load()   }, [id])

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
      await uploadProjectFile(id, file, { milestoneId: uploadOpts.milestoneId || undefined, isDeliverable: uploadOpts.isDeliverable })
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

  async function handleComment({ body, milestoneId }) {
    const saved = await postAdminProjectComment(id, { body, milestoneId })
    setProject((p) => p && { ...p, comments: [...(p.comments || []), saved] })
  }

  async function handleToggleResolved(comment) {
    try {
      const saved = await toggleAdminCommentResolved(id, comment.id)
      setProject((p) => p && { ...p, comments: (p.comments || []).map((c) => c.id === comment.id ? { ...c, ...saved } : c) })
    } catch (err) { showError(err.message || "Could not update comment") }
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
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
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
            <Field label="Preview URL">
              <Input type="url" value={form.previewUrl} onChange={(v) => setForm({ ...form, previewUrl: v })} placeholder="https://staging.example.com — shown to the client as a live preview" />
            </Field>
          </div>
          <Field label="NDA click-wrap">
            <div className="flex flex-col gap-2 pt-1">
              <Checkbox
                label="Client must accept the NDA before seeing milestones, files or messages"
                checked={form.requiresNda}
                onChange={(checked) => setForm({ ...form, requiresNda: Boolean(checked) })}
              />
              <Input value={form.ndaVersion} onChange={(v) => setForm({ ...form, ndaVersion: v })} placeholder="NDA version (e.g. 2026-08) — bump to re-ask the client" />
            </div>
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-lift-1)] transition hover:bg-violet-deep disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Create project" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Tier 4 · no-login portal link */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-card font-bold text-violet">Client portal link</h2>
              <p className="mt-0.5 text-meta text-charcoal-80/65">
                Read-only access without an account: the client opens the link, receives a 6-digit PIN by email, and sees milestones, files and the preview.
                {project.portalTokenExpiresAt ? ` Current link expires ${fmtDate(project.portalTokenExpiresAt)}.` : " No link has been issued yet."}
              </p>
            </div>
            <button
              type="button" onClick={handlePortalLink} disabled={mintingLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet/30 bg-white px-3 py-2 text-sm font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-60"
            >
              {mintingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {project.portalTokenExpiresAt ? "Rotate link" : "Generate link"}
            </button>
          </div>
          {portalLink?.url && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-charcoal-80/5 px-3 py-2 font-mono text-[12px] text-charcoal">{portalLink.url}</code>
              <button
                type="button" onClick={copyPortalLink}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-deep"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Milestones */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-card font-bold text-violet">Milestones</h2>
              <p className="mt-0.5 text-meta text-charcoal-80/65">{project.milestones.length} total</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {project.milestones.map((m) => {
              const Icon = MILESTONE_ICON[m.status] || Hourglass
              const msComments = (project.comments || []).filter((c) => c.milestoneId === m.id)
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
                    <div className="mt-1.5 font-mono text-[11px] text-charcoal-80/65">
                      {m.dueDate && <>Due {new Date(m.dueDate).toLocaleDateString()} · </>}
                      {m.approvedAt && <>Approved by client {fmtWhen(m.approvedAt)} · </>}
                      {m.changesRequestedAt && <>Changes requested {fmtWhen(m.changesRequestedAt)} · </>}
                      {m.completedAt && <>Completed {new Date(m.completedAt).toLocaleDateString()}</>}
                    </div>
                    {m.clientNote && (
                      <div className="mt-2 rounded-md border border-charcoal-80/10 bg-charcoal-80/5 px-3 py-2 text-micro text-charcoal-80">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {m.changesRequestedAt ? <RotateCcw className="h-3 w-3" /> : <ThumbsUp className="h-3 w-3" />}
                          Client note
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap">{m.clientNote}</p>
                      </div>
                    )}
                    <div className="mt-3 border-t border-charcoal-80/10 pt-3">
                      <CommentThread comments={msComments} onToggleResolved={handleToggleResolved} />
                      <ReplyBox className="mt-2" placeholder="Reply on this milestone…" onSubmit={(body) => handleComment({ body, milestoneId: m.id })} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <select
                      value={m.status}
                      onChange={(e) => handleMilestoneStatus(m, e.target.value)}
                      className="rounded-md border border-charcoal-80/15 bg-white px-2 py-1 text-[11px] text-charcoal-80 focus:border-violet focus:outline-none"
                      aria-label={`Status of ${m.title}`}
                    >
                      {MILESTONE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
              <div className="rounded-lg border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-4 text-center text-meta text-charcoal-80/65">
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
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-card font-bold text-violet">Deliverables</h2>
              <p className="mt-0.5 text-meta text-charcoal-80/65">{project.files.length} file{project.files.length === 1 ? "" : "s"} · max 50 MB each</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-violet/15 bg-violet-pale/30 p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <Field label="Attach to milestone (optional)">
              <select
                value={uploadOpts.milestoneId}
                onChange={(e) => setUploadOpts({ ...uploadOpts, milestoneId: e.target.value })}
                className={SELECT_CLASS}
              >
                <option value="">No milestone</option>
                {project.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </Field>
            <Checkbox
              label="Deliverable"
              description="Shown to the client as a deliverable from the team"
              checked={uploadOpts.isDeliverable}
              onChange={(checked) => setUploadOpts({ ...uploadOpts, isDeliverable: checked })}
              className="pb-1"
            />
            <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-violet px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-deep">
              <Upload className="h-4 w-4" /> Upload file
              <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {project.files.length === 0 && (
              <div className="rounded-lg border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-4 text-center text-meta text-charcoal-80/65">
                No files uploaded yet.
              </div>
            )}
            {project.files.map((f) => {
              const { icon: FileIcon, label: typeLabel, chip } = getFileTypeStyles(f.fileName || f.fileType)
              const milestone = f.milestoneId ? project.milestones.find((m) => m.id === f.milestoneId) : null
              return (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-charcoal-80/10 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-pale text-violet">
                    <FileIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-meta font-semibold text-charcoal-80">{f.fileName}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${chip}`}>{typeLabel}</span>
                      <StatusPill status={f.uploadedByRole === "client" ? "member" : "admin"} label={f.uploadedByRole === "client" ? "Client" : "Team"} />
                      {f.isDeliverable && <StatusPill status="delivered" label="Deliverable" />}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-charcoal-80/65">
                      {[formatFileSize(f.fileSize), f.uploadedBy?.fullName, milestone ? `↳ ${milestone.title}` : null, new Date(f.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={fileUrl(project.id, f)} target="_blank" rel="noopener noreferrer"
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
              )
            })}
          </div>
        </div>
      )}

      {/* Project thread */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <h2 className="text-card font-bold text-violet">Project thread</h2>
          <p className="mt-0.5 text-meta text-charcoal-80/65">Messages not tied to a milestone. The client is emailed when you reply.</p>
          <div className="mt-4">
            <CommentThread
              comments={(project.comments || []).filter((c) => !c.milestoneId && !c.fileId)}
              empty="No messages yet."
              onToggleResolved={handleToggleResolved}
            />
            <ReplyBox className="mt-3" placeholder="Write a message to the client…" onSubmit={(body) => handleComment({ body })} />
          </div>
        </div>
      )}
    </section>
  )
}

/* ── comments ────────────────────────────────────────────────────────── */
function CommentThread({ comments, empty, onToggleResolved }) {
  if (!comments.length) {
    return empty ? (
      <div className="flex items-center gap-2 py-2 text-meta text-charcoal-80/65">
        <MessageSquare className="h-4 w-4" /> {empty}
      </div>
    ) : null
  }
  return (
    <ul className="space-y-2">
      {comments.map((c) => {
        const isTeam = c.authorRole === "admin"
        return (
          <li key={c.id} className={`flex items-start justify-between gap-3 rounded-md px-3 py-2 ${isTeam ? "bg-violet-pale/40" : "bg-charcoal-80/5"}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-charcoal-80/65">
                <span className="font-semibold text-charcoal-80">{c.author?.fullName || (isTeam ? "Team" : "Client")}</span>
                <StatusPill status={isTeam ? "admin" : "member"} label={isTeam ? "Team" : "Client"} />
                <span>{fmtWhen(c.createdAt)}</span>
                {c.resolvedAt && <StatusPill status="completed" label="Resolved" />}
              </div>
              <p className={`mt-1 whitespace-pre-wrap text-micro ${c.resolvedAt ? "text-charcoal-80/65" : "text-charcoal-80"}`}>{c.body}</p>
            </div>
            <button
              type="button" onClick={() => onToggleResolved(c)}
              className={`shrink-0 rounded-md border p-1.5 transition ${c.resolvedAt ? "border-mint/30 bg-mint/15 text-mint-700" : "border-charcoal-80/15 bg-white text-charcoal-80 hover:bg-mint/10"}`}
              aria-label={c.resolvedAt ? "Mark as unresolved" : "Mark as resolved"}
              title={c.resolvedAt ? "Mark as unresolved" : "Mark as resolved"}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ReplyBox({ onSubmit, placeholder, className = "" }) {
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const submit = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true); setErr("")
    try { await onSubmit(text); setBody("") }
    catch (ex) { setErr(ex?.message || "Could not post comment") }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className={`${className} flex items-start gap-2`}>
      <textarea
        rows={1} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        maxLength={5000}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e) }}
        className="min-h-[38px] flex-1 resize-y rounded-md border border-charcoal-80/15 bg-white px-3 py-2 text-sm text-charcoal focus:border-violet focus:outline-none"
      />
      <button
        type="submit" disabled={busy || !body.trim()}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-md bg-violet px-3 text-sm font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
      </button>
      {err && <span className="text-micro text-rose-700">{err}</span>}
    </form>
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
