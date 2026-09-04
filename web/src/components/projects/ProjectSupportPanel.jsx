import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AnimatePresence, m } from "framer-motion"
import {
  LifeBuoy, Plus, ArrowLeft, Paperclip, Send, X, FileText, UploadCloud, MessageSquare,
} from "lucide-react"
import {
  Button, Badge, Input, Textarea, Select, FormField, InlineBanner, EmptyStateSurface, Spinner,
} from "../ui"
import { useToast } from "../../context/ToastContext"
import {
  fetchMyProjectTickets, fetchMyProjectTicket, createMyProjectTicket, replyMyProjectTicket, projectFileDownloadUrl,
} from "../../services/clientProjectService"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectSupportPanel · Tier 2 project-scoped support tickets
 *
 *  Self-contained: list → new-ticket form → thread. Mounted by the project
 *  detail page with { projectId, readOnly, milestones }. Attachments are
 *  ProjectFile rows, so download links reuse the ownership-scoped
 *  /member/projects/:id/files/:fileId/download endpoint (cookie session —
 *  a plain anchor works).
 *  ──────────────────────────────────────────────────────────────────── */

const MAX_FILES = 10
const MAX_MB = 50
// Mirrors ALLOWED_EXT in src/middleware/uploadProjectFile.js — keep in sync.
const ALLOWED_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".pdf", ".zip", ".txt", ".md", ".csv", ".json",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".fig", ".sketch", ".ai", ".psd",
])
const ACCEPT = Array.from(ALLOWED_EXT).join(",")
const PRIORITIES = ["low", "medium", "high"]
const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"]

const ext = (name) => {
  const i = String(name || "").lastIndexOf(".")
  return i >= 0 ? String(name).slice(i).toLowerCase() : ""
}
const formatBytes = (n) => {
  if (!Number.isFinite(n) || n <= 0) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
const formatDate = (value, locale) => {
  if (!value) return ""
  try {
    return new Date(value).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch { return "" }
}
const errorMessage = (e, fallback) => e?.data?.error?.message || e?.message || fallback

/* ── Attachment chip (download link) ─────────────────────────────────── */
function AttachmentChip({ projectId, file }) {
  return (
    <a
      href={projectFileDownloadUrl(projectId, file.id)}
      download={file.fileName}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-charcoal-80/15 bg-white px-2.5 py-1 text-[12px] font-medium text-violet transition hover:border-violet/40 hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{file.fileName}</span>
      {file.fileSize ? <span className="shrink-0 font-mono text-[11px] tabular-nums text-charcoal-80">{formatBytes(file.fileSize)}</span> : null}
    </a>
  )
}

/* ── Dropzone (validates count / size / extension client-side) ───────── */
function useFilePicker({ t }) {
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState("")

  const addFiles = useCallback((incoming) => {
    const list = Array.from(incoming || [])
    setFileError("")
    setFiles((prev) => {
      const next = [...prev]
      for (const f of list) {
        if (next.length >= MAX_FILES) { setFileError(t("projects.support.errors.tooMany", { max: MAX_FILES })); break }
        if (!ALLOWED_EXT.has(ext(f.name))) { setFileError(t("projects.support.errors.badType", { name: f.name })); continue }
        if (f.size > MAX_MB * 1024 * 1024) { setFileError(t("projects.support.errors.tooLarge", { name: f.name, size: MAX_MB })); continue }
        if (next.some((p) => p.name === f.name && p.size === f.size)) continue
        next.push(f)
      }
      return next
    })
  }, [t])

  const removeFile = useCallback((idx) => setFiles((prev) => prev.filter((_, i) => i !== idx)), [])
  const reset = useCallback(() => { setFiles([]); setFileError("") }, [])
  return { files, fileError, addFiles, removeFile, reset }
}

function Dropzone({ id, files, fileError, onAdd, onRemove, disabled, compact = false }) {
  const { t } = useTranslation("dashboard")
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onAdd(e.dataTransfer.files) }}
        className={[
          "flex flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed text-center transition",
          compact ? "px-3 py-3" : "px-4 py-6",
          over ? "border-violet bg-violet-pale" : "border-charcoal-80/25 bg-mist",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <UploadCloud className="h-5 w-5 text-violet" aria-hidden="true" />
        <p className="text-[13px] text-charcoal-80">
          {t("projects.support.form.dropzone")}{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 rounded"
          >
            {t("projects.support.form.browse")}
          </button>
        </p>
        {!compact && (
          <p className="text-[12px] text-charcoal-80">{t("projects.support.form.attachmentsHint", { max: MAX_FILES, size: MAX_MB })}</p>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => { onAdd(e.target.files); e.target.value = "" }}
        />
      </div>
      {fileError ? <p role="alert" className="text-[12px] font-medium text-[var(--color-feedback-danger-text)]">{fileError}</p> : null}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("projects.support.form.attachments")}>
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-charcoal-80/15 bg-white px-2.5 py-1 text-[12px] text-charcoal-80">
              <FileText className="h-3.5 w-3.5 shrink-0 text-violet" aria-hidden="true" />
              <span className="truncate">{f.name}</span>
              <span className="font-mono text-[11px] tabular-nums">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={t("projects.support.form.remove", { name: f.name })}
                className="rounded-full p-0.5 text-charcoal-80 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── New ticket form ─────────────────────────────────────────────────── */
function NewTicketForm({ projectId, milestones, onCreated, onCancel }) {
  const { t } = useTranslation("dashboard")
  const { showSuccess } = useToast()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [priority, setPriority] = useState("medium")
  const [milestoneId, setMilestoneId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const picker = useFilePicker({ t })

  const subjectOk = subject.trim().length >= 3 && subject.trim().length <= 200
  const messageOk = message.trim().length >= 10 && message.trim().length <= 5000

  async function submit(e) {
    e.preventDefault()
    if (!subjectOk || !messageOk || submitting) return
    setSubmitting(true); setError("")
    try {
      const ticket = await createMyProjectTicket(projectId, {
        subject: subject.trim(), message: message.trim(), priority, milestoneId: milestoneId || undefined, files: picker.files,
      })
      showSuccess(t("projects.support.success.created"))
      picker.reset()
      onCreated(ticket)
    } catch (err) {
      setError(errorMessage(err, t("projects.support.errors.create")))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <InlineBanner tone="danger">{error}</InlineBanner> : null}
      <Input
        label={t("projects.support.form.subject")}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={t("projects.support.form.subjectPlaceholder")}
        maxLength={200}
        required
        error={subject && !subjectOk ? t("projects.support.form.subjectLength") : undefined}
      />
      <Textarea
        label={t("projects.support.form.message")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("projects.support.form.messagePlaceholder")}
        rows={5}
        maxLength={5000}
        required
        error={message && !messageOk ? t("projects.support.form.messageLength") : undefined}
      />
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
              ...milestones.map((m) => ({ value: m.id, label: m.title })),
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
          disabled={submitting}
        />
      </FormField>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>{t("projects.support.form.cancel")}</Button>
        <Button type="submit" icon={Send} loading={submitting} disabled={!subjectOk || !messageOk}>{t("projects.support.form.submit")}</Button>
      </div>
    </form>
  )
}

/* ── Thread ──────────────────────────────────────────────────────────── */
function TicketThread({ projectId, ticketId, readOnly, onBack, onUpdated }) {
  const { t, i18n } = useTranslation("dashboard")
  const { showSuccess } = useToast()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const picker = useFilePicker({ t })

  useEffect(() => {
    let alive = true
    setLoading(true); setError("")
    fetchMyProjectTicket(projectId, ticketId)
      .then((data) => { if (alive) setTicket(data) })
      .catch((e) => { if (alive) setError(errorMessage(e, t("projects.support.errors.loadOne"))) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [projectId, ticketId, t])

  const isClosed = ticket?.status === "closed"
  const canReply = !readOnly && !isClosed

  async function send(e) {
    e.preventDefault()
    if (!reply.trim() || sending) return
    setSending(true); setSendError("")
    try {
      const msg = await replyMyProjectTicket(projectId, ticketId, { message: reply.trim(), files: picker.files })
      setTicket((prev) => prev ? { ...prev, status: prev.status === "resolved" ? "open" : prev.status, messages: [...(prev.messages || []), msg] } : prev)
      setReply(""); picker.reset()
      showSuccess(t("projects.support.success.replied"))
      onUpdated?.()
    } catch (err) {
      setSendError(errorMessage(err, t("projects.support.errors.reply")))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 rounded"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("projects.support.thread.back")}
      </button>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : error ? (
        <InlineBanner tone="danger">{error}</InlineBanner>
      ) : ticket ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal-80">#{ticket.ticketNumber}</div>
              <h4 className="mt-1 text-[17px] font-bold leading-snug text-violet">{ticket.subject}</h4>
              <p className="mt-1 text-[12px] text-charcoal-80">{t("projects.support.opened", { date: formatDate(ticket.createdAt, i18n.language) })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge status={ticket.status}>{t(`projects.support.status.${ticket.status}`)}</Badge>
              <Badge tone={ticket.priority === "high" ? "danger" : ticket.priority === "low" ? "info" : "warning"} dot={false}>
                {t(`projects.support.priority.${ticket.priority}`)}
              </Badge>
            </div>
          </div>

          <ol className="space-y-3" role="log" aria-label={ticket.subject}>
            {(ticket.messages || []).length === 0 && (
              <li className="rounded-[10px] border border-dashed border-charcoal-80/25 bg-mist p-4 text-center text-[13px] text-charcoal-80">
                {t("projects.support.thread.noMessages")}
              </li>
            )}
            {(ticket.messages || []).map((m) => {
              const mine = m.senderRole !== "admin"
              return (
                <li
                  key={m.id}
                  className={`rounded-[10px] border p-4 text-[14px] leading-6 ${mine ? "border-charcoal-80/10 bg-white text-charcoal-80" : "border-violet/20 bg-violet-pale text-charcoal-80"}`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold text-violet">{mine ? t("projects.support.thread.you") : t("projects.support.thread.team")}</span>
                    <time dateTime={m.createdAt} className="font-mono text-[11px] tabular-nums text-charcoal-80">{formatDate(m.createdAt, i18n.language)}</time>
                  </div>
                  <div className="whitespace-pre-wrap">{m.message}</div>
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2" aria-label={t("projects.support.thread.attachments")}>
                      {m.attachments.map((f) => <AttachmentChip key={f.id} projectId={projectId} file={f} />)}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          {canReply ? (
            <form onSubmit={send} className="space-y-3 border-t border-charcoal-80/10 pt-4" noValidate>
              {sendError ? <InlineBanner tone="danger">{sendError}</InlineBanner> : null}
              <Textarea
                label={t("projects.support.thread.reply")}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t("projects.support.thread.replyPlaceholder")}
                rows={3}
                maxLength={5000}
              />
              <Dropzone
                compact
                files={picker.files}
                fileError={picker.fileError}
                onAdd={picker.addFiles}
                onRemove={picker.removeFile}
                disabled={sending}
              />
              <div className="flex justify-end">
                <Button type="submit" icon={Send} loading={sending} disabled={!reply.trim()}>{t("projects.support.thread.send")}</Button>
              </div>
            </form>
          ) : isClosed ? (
            <InlineBanner tone="info">{t("projects.support.thread.closedNotice")}</InlineBanner>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/* ── Panel ───────────────────────────────────────────────────────────── */
export default function ProjectSupportPanel({ projectId, readOnly = false, milestones = [] }) {
  const { t, i18n } = useTranslation("dashboard")
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [view, setView] = useState({ mode: "list" }) // list | new | { mode: "thread", ticketId }

  const load = useCallback(async () => {
    if (!projectId) return
    setError("")
    try {
      setTickets(await fetchMyProjectTickets(projectId))
    } catch (e) {
      setError(errorMessage(e, t("projects.support.errors.load")))
    } finally {
      setLoading(false)
    }
  }, [projectId, t])

  useEffect(() => { setLoading(true); load() }, [load])

  const openCount = useMemo(() => tickets.filter((x) => x.status === "open" || x.status === "in_progress").length, [tickets])

  return (
    <section
      aria-labelledby="project-support-title"
      className="rounded-[14px] border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e1)] sm:p-6"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-violet-pale text-violet">
            <LifeBuoy className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h3 id="project-support-title" className="text-[17px] font-bold leading-tight text-violet">
              {t("projects.support.title")}
              {openCount > 0 && <span className="ml-2 font-mono text-[12px] tabular-nums text-charcoal-80">({openCount})</span>}
            </h3>
            <p className="mt-1 max-w-prose text-[13px] text-charcoal-80">{t("projects.support.subtitle")}</p>
          </div>
        </div>
        {view.mode === "list" && !readOnly && (
          <Button size="sm" icon={Plus} onClick={() => setView({ mode: "new" })}>{t("projects.support.newTicket")}</Button>
        )}
      </header>

      {readOnly && view.mode === "list" ? <InlineBanner tone="info" className="mb-4">{t("projects.support.readOnly")}</InlineBanner> : null}

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={view.mode === "thread" ? `thread-${view.ticketId}` : view.mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {view.mode === "new" && (
            <NewTicketForm
              projectId={projectId}
              milestones={milestones}
              onCancel={() => setView({ mode: "list" })}
              onCreated={(ticket) => { load(); setView(ticket?.id ? { mode: "thread", ticketId: ticket.id } : { mode: "list" }) }}
            />
          )}

          {view.mode === "thread" && (
            <TicketThread
              projectId={projectId}
              ticketId={view.ticketId}
              readOnly={readOnly}
              onBack={() => setView({ mode: "list" })}
              onUpdated={load}
            />
          )}

          {view.mode === "list" && (
            loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : error ? (
              <InlineBanner tone="danger">{error}</InlineBanner>
            ) : tickets.length === 0 ? (
              <EmptyStateSurface
                icon={MessageSquare}
                title={t("projects.support.empty")}
                description={t("projects.support.emptyBody")}
                size="sm"
              />
            ) : (
              <ul className="divide-y divide-charcoal-80/10" aria-label={t("projects.support.list")}>
                {tickets.map((tk) => (
                  <li key={tk.id}>
                    <button
                      type="button"
                      onClick={() => setView({ mode: "thread", ticketId: tk.id })}
                      className="flex w-full items-start justify-between gap-3 rounded-[10px] px-2 py-3 text-left transition hover:bg-mist focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-violet">{tk.subject}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-charcoal-80">
                          <span className="font-mono tabular-nums">#{tk.ticketNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t("projects.support.messages", { count: tk._count?.messages ?? 0 })}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t("projects.support.lastActivity", { date: formatDate(tk.updatedAt || tk.createdAt, i18n.language) })}</span>
                        </div>
                      </div>
                      <Badge status={TICKET_STATUSES.includes(tk.status) ? tk.status : undefined} size="sm">
                        {t(`projects.support.status.${tk.status}`, { defaultValue: tk.status })}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </m.div>
      </AnimatePresence>
    </section>
  )
}

export { ProjectSupportPanel }
