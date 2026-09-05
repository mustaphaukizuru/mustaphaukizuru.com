import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"
import {
  FileQuestion, UploadCloud, CheckCircle2, AlertTriangle, Clock, X, Loader2, Inbox,
} from "lucide-react"
import { Button, Badge, EmptyStateSurface, InlineBanner, Spinner } from "../ui"
import { useToast } from "../../context/ToastContext"

/* ──────────────────────────────────────────────────────────────────────────
 *  FileRequestPanel · "what we are waiting on you for" (T5-5)
 *
 *  One component, two surfaces: the signed-in project page and the PIN
 *  portal. They differ only in which endpoint accepts the upload, so the
 *  caller passes `onUpload(requestId, files)` and this file owns the rest.
 *
 *  The reminder email links here with ?request=<id>. That row is scrolled to
 *  and highlighted on arrival — a client who clicks "upload it" in an email
 *  should not then have to find the row it meant among eight others.
 *  ──────────────────────────────────────────────────────────────────── */

const MAX_FILES = 10
const MAX_MB = 50

const STATUS_TONE = {
  requested: "info",
  submitted: "warning",
  rejected: "danger",
  accepted: "success",
  cancelled: "neutral",
}

const STATUS_ICON = {
  requested: FileQuestion,
  submitted: Clock,
  rejected: AlertTriangle,
  accepted: CheckCircle2,
  cancelled: X,
}

/** Does the studio still need something from the client for this row? */
const needsClient = (r) => r.status === "requested" || r.status === "rejected"

export default function FileRequestPanel({
  requests = [],
  loading = false,
  readOnly = false,
  onUpload,
  onChanged,
  className = "",
}) {
  const { t, i18n } = useTranslation("dashboard")
  const toast = useToast()
  const reduced = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState("")
  const rowRefs = useRef({})
  const inputRefs = useRef({})

  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"
  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }),
    [locale],
  )

  // The row the reminder email pointed at. Read once into state so clearing
  // the query param does not immediately drop the highlight.
  const deepLinked = searchParams.get("request")
  const [highlighted, setHighlighted] = useState(deepLinked || null)

  useEffect(() => {
    if (!deepLinked || loading) return undefined
    const node = rowRefs.current[deepLinked]
    if (!node) return undefined
    node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" })
    // The param has done its job. Leaving it in the address bar would mean a
    // reload weeks later re-highlights a row that is long since closed, and a
    // copied URL would carry the highlight to whoever it was shared with.
    const next = new URLSearchParams(searchParams)
    next.delete("request")
    setSearchParams(next, { replace: true })
    const timer = setTimeout(() => setHighlighted(null), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once, when the row it points at has rendered
  }, [deepLinked, loading])

  const pick = useCallback((id) => inputRefs.current[id]?.click(), [])

  const submit = useCallback(async (request, fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setError("")

    if (files.length > MAX_FILES) {
      setError(t("fileRequests.tooMany", { max: MAX_FILES }))
      return
    }
    const oversize = files.find((f) => f.size > MAX_MB * 1024 * 1024)
    if (oversize) {
      setError(t("fileRequests.tooBig", { name: oversize.name, max: MAX_MB }))
      return
    }
    // The server checks acceptExt too, and its answer is the one that counts.
    // This only saves the client a round trip and a rejected upload.
    if (request.acceptExt) {
      const allowed = request.acceptExt.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      const bad = files.find((f) => {
        const dot = f.name.lastIndexOf(".")
        const ext = dot === -1 ? "" : f.name.slice(dot).toLowerCase()
        return !allowed.includes(ext)
      })
      if (bad) {
        setError(t("fileRequests.wrongType", { name: bad.name, accept: request.acceptExt }))
        return
      }
    }

    setBusyId(request.id)
    try {
      await onUpload(request.id, files)
      toast?.success?.(t("fileRequests.uploaded"))
      await onChanged?.()
    } catch (e) {
      setError(e?.message || t("fileRequests.uploadFailed"))
    } finally {
      setBusyId(null)
      // Clearing the input matters: without it, picking the SAME file again
      // after a failure fires no change event and the retry looks dead.
      const input = inputRefs.current[request.id]
      if (input) input.value = ""
    }
  }, [onUpload, onChanged, t, toast])

  const open = requests.filter(needsClient)

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <Spinner />
      </div>
    )
  }

  if (!requests.length) {
    return (
      <EmptyStateSurface
        icon={Inbox}
        title={t("fileRequests.emptyTitle")}
        description={t("fileRequests.emptyBody")}
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      {open.length ? (
        <p className="mb-4 text-body text-charcoal-80">
          {t("fileRequests.openCount", { count: open.length })}
        </p>
      ) : null}

      {error ? (
        <InlineBanner tone="danger" className="mb-4" onDismiss={() => setError("")}>
          {error}
        </InlineBanner>
      ) : null}

      <ul className="space-y-3">
        {requests.map((request) => {
          const Icon = STATUS_ICON[request.status] || FileQuestion
          const isOpen = needsClient(request)
          const isHot = highlighted === request.id
          const overdue = isOpen && request.dueAt && new Date(request.dueAt) < new Date()
          return (
            <m.li
              key={request.id}
              ref={(node) => { rowRefs.current[request.id] = node }}
              animate={isHot && !reduced ? { scale: [1, 1.01, 1] } : {}}
              transition={{ duration: 0.6 }}
              className={`rounded-xl border p-4 transition-colors ${
                isHot ? "border-violet bg-violet-pale/40" : "border-charcoal-80/10 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-charcoal-80/60" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-body font-medium text-charcoal-80">{request.title}</p>
                    {request.instructions ? (
                      <p className="mt-1 text-meta text-charcoal-80/70">{request.instructions}</p>
                    ) : null}
                    {request.reviewNote && request.status === "rejected" ? (
                      <p className="mt-1 text-meta text-amber-700">{request.reviewNote}</p>
                    ) : null}
                    <p className="mt-1 flex flex-wrap gap-x-3 text-meta text-charcoal-80/65">
                      {request.dueAt ? (
                        <span className={overdue ? "text-amber-700" : undefined}>
                          {t("fileRequests.due", { date: fmtDate.format(new Date(request.dueAt)) })}
                        </span>
                      ) : null}
                      {request.acceptExt ? (
                        <span>{t("fileRequests.accepts", { list: request.acceptExt })}</span>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS_TONE[request.status] || "neutral"}>
                    {t(`fileRequests.status.${request.status}`, { defaultValue: request.status })}
                  </Badge>
                  {isOpen && !readOnly && onUpload ? (
                    <>
                      <input
                        ref={(node) => { inputRefs.current[request.id] = node }}
                        type="file"
                        multiple
                        className="sr-only"
                        accept={request.acceptExt || undefined}
                        onChange={(e) => submit(request, e.target.files)}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === request.id}
                        onClick={() => pick(request.id)}
                      >
                        {busyId === request.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <UploadCloud className="size-4" aria-hidden="true" />
                        )}
                        {t("fileRequests.upload")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </m.li>
          )
        })}
      </ul>
    </div>
  )
}
