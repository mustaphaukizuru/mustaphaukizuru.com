// ─────────────────────────────────────────────────────────────────────────────
// icsGenerator.js — RFC 5545 iCalendar invite builder.
//
// Produces a single VEVENT inside a VCALENDAR. Used to attach .ics files to
// booking emails so Gmail / Outlook / Apple Mail render an inline
// "Add to calendar" action and the meeting appears as a real calendar event.
//
// Key compliance points:
//   - All output uses CRLF line endings (RFC 5545 § 3.1).
//   - Lines longer than 75 octets are folded with CRLF + space (§ 3.1).
//   - Text properties escape backslash, semicolon, comma, newline (§ 3.3.11).
//   - DTSTAMP / DTSTART / DTEND emitted as UTC (suffix "Z").
//   - SEQUENCE increments on update; MUST increment on every reschedule.
//   - METHOD:CANCEL uses STATUS:CANCELLED so receiving clients remove it.
//
// Pure, dependency-free, side-effect-free. Returns a string the mailer can
// attach as a Buffer with Content-Type "text/calendar".
// ─────────────────────────────────────────────────────────────────────────────

const PRODID = "-//Mustapha Ukizuru//Booking//EN"

// ─────────────────────────────────────────────────────────────────────────────
// Encoding helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a Date as the iCalendar UTC timestamp form: YYYYMMDDTHHMMSSZ.
 */
function formatUtc(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) throw new Error("icsGenerator: invalid date")
  const pad = (n) => String(n).padStart(2, "0")
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/**
 * Escape RFC 5545 TEXT values: backslash, semicolon, comma, newline.
 */
function escapeText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n")
}

/**
 * Fold a single content line at ≤ 75 octets, joining continuations with CRLF + SP.
 * Octet-aware (UTF-8 multi-byte safe). Required by RFC 5545 § 3.1.
 */
function foldLine(line) {
  const bytes = Buffer.from(line, "utf8")
  if (bytes.length <= 75) return line

  const chunks = []
  let cursor = 0
  let isFirst = true
  while (cursor < bytes.length) {
    // First chunk: 75 bytes; subsequent chunks: 74 bytes (1 byte for the leading SP).
    const limit = isFirst ? 75 : 74
    let take = Math.min(limit, bytes.length - cursor)

    // Don't split a UTF-8 multi-byte sequence: walk back if needed.
    while (take > 0) {
      const last = bytes[cursor + take - 1]
      // If the last byte is a continuation byte (10xxxxxx), back up.
      if ((last & 0xc0) === 0x80) take -= 1
      else break
    }
    if (take <= 0) break

    chunks.push(bytes.slice(cursor, cursor + take).toString("utf8"))
    cursor += take
    isFirst = false
  }
  return chunks.join("\r\n ")
}

/**
 * Join an array of property lines with CRLF, folding each to 75 octets.
 */
function joinLines(lines) {
  return lines.filter(Boolean).map(foldLine).join("\r\n")
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an iCalendar VEVENT invite.
 *
 * @param {Object}   ev
 * @param {string}   ev.uid            Stable identifier (use Consultation.id @ host)
 * @param {Date|string} ev.start       Start time (UTC Date or ISO string)
 * @param {Date|string} ev.end         End time (UTC Date or ISO string)
 * @param {string}   ev.summary        Event title
 * @param {string}   [ev.description]  Long description (will be escaped + folded)
 * @param {string}   [ev.location]     Physical or virtual location (e.g. meeting URL)
 * @param {string}   [ev.url]          Web URL associated with the event
 * @param {Object}   [ev.organizer]    { name, email }
 * @param {Object}   [ev.attendee]     { name, email }
 * @param {number}   [ev.sequence=0]   Increment on every update; required by clients
 *                                     to recognise the event has changed.
 * @param {"REQUEST"|"CANCEL"} [ev.method="REQUEST"]
 * @param {Date|string} [ev.dtStamp]   When this iCalendar object was created (UTC).
 *                                     Defaults to "now". Useful to inject in tests.
 * @param {Array<{ minutesBefore: number, description?: string }>} [ev.alarms]
 *                                     VALARM entries (DISPLAY action).
 *
 * @returns {string} iCalendar text suitable for the .ics attachment body.
 */
function buildEventIcs(ev) {
  if (!ev || !ev.uid) throw new Error("icsGenerator: uid required")
  if (!ev.start || !ev.end) throw new Error("icsGenerator: start/end required")

  const method   = (ev.method === "CANCEL" ? "CANCEL" : "REQUEST")
  const sequence = Number.isInteger(ev.sequence) ? ev.sequence : 0
  const status   = method === "CANCEL" ? "CANCELLED" : "CONFIRMED"
  const dtStamp  = formatUtc(ev.dtStamp || new Date())
  const dtStart  = formatUtc(ev.start)
  const dtEnd    = formatUtc(ev.end)

  const eventLines = [
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    `SUMMARY:${escapeText(ev.summary || "Consultation")}`,
    ev.description ? `DESCRIPTION:${escapeText(ev.description)}` : null,
    ev.location    ? `LOCATION:${escapeText(ev.location)}`       : null,
    ev.url         ? `URL:${ev.url}`                              : null,
    ev.organizer?.email
      ? `ORGANIZER;CN=${escapeText(ev.organizer.name || "")}:mailto:${ev.organizer.email}`
      : null,
    ev.attendee?.email
      ? `ATTENDEE;CN=${escapeText(ev.attendee.name || "")};RSVP=TRUE:mailto:${ev.attendee.email}`
      : null,
    "TRANSP:OPAQUE",
  ]

  // Alarms — only emit on REQUEST (cancellations don't carry reminders).
  if (method === "REQUEST" && Array.isArray(ev.alarms)) {
    ev.alarms.forEach((a) => {
      const min = Math.max(1, Number(a.minutesBefore) || 0)
      eventLines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(a.description || ev.summary || "Reminder")}`,
        `TRIGGER:-PT${min}M`,
        "END:VALARM",
      )
    })
  }

  eventLines.push("END:VEVENT")

  const calendarLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    ...eventLines,
    "END:VCALENDAR",
  ]

  return joinLines(calendarLines) + "\r\n"
}

/**
 * Build the standard "consultation booked / rescheduled" invite from a
 * Consultation row (with relations: user, assignedAdmin, service).
 *
 * @param {Object}  consultation     Consultation row + relations
 * @param {Object}  [options]
 * @param {string} [options.method="REQUEST"]   "REQUEST" | "CANCEL"
 * @param {number} [options.sequence]           Override sequence (else derived)
 * @param {string} [options.fromEmail]          Organizer email
 * @param {string} [options.fromName]           Organizer display name
 * @param {string} [options.baseUrl]            Frontend base URL for the dashboard link
 */
function buildConsultationIcs(consultation, options = {}) {
  if (!consultation) throw new Error("icsGenerator: consultation required")

  const start = consultation.scheduledAt
  const end   = consultation.endsAt
    ? consultation.endsAt
    : new Date(new Date(consultation.scheduledAt).getTime() + (consultation.durationMin || 30) * 60 * 1000)

  const baseUrl = options.baseUrl || "https://mustaphaukizuru.com"
  const fromEmail = options.fromEmail || "hello@mustaphaukizuru.com"
  const fromName  = options.fromName  || consultation.assignedAdmin?.fullName || "Mustapha Ukizuru"

  // Derive a domain for the UID; consistent across update/cancel so clients
  // recognise it as the same event and update in place.
  const uidDomain = (() => {
    try { return new URL(baseUrl).hostname || "mustaphaukizuru.com" }
    catch { return "mustaphaukizuru.com" }
  })()
  const uid = `${consultation.id}@${uidDomain}`

  const summary = consultation.service?.title
    ? `${consultation.service.title} — Consultation`
    : "Consultation"

  // Build a description with practical info: notes, dashboard link, host.
  const lines = [`Consultation with ${fromName}.`]
  if (consultation.clientNotes)  lines.push(`\nYour notes: ${consultation.clientNotes}`)
  if (consultation.meetingLink)  lines.push(`\nJoin link: ${consultation.meetingLink}`)
  lines.push(`\nManage your booking: ${baseUrl}/dashboard/consultations`)

  // Sequence: prefer the server-stored monotonic revision counter
  // (Booking Hardening v1 added Consultation.revision; it starts at 0
  // and increments on every reschedule via the new-row payload in
  // consultationService.rescheduleConsultation). When `revision` is
  // missing (pre-v1 rows or unit-test fixtures), fall back to the
  // historic boolean heuristic so legacy data still emits sane ICS.
  //
  // RFC 5545 § 3.8.7.4 — SEQUENCE MUST increment monotonically across
  // every update of the same UID; clients that see a non-increasing
  // SEQUENCE may silently discard the update.
  const sequence = Number.isInteger(options.sequence)
    ? options.sequence
    : (Number.isInteger(consultation.revision)
      ? consultation.revision
      : (consultation.rescheduledFromId ? 1 : 0))

  // Alarms — 24h + 1h before start (matches our reminder cron).
  const alarms = options.method === "CANCEL"
    ? []
    : [
        { minutesBefore: 24 * 60, description: `Reminder: ${summary} tomorrow` },
        { minutesBefore: 60,      description: `Reminder: ${summary} in 1 hour` },
      ]

  return buildEventIcs({
    uid,
    start,
    end,
    summary,
    description: lines.join(""),
    location:    consultation.meetingLink || null,
    url:         `${baseUrl}/dashboard/consultations`,
    organizer:   { name: fromName, email: fromEmail },
    attendee:    consultation.user?.email
      ? { name: consultation.user.fullName || "", email: consultation.user.email }
      : null,
    method:      options.method || "REQUEST",
    sequence,
    alarms,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  buildEventIcs,
  buildConsultationIcs,
  // Internals exposed for tests
  formatUtc,
  escapeText,
  foldLine,
}
