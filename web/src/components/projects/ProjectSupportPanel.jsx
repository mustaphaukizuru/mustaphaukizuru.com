import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Paperclip, Send, X, FileText, UploadCloud } from "lucide-react"
import { Button, Badge, Textarea, InlineBanner, Spinner } from "../ui"
import useFilePicker, { ACCEPT, MAX_FILES, MAX_MB } from "../../hooks/useFilePicker"
import { useToast } from "../../context/ToastContext"
import { fetchMyProjectTicket, replyMyProjectTicket, projectFileDownloadUrl } from "../../services/clientProjectService"

/* ──────────────────────────────────────────────────────────────────────────
 *  Project support tickets · the ticket half of MessagesPanel (T5-20).
 *
 *  This was a self-contained panel of its own until the client was given one
 *  composer for all three ways of saying something. What is left is the part
 *  a ticket genuinely needs and a comment does not: the thread, the reply box
 *  and the attachment pipeline. MessagesPanel owns the list and the composer.
 *
 *  Attachments are ProjectFile rows, so download links reuse the
 *  ownership-scoped /member/projects/:id/files/:fileId/download endpoint
 *  (cookie session — a plain anchor works).
 *  ──────────────────────────────────────────────────────────────────── */

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
export function Dropzone({ id, files, fileError, onAdd, onRemove, disabled, compact = false }) {
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

/* ── Thread ──────────────────────────────────────────────────────────── */
export function TicketThread({ projectId, ticketId, readOnly, onBack, onUpdated }) {
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
