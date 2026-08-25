// ─────────────────────────────────────────────────────────────────────────────
// bookingService.js — frontend API wrapper for /api/v1 booking endpoints.
// All API calls funnel through web/src/lib/api.js per project convention.
// ─────────────────────────────────────────────────────────────────────────────

import {
  apiGet,
  authGet,
  authPost,
  authPatch,
  authDelete,
} from "../lib/api"

// ── Public read ──────────────────────────────────────────────────────────────

/** GET /api/v1/availability/slots — slots for a single date in client tz. */
export async function fetchAvailableSlots({ serviceId, date, timezone }) {
  const params = new URLSearchParams({ date, timezone })
  if (serviceId) params.set("serviceId", serviceId)
  const r = await apiGet(`/api/v1/availability/slots?${params.toString()}`)
  return Array.isArray(r?.data) ? r.data : []
}

/** GET /api/v1/availability/days — which days in a month have ≥ 1 slot. */
export async function fetchAvailableDays({ serviceId, year, month, timezone }) {
  const params = new URLSearchParams({ year: String(year), month: String(month), timezone })
  if (serviceId) params.set("serviceId", serviceId)
  const r = await apiGet(`/api/v1/availability/days?${params.toString()}`)
  return Array.isArray(r?.data) ? r.data : []
}

// ── Member booking lifecycle ────────────────────────────────────────────────

/** POST /api/v1/consultations — book a slot. */
export async function bookConsultation(payload) {
  const r = await authPost("/api/v1/consultations", payload)
  return r?.data || r
}

/** GET /api/v1/consultations — list current user's consultations. */
export async function fetchMyConsultations({ status, upcoming } = {}) {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (upcoming) params.set("upcoming", "true")
  const qs = params.toString()
  const r = await authGet(`/api/v1/consultations${qs ? `?${qs}` : ""}`)
  return Array.isArray(r?.data) ? r.data : []
}

/** PATCH /api/v1/consultations/:id/reschedule */
export async function rescheduleConsultation(id, { newStartUtc, newTimezone }) {
  const r = await authPatch(`/api/v1/consultations/${id}/reschedule`, { newStartUtc, newTimezone })
  return r?.data || r
}

/** DELETE /api/v1/consultations/:id — cancel. */
export async function cancelConsultation(id, { reason } = {}) {
  const r = await authDelete(`/api/v1/consultations/${id}`, {
    body: JSON.stringify({ reason: reason || null }),
    headers: { "Content-Type": "application/json" },
  })
  return r?.data || r
}

// ── Admin: availability rules + exceptions ──────────────────────────────────

export async function adminListRules() {
  const r = await authGet("/api/v1/admin/availability/rules")
  return Array.isArray(r?.data) ? r.data : []
}

export async function adminCreateRule(payload) {
  const r = await authPost("/api/v1/admin/availability/rules", payload)
  return r?.data || r
}

export async function adminUpdateRule(id, patch) {
  const r = await authPatch(`/api/v1/admin/availability/rules/${id}`, patch)
  return r?.data || r
}

export async function adminDeleteRule(id) {
  return authDelete(`/api/v1/admin/availability/rules/${id}`)
}

export async function adminListExceptions({ from, to } = {}) {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const qs = params.toString()
  const r = await authGet(`/api/v1/admin/availability/exceptions${qs ? `?${qs}` : ""}`)
  return Array.isArray(r?.data) ? r.data : []
}

export async function adminCreateException(payload) {
  const r = await authPost("/api/v1/admin/availability/exceptions", payload)
  return r?.data || r
}

export async function adminDeleteException(id) {
  return authDelete(`/api/v1/admin/availability/exceptions/${id}`)
}

export async function adminListConsultations(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") params.set(k, String(v)) })
  const qs = params.toString()
  const r = await authGet(`/api/v1/admin/consultations${qs ? `?${qs}` : ""}`)
  return r?.data ? r : { data: [], pagination: { total: 0, page: 1, pageSize: 25 } }
}

export async function adminUpdateConsultation(id, patch) {
  const r = await authPatch(`/api/v1/admin/consultations/${id}`, patch)
  return r?.data || r
}

/**
 * Re-run the Google Calendar + Meet provisioner on a consultation that
 * was confirmed without a meeting link (typically because Google was
 * misconfigured at the time and is now fixed).
 *
 * Returns the updated row on success. The backend returns 409 with a
 * diagnostic message when Google is STILL misconfigured (e.g. refresh
 * token still wrong) — authPost surfaces that as a thrown Error whose
 * .message is the backend's `message` field, so the caller catch block
 * can show it directly.
 */
export async function adminRegenerateConsultationLink(id) {
  const r = await authPost(`/api/v1/admin/consultations/${id}/regenerate-link`, {})
  return r?.data || r
}

// ── Helpers (client-side tz utilities, no external deps) ────────────────────

/** The browser's IANA timezone (e.g. "America/Mexico_City"). */
export function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** Format a UTC ISO string as a localised time, e.g. "9:00 AM". */
export function formatTime(utcIso, timezone, opts = {}) {
  if (!utcIso) return ""
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: timezone, ...opts,
    }).format(new Date(utcIso))
  } catch {
    return ""
  }
}

/**
 * Label a list of slots for display, disambiguating a repeated wall-clock
 * hour.
 *
 * On a DST fall-back day the local clock repeats an hour, so two genuinely
 * different instants format to the same "1:00 AM". The buttons are keyed on
 * `startUtc` so the booking is still correct, but the client cannot see which
 * one they are choosing. When a label collides we append the short timezone
 * name ("1:00 AM CDT" vs "1:00 AM CST") — and only then, so the other 364
 * days stay clean.
 *
 * @param {Array<{startUtc: string}>} slots
 * @returns {Array<{startUtc: string, label: string}>}
 */
export function labelSlots(slots = [], timezone) {
  const base = slots.map((s) => ({ startUtc: s.startUtc, label: formatTime(s.startUtc, timezone) }))
  const seen = new Map()
  for (const s of base) seen.set(s.label, (seen.get(s.label) || 0) + 1)

  return base.map((s) => {
    if (seen.get(s.label) < 2) return s
    const withZone = formatTime(s.startUtc, timezone, { timeZoneName: "short" })
    return { ...s, label: withZone || s.label }
  })
}

/** Format a UTC ISO string as a long date, e.g. "Monday, May 4, 2026". */
export function formatLongDate(utcIso, timezone) {
  if (!utcIso) return ""
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone,
    }).format(new Date(utcIso))
  } catch {
    return ""
  }
}

/** Format a UTC ISO string as date + time + tz, e.g. "May 4, 2026 · 9:00 AM CDT". */
export function formatDateTime(utcIso, timezone) {
  if (!utcIso) return ""
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
      timeZoneName: "short", timeZone: timezone,
    }).format(new Date(utcIso))
  } catch {
    return ""
  }
}

/** YYYY-MM-DD of a Date as observed in the given timezone. */
export function localDateKey(date, timezone) {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    })
    return fmt.format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}
