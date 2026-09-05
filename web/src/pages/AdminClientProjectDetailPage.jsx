import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  ArrowLeft, Save, Plus, Trash2, Upload, Download, Loader2, AlertCircle, Hourglass, Clock, CheckCircle2, Eye, ThumbsUp, Send, Check, RotateCcw, MessageSquare, Link2, Copy, BookOpen, Receipt,
} from "lucide-react"
import {
  fetchAdminProject, updateAdminProject, createAdminProject, createAdminPortalLink, createAdminCaseStudyDraft,
  createMilestone, updateMilestone, deleteMilestone,
  uploadProjectFile, deleteProjectFile,
  postAdminProjectComment, toggleAdminCommentResolved,
  quoteChangeRequest, completeChangeRequest,
  fetchAdminProjectEvents,
} from "../services/clientProjectService"
// T5-5 · the operator half of the document requests, and the same
// timeline component the client and /track see — at admin visibility.
import ProjectRequestsAdmin from "../components/admin/ProjectRequestsAdmin"
// T5-13 · credentials never travel as files, in either direction.
import ProjectSecretsAdmin from "../components/admin/ProjectSecretsAdmin"
// T5-17 · a school has a director who approves and an IT person who uploads.
import ProjectMembersAdmin from "../components/admin/ProjectMembersAdmin"
import ProjectTimeline from "../components/projects/ProjectTimeline"
import { useToast } from "../context/ToastContext"
import { SkeletonCard, Checkbox } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import { API_BASE_URL } from "../lib/api"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"

const PROJECT_STATUSES = ["planning", "in_progress", "review", "completed", "cancelled"]
const ACCESS_STATES = [
  { value: "active",    label: "Active — full client access" },
  { value: "suspended", label: "Suspended — preview hidden, deliverables on hold (402)" },
  { value: "handover",  label: "Handover — final deliverables released (requires zero balance)" },
]
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
    requiresNda: false, ndaVersion: "", accessState: "active",
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

  // T5-5 · same shape as copyPortalLink. Clipboard access can be refused
  // (an insecure origin, a locked-down browser) and the code is on screen
  // anyway, so a failure is reported rather than thrown.
  async function copyTrackingCode() {
    if (!project?.trackingCode) return
    try { await navigator.clipboard.writeText(project.trackingCode); showSuccess("Tracking code copied") }
    catch { showError("Could not copy — select the code and copy it by hand") }
  }

  // T5-5 · the admin-visibility timeline. Its own fetch rather than a field
  // on the project payload: it is 200 rows of history, and the project read
  // is on the critical path of every save.
  const [adminEvents, setAdminEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  useEffect(() => {
    if (isNew || !id) { setEventsLoading(false); return }
    let alive = true
    ;(async () => {
      try {
        const rows = await fetchAdminProjectEvents(id)
        if (alive) setAdminEvents(rows)
      } catch {
        // A missing timeline is not worth failing the page over; the panel
        // renders its own empty state.
      } finally {
        if (alive) setEventsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, isNew])

  /**
   * T5-12 · set or clear a milestone's expected date.
   *
   * On blur rather than on change: a date input fires on every keystroke in
   * some browsers, and each one would be a write — and, past the two-day
   * threshold, an event the client sees. One write when the operator is done.
   */
  async function handleMilestoneEstimate(m, value) {
    const next = value || null
    const current = m.estimatedAt ? new Date(m.estimatedAt).toISOString().slice(0, 10) : null
    if (next === current) return
    try {
      await updateMilestone(id, m.id, { estimatedAt: next })
      showSuccess(next ? "Expected date updated" : "Expected date cleared")
      load()
    } catch (err) {
      showError(err.message || "Could not update the expected date")
    }
  }

  // Tier 4 · case-study draft
  const [draftingCase, setDraftingCase] = useState(false)
  async function handleCaseStudyDraft() {
    setDraftingCase(true)
    try {
      const data = await createAdminCaseStudyDraft(id)
      showSuccess("Draft case study created — opening the editor")
      navigate(`/admin/portfolio/${data.id}/edit`)
    } catch (err) {
      console.error("[ClientProject] case-study draft failed:", err)
      showError(err.message || "Could not create the case study draft")
    } finally { setDraftingCase(false) }
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
        accessState: data.accessState || "active",
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
          {!isNew && (
            <div className="md:col-span-2">
              <Field label="Client access (kill switch / handover)">
                <select value={form.accessState} onChange={(e) => setForm({ ...form, accessState: e.target.value })} className={SELECT_CLASS}>
                  {ACCESS_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-charcoal-80/65">
                  The nightly dunning job suspends a project whose invoice has been overdue longer than the grace period and reinstates it once paid. Handover is refused (409) while any invoice is unpaid.
                </p>
              </Field>
            </div>
          )}
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

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!isNew && project && (
            <button
              type="button" onClick={handleCaseStudyDraft} disabled={draftingCase}
              title="Creates a draft Portfolio entry (context, problem, milestones as approach) you can edit before publishing"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet/30 bg-white px-4 py-2 text-sm font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-60"
            >
              {draftingCase ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              Draft case study
            </button>
          )}
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

      {/* T5-5 · the tracking code. Read off an invoice by a client who then
          types it into /track, so the operator needs it copyable rather than
          only visible. It is assigned at creation and never changes. */}
      {!isNew && project?.trackingCode && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-card font-bold text-violet">Tracking code</h2>
              <p className="mt-0.5 text-meta text-charcoal-80/65">
                The client can check progress at /track with this, without signing in. It shows phase,
                milestones and how many documents are outstanding — never amounts, names or file names.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded-lg bg-charcoal-80/5 px-3 py-2 font-mono text-[13px] tracking-[0.12em] text-charcoal">{project.trackingCode}</code>
              <button
                type="button" onClick={copyTrackingCode}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-deep"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* T5-5 · documents we are waiting on from this client. */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-card font-bold text-violet">Documents from the client</h2>
              <p className="mt-0.5 text-meta text-charcoal-80/65">
                The client sees these in their dashboard and in the portal, and is emailed when one is raised or reviewed.
              </p>
            </div>
            {/* The invoice form wants a service-order cuid, which is otherwise
                copied by hand from another page. */}
            {project.serviceOrderId && (
              <Link
                to={`/admin/invoices?serviceOrderId=${encodeURIComponent(project.serviceOrderId)}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet/30 px-3 py-2 text-sm font-semibold text-violet transition hover:bg-violet-pale"
              >
                <Receipt className="h-4 w-4" /> Issue an invoice
              </Link>
            )}
          </div>
          <div className="mt-4">
            <ProjectRequestsAdmin projectId={id} milestones={project.milestones || []} />
          </div>
        </div>
      )}

      {/* T5-17 · who else may reach this project. Above the credential
          handoff because "who is on this" is the question you answer first. */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <h2 className="text-card font-bold text-violet">People on this project</h2>
          <p className="mt-0.5 max-w-prose text-meta text-charcoal-80/65">
            The account holder always has full access. Add the people who actually do the work — an
            approver signs off milestones and quotes, a viewer reads, uploads and comments. No
            account needed: they get in with the tracking code and a PIN sent to their own inbox.
          </p>
          <div className="mt-4">
            <ProjectMembersAdmin projectId={id} />
          </div>
        </div>
      )}

      {/* T5-13 · the secure credential handoff, immediately below the
          document requests — because that is where an operator is standing
          when they are about to ask for a password by the wrong route. */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <h2 className="text-card font-bold text-violet">Credentials</h2>
          <p className="mt-0.5 max-w-prose text-meta text-charcoal-80/65">
            Read once, then destroyed. Both directions: hand over admin access at handover, and
            collect a hosting password without it living in an inbox or on disk.
          </p>
          <div className="mt-4">
            <ProjectSecretsAdmin projectId={id} />
          </div>
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
                    {/* T5-12 · the estimate, editable inline.
                        Separate from "Due" beside it on purpose: due is what
                        was AGREED and what a slip is measured against;
                        this is what we now believe. Moving it by more than
                        two days writes a public milestone.rescheduled event,
                        so the client learns from the tracker rather than on
                        the day. */}
                    <label className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-charcoal-80/65">
                      <span className="font-semibold">Now expected</span>
                      <input
                        type="date"
                        defaultValue={m.estimatedAt ? new Date(m.estimatedAt).toISOString().slice(0, 10) : ""}
                        onBlur={(e) => handleMilestoneEstimate(m, e.target.value)}
                        className="rounded-md border border-charcoal-80/15 bg-white px-2 py-1 text-[11px] text-charcoal-80 focus:border-violet focus:outline-none"
                        aria-label={`Expected date for ${m.title}`}
                      />
                      {m.dueDate && m.estimatedAt && new Date(m.estimatedAt) > new Date(m.dueDate) ? (
                        <span className="font-semibold text-amber-700">past the agreed date</span>
                      ) : null}
                    </label>
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
                    {/* T5-14 · the read receipt. Admin-only by design — a
                        client shown "you opened this on Tuesday" is being
                        watched; an operator who knows whether the deliverable
                        was ever looked at is the difference between chasing
                        and waiting.
                        "Not opened yet" is stated rather than left blank: an
                        absent line reads as "no data", and the whole value
                        here is being able to tell those two apart. */}
                    {f.uploadedByRole !== "client" ? (
                      <div className="mt-0.5 font-mono text-[11px]">
                        {f.firstViewedAt ? (
                          <span className="text-mint-700">
                            Seen {new Date(f.firstViewedAt).toLocaleDateString()}
                            {f.viewCount > 1 ? ` · ${f.viewCount} opens` : ""}
                          </span>
                        ) : (
                          <span className="text-charcoal-80/65">Not opened yet</span>
                        )}
                      </div>
                    ) : null}
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

      {/* Tier 4 · change requests (client-initiated extra work) */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <h2 className="text-card font-bold text-violet">Change requests</h2>
          <p className="mt-0.5 text-meta text-charcoal-80/65">
            Extra work the client asked for. Send a quote — the client is emailed and can accept it (creates a payable order + a milestone) or decline it.
          </p>
          <div className="mt-4 space-y-3">
            {(project.changeRequests || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-charcoal-80/15 px-4 py-6 text-center text-meta text-charcoal-80/65">No change requests yet.</div>
            ) : (project.changeRequests || []).map((cr) => (
              <ChangeRequestRow
                key={cr.id} cr={cr} currency={project.serviceOrder?.order?.currency || "MXN"}
                onQuote={async (payload) => {
                  try { await quoteChangeRequest(id, cr.id, payload); showSuccess("Quote sent to the client"); load() }
                  catch (err) { showError(err.message || "Could not send quote") }
                }}
                onDone={async () => {
                  try { await completeChangeRequest(id, cr.id); showSuccess("Marked done"); load() }
                  catch (err) { showError(err.message || "Could not update") }
                }}
              />
            ))}
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

      {/* T5-5 · the full timeline, admin visibility: everything the client
          sees plus the rows written narrower than "client". */}
      {!isNew && project && (
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
          <h2 className="text-card font-bold text-violet">Timeline</h2>
          <p className="mt-0.5 mb-4 text-meta text-charcoal-80/65">
            Every recorded event on this project. The client sees a subset; /track sees less again.
          </p>
          <ProjectTimeline events={adminEvents} loading={eventsLoading} />
        </div>
      )}
    </section>
  )
}

/* ── Tier 4 · change request row ─────────────────────────────────────── */
const CR_STATUS_LABEL = { requested: "Awaiting quote", quoted: "Quoted", accepted: "Accepted · awaiting payment", declined: "Declined", done: "Done" }
const CR_STATUS_PILL  = { requested: "pending", quoted: "processing", accepted: "active", declined: "inactive", done: "completed" }

function ChangeRequestRow({ cr, currency, onQuote, onDone }) {
  const [amount, setAmount] = useState(cr.quoteAmount != null ? String(cr.quoteAmount) : "")
  const [note, setNote] = useState(cr.quoteNote || "")
  const [busy, setBusy] = useState(false)
  const open = cr.status === "requested" || cr.status === "quoted"
  const send = async () => {
    if (!(Number(amount) > 0)) return
    setBusy(true)
    try { await onQuote({ amount: Number(amount), note, currency: cr.quoteCurrency || currency }) } finally { setBusy(false) }
  }
  return (
    <div className={`rounded-xl border p-4 ${cr.status === "requested" ? "border-amber-300/60" : "border-charcoal-80/10"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-meta font-semibold text-charcoal-80">{cr.title}</h3>
        <StatusPill status={CR_STATUS_PILL[cr.status] || "pending"} label={CR_STATUS_LABEL[cr.status] || cr.status} />
        <span className="font-mono text-[11px] text-charcoal-80/65">{fmtWhen(cr.createdAt)}</span>
        {cr.quoteAmount != null && (
          <span className="font-mono text-[11px] font-semibold text-violet">
            {Number(cr.quoteAmount).toFixed(2)} {cr.quoteCurrency || currency}
          </span>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-micro text-charcoal-80/75">{cr.description}</p>
      {cr.orderId && (
        <Link to={`/admin/orders/${cr.orderId}`} className="mt-2 inline-block text-micro font-semibold text-violet hover:underline">Open order →</Link>
      )}
      {open && (
        <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-end">
          <Field label={`Quote (${cr.quoteCurrency || currency})`} required>
            <Input type="number" value={amount} onChange={setAmount} placeholder="0.00" />
          </Field>
          <Field label="Note to the client">
            <textarea
              rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
            />
          </Field>
          <button
            type="button" onClick={send} disabled={busy || !(Number(amount) > 0)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet px-4 py-2.5 text-meta font-semibold text-white transition hover:bg-violet/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {cr.status === "quoted" ? "Re-send quote" : "Send quote"}
          </button>
        </div>
      )}
      {cr.status === "accepted" && (
        <button
          type="button" onClick={onDone}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-mint/30 bg-white px-3 py-1.5 text-micro font-semibold text-mint-700 hover:bg-mint/10"
        >
          <Check className="h-3.5 w-3.5" /> Mark done
        </button>
      )}
    </div>
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
