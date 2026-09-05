import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m } from "framer-motion"
import {
  Briefcase, Calendar, Download, CheckCircle2, Clock, AlertCircle, Hourglass, Eye, ThumbsUp,
  ExternalLink, Lock, Loader2, Mail, KeyRound, ShieldCheck, RefreshCw, User as UserIcon,
} from "lucide-react"
import { probePortal, requestPortalPin, verifyPortalPin, fetchPortalProject, portalFileDownloadUrl } from "../services/portalService"
import { Button, Input } from "../components/ui/index"
import useLazyNamespace from "../hooks/useLazyNamespace"
import StatusPill from "../components/admin/StatusPill"
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons"
// T5-5 · the same three panels the signed-in project page renders. The
// only difference is which endpoint answers, and that lives in the hook.
import ProjectTimeline from "../components/projects/ProjectTimeline"
import FileRequestPanel from "../components/projects/FileRequestPanel"
import ProjectInvoices from "../components/projects/ProjectInvoices"
import SecretsPanel from "../components/projects/SecretsPanel"
import HoursLedger from "../components/projects/HoursLedger"
import PanelLoadError from "../components/projects/PanelLoadError"
import useProjectPanels from "../hooks/useProjectPanels"

/* ── constants ─────────────────────────────────────────────────────────── */
const CARD = "rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]"
const EMPTY = "rounded-xl border border-dashed border-charcoal-80/15 bg-violet-pale/20 px-4 py-6 text-center text-meta text-charcoal-80/65"
const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"

const MILESTONE_ICON = { pending: Hourglass, in_progress: Clock, awaiting_client: Eye, approved: ThumbsUp, completed: CheckCircle2 }
const MILESTONE_TONE = {
  completed: "bg-mint/15 text-mint-700",
  approved: "bg-mint/15 text-mint-700",
  awaiting_client: "bg-violet-pale text-violet",
  in_progress: "bg-amber/10 text-amber-700",
  pending: "bg-charcoal-80/5 text-charcoal-80",
}

/**
 * PortalPage · /portal/:token
 *
 * No-login client portal (Tier 4). Three steps on one page:
 *   1. "send PIN"   → POST /portal/:token/pin      (email goes to the owner)
 *   2. "enter PIN"  → POST /portal/:token/verify   (httpOnly mu_portal cookie)
 *   3. read-only    → GET  /portal/me/project      (milestones, files, preview)
 * A visitor who still holds a live cookie skips straight to step 3.
 */
export default function PortalPage() {
  const { t } = useTranslation("dashboard")
  const { token } = useParams()

  const [phase, setPhase] = useState("loading") // loading | invalid | idle | sent | view
  const [probe, setProbe] = useState(null)
  const [hint, setHint] = useState(null)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [project, setProject] = useState(null)

  // Boot: a live cookie wins; otherwise probe the link so we can name the project.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await fetchPortalProject()
        if (!alive) return
        setProject(data); setPhase("view"); return
      } catch { /* no cookie yet — fall through to the link probe */ }
      try {
        const data = await probePortal(token)
        if (!alive) return
        setProbe(data); setPhase("idle")
      } catch (e) {
        if (!alive) return
        setError(e?.message || t("portal.errors.invalid")); setPhase("invalid")
      }
    })()
    return () => { alive = false }
  }, [token, t])

  const sendPin = async () => {
    setBusy(true); setError("")
    try {
      const data = await requestPortalPin(token)
      setHint(data); setPhase("sent")
    } catch (e) { setError(e?.message || t("portal.errors.pinSend")) }
    finally { setBusy(false) }
  }

  const verify = async (e) => {
    e?.preventDefault?.()
    if (busy) return
    setBusy(true); setError("")
    try {
      await verifyPortalPin(token, pin)
      const data = await fetchPortalProject()
      setProject(data); setPhase("view")
    } catch (e2) { setError(e2?.message || t("portal.errors.pinInvalid")) }
    finally { setBusy(false) }
  }

  // T5-5 · `dashboard` is route-scoped now (LAZY_NAMESPACES in
  // i18n/resources.js): 50 KB per language that no public page reads. It is
  // fetched here and this tree waits for it, because the project does not use
  // Suspense for translations and rendering early paints raw keys.
  //
  // The guard sits AFTER every hook, not at the top: an early return above
  // them would change the hook order between renders.
  const i18nReady = useLazyNamespace("dashboard")
  if (!i18nReady) return null

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {phase === "loading" && (
          <div className={`${CARD} flex items-center justify-center gap-2 text-meta text-charcoal-80/65`}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("portal.loading")}
          </div>
        )}

        {phase === "invalid" && (
          <div className={`${CARD} text-center`}>
            <Lock className="mx-auto h-8 w-8 text-charcoal-80" aria-hidden="true" />
            <h1 className="mt-3 text-card font-bold text-violet">{t("portal.invalid.title")}</h1>
            <p className="mt-1 text-meta text-charcoal-80/65">{error || t("portal.invalid.body")}</p>
          </div>
        )}

        {(phase === "idle" || phase === "sent") && (
          <div className="mx-auto max-w-lg space-y-4">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-pale text-violet">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-charcoal-80/65">{t("portal.eyebrow")}</p>
              <h1 className="mt-1 text-card font-bold text-violet">{probe?.projectName || t("portal.title")}</h1>
              <p className="mt-2 text-meta text-charcoal-80/70">{t("portal.intro")}</p>
            </div>

            <div className={CARD}>
              {phase === "idle" ? (
                <div className="space-y-4">
                  <p className="text-meta text-charcoal-80/80">{t("portal.step1.body")}</p>
                  <Button onClick={sendPin} disabled={busy} icon={busy ? Loader2 : Mail} className="w-full">
                    {busy ? t("portal.step1.sending") : t("portal.step1.cta")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={verify} className="space-y-4">
                  <p className="text-meta text-charcoal-80/80">{t("portal.step2.body", { email: hint?.emailHint || "" })}</p>
                  <Input
                    label={t("portal.step2.label")}
                    value={pin}
                    onChange={(e) => setPin(String(e.target.value || "").replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    icon={KeyRound}
                  />
                  <Button type="submit" disabled={busy || pin.length !== 6} icon={busy ? Loader2 : Lock} className="w-full">
                    {busy ? t("portal.step2.verifying") : t("portal.step2.cta")}
                  </Button>
                  <button
                    type="button"
                    onClick={sendPin}
                    disabled={busy}
                    className="mx-auto flex items-center gap-1 text-meta text-violet hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("portal.step2.resend")}
                  </button>
                </form>
              )}
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          </div>
        )}

        {phase === "view" && project && <PortalView project={project} t={t} />}
      </m.div>
    </main>
  )
}

/* ── read-only view ────────────────────────────────────────────────────── */

function PortalView({ project, t }) {
  // The portal is read-only for everything EXCEPT satisfying a document
  // request: that is the one write T5-3 opened, because a client who has
  // no account still has to be able to send the thing that unblocks the
  // work. Everything else here stays a read.
  const panels = useProjectPanels("portal")

  const milestones = project.milestones || []
  const files = project.files || []
  const done = milestones.filter((ms) => ms.status === "completed" || ms.status === "approved").length
  const pct = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-xl bg-violet-pale/50 px-4 py-2 text-meta text-charcoal-80/80">
        <Eye className="h-4 w-4 shrink-0 text-violet" aria-hidden="true" /> {t("portal.readOnly")}
      </div>

      {project.ndaGate && (
        <div className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-meta text-amber-700" role="status">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t("portal.ndaGate")}
        </div>
      )}

      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Briefcase className="h-5 w-5 text-violet" aria-hidden="true" />
              <h1 className="text-card font-bold text-violet">{project.projectName}</h1>
              <StatusPill status={project.projectStatus} />
            </div>
            {project.description && <p className="mt-2 max-w-2xl text-meta text-charcoal-80/75">{project.description}</p>}
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

      <Section title={t("projects.detail.timeline")} subtitle={t("projects.detail.milestones", { count: milestones.length })}>
        {milestones.length === 0 ? <div className={EMPTY}>{t("projects.detail.noMilestones")}</div> : milestones.map((ms, idx) => {
          const Icon = MILESTONE_ICON[ms.status] || Hourglass
          const key = `projects.detail.status.${ms.status}`
          const label = t(key)
          return (
            <div key={ms.id} className={CARD}>
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${MILESTONE_TONE[ms.status] || MILESTONE_TONE.pending}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-charcoal-80/65">{String(idx + 1).padStart(2, "0")}</span>
                    <h3 className="font-semibold text-violet">{ms.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${MILESTONE_TONE[ms.status] || MILESTONE_TONE.pending}`}>
                      {label === key ? ms.status : label}
                    </span>
                  </div>
                  {ms.description && <p className="mt-1 text-meta text-charcoal-80/75">{ms.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-charcoal-80/65">
                    {ms.dueDate && <span>{t("projects.detail.milestoneDue", { date: fmtDate(ms.dueDate) })}</span>}
                    {ms.completedAt && <span>{t("projects.detail.milestoneCompleted", { date: fmtDate(ms.completedAt) })}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </Section>

      {project.previewUrl && (
        <Section title={t("projects.detail.preview.title")} subtitle={t("projects.detail.preview.subtitle")}>
          <div className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a href={project.previewUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-mono text-[12px] text-violet hover:underline">
                {project.previewUrl}
              </a>
              <Button as="a" href={project.previewUrl} target="_blank" rel="noopener noreferrer" size="sm" variant="secondary" icon={ExternalLink}>
                {t("projects.detail.preview.open")}
              </Button>
            </div>
          </div>
        </Section>
      )}

      {/* T5-5 · above the file gallery for the same reason as on the
          dashboard: it is the only block that asks the client to act. */}
      <Section title={t("fileRequests.title")}>
        <FileRequestPanel
          requests={panels.requests}
          loading={panels.loading}
          onUpload={panels.upload}
          onChanged={panels.reload}
        />
      </Section>

      <Section title={t("projects.detail.deliverables")} subtitle={t("projects.detail.files", { count: files.length })}>
        {files.length === 0 ? <div className={EMPTY}>{t("portal.noFiles")}</div> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {files.map((f) => {
              const { icon: FileIcon, label, chip, iconColor } = getFileTypeStyles(f.fileName || f.fileType)
              const purged = Boolean(f.purgedAt)
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[var(--shadow-e3)]">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-charcoal-80/5">
                    <FileIcon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-meta font-semibold text-violet">{f.fileName}</p>
                    <p className="font-mono text-[11px] text-charcoal-80/65">
                      <span className={`mr-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${chip}`}>{label}</span>
                      {formatFileSize(f.fileSize)} · {fmtDate(f.createdAt)}
                    </p>
                  </div>
                  {purged ? (
                    <span className="font-mono text-[10px] uppercase text-charcoal-80/65">{t("portal.purged")}</span>
                  ) : (
                    <a href={portalFileDownloadUrl(f.id)} className="rounded-lg p-2 text-violet hover:bg-violet-pale" aria-label={t("portal.download", { name: f.fileName })}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* T5-5 · invoices, through the portal's own authorisation gate — the
          order-scoped PDF route checks a session and a portal holder has
          none. */}
      <Section title={t("invoices.title")}>
        <ProjectInvoices
          invoices={panels.invoices}
          billing={panels.billing}
          onPay={panels.pay}
          loading={panels.loading}
        />
      </Section>

      {/* D0-4 · a panel that failed must not look like a panel that is
          empty. Renders nothing on the normal path. */}
      <PanelLoadError failed={panels.failed} onRetry={panels.reload} className="mb-4" />

      {(panels.hours?.allowance || panels.hours?.months?.some((m) => m.entries.length > 0)) ? (
        <Section title={t("projects.hours.title")}>
          <HoursLedger ledger={panels.hours} portal loading={panels.loading} />
        </Section>
      ) : null}

      {/* T5-13 · this is the surface the credential handoff exists for: a
          client with no account, on a forwarded link, who has been asked for
          the hosting password. Without a box to put it in they reply to the
          email with it in the body. */}
      <Section title={t("projects.secrets.title")}>
        <SecretsPanel
          secrets={panels.secrets}
          onReveal={panels.revealSecret}
          onSend={panels.sendSecret}
          onChanged={panels.reload}
        />
      </Section>

      <Section title={t("track.activity")}>
        <ProjectTimeline events={panels.events} loading={panels.loading} />
      </Section>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div>
      <h2 className="text-card font-bold text-violet">{title}</h2>
      {subtitle && <p className="mt-0.5 text-meta text-charcoal-80/65">{subtitle}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}
