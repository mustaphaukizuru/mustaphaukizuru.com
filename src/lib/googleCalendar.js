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
const logger     = require("../utils/logger")

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
 * Validate that the refresh-token env value LOOKS like a real Google refresh
 * token. The bootstrap script has a classic trap: it prompts the operator
 * to paste the OAuth callback URL into the terminal (so it can extract the
 * `?code=…` and exchange it), then prints the refresh token for them to
 * paste into .env. Mixing those two steps up — pasting the callback URL
 * into .env instead of the printed token — produces a non-token value that
 * googleapis rejects with `invalid_grant` on the FIRST API call, after
 * every booking has already been confirmed.
 *
 * Real Google refresh tokens start with `1//` and are typically 75-100+
 * chars. URLs start with `http`. A short opaque string is unlikely too.
 * Reject anything obviously not a token and force the operator to fix the
 * misconfiguration BEFORE the booking flow silently degrades.
 */
function looksLikeRefreshToken(value) {
  if (!value || typeof value !== "string") return false
  if (/^https?:\/\//i.test(value)) return false           // someone pasted a URL
  if (value.length < 40)            return false           // too short to be real
  return true
}

/**
 * True when every required env var is present AND the refresh token at
 * least looks like a token. Refresh-token bootstrap is the only required
 * piece that takes the operator extra effort; we treat `calendarId` as
 * optional (defaults to "primary").
 *
 * Returning false here short-circuits the booking provisioner to the
 * "manual" branch (meetingLink=null, admin attention needed) rather than
 * letting it fail loudly at the Calendar API call. The boot pre-flight in
 * src/config/env.js surfaces the same gap at startup time.
 */
function isConfigured() {
  const cfg = readConfig()
  if (!cfg.clientId || !cfg.clientSecret || !cfg.hostEmail) return false
  if (!looksLikeRefreshToken(cfg.refreshToken)) return false
  return true
}

/**
 * Why isConfigured() is false. Useful in error logs so operators don't have
 * to spelunk through individual env vars. Returns a short human string.
 */
function diagnoseConfig() {
  const cfg = readConfig()
  const missing = []
  if (!cfg.clientId)     missing.push("GOOGLE_OAUTH_CLIENT_ID")
  if (!cfg.clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET")
  if (!cfg.hostEmail)    missing.push("GOOGLE_CALENDAR_HOST_EMAIL")
  if (!cfg.refreshToken) missing.push("GOOGLE_OAUTH_REFRESH_TOKEN")
  if (missing.length > 0) return `missing env: ${missing.join(", ")}`
  if (/^https?:\/\//i.test(cfg.refreshToken)) {
    return "GOOGLE_OAUTH_REFRESH_TOKEN looks like a URL — did you paste the OAuth callback URL by mistake? Re-run scripts/google-oauth-bootstrap.js and paste the PRINTED token (starts with '1//'), not the redirect URL."
  }
  if (cfg.refreshToken.length < 40) {
    return `GOOGLE_OAUTH_REFRESH_TOKEN is only ${cfg.refreshToken.length} chars — real Google refresh tokens are 75+ chars. Re-run scripts/google-oauth-bootstrap.js.`
  }
  return "ok"
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
    // Surface the underlying Google error (status code + body message) so
    // PM2 logs are diagnostic. googleapis wraps the response on err.response;
    // err.errors carries the structured `[{ message, reason }]` list.
    const status   = err?.response?.status || err?.code || null
    const data     = err?.response?.data   || err?.errors || null
    const summary  = err?.errors?.[0]?.message || err?.message || "unknown"
    logger.error("[gcal] createCalendarEvent failed", {
      status,
      message: summary,
      // err.response.data on a googleapis error has shape:
      //   { error: { code, message, errors: [...], status: "PERMISSION_DENIED" | ... } }
      googleError: data?.error || data || null,
    })
    // Surface the same context up the stack so the consultation service can
    // log it against the consultation id.
    const wrap = Object.assign(new Error(`Google Calendar create failed: ${summary}`), {
      code:        "GCAL_CREATE_FAILED",
      cause:       err,
      googleStatus: status,
      googleError:  data?.error || data || null,
    })
    throw wrap
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
  diagnoseConfig,
  buildAuthClient,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  // Exported for the one-time bootstrap script.
  SCOPES,
  readConfig,
}
