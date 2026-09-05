import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import LocalizedLink from "../LocalizedLink"
import useLocalizedNavigate from "../../hooks/useLocalizedNavigate"
import { AnimatePresence, m } from "framer-motion"
import {
  MessageSquare, LifeBuoy, Receipt, Send, Plus, X, Lock, Check, CreditCard, ExternalLink,
} from "lucide-react"
import { Button, Input, Textarea, Select, FormField, InlineBanner, EmptyStateSurface, Spinner } from "../ui"
import { useToast } from "../../context/ToastContext"
import useApiQuery from "../../hooks/useApiQuery"
import mergeMessages from "../../lib/mergeMessages"
import {
  fetchMyProjectTickets, createMyProjectTicket,
  fetchMyChangeRequests, createMyChangeRequest, acceptMyChangeRequest, declineMyChangeRequest,
} from "../../services/clientProjectService"
import useFilePicker from "../../hooks/useFilePicker"
import { TicketThread, Dropzone } from "./ProjectSupportPanel"

/* ──────────────────────────────────────────────────────────────────────────
 *  MessagesPanel · T5-20 · one place to say something
 *
 *  The client used to face three boxes on the same page: a project thread, a
 *  support panel and a change-request form. Three verbs for one intention —
 *  "I need to tell them something" — and the client had to classify their own
 *  message correctly before they could send it. Get it wrong and the reply
 *  arrives somewhere they are not looking.
 *
 *  The three models stay exactly as they are. Comments, ProjectTicket and
 *  ChangeRequest have different lifecycles, different admin views and (for
 *  change requests) money attached; merging the DATA would be a much larger
 *  and much worse change. What merges is the presentation: one composer with
 *  a type selector, and one dated list.
 *
 *  The selector is not a formality. Each choice says plainly what happens
 *  next — an answer here, a numbered ticket, or a quote before any work —
 *  which is the thing the client actually needed to know and the reason the
 *  three-box version made them guess.
 *  ──────────────────────────────────────────────────────────────────── */

const KINDS = ["question", "problem", "extra"]
const PRIORITIES = ["low", "medium", "high"]

const CR_TONE = {
  requested: "bg-amber/10 text-amber-700",
  quoted:    "bg-violet-pale text-violet",
  accepted:  "bg-azure/10 text-azure-deep",
  declined:  "bg-charcoal-80/5 text-charcoal-80",
  done:      "bg-mint/15 text-mint-700",
}
const TICKET_TONE = {
  open:        "bg-amber/10 text-amber-700",
  in_progress: "bg-azure/10 text-azure-deep",
  resolved:    "bg-mint/15 text-mint-700",
  closed:      "bg-charcoal-80/10 text-charcoal-80",
}

const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  : ""
const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"
const fmtMoney = (v, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "MXN", maximumFractionDigits: 2 }).format(Number(v || 0)) }
  catch { return `${Number(v || 0).toFixed(2)} ${currency || "MXN"}` }
}

/* ── the badge that says which of the three a row is ─────────────────── */
function KindBadge({ kind, t }) {
  const Icon = kind === "question" ? MessageSquare : kind === "problem" ? LifeBuoy : Receipt
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-charcoal-80/5 px-2 py-px text-micro font-bold uppercase tracking-wider text-charcoal-80">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(`projects.messages.kind.${kind}`)}
    </span>
  )
}

/* ── rows ────────────────────────────────────────────────────────────── */

function CommentRow({ comment: c, t }) {
  const isTeam = c.authorRole === "admin"
  return (
    <div className={`rounded-lg border p-4 ${isTeam ? "border-violet/20 bg-violet-pale/40" : "border-charcoal-80/10 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-meta text-charcoal-80/65">
        <KindBadge kind="question" t={t} />
        <span className="font-semibold text-charcoal-80">
          {c.author?.fullName || (isTeam ? t("projects.detail.thread.team") : t("projects.detail.thread.you"))}
        </span>
        <span>{fmtDateTime(c.createdAt)}</span>
        {c.resolvedAt && (
          <span className="inline-flex items-center gap-1 rounded-full bg-mint/15 px-1.5 py-px text-micro font-bold uppercase tracking-wider text-mint-700">
            <Check className="h-2.5 w-2.5" aria-hidden="true" /> {t("projects.detail.thread.resolved")}
          </span>
        )}
      </div>
      <p className={`mt-1 whitespace-pre-wrap text-meta ${c.resolvedAt ? "text-charcoal-80/65" : "text-charcoal-80"}`}>{c.body}</p>
    </div>
  )
}

function TicketRow({ ticket: tk, onOpen, t }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(tk.id)}
      className="block w-full rounded-lg border border-charcoal-80/10 bg-white p-4 text-left transition hover:border-violet/40 hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-meta text-charcoal-80/65">
        <KindBadge kind="problem" t={t} />
        <span className="tabular-nums">#{tk.ticketNumber}</span>
        <span>{fmtDateTime(tk.updatedAt || tk.createdAt)}</span>
        <span className={`rounded-full px-2 py-px text-micro font-bold uppercase tracking-wider ${TICKET_TONE[tk.status] || TICKET_TONE.open}`}>
          {t(`projects.support.status.${tk.status}`, { defaultValue: tk.status })}
        </span>
      </div>
      <div className="mt-1 text-meta font-semibold text-violet">{tk.subject}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/65">
        <span>{t("projects.support.messages", { count: tk._count?.messages ?? 0 })}</span>
        <span aria-hidden="true">·</span>
        <span className="font-semibold text-violet">{t("projects.messages.openThread")}</span>
      </div>
    </button>
  )
}

function ChangeRow({ request: cr, projectId, readOnly, currency, onChanged, t }) {
  const navigate = useLocalizedNavigate()
  const { showSuccess, showError } = useToast()
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    setBusy(true)
    try {
      const r = await acceptMyChangeRequest(projectId, cr.id)
      showSuccess(t("projects.changeRequests.toast.accepted"))
      // Accepting raises an order. Sending the client straight to it is the
      // point — a quote they accepted and then had to go find is a quote
      // that does not get paid.
      if (r?.orderId) navigate(`/dashboard/orders/${r.orderId}`)
      else onChanged()
    } catch (ex) {
      showError(ex?.message || t("projects.changeRequests.toast.failed"))
      setBusy(false)
    }
  }
  const decline = async () => {
    setBusy(true)
    try {
      await declineMyChangeRequest(projectId, cr.id)
      showSuccess(t("projects.changeRequests.toast.declined"))
      onChanged()
    } catch (ex) {
      showError(ex?.message || t("projects.changeRequests.toast.failed"))
    } finally { setBusy(false) }
  }

  const decidable = cr.status === "quoted" && !readOnly
  return (
    <div className={`rounded-lg border p-4 ${decidable ? "border-violet/40 bg-white" : "border-charcoal-80/10 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-2 font-mono text-meta text-charcoal-80/65">
        <KindBadge kind="extra" t={t} />
        <span>{fmtDate(cr.createdAt)}</span>
        <span className={`rounded-full px-2 py-px text-micro font-bold uppercase tracking-wider ${CR_TONE[cr.status] || CR_TONE.requested}`}>
          {t(`projects.changeRequests.status.${cr.status}`, { defaultValue: cr.status })}
        </span>
      </div>
      <div className="mt-1 text-meta font-semibold text-charcoal-80">{cr.title}</div>
      <p className="mt-1 whitespace-pre-wrap text-micro text-charcoal-80/75">{cr.description}</p>

      {cr.quoteAmount != null && (
        <p className="mt-2 text-meta font-semibold text-violet">
          {t("projects.changeRequests.quote", { amount: fmtMoney(cr.quoteAmount, cr.quoteCurrency || currency) })}
        </p>
      )}
      {cr.quoteNote && (
        <div className="mt-2 rounded-lg bg-violet-pale/40 px-3 py-2 text-micro text-charcoal-80">
          <span className="font-semibold">{t("projects.changeRequests.quoteNote")}</span>
          <p className="mt-0.5 whitespace-pre-wrap">{cr.quoteNote}</p>
        </div>
      )}
      {decidable && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon={CreditCard} loading={busy} onClick={accept}>{t("projects.changeRequests.accept")}</Button>
          <Button size="sm" variant="secondary" icon={X} disabled={busy} onClick={decline}>{t("projects.changeRequests.decline")}</Button>
        </div>
      )}
      {cr.orderId && (
        <div className="mt-3">
          <LocalizedLink to={`/dashboard/orders/${cr.orderId}`} className="inline-flex items-center gap-1 text-micro font-semibold text-violet hover:underline">
            <ExternalLink className="h-3 w-3" aria-hidden="true" /> {t("projects.changeRequests.viewOrder")}
          </LocalizedLink>
        </div>
      )}
    </div>
  )
}

/* ── composer ────────────────────────────────────────────────────────── */

function Composer({ milestones, onComment, onTicket, onChange: onChangeRequest, onCancel }) {
  const { t } = useTranslation("dashboard")
  const { showSuccess } = useToast()
  const [kind, setKind] = useState("question")
  const [body, setBody] = useState("")
  const [subject, setSubject] = useState("")
  const [priority, setPriority] = useState("medium")
  const [milestoneId, setMilestoneId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const picker = useFilePicker({ t })

  // Each kind validates on its own terms rather than on a shared minimum: a
  // question can legitimately be one line, a ticket we will have to act on
  // cannot.
  const needsSubject = kind !== "question"
  const subjectOk = !needsSubject || (subject.trim().length >= 3 && subject.trim().length <= 200)
  const bodyOk = kind === "question"
    ? body.trim().length > 0
    : body.trim().length >= 10 && body.trim().length <= 5000
  const ready = subjectOk && bodyOk && !busy

  const submit = async (e) => {
    e.preventDefault()
    if (!ready) return
    setBusy(true); setError("")
    try {
      if (kind === "question") {
        await onComment({ body: body.trim() })
        showSuccess(t("projects.messages.sent.question"))
      } else if (kind === "problem") {
        await onTicket({
          subject: subject.trim(), message: body.trim(), priority,
          milestoneId: milestoneId || undefined, files: picker.files,
        })
        showSuccess(t("projects.support.success.created"))
      } else {
        await onChangeRequest({ title: subject.trim(), description: body.trim() })
        showSuccess(t("projects.changeRequests.toast.created"))
      }
      setBody(""); setSubject(""); picker.reset()
      onCancel()
    } catch (ex) {
      setError(ex?.message || t("projects.detail.toast.failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-violet/15 bg-violet-pale/30 p-4" noValidate>
      {error ? <InlineBanner tone="danger">{error}</InlineBanner> : null}

      <fieldset>
        <legend className="text-meta font-semibold text-charcoal-80">{t("projects.messages.compose.type")}</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("projects.messages.compose.type")}>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => { setKind(k); setError("") }}
              className={`rounded-full border px-3 py-1.5 text-micro font-semibold transition-colors ${
                kind === k
                  ? "border-violet bg-violet text-white"
                  : "border-charcoal-80/15 bg-white text-charcoal-80 hover:border-violet"
              }`}
            >
              {t(`projects.messages.compose.${k}`)}
            </button>
          ))}
        </div>
        {/* What happens next, said before they type rather than after they
            send. This is the whole reason the selector is worth having. */}
        <p className="mt-2 text-micro text-charcoal-80/75">{t(`projects.messages.compose.${kind}Hint`)}</p>
      </fieldset>

      {needsSubject && (
        <Input
          label={t(kind === "problem" ? "projects.support.form.subject" : "projects.changeRequests.form.title")}
          value={subject}
          maxLength={200}
          required
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t(kind === "problem" ? "projects.support.form.subjectPlaceholder" : "projects.changeRequests.form.titlePlaceholder")}
          error={subject && !subjectOk ? t("projects.support.form.subjectLength") : undefined}
        />
      )}

      <Textarea
        label={t(kind === "extra" ? "projects.changeRequests.form.description" : "projects.support.form.message")}
        value={body}
        rows={kind === "question" ? 3 : 5}
        maxLength={5000}
        required
        onChange={(e) => setBody(e.target.value)}
        placeholder={t(`projects.messages.compose.${kind}Placeholder`)}
        error={body && !bodyOk ? t("projects.support.form.messageLength") : undefined}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e) }}
      />

      {kind === "problem" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("projects.support.form.priorityLabel")}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={PRIORITIES.map((p) => ({ value: p, label: t(`projects.support.priority.${p}`) }))}
            />
            {Array.isArray(milestones) && milestones.length > 0 ? (
              <Select
                label={t("projects.support.form.milestone")}
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                options={[
                  { value: "", label: t("projects.support.form.milestoneNone") },
                  ...milestones.map((ms) => ({ value: ms.id, label: ms.title })),
                ]}
              />
            ) : null}
          </div>
          <FormField label={t("projects.support.form.attachments")}>
            <Dropzone
              files={picker.files}
              fileError={picker.fileError}
              onAdd={picker.addFiles}
              onRemove={picker.removeFile}
              disabled={busy}
            />
          </FormField>
        </>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" icon={X} onClick={onCancel} disabled={busy}>
          {t("projects.support.form.cancel")}
        </Button>
        <Button type="submit" size="sm" icon={Send} loading={busy} disabled={!ready}>
          {t("projects.support.form.submit")}
        </Button>
      </div>
    </form>
  )
}

/* ── panel ───────────────────────────────────────────────────────────── */

export default function MessagesPanel({
  projectId,
  readOnly = false,
  milestones = [],
  currency,
  comments = [],
  onComment,
}) {
  const { t } = useTranslation("dashboard")
  const [composing, setComposing] = useState(false)
  const [openTicketId, setOpenTicketId] = useState(null)

  const tickets = useApiQuery(
    `projects:${projectId}:tickets`,
    () => fetchMyProjectTickets(projectId),
    { enabled: Boolean(projectId), select: (d) => (Array.isArray(d) ? d : []) },
  )
  const requests = useApiQuery(
    `projects:${projectId}:change-requests`,
    () => fetchMyChangeRequests(projectId),
    { enabled: Boolean(projectId), select: (d) => (Array.isArray(d) ? d : []) },
  )

  const items = useMemo(
    () => mergeMessages(comments, tickets.data, requests.data),
    [comments, tickets.data, requests.data],
  )

  const createTicket = useCallback(async (payload) => {
    const created = await createMyProjectTicket(projectId, payload)
    tickets.refetch()
    if (created?.id) setOpenTicketId(created.id)
  }, [projectId, tickets])

  const createChange = useCallback(async (payload) => {
    await createMyChangeRequest(projectId, payload)
    requests.refetch()
  }, [projectId, requests])

  if (openTicketId) {
    return (
      <div className="rounded-[14px] border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e1)] sm:p-6">
        <TicketThread
          projectId={projectId}
          ticketId={openTicketId}
          readOnly={readOnly}
          onBack={() => setOpenTicketId(null)}
          onUpdated={tickets.refetch}
        />
      </div>
    )
  }

  const loading = tickets.loading || requests.loading

  return (
    <div className="rounded-[14px] border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e1)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-meta text-charcoal-80/75">{t("projects.messages.subtitle")}</p>
        {readOnly ? (
          <p className="flex items-center gap-1.5 text-micro text-charcoal-80/65">
            <Lock className="h-3 w-3" aria-hidden="true" /> {t("projects.messages.readOnly")}
          </p>
        ) : !composing ? (
          <Button size="sm" icon={Plus} onClick={() => setComposing(true)}>{t("projects.messages.new")}</Button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {composing && !readOnly && (
          <m.div
            key="composer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="mb-4 overflow-hidden"
          >
            <Composer
              milestones={milestones}
              onComment={onComment}
              onTicket={createTicket}
              onChange={createChange}
              onCancel={() => setComposing(false)}
            />
          </m.div>
        )}
      </AnimatePresence>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyStateSurface
          icon={MessageSquare}
          title={t("projects.messages.empty")}
          description={t("projects.messages.emptyBody")}
          size="sm"
        />
      ) : (
        <ul className="space-y-3" aria-label={t("projects.messages.title")}>
          {items.map((item) => (
            <li key={item.key}>
              {item.kind === "question" && <CommentRow comment={item.data} t={t} />}
              {item.kind === "problem" && <TicketRow ticket={item.data} onOpen={setOpenTicketId} t={t} />}
              {item.kind === "extra" && (
                <ChangeRow
                  request={item.data}
                  projectId={projectId}
                  readOnly={readOnly}
                  currency={currency}
                  onChanged={requests.refetch}
                  t={t}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { MessagesPanel }
