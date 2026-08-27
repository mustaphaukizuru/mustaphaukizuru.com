import { useCallback, useMemo, useRef, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Briefcase, Calendar, Download, CheckCircle2, Clock, AlertCircle,
  User as UserIcon, Hourglass, ExternalLink, Eye, UploadCloud, MessageSquare,
  Lock, ThumbsUp, RotateCcw, Send, Check, X, Loader2, Image as ImageIcon,
} from "lucide-react"
import {
  fetchMyProject, uploadMyProjectFiles, postMyProjectComment,
  approveMyMilestone, requestMyMilestoneChanges,
} from "../services/clientProjectService"
import useApiQuery from "../hooks/useApiQuery"
import { SkeletonCard, Button, Modal, Textarea, Select, InlineBanner } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import { API_BASE_URL } from "../lib/api"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"
import { useToast } from "../context/ToastContext"
import ProjectSupportPanel from "../components/projects/ProjectSupportPanel"

/* ── constants ─────────────────────────────────────────────────────────── */
const MAX_FILES = 10
const MAX_BYTES = 50 * 1024 * 1024
// Mirrors ALLOWED_EXT in src/middleware/uploadProjectFile.js — keep in sync.
const ALLOWED_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".pdf", ".zip", ".txt", ".md", ".csv", ".json",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".fig", ".sketch", ".ai", ".psd",
])
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"])
const EXPIRED = Symbol("expired")

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"
const fmtDateTime = (d) => d ? new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""
const extOf = (name) => {
  const i = String(name || "").lastIndexOf(".")
  return i >= 0 ? String(name).slice(i).toLowerCase() : ""
}

const MILESTONE_ICON = {
  pending: Hourglass,
  in_progress: Clock,
  awaiting_client: Eye,
  approved: ThumbsUp,
  completed: CheckCircle2,
}
const MILESTONE_TONE = {
  completed: "bg-mint/15 text-mint-700",
  approved: "bg-mint/15 text-mint-700",
  awaiting_client: "bg-violet-pale text-violet",
  in_progress: "bg-amber/10 text-amber-700",
  pending: "bg-charcoal-80/5 text-charcoal-80",
}

/**
 * fileDownloadUrl · CPM security · routes file downloads through the
 * authenticated streaming endpoint. The endpoint verifies ownership
 * server-side; the session cookie authenticates <img> and <a> alike.
 */
function fileDownloadUrl(projectId, fileId) {
  const base = (API_BASE_URL || "").replace(/\/$/, "")
  return `${base}/api/v1/member/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`
}

const CARD = "rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]"
const EMPTY = "rounded-xl border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-6 text-center text-meta text-charcoal-80/65"

/* ════════════════════════════════════════════════════════════════════════ */

export default function DashboardProjectDetailPage() {
  const { t } = useTranslation("dashboard")
  const { id } = useParams()
  const { showSuccess, showError } = useToast()

  const { data: project = null, loading, error, refetch, setData } = useApiQuery(
    `projects:${id}`,
    async () => {
      try { return await fetchMyProject(id) }
      catch (e) {
        // 410 PROJECT_EXPIRED is a state, not a failure — render it as such.
        if (e?.code === "PROJECT_EXPIRED" || e?.status === 410) return EXPIRED
        throw e
      }
    },
    { enabled: Boolean(id), select: (data) => data || null }
  )

  const milestoneLabel = useCallback((status) => {
    const key = `projects.detail.status.${status}`
    const label = t(key)
    return label === key ? undefined : label
  }, [t])

  if (loading) return <section><SkeletonCard height="h-[400px]" /></section>

  if (project === EXPIRED) {
    return (
      <section className="space-y-4">
        <BackLink t={t} />
        <div className={`${CARD} text-center`}>
          <Lock className="mx-auto h-8 w-8 text-charcoal-80" aria-hidden="true" />
          <h1 className="mt-3 text-card font-bold text-violet">{t("projects.detail.expired.title")}</h1>
          <p className="mt-1 text-meta text-charcoal-80/65">{t("projects.detail.expired.body")}</p>
        </div>
      </section>
    )
  }

  if (error || !project) {
    return (
      <section className="space-y-4">
        <BackLink t={t} />
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error || t("projects.errors.notFound")}
        </div>
      </section>
    )
  }

  const access = project.access || { readOnly: false, isClosed: false, expiresAt: null }
  const readOnly = Boolean(access.readOnly)
  const milestones = project.milestones || []
  const files = project.files || []
  const comments = project.comments || []
  const done = milestones.filter((ms) => ms.status === "completed" || ms.status === "approved").length
  const pct = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0
  const threadComments = comments.filter((c) => !c.milestoneId && !c.fileId)

  /* ── local mutations (optimistic where cheap) ────────────────────────── */
  const patchMilestone = (milestoneId, patch) => setData((prev) => prev && {
    ...prev,
    milestones: prev.milestones.map((ms) => ms.id === milestoneId ? { ...ms, ...patch } : ms),
  })
  const appendComment = (comment) => setData((prev) => prev && { ...prev, comments: [...(prev.comments || []), comment] })

  const handleApprove = async (milestone, note) => {
    const snapshot = milestone
    patchMilestone(milestone.id, { status: "approved", approvedAt: new Date().toISOString(), clientNote: note || null, changesRequestedAt: null })
    try {
      const saved = await approveMyMilestone(project.id, milestone.id, { note })
      if (saved?.id) patchMilestone(milestone.id, saved)
      showSuccess(t("projects.detail.toast.approved"))
    } catch (e) {
      patchMilestone(milestone.id, snapshot)
      showError(e?.message || t("projects.detail.toast.failed"))
      refetch()
    }
  }
  const handleRequestChanges = async (milestone, note) => {
    const saved = await requestMyMilestoneChanges(project.id, milestone.id, { note })
    patchMilestone(milestone.id, saved?.id ? saved : { status: "in_progress", changesRequestedAt: new Date().toISOString(), clientNote: note })
    showSuccess(t("projects.detail.toast.changesRequested"))
  }
  const handleComment = async ({ body, milestoneId, fileId }) => {
    const saved = await postMyProjectComment(project.id, { body, milestoneId, fileId })
    if (saved?.id) appendComment(saved)
    else refetch()
  }

  return (
    <section className="space-y-6">
      <BackLink t={t} />

      {access.isClosed && (
        <InlineBanner tone="warning" icon={Lock} title={t("projects.detail.closed.title")}>
          {t("projects.detail.closed.body", { date: fmtDate(access.expiresAt) })}
        </InlineBanner>
      )}

      {/* Header */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Briefcase className="h-5 w-5 text-violet" aria-hidden="true" />
              <h1 className="text-card font-bold text-violet">{project.projectName}</h1>
              <StatusPill status={project.projectStatus} />
            </div>
            {project.description && (
              <p className="mt-2 max-w-2xl text-meta text-charcoal-80/75">{project.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px] text-charcoal-80/65">
              <span><Calendar className="mr-1 inline h-3 w-3" />{t("projects.detail.started", { date: fmtDate(project.startDate) })}</span>
              <span><Calendar className="mr-1 inline h-3 w-3" />{t("projects.detail.due", { date: fmtDate(project.dueDate) })}</span>
              {project.assignedAdmin && (
                <span><UserIcon className="mr-1 inline h-3 w-3" />{t("projects.detail.lead", { name: project.assignedAdmin.fullName })}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/65">{t("projects.detail.progress")}</div>
            <div className="font-mono text-display font-bold tabular-nums text-violet">{pct}%</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-pale" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Milestones */}
      <SectionBlock title={t("projects.detail.timeline")} subtitle={t("projects.detail.milestones", { count: milestones.length })}>
        {milestones.length === 0 ? (
          <div className={EMPTY}>{t("projects.detail.noMilestones")}</div>
        ) : milestones.map((ms, idx) => (
          <MilestoneCard
            key={ms.id}
            index={idx}
            milestone={ms}
            comments={comments.filter((c) => c.milestoneId === ms.id)}
            readOnly={readOnly}
            label={milestoneLabel(ms.status)}
            onApprove={handleApprove}
            onRequestChanges={handleRequestChanges}
            onComment={handleComment}
            t={t}
          />
        ))}
      </SectionBlock>

      {/* Preview */}
      {project.previewUrl && (
        <SectionBlock title={t("projects.detail.preview.title")} subtitle={t("projects.detail.preview.subtitle")}>
          <div className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-pale text-violet">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                </div>
                <a
                  href={project.previewUrl} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 truncate font-mono text-[12px] text-violet hover:underline"
                >
                  {project.previewUrl}
                </a>
              </div>
              <Button as="a" href={project.previewUrl} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary" icon={ExternalLink}>
                {t("projects.detail.preview.open")}
              </Button>
            </div>
            {project.previewCanFrame && (
              <div className="mt-4 overflow-hidden rounded-lg border border-charcoal-80/10 bg-charcoal-80/5" style={{ aspectRatio: "16 / 10" }}>
                <iframe
                  src={project.previewUrl}
                  title={t("projects.detail.preview.frameTitle", { name: project.projectName })}
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  loading="lazy"
                  className="h-full w-full"
                />
              </div>
            )}
          </div>
        </SectionBlock>
      )}

      {/* Files */}
      <SectionBlock title={t("projects.detail.deliverables")} subtitle={t("projects.detail.files", { count: files.length })}>
        {!readOnly && (
          <Dropzone
            projectId={project.id}
            milestones={milestones}
            onUploaded={() => { showSuccess(t("projects.detail.toast.uploaded")); refetch() }}
            t={t}
          />
        )}
        <FileGallery
          projectId={project.id}
          files={files.filter((f) => f.uploadedByRole !== "client")}
          title={t("projects.detail.gallery.team")}
          empty={t("projects.detail.gallery.teamEmpty")}
          t={t}
        />
        <FileGallery
          projectId={project.id}
          files={files.filter((f) => f.uploadedByRole === "client")}
          title={t("projects.detail.gallery.yours")}
          empty={t("projects.detail.gallery.yoursEmpty")}
          t={t}
        />
      </SectionBlock>

      {/* Project thread */}
      <SectionBlock title={t("projects.detail.thread.title")} subtitle={t("projects.detail.thread.subtitle")}>
        <div className={CARD}>
          <CommentList comments={threadComments} empty={t("projects.detail.thread.empty")} t={t} />
          <ReplyBox
            className="mt-4"
            readOnly={readOnly}
            placeholder={t("projects.detail.thread.placeholder")}
            onSubmit={(body) => handleComment({ body })}
            t={t}
          />
        </div>
      </SectionBlock>

      {/* Support tickets scoped to this project — status next to the
          project's, attachments via the same private file pipeline. */}
      <SectionBlock title={t("projects.support.title")} subtitle={t("projects.support.subtitle")}>
        <ProjectSupportPanel projectId={project.id} readOnly={readOnly} milestones={project.milestones || []} />
      </SectionBlock>
    </section>
  )
}

/* ── layout bits ───────────────────────────────────────────────────────── */

function BackLink({ t }) {
  return (
    <Link to="/dashboard/projects" className="inline-flex items-center gap-1 text-meta text-violet hover:underline">
      <ArrowLeft className="h-4 w-4" /> {t("projects.detail.back")}
    </Link>
  )
}

function SectionBlock({ title, subtitle, children }) {
  return (
    <div>
      <h2 className="text-card font-bold text-violet">{title}</h2>
      {subtitle && <p className="mt-0.5 text-meta text-charcoal-80/65">{subtitle}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

/* ── milestone card ────────────────────────────────────────────────────── */

function MilestoneCard({ milestone: ms, index, comments, readOnly, label, onApprove, onRequestChanges, onComment, t }) {
  const [approveOpen, setApproveOpen] = useState(false)
  const [changesOpen, setChangesOpen] = useState(false)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState("")
  const Icon = MILESTONE_ICON[ms.status] || Hourglass
  const tone = MILESTONE_TONE[ms.status] || MILESTONE_TONE.pending
  const awaiting = ms.status === "awaiting_client" && !readOnly

  const closeAll = () => { setApproveOpen(false); setChangesOpen(false); setNote(""); setFormError("") }

  const submitApprove = async () => {
    setBusy(true)
    closeAll()
    await onApprove(ms, note.trim())
    setBusy(false)
  }
  const submitChanges = async () => {
    if (!note.trim()) { setFormError(t("projects.detail.actions.noteRequired")); return }
    setBusy(true)
    try {
      await onRequestChanges(ms, note.trim())
      closeAll()
    } catch (e) {
      setFormError(e?.message || t("projects.detail.toast.failed"))
    } finally { setBusy(false) }
  }

  return (
    <m.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className={`rounded-xl border bg-white p-4 ${awaiting ? "border-violet/40 shadow-[var(--shadow-e3)]" : "border-charcoal-80/10"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-meta font-semibold text-charcoal-80">{ms.title}</h3>
            <StatusPill status={ms.status} label={label} />
          </div>
          {ms.description && <p className="mt-1 text-micro text-charcoal-80/65">{ms.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-charcoal-80/65">
            {ms.dueDate && <span>{t("projects.detail.milestoneDue", { date: fmtDate(ms.dueDate) })}</span>}
            {ms.approvedAt && <span>{t("projects.detail.milestoneApproved", { date: fmtDate(ms.approvedAt) })}</span>}
            {ms.completedAt && <span>{t("projects.detail.milestoneCompleted", { date: fmtDate(ms.completedAt) })}</span>}
          </div>

          {ms.clientNote && (
            <div className="mt-3 rounded-lg border border-charcoal-80/10 bg-charcoal-80/5 px-3 py-2 text-micro text-charcoal-80">
              <span className="font-semibold">
                {ms.changesRequestedAt
                  ? t("projects.detail.changesRequestedOn", { date: fmtDate(ms.changesRequestedAt) })
                  : t("projects.detail.yourNote")}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{ms.clientNote}</p>
            </div>
          )}

          {awaiting && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" icon={Check} loading={busy} onClick={() => { setApproveOpen(true); setChangesOpen(false) }}>
                {t("projects.detail.actions.approve")}
              </Button>
              <Button size="sm" variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => { setChangesOpen(true); setApproveOpen(false) }}>
                {t("projects.detail.actions.requestChanges")}
              </Button>
            </div>
          )}

          <AnimatePresence initial={false}>
            {approveOpen && (
              <m.div key="approve" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-3 space-y-2 rounded-lg border border-violet/15 bg-violet-pale/30 p-3">
                  <Textarea
                    rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
                    label={t("projects.detail.actions.approveNoteLabel")}
                    placeholder={t("projects.detail.actions.approveNotePlaceholder")}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" icon={Check} onClick={submitApprove}>{t("projects.detail.actions.confirmApprove")}</Button>
                    <Button size="sm" variant="ghost" icon={X} onClick={closeAll}>{t("projects.detail.actions.cancel")}</Button>
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>

          <Modal
            open={changesOpen}
            onClose={closeAll}
            size="sm"
            title={t("projects.detail.actions.requestChangesTitle", { title: ms.title })}
            description={t("projects.detail.actions.requestChangesBody")}
            footer={(
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeAll} disabled={busy}>{t("projects.detail.actions.cancel")}</Button>
                <Button icon={Send} loading={busy} onClick={submitChanges}>{t("projects.detail.actions.send")}</Button>
              </div>
            )}
          >
            <Textarea
              rows={4} value={note} onChange={(e) => { setNote(e.target.value); setFormError("") }}
              maxLength={2000} required error={formError}
              label={t("projects.detail.actions.changesNoteLabel")}
              placeholder={t("projects.detail.actions.changesNotePlaceholder")}
            />
          </Modal>

          {(comments.length > 0 || !readOnly) && (
            <div className="mt-4 border-t border-charcoal-80/10 pt-3">
              <CommentList comments={comments} compact t={t} />
              <ReplyBox
                className={comments.length ? "mt-3" : ""}
                compact
                readOnly={readOnly}
                placeholder={t("projects.detail.thread.milestonePlaceholder")}
                onSubmit={(body) => onComment({ body, milestoneId: ms.id })}
                t={t}
              />
            </div>
          )}
        </div>
      </div>
    </m.div>
  )
}

/* ── comments ──────────────────────────────────────────────────────────── */

function CommentList({ comments, empty, compact = false, t }) {
  if (!comments.length) {
    return empty ? (
      <div className="flex items-center justify-center gap-2 py-4 text-meta text-charcoal-80/65">
        <MessageSquare className="h-4 w-4" aria-hidden="true" /> {empty}
      </div>
    ) : null
  }
  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {comments.map((c) => {
        const isTeam = c.authorRole === "admin"
        return (
          <li key={c.id} className={`rounded-lg px-3 py-2 ${isTeam ? "bg-violet-pale/40" : "bg-charcoal-80/5"}`}>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-charcoal-80/65">
              <span className="font-semibold text-charcoal-80">
                {c.author?.fullName || (isTeam ? t("projects.detail.thread.team") : t("projects.detail.thread.you"))}
              </span>
              <span className={`rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${isTeam ? "bg-violet-pale text-violet" : "bg-azure/10 text-azure-deep"}`}>
                {isTeam ? t("projects.detail.thread.roleTeam") : t("projects.detail.thread.roleClient")}
              </span>
              <span>{fmtDateTime(c.createdAt)}</span>
              {c.resolvedAt && (
                <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-mint-700">
                  <Check className="h-2.5 w-2.5" aria-hidden="true" /> {t("projects.detail.thread.resolved")}
                </span>
              )}
            </div>
            <p className={`mt-1 whitespace-pre-wrap ${compact ? "text-micro" : "text-meta"} ${c.resolvedAt ? "text-charcoal-80/65" : "text-charcoal-80"}`}>{c.body}</p>
          </li>
        )
      })}
    </ul>
  )
}

function ReplyBox({ onSubmit, readOnly, placeholder, compact = false, className = "", t }) {
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const submit = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true); setErr("")
    try {
      await onSubmit(text)
      setBody("")
    } catch (ex) {
      setErr(ex?.message || t("projects.detail.toast.failed"))
    } finally { setBusy(false) }
  }
  if (readOnly) {
    return (
      <p className={`${className} flex items-center gap-1.5 text-micro text-charcoal-80/65`}>
        <Lock className="h-3 w-3" aria-hidden="true" /> {t("projects.detail.thread.readOnly")}
      </p>
    )
  }
  return (
    <form onSubmit={submit} className={`${className} flex flex-col gap-2`}>
      <Textarea
        rows={compact ? 1 : 3} autoGrow value={body} onChange={(e) => setBody(e.target.value)}
        maxLength={5000} placeholder={placeholder} error={err} aria-label={placeholder}
        inputClass={compact ? "py-2 text-[13px]" : ""}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e) }}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant={compact ? "secondary" : "primary"} icon={Send} loading={busy} disabled={!body.trim()}>
          {t("projects.detail.thread.send")}
        </Button>
      </div>
    </form>
  )
}

/* ── files ─────────────────────────────────────────────────────────────── */

function FileGallery({ projectId, files, title, empty, t }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-charcoal-80/65">{title} · {files.length}</h3>
      {files.length === 0 ? (
        <div className={EMPTY}>{empty}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((f) => <FileTile key={f.id} projectId={projectId} file={f} t={t} />)}
        </ul>
      )}
    </div>
  )
}

function FileTile({ projectId, file: f, t }) {
  const [imgFailed, setImgFailed] = useState(false)
  const href = fileDownloadUrl(projectId, f.id)
  const ext = extOf(f.fileName)
  const isImage = !imgFailed && (IMAGE_EXT.has(ext) || /^image\/(png|jpe?g|gif|webp)/i.test(f.fileType || ""))
  const { icon: Icon, label, chip, iconColor } = getFileTypeStyles(f.fileName || f.fileType)
  const isTeam = f.uploadedByRole !== "client"
  return (
    <li>
      <a
        href={href} target="_blank" rel="noopener noreferrer"
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white transition hover:border-violet/30 hover:shadow-[var(--shadow-e3)]"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center bg-charcoal-80/5">
          {isImage ? (
            <img src={href} alt={f.fileName} loading="lazy" decoding="async" onError={() => setImgFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <Icon className={`h-10 w-10 ${iconColor}`} aria-hidden="true" />
          )}
          <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${chip}`}>{label}</span>
          {f.isDeliverable && (
            <span className="absolute right-2 top-2 rounded-full bg-mint/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-mint-700">
              {t("projects.detail.gallery.deliverable")}
            </span>
          )}
        </div>
        <div className="flex flex-1 items-start justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-meta font-semibold text-charcoal-80" title={f.fileName}>{f.fileName}</div>
            <div className="mt-0.5 font-mono text-[11px] text-charcoal-80/65">
              {[formatFileSize(f.fileSize), isTeam ? t("projects.detail.gallery.byTeam") : t("projects.detail.gallery.byYou"), fmtDate(f.createdAt)].filter(Boolean).join(" · ")}
            </div>
          </div>
          <Download className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden="true" />
        </div>
      </a>
    </li>
  )
}

/* ── dropzone ──────────────────────────────────────────────────────────── */

function Dropzone({ projectId, milestones, onUploaded, t }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problems, setProblems] = useState([])
  const [milestoneId, setMilestoneId] = useState("")
  const options = useMemo(() => [
    { value: "", label: t("projects.detail.upload.noMilestone") },
    ...milestones.map((ms) => ({ value: ms.id, label: ms.title })),
  ], [milestones, t])

  const validate = (list) => {
    const errs = []
    if (list.length > MAX_FILES) errs.push(t("projects.detail.upload.tooMany", { max: MAX_FILES }))
    for (const f of list.slice(0, MAX_FILES)) {
      const ext = extOf(f.name)
      if (!ALLOWED_EXT.has(ext)) errs.push(t("projects.detail.upload.badType", { name: f.name }))
      else if (f.size > MAX_BYTES) errs.push(t("projects.detail.upload.tooBig", { name: f.name, size: formatFileSize(MAX_BYTES) }))
    }
    return errs
  }

  const handleFiles = async (fileList) => {
    const list = Array.from(fileList || [])
    if (!list.length || busy) return
    const errs = validate(list)
    setProblems(errs)
    if (errs.length) return
    setBusy(true)
    try {
      await uploadMyProjectFiles(projectId, list, { milestoneId: milestoneId || undefined })
      if (inputRef.current) inputRef.current.value = ""
      onUploaded?.()
    } catch (e) {
      setProblems([e?.message || t("projects.detail.toast.failed")])
    } finally { setBusy(false) }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    handleFiles(e.dataTransfer?.files)
  }
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click() }
  }

  return (
    <div className={`${CARD} space-y-3`}>
      <div
        role="button" tabIndex={busy ? -1 : 0} aria-disabled={busy} aria-label={t("projects.detail.upload.title")}
        onClick={() => !busy && inputRef.current?.click()} onKeyDown={onKey}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)} onDrop={onDrop}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          dragging ? "border-violet bg-violet-pale/40" : "border-charcoal-80/15 bg-violet-pale/20 hover:border-violet/40",
          busy ? "cursor-wait opacity-60" : "",
        ].join(" ")}
      >
        {busy
          ? <Loader2 className="h-7 w-7 animate-spin text-violet" aria-hidden="true" />
          : <UploadCloud className="h-7 w-7 text-violet" aria-hidden="true" />}
        <div className="text-meta font-semibold text-charcoal-80">
          {busy ? t("projects.detail.upload.uploading") : t("projects.detail.upload.title")}
        </div>
        <div className="text-micro text-charcoal-80/65">{t("projects.detail.upload.hint", { max: MAX_FILES, size: formatFileSize(MAX_BYTES) })}</div>
        <div className="font-mono text-[10px] text-charcoal-80/65">{[...ALLOWED_EXT].map((x) => x.slice(1)).join(" · ")}</div>
        <input
          ref={inputRef} type="file" multiple className="hidden" disabled={busy}
          accept={[...ALLOWED_EXT].join(",")}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {milestones.length > 0 && (
        <Select
          label={t("projects.detail.upload.milestoneLabel")}
          value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}
          options={options} disabled={busy} className="max-w-sm"
        />
      )}

      {problems.length > 0 && (
        <InlineBanner tone="danger" onDismiss={() => setProblems([])}>
          <ul className="list-disc space-y-0.5 pl-4">
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </InlineBanner>
      )}
      <p className="flex items-center gap-1.5 text-micro text-charcoal-80/65">
        <ImageIcon className="h-3 w-3" aria-hidden="true" /> {t("projects.detail.upload.imagesHint")}
      </p>
    </div>
  )
}
