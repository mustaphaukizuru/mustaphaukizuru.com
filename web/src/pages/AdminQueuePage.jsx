import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  FileCheck2, RotateCcw, MessageSquare, LifeBuoy, FilePlus2,
  ThumbsUp, FileQuestion, Receipt, RefreshCw, CheckCircle2, AlertTriangle,
} from "lucide-react"

import { fetchAdminQueue } from "../services/clientProjectService"

/* ══════════════════════════════════════════════════════════════════════════
 *  AdminQueuePage · /admin/queue · T5-16
 *
 *  Everything waiting, across every project, in one place.
 *
 *  The operator's day was a tour: open each project, scroll for a submitted
 *  document, an unanswered comment, a milestone that came back with changes.
 *  The cost of that is not effort — it is the one that gets missed.
 *
 *  TWO COLUMNS, AND THE SPLIT IS THE POINT
 *
 *  Left is what the operator is blocking: work to do. Right is what the
 *  client is blocking: people to chase — a different action, and a different
 *  hour of the day. Merging them into one "open items" count is how a queue
 *  becomes wallpaper, because the number never reaches zero and half of it
 *  was never yours to clear.
 *
 *  Oldest first on the left. A queue sorted newest-first buries the thing
 *  that has been waiting longest, which is the one most likely to have been
 *  forgotten.
 *  ══════════════════════════════════════════════════════════════════════ */

const MINE = {
  review_document: { icon: FileCheck2, label: "Document to review" },
  changes_requested: { icon: RotateCcw, label: "Changes requested" },
  unanswered_comment: { icon: MessageSquare, label: "Unanswered comment" },
  open_ticket: { icon: LifeBuoy, label: "Open ticket" },
  quote_change_request: { icon: FilePlus2, label: "Change request to quote" },
}

const THEIRS = {
  awaiting_approval: { icon: ThumbsUp, label: "Waiting for approval" },
  awaiting_document: { icon: FileQuestion, label: "Waiting for a document" },
  unpaid_invoice: { icon: Receipt, label: "Unpaid invoice" },
}

/** "3 days" / "today" — how long it has been sitting there. */
function since(value) {
  if (!value) return null
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (Number.isNaN(days)) return null
  if (days <= 0) return "today"
  if (days === 1) return "1 day"
  return `${days} days`
}

function Row({ item, kinds, showAge }) {
  const meta = kinds[item.kind] || { icon: MessageSquare, label: item.kind }
  const Icon = meta.icon
  const age = showAge ? since(item.since) : null
  const due = item.due ? new Date(item.due).toLocaleDateString() : null

  return (
    <li>
      <Link
        to={item.href}
        className="flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 transition-colors hover:border-violet"
      >
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.overdue ? "text-rose-700" : "text-charcoal-80/60"}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-meta font-semibold text-charcoal-80">{item.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-charcoal-80/65">
            {[
              meta.label,
              item.project?.name,
              item.project?.trackingCode,
              // The age on the left, the deadline on the right — they answer
              // different questions and only one applies per column.
              age ? `waiting ${age}` : null,
              due ? `due ${due}` : null,
              item.amount ? `${item.amount.toLocaleString()} ${item.currency || ""}`.trim() : null,
              item.remindedAt ? "reminded" : null,
            ].filter(Boolean).join(" · ")}
          </p>
          {item.detail ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-charcoal-80/65">{item.detail}</p>
          ) : null}
        </div>
        {item.overdue ? (
          <span className="shrink-0 rounded-md bg-rose/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
            overdue
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function Column({ title, hint, items, kinds, showAge, emptyIcon: EmptyIcon, empty }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-charcoal">{title}</h2>
        <span className="font-mono text-sm tabular-nums text-charcoal-80">{items.length}</span>
      </div>
      <p className="mb-4 text-sm text-charcoal-80">{hint}</p>
      {items.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-charcoal-50">
          <EmptyIcon className="h-4 w-4" />
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <Row key={`${item.kind}-${item.id}`} item={item} kinds={kinds} showAge={showAge} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function AdminQueuePage() {
  const [queue, setQueue] = useState({ waitingOnMe: [], waitingOnClient: [], counts: { me: 0, client: 0 } })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await fetchAdminQueue()
    setQueue(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    // In a callback, not the effect body: the linter treats a call that
    // reaches setState as a synchronous one, and it is right to.
    ;(async () => { if (alive) await load() })()
    return () => { alive = false }
  }, [load])

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-charcoal">Queue</h1>
          <p className="mt-1 text-sm text-charcoal-80">
            Everything waiting, across every project. Closed projects are not here.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal-80/15 px-3 py-2 text-sm font-semibold text-charcoal-80 transition hover:border-violet hover:text-violet"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-charcoal-50">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Column
            title="Waiting on you"
            hint="Work that is blocked until you do something. Oldest first."
            items={queue.waitingOnMe}
            kinds={MINE}
            showAge
            emptyIcon={CheckCircle2}
            empty="Nothing is waiting on you."
          />
          <Column
            title="Waiting on clients"
            hint="People to chase, not work to do. Overdue first."
            items={queue.waitingOnClient}
            kinds={THEIRS}
            emptyIcon={AlertTriangle}
            empty="Nothing outstanding with clients."
          />
        </div>
      )}
    </div>
  )
}
