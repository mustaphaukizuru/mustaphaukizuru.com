import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Video, Clock, ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"

import { fetchMyConsultations } from "../../services/bookingService"

/**
 * UpcomingMeetingBanner · "Join Now" reminder pinned above the dashboard.
 *
 * Shows automatically when the member has a confirmed consultation
 * starting in the next 15 minutes OR currently in progress (within 60
 * minutes of `scheduledAt`). Disappears outside that window without any
 * user action.
 *
 * Polling cadence — every 30 seconds. The dashboard layout typically
 * keeps a user around for several minutes when they're working in their
 * account; 30s polling is generous enough to surface a meeting that's
 * approaching without burning unnecessary API calls. The countdown
 * itself updates locally every 5 seconds without re-hitting the API.
 *
 * Why poll instead of WebSocket: the only thing that changes is which
 * meeting becomes "soon" — pure time-based. Cheap, no infra cost,
 * survives a stale browser tab gracefully.
 *
 * Scope: dashboard-only. The marketing pages don't render this banner —
 * a public visitor browsing /about doesn't need a "meeting in 3 min"
 * banner at the top. If we want it on public pages later, mount it in
 * the global App.jsx after the auth context is available.
 */

const POLL_MS         = 30_000          // refetch every 30s
const TICK_MS         = 5_000           // countdown refresh
const LEAD_TIME_MIN   = 15              // start showing this many min before
const TRAILING_MIN    = 60              // keep showing this many min past start

function pickActiveMeeting(items, now) {
  for (const c of items || []) {
    if (c.status !== "confirmed" && c.status !== "scheduled") continue
    if (!c.meetingLink) continue
    const start = new Date(c.scheduledAt).getTime()
    if (Number.isNaN(start)) continue
    const lead  = LEAD_TIME_MIN * 60_000
    const trail = TRAILING_MIN * 60_000
    if (now >= start - lead && now <= start + trail) {
      return c
    }
  }
  return null
}

export default function UpcomingMeetingBanner() {
  const { t } = useTranslation("dashboard")
  const [meeting, setMeeting] = useState(null)
  const [, setTick] = useState(0) // re-render for countdown

  // Poll the API on mount + every POLL_MS
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const items = await fetchMyConsultations({ upcoming: true })
        if (cancelled) return
        setMeeting(pickActiveMeeting(items, Date.now()))
      } catch {
        // Best-effort. A failing dashboard banner must NEVER bubble up
        // and break the rest of the page. Network blip → just no banner
        // this tick, retry on next poll.
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Re-render every TICK_MS so the "Starts in N minutes" countdown
  // updates without re-fetching. Stops when there's nothing to count.
  useEffect(() => {
    if (!meeting) return undefined
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS)
    return () => clearInterval(id)
  }, [meeting])

  if (!meeting) return null

  const start  = new Date(meeting.scheduledAt).getTime()
  const now    = Date.now()
  const diffMs = start - now
  const isLive = diffMs <= 0

  // Countdown label — friendly natural-language phrasing rather than
  // exact seconds. Three states: "starting now-ish", "live", or "in N min".
  let label
  if (isLive) {
    label = t("meetingBanner.live", { defaultValue: "Meeting in progress" })
  } else if (diffMs <= 60_000) {
    label = t("meetingBanner.startingNow", { defaultValue: "Starting now" })
  } else {
    const min = Math.ceil(diffMs / 60_000)
    label = t("meetingBanner.startsIn", {
      defaultValue: "Starts in {{count}} minute",
      defaultValue_plural: "Starts in {{count}} minutes",
      count: min,
    })
  }

  const hostName    = meeting.assignedAdmin?.fullName
  const serviceName = meeting.service?.title || t("meetingBanner.fallbackTitle", { defaultValue: "Consultation" })
  const isGoogleMeet = (meeting.meetingProvider || "").toLowerCase() === "google_meet"
  const joinLabel = isGoogleMeet
    ? t("meetingBanner.joinGoogleMeet", { defaultValue: "Join Google Meet" })
    : t("meetingBanner.joinMeeting", { defaultValue: "Join meeting" })

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{    opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-violet to-violet-deep p-4 shadow-[0_12px_36px_rgba(93,63,211,0.20)] sm:p-5"
        role="region"
        aria-live="polite"
        aria-label={t("meetingBanner.regionLabel", { defaultValue: "Upcoming meeting" })}
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isLive ? "bg-mint/30 text-white" : "bg-white/15 text-white"
              }`}
              aria-hidden="true"
            >
              {isLive ? (
                // Pulsing dot when live to draw the eye
                <span className="relative inline-flex">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
                  <Video className="relative h-5 w-5" />
                </span>
              ) : (
                <Clock className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                {label}
              </p>
              <p className="mt-1 truncate text-[15px] font-bold text-white sm:text-[16px]">
                {serviceName}
                {hostName ? ` · ${hostName}` : ""}
              </p>
            </div>
          </div>

          <a
            href={meeting.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[13.5px] font-bold text-violet shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40 sm:w-auto sm:text-[14px]"
          >
            <Video className="h-4 w-4" aria-hidden="true" />
            {joinLabel}
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          </a>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
