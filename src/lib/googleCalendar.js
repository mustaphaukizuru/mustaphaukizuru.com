// @ts-check
/**
 * src/lib/googleCalendar.js · Google Calendar API helper
 *
 * One job: create / update / cancel Calendar events that carry a Google Meet
 * conference link, on behalf of hello@mustaphaukizuru.com.
 *
 * Auth model — OAuth2 with a long-lived refresh token:
 *   - One-time bootstrap (see scripts/google-oauth-bootstrap.js) produces a
 *     refresh token that gets pasted into .env.production.
 *   - At runtime, this module exchanges that refresh token for short-lived
 *     access tokens automatically (googleapis handles the rotation).
 *   - No user-facing consent flow — the host already consented once.
 *
 * Graceful degradation:
 *   - If any required env var is missing, `isConfigured()` returns false and
 *     the consultation flow falls back to the legacy Jitsi link generator.
 *   - The caller (consultationService) NEVER blows up because Google is
 *     misconfigured — bookings always succeed, you just lose the Meet
 *     auto-link until env vars are set.
 *
 * Why createEvent + auto-Meet (not the standalone Meet REST API):
 *   - Calendar events ship Google's invite emails + reminders for free.
 *   - The host (hello@) and the attendee both get the event on their
 *     calendar with the Meet button built in — that's what clients expect.
 *   - The standalone Meet API is still in beta and doesn't surface the
 *     attendee invitation pipeline.
 */

const { google } = require("googleapis")
const crypto     = require("crypto")
const logger     = require("./logger")

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

/**
 * Read the env vars once at module load. Returns a struct callers can check
 * for completeness; `null` for a missing var. We don't throw at load time
 * because we want the rest of the app to boot even when Google isn't set up.
 */
function readConfig() {
  return {
    clientId:     process.env.GOOGLE_OAUTH_CLIENT_ID     || null,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || null,
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || null,
    hostEmail:    process.env.GOOGLE_CALENDAR_HOST_EMAIL || null,
    calendarId:   process.env.GOOGLE_CALENDAR_ID || "primary",
    redirectUri:  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
                  "http://localhost:5000/api/v1/admin/google/oauth-callback",
  }
}

/**
 * True when every required env var is present. Refresh-token bootstrap is
 * the only required one that takes the operator extra effort; we treat
 * `calendarId` as optional (defaults to "primary").
 */
function isConfigured() {
  const cfg = readConfig()
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.refreshToken && cfg.hostEmail)
}

/**
 * Build an authenticated OAuth2 client. The refresh token is set on the
 * client; googleapis will exchange it for an access token on the first
 * API call and rotate as needed.
 */
function buildAuthClient() {
  const cfg = readConfig()
  const client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri)
  client.setCredentials({ refresh_token: cfg.refreshToken })
  return client
}

/**
 * @typedef {Object} CreateEventInput
 * @property {string} summary       — Calendar event title
 * @property {string} description   — long-form body (HTML allowed; Calendar renders plain)
 * @property {Date}   start         — UTC Date instance
 * @property {Date}   end           — UTC Date instance
 * @property {string} timezone      — IANA timezone (client-provided, e.g. "America/Mexico_City")
 * @property {string} attendeeEmail — single attendee for now (the booking client)
 * @property {string=} attendeeName — display name in invite
 * @property {string=} consultationId — used to build a stable conferenceData.requestId
 */

/**
 * Create a Calendar event with an auto-generated Google Meet link.
 *
 * The Meet link is requested by passing a `conferenceData.createRequest`
 * block on the event payload. Google generates the link server-side and
 * returns it on the response (`hangoutLink` + a richer `conferenceData`
 * object on the event).
 *
 * @param {CreateEventInput} input
 * @returns {Promise<{ eventId: string, meetLink: string, htmlLink: string|null }>}
 */
async function createCalendarEvent(input) {
  if (!isConfigured()) {
    throw Object.assign(new Error("Google Calendar is not configured"), { code: "GCAL_NOT_CONFIGURED" })
  }
  const cfg  = readConfig()
  const auth = buildAuthClient()
  const cal  = google.calendar({ version: "v3", auth })

  // `requestId` must be unique per conference-create-request. Using the
  // consultation id plus a random salt prevents accidental collisions if
  // the same booking flow ever retries.
  const requestId = (input.consultationId || "ukz")
    + "-" + crypto.randomBytes(4).toString("hex")

  const resource = {
    summary:     input.summary,
    description: input.description || "",
    start: {
      dateTime: input.start.toISOString(),
      timeZone: input.timezone || "UTC",
    },
    end: {
      dateTime: input.end.toISOString(),
      timeZone: input.timezone || "UTC",
    },
    attendees: input.attendeeEmail
      ? [{ email: input.attendeeEmail, displayName: input.attendeeName || undefined }]
      : [],
    // Auto-request a Meet link. `solutionKey` MUST be hangoutsMeet — older
    // "eventHangout" / "eventNamedHangout" values create plain Hangouts
    // links (no Meet conference UI). Validated against current Calendar
    // API docs.
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 * 24 },  // 1 day before
        { method: "popup", minutes: 10 },       // 10 min before
      ],
    },
  }

  try {
    const res = await cal.events.insert({
      calendarId:        cfg.calendarId,
      // `conferenceDataVersion: 1` is REQUIRED to actually create the Meet
      // link. Without it the API silently ignores conferenceData.
      conferenceDataVersion: 1,
      // sendUpdates: "all" makes Google email the attendee with the invite.
      // Without it the event is created silently and the client gets nothing.
      sendUpdates: "all",
      requestBody: resource,
    })

    const event = res.data
    const meetLink = pickMeetLink(event)
    if (!meetLink) {
      // Event created but no Meet link came back — likely a Calendar API
      // hiccup or an unsupported scope. Log loudly so we notice; throw so
      // the caller's catch block can fall back to Jitsi.
      logger.error("[gcal] event created but no Meet link in response", { eventId: event.id })
      throw Object.assign(new Error("No Meet link in event response"), { code: "GCAL_NO_MEET_LINK" })
    }

    return {
      eventId:  event.id || "",
      meetLink,
      htmlLink: event.htmlLink || null,
    }
  } catch (err) {
    // Wrap with a stable code so consultationService can route to fallback
    // without sniffing googleapis-specific error shapes.
    if (err.code === "GCAL_NO_MEET_LINK") throw err
    logger.error("[gcal] createCalendarEvent failed", { message: err?.message })
    throw Object.assign(new Error("Google Calendar create failed"), { code: "GCAL_CREATE_FAILED", cause: err })
  }
}

/**
 * Patch the start/end time on an existing event. Used when the admin
 * reschedules a booking — keeps the same event id so the Meet link stays
 * the same and Google emails the time change to both parties automatically.
 *
 * @param {string} eventId
 * @param {{ start: Date, end: Date, timezone: string }} patch
 */
async function updateCalendarEvent(eventId, patch) {
  if (!isConfigured()) {
    throw Object.assign(new Error("Google Calendar is not configured"), { code: "GCAL_NOT_CONFIGURED" })
  }
  const cfg  = readConfig()
  const auth = buildAuthClient()
  const cal  = google.calendar({ version: "v3", auth })

  try {
    const res = await cal.events.patch({
      calendarId:  cfg.calendarId,
      eventId,
      sendUpdates: "all",
      requestBody: {
        start: { dateTime: patch.start.toISOString(), timeZone: patch.timezone || "UTC" },
        end:   { dateTime: patch.end.toISOString(),   timeZone: patch.timezone || "UTC" },
      },
    })
    return {
      eventId:  res.data.id || eventId,
      meetLink: pickMeetLink(res.data),
      htmlLink: res.data.htmlLink || null,
    }
  } catch (err) {
    logger.error("[gcal] updateCalendarEvent failed", { eventId, message: err?.message })
    throw Object.assign(new Error("Google Calendar update failed"), { code: "GCAL_UPDATE_FAILED", cause: err })
  }
}

/**
 * Cancel (delete) an event. Google emails the attendee a cancellation
 * automatically when `sendUpdates: "all"`. Idempotent — returns silently
 * if the event no longer exists.
 *
 * @param {string} eventId
 */
async function cancelCalendarEvent(eventId) {
  if (!isConfigured()) {
    throw Object.assign(new Error("Google Calendar is not configured"), { code: "GCAL_NOT_CONFIGURED" })
  }
  const cfg  = readConfig()
  const auth = buildAuthClient()
  const cal  = google.calendar({ version: "v3", auth })

  try {
    await cal.events.delete({
      calendarId:  cfg.calendarId,
      eventId,
      sendUpdates: "all",
    })
  } catch (err) {
    // 404 / 410 means the event is already gone — safe to ignore.
    const status = err?.response?.status || err?.code
    if (status === 404 || status === 410) return
    logger.error("[gcal] cancelCalendarEvent failed", { eventId, message: err?.message })
    throw Object.assign(new Error("Google Calendar cancel failed"), { code: "GCAL_CANCEL_FAILED", cause: err })
  }
}

/**
 * Extract the Meet link from a Calendar event response. Newer events use
 * `conferenceData.entryPoints`; older fallback path is `hangoutLink`.
 */
function pickMeetLink(event) {
  if (!event) return ""
  if (event.hangoutLink) return event.hangoutLink
  const entry = (event.conferenceData?.entryPoints || []).find(
    (e) => e?.entryPointType === "video"
  )
  return entry?.uri || ""
}

module.exports = {
  isConfigured,
  buildAuthClient,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  // Exported for the one-time bootstrap script.
  SCOPES,
  readConfig,
}
