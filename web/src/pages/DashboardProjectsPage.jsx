import { LocalizedLink as Link } from "../components/LocalizedLink"
import { useTranslation } from "react-i18next"
import { m } from "framer-motion"
import { AlertCircle, Archive, ArrowRight, Briefcase, Calendar, CheckCircle2, FileText } from "lucide-react"
import { fetchMyProjects } from "../services/clientProjectService"
import useApiQuery from "../hooks/useApiQuery"
import { MetricCard, SkeletonCard } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import { formatDate } from "../lib/format"

/* I18N · Phase 119A — strings keyed under `dashboard.projects.*`.
 * StatusPill maps an internal status to a chip label internally; we
 * deliberately don't translate here so the i18n contract for status
 * machines stays in one place (StatusPill consumes the same status
 * strings everywhere else). */

const fmtDate = (d) => d ? formatDate(d) : "—"

function progressPct(milestones = []) {
  if (milestones.length === 0) return 0
  const done = milestones.filter((m) => m.status === "completed").length
  return Math.round((done / milestones.length) * 100)
}

export default function DashboardProjectsPage() {
  const { t } = useTranslation("dashboard")
  const { data: projects = [], loading, error } = useApiQuery(
    "projects",
    () => fetchMyProjects(),
    { select: (rows) => (Array.isArray(rows) ? rows : []) }
  )

  const active = projects.filter((p) => ["planning", "in_progress", "review"].includes(p.projectStatus)).length
  const done = projects.filter((p) => p.projectStatus === "completed").length

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((i) => <SkeletonCard key={i} />)}</div>
        <div className="grid gap-4 sm:grid-cols-2">{[1,2].map((i) => <SkeletonCard key={i} height="h-[180px]" />)}</div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title={t("projects.metrics.total")}     value={projects.length} icon={Briefcase}    tone="purple" />
        <MetricCard title={t("projects.metrics.active")}    value={active}          icon={Calendar}     tone="blue" />
        <MetricCard title={t("projects.metrics.completed")} value={done}            icon={CheckCircle2} tone="green" />
      </div>

      <div>
        <h2 className="text-card font-bold text-violet">{t("projects.list.title")}</h2>
        <p className="mt-0.5 text-meta text-charcoal-80/65">
          {t("projects.list.subtitle")}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-violet/20 bg-violet-pale/30 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet shadow-sm">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-card font-semibold text-violet">{t("projects.list.empty")}</p>
          <p className="max-w-xs text-meta text-charcoal-80/65">
            {t("projects.list.emptyBody")}
          </p>
          <Link to="/services" className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep">
            {t("projects.list.browseServices")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p, idx) => {
            const pct = progressPct(p.milestones)
            const fileCount = p._count?.files ?? 0
            /* D5-1 · an expired project is a dead link.
             *
             * GET /member/projects returns every project the account owns,
             * expired ones included, but the detail route answers 410
             * PROJECT_EXPIRED — so this card was an ordinary "Open project"
             * button onto an error page. The row now carries the same
             * `access` object the detail response sends, and an expired one
             * loses the link and says why instead. */
            const expired = Boolean(p.access?.isExpired)
            return (
              <m.article
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04, ease: "easeOut" }}
                className={`flex flex-col gap-4 rounded-xl border p-5 shadow-[var(--shadow-e3)] transition ${
                  expired
                    ? "border-charcoal-80/10 bg-mist"
                    : "border-charcoal-80/10 bg-white hover:-translate-y-0.5 hover:shadow-[var(--shadow-e6)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`truncate text-meta font-bold ${expired ? "text-charcoal-80/75" : "text-violet"}`}>{p.projectName}</h3>
                      {expired ? (
                        <span className="shrink-0 rounded-full bg-charcoal-80/8 px-2 py-0.5 text-micro font-semibold uppercase text-charcoal-80/75">
                          {t("projects.card.expired")}
                        </span>
                      ) : (
                        <StatusPill status={p.projectStatus} />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-meta text-charcoal-80/65">
                      <span><Calendar className="inline h-3 w-3 mr-1" />{t("projects.card.due", { date: fmtDate(p.dueDate) })}</span>
                      <span><FileText className="inline h-3 w-3 mr-1" />{t("projects.card.files", { count: fileCount })}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between font-mono text-micro uppercase tracking-wider text-charcoal-80/65">
                    <span>{t("projects.card.milestones")}</span>
                    <span className="tabular-nums">
                      {p.milestones.filter((m) => m.status === "completed").length} / {p.milestones.length}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-violet-pale"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t("projects.progressLabel", { percent: pct })}
                  >
                    <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {expired ? (
                  <p className="flex items-start gap-2 rounded-lg border border-charcoal-80/10 bg-white px-3 py-2 text-micro text-charcoal-80/75">
                    <Archive className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t("projects.card.expiredBody")}</span>
                  </p>
                ) : (
                  <Link
                    to={`/dashboard/projects/${p.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet/20 bg-violet-pale px-3 py-2 text-micro font-semibold text-violet transition hover:bg-violet hover:text-white"
                  >
                    {t("projects.card.open")} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </m.article>
            )
          })}
        </div>
      )}
    </section>
  )
}
