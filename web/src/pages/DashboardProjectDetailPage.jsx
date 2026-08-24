import { useParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft, Briefcase, Calendar, FileText, Download, CheckCircle2,
  Clock, AlertCircle, User as UserIcon, Hourglass,
} from "lucide-react"
import { fetchMyProject } from "../services/clientProjectService"
import useApiQuery from "../hooks/useApiQuery"
import { SkeletonCard } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import { API_BASE_URL } from "../lib/api"

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : ","

const MILESTONE_ICON = {
  pending: Hourglass,
  in_progress: Clock,
  completed: CheckCircle2,
}

/**
 * fileDownloadUrl · CPM security · routes file downloads through the
 * authenticated streaming endpoint that replaced the previous public
 * static-serve path. The endpoint verifies ownership server-side, so a
 * leaked URL by itself can't expose a deliverable to anyone but the
 * project owner. authFetch handles the bearer token.
 */
function fileDownloadUrl(projectId, fileId) {
  const base = (API_BASE_URL || "").replace(/\/$/, "")
  return `${base}/api/v1/member/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`
}

export default function DashboardProjectDetailPage() {
  const { t } = useTranslation("dashboard")
  const { id } = useParams()
  const { data: project = null, loading, error } = useApiQuery(
    `projects:${id}`,
    () => fetchMyProject(id),
    { enabled: Boolean(id), select: (data) => data || null }
  )

  if (loading) return <section><SkeletonCard height="h-[400px]" /></section>

  if (error || !project) {
    return (
      <section className="space-y-4">
        <Link to="/dashboard/projects" className="inline-flex items-center gap-1 text-meta text-violet hover:underline">
          <ArrowLeft className="h-4 w-4" /> {t("projects.detail.back")}
        </Link>
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error || t("projects.errors.notFound")}
        </div>
      </section>
    )
  }

  const completed = project.milestones.filter((m) => m.status === "completed").length
  const pct = project.milestones.length > 0 ? Math.round((completed / project.milestones.length) * 100) : 0

  return (
    <section className="space-y-6">
      <Link to="/dashboard/projects" className="inline-flex items-center gap-1 text-meta text-violet hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t("projects.detail.back")}
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-violet" aria-hidden="true" />
              <h1 className="text-card font-bold text-violet">{project.projectName}</h1>
              <StatusPill status={project.projectStatus} />
            </div>
            {project.description && (
              <p className="mt-2 max-w-2xl text-meta text-charcoal-80/75">{project.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px] text-charcoal-80/55">
              <span><Calendar className="inline h-3 w-3 mr-1" />{t("projects.detail.started", { date: fmtDate(project.startDate) })}</span>
              <span><Calendar className="inline h-3 w-3 mr-1" />{t("projects.detail.due",     { date: fmtDate(project.dueDate)   })}</span>
              {project.assignedAdmin && (
                <span><UserIcon className="inline h-3 w-3 mr-1" />{t("projects.detail.lead", { name: project.assignedAdmin.fullName })}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/55">{t("projects.detail.progress")}</div>
            <div className="font-mono text-display font-bold tabular-nums text-violet">{pct}%</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-violet-pale" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Milestones */}
      <div>
        <h2 className="text-card font-bold text-violet">{t("projects.detail.timeline")}</h2>
        <p className="mt-0.5 text-meta text-charcoal-80/65">
          {t("projects.detail.milestones", { count: project.milestones.length })}
        </p>
        <div className="mt-4 space-y-3">
          {project.milestones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-6 text-center text-meta text-charcoal-80/55">
              {t("projects.detail.noMilestones")}
            </div>
          ) : project.milestones.map((m, idx) => {
            const Icon = MILESTONE_ICON[m.status] || Hourglass
            const tone = m.status === "completed" ? "bg-mint/15 text-mint border-mint/30"
                       : m.status === "in_progress" ? "bg-amber/10 text-amber-700 border-amber/20"
                       : "bg-charcoal-80/5 text-charcoal-80/65 border-charcoal-80/10"
            return (
              <m.div
                key={m.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className={`flex items-start gap-3 rounded-xl border p-4 ${tone.replace(/text-\S+|bg-\S+/g, "").trim()} bg-white border-charcoal-80/10`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-meta font-semibold text-charcoal-80">{m.title}</h3>
                    <StatusPill status={m.status} />
                  </div>
                  {m.description && <p className="mt-1 text-micro text-charcoal-80/65">{m.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-charcoal-80/45">
                    {m.dueDate && <span>{t("projects.detail.milestoneDue", { date: fmtDate(m.dueDate) })}</span>}
                    {m.completedAt && <span>{t("projects.detail.milestoneCompleted", { date: fmtDate(m.completedAt) })}</span>}
                  </div>
                </div>
              </m.div>
            )
          })}
        </div>
      </div>

      {/* Files */}
      <div>
        <h2 className="text-card font-bold text-violet">{t("projects.detail.deliverables")}</h2>
        <p className="mt-0.5 text-meta text-charcoal-80/65">
          {t("projects.detail.files", { count: project.files.length })}
        </p>
        <div className="mt-4 space-y-2">
          {project.files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-6 text-center text-meta text-charcoal-80/55">
              {t("projects.detail.noFiles")}
            </div>
          ) : project.files.map((f) => (
            <a
              key={f.id}
              href={fileDownloadUrl(project.id, f.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-80/10 bg-white px-4 py-3 transition hover:border-violet/30 hover:bg-violet-pale/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-pale text-violet">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-meta font-semibold text-charcoal-80">{f.fileName}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-charcoal-80/55">
                    {f.fileType || t("projects.detail.fileFallback")} · {fmtDate(f.createdAt)}
                  </div>
                </div>
              </div>
              <Download className="h-4 w-4 shrink-0 text-violet" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
