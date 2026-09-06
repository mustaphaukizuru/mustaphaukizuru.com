import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"
import {
  Sparkles, PlayCircle, PauseCircle, RotateCcw, CheckCircle2, PackageCheck,
  Flag, Send, ThumbsUp, PencilLine, FileQuestion, FileUp, FileCheck2, FileX2,
  Download, MessageSquare, Receipt, BadgeDollarSign, AlarmClock, Circle,
} from "lucide-react"
import { EmptyStateSurface, Spinner } from "../ui"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectTimeline · one component, three surfaces (T5-5)
 *
 *  The same list of ProjectEvent rows is rendered on the anonymous /track
 *  page, on the signed-in project page and in the PIN portal. Only the
 *  fetching differs, so the caller passes `events` and this file owns nothing
 *  but the presentation — which is the point. Three copies of "what does
 *  milestone.approved look like" would drift within a month.
 *
 *  The events themselves are already projected for the viewer by the server:
 *  the public projection carries no `detail` at all (ADR 0006). This file
 *  must never decide what a viewer may see — it only draws what it is given.
 *  ──────────────────────────────────────────────────────────────────── */

/**
 * Icon per event type. Keyed by the full type string rather than its prefix
 * so a new type shows up as the neutral dot instead of silently borrowing
 * the wrong meaning.
 */
const ICON = {
  "project.created": Sparkles,
  "project.started": PlayCircle,
  "project.on_hold": PauseCircle,
  "project.resumed": RotateCcw,
  "project.completed": CheckCircle2,
  "project.handover": PackageCheck,
  "milestone.started": Flag,
  "milestone.delivered": Send,
  "milestone.approved": ThumbsUp,
  "milestone.changes_requested": PencilLine,
  "file.requested": FileQuestion,
  "file.received": FileUp,
  "file.accepted": FileCheck2,
  "file.rejected": FileX2,
  "file.delivered": Download,
  "comment.added": MessageSquare,
  "invoice.issued": Receipt,
  "invoice.paid": BadgeDollarSign,
  "invoice.overdue": AlarmClock,
}

/**
 * Tone per event type. Only three tones plus the default: something moved
 * forward, something needs the client, something is a problem. A twentieth
 * colour would say nothing a reader could learn.
 */
const TONE = {
  "project.completed": "good",
  "project.handover": "good",
  "milestone.approved": "good",
  "file.accepted": "good",
  "invoice.paid": "good",
  "milestone.delivered": "waiting",
  "file.requested": "waiting",
  // Client-actionable, so it reads like the other two rather than as one
  // more grey line: an issued invoice is something to act on.
  "invoice.issued": "waiting",
  "milestone.changes_requested": "attention",
  "file.rejected": "attention",
  "invoice.overdue": "attention",
  "project.on_hold": "attention",
}

const DOT = {
  good: "bg-mint/15 text-mint-700 ring-mint/25",
  waiting: "bg-violet-pale text-violet ring-violet/20",
  attention: "bg-amber/10 text-amber-700 ring-amber/25",
  neutral: "bg-charcoal-80/5 text-charcoal-80/70 ring-charcoal-80/10",
}

/**
 * Group by calendar day in the reader's own timezone.
 *
 * A timeline of fourteen rows each stamped with a full date is a wall. The
 * date belongs to the day, and the time to the row.
 */
function groupByDay(events, locale) {
  const groups = []
  const dayFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" })
  for (const event of events) {
    const at = event?.createdAt ? new Date(event.createdAt) : null
    const key = at && !Number.isNaN(at.getTime()) ? at.toDateString() : "unknown"
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(event)
    else groups.push({ key, label: at && key !== "unknown" ? dayFmt.format(at) : "", items: [event] })
  }
  return groups
}

export default function ProjectTimeline({
  events = [],
  loading = false,
  limit = null,
  className = "",
}) {
  const { t, i18n } = useTranslation("dashboard")
  const reduced = useReducedMotion()
  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"

  const shown = useMemo(
    () => (limit ? events.slice(0, limit) : events),
    [events, limit],
  )
  const groups = useMemo(() => groupByDay(shown, locale), [shown, locale])
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }),
    [locale],
  )

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <Spinner />
      </div>
    )
  }

  if (!shown.length) {
    return (
      <EmptyStateSurface
        size="xs"
        icon={Circle}
        title={t("timeline.emptyTitle")}
        description={t("timeline.emptyBody")}
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      {groups.map((group, gi) => (
        <section key={`${group.key}-${gi}`} className="mb-6 last:mb-0">
          {group.label ? (
            <h3 className="mb-3 text-meta font-semibold uppercase tracking-wide text-charcoal-80/65">
              {group.label}
            </h3>
          ) : null}

          <ol className="relative space-y-4 ps-8">
            {/* The rail. Inset so it runs through the middle of the dots, and
                aria-hidden because it carries no information the list does
                not already give a screen reader. */}
            <span
              aria-hidden="true"
              className="absolute inset-y-1 start-[0.9375rem] w-px bg-charcoal-80/10"
            />
            {group.items.map((event, i) => {
              const Icon = ICON[event.type] || Circle
              const tone = DOT[TONE[event.type] || "neutral"]
              const at = event.createdAt ? new Date(event.createdAt) : null
              const valid = at && !Number.isNaN(at.getTime())
              return (
                <m.li
                  key={event.id || `${event.type}-${i}`}
                  className="relative"
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: reduced ? 0 : Math.min(i * 0.03, 0.24) }}
                >
                  <span
                    className={`absolute -start-8 top-0 grid size-8 place-items-center rounded-full ring-1 ${tone}`}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <p className="text-body font-medium text-charcoal-80">{event.title}</p>
                  {event.detail ? (
                    <p className="mt-0.5 text-meta text-charcoal-80/70">{event.detail}</p>
                  ) : null}
                  {valid ? (
                    <time
                      dateTime={at.toISOString()}
                      className="mt-1 block text-meta text-charcoal-80/65"
                    >
                      {timeFmt.format(at)}
                    </time>
                  ) : null}
                </m.li>
              )
            })}
          </ol>
        </section>
      ))}

      {limit && events.length > limit ? (
        <p className="text-meta text-charcoal-80/65">
          {t("timeline.more", { count: events.length - limit })}
        </p>
      ) : null}
    </div>
  )
}
