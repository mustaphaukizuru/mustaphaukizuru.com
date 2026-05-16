# Booking Backend — Deep Technical Analysis

**Repository:** `mustaphaukizuru-repo`
**Subsystem:** Consultation booking (public availability + member lifecycle + admin operations)
**Analysis date:** 13 May 2026
**Author:** Claude (Cowork mode), for Mustapha Ukizuru

---

## 1. Executive Summary

The booking subsystem is the most architecturally mature module in your backend. It is essentially a self-contained scheduling product layered on top of the broader services / orders e-commerce stack. The design demonstrates clear separation of concerns (pure algorithm vs. I/O wrappers), defensive concurrency control at the DB layer, graceful degradation when third-party providers fail, and full audit traceability for admin actions.

It is not, however, defect-free. The most significant risks fall into four buckets: (1) a server-side timezone-sensitivity bug in the availability fetch window, (2) a duplicate-prevention model that breaks down once a second host is introduced, (3) some authorization gaps on admin endpoints, and (4) a calendar/reminders contract that assumes one-and-only-one host. These are flagged in detail below with concrete recommendations.

Overall grade: **A-** for execution, **B+** for production hardening. The code is shippable as-is for a single-host operation; promoting it to a true multi-host product needs a small, well-defined set of changes.

---

## 2. Architecture at a Glance

```
                                 ┌─────────────────────────────────────────────────┐
        Public (no auth)         │  GET  /api/v1/availability/slots               │
                                 │  GET  /api/v1/availability/days                │
                                 │  GET  /api/v1/consultations/by-token/:token    │
                                 └─────────────────────────────────────────────────┘
                                                       │
                                                       ▼
                                 ┌─────────────────────────────────────────────────┐
        Member (JWT protect)     │  POST   /api/v1/consultations                  │
                                 │  GET    /api/v1/consultations                  │
                                 │  GET    /api/v1/consultations/:id              │
                                 │  PATCH  /api/v1/consultations/:id/reschedule   │
                                 │  DELETE /api/v1/consultations/:id              │
                                 └─────────────────────────────────────────────────┘
                                                       │
                                                       ▼
                                 ┌─────────────────────────────────────────────────┐
        Admin (protect+adminOnly)│  /api/v1/admin/availability/{rules,exceptions} │
                                 │  /api/v1/admin/consultations                   │
                                 │  /api/v1/admin/consultations/:id               │
                                 │  /api/v1/admin/consultations/:id/regen-link    │
                                 └─────────────────────────────────────────────────┘

   Controllers ── thin       ─►  Services ── all logic ──►  Prisma + Google APIs
   asyncHandler wrappers          (consultation, availability)   (Calendar + Meet)
                                          │
                                          ├─►  Mailer  (nodemailer + ICS)
                                          ├─►  Logger  (winston-ish)
                                          └─►  Cron    (node-cron / scheduler.js)
```

Three Prisma models hold the entire domain: `Consultation`, `AvailabilityRule`, `AvailabilityException`, plus the booking-policy columns hanging off `Service`. Background concerns (reminders, audit log) are first-class entities and are visible end-to-end.

---

## 3. Data Model (Prisma)

### 3.1 `Service` — booking policy lives here

```prisma
isBookable             Boolean @default(false)
bookingDurationMin     Int     @default(30)
bookingBufferMin       Int     @default(15)
bookingMinNoticeHours  Int     @default(24)
bookingMaxAdvanceDays  Int     @default(60)
bookingRequiresPayment Boolean @default(false)
```

Each service carries its own scheduling policy. Defaults are sensible (30-min sessions, 15-min buffer, one-day notice, two-month horizon). `bookingRequiresPayment` is declared but **never consulted** in the booking flow — see §11.4.

### 3.2 `Consultation`

```prisma
id                String   @id @default(cuid())
serviceOrderId    String?   // null for free discovery calls
serviceId         String?
userId            String
assignedAdminId   String?  // host
scheduledAt       DateTime
endsAt            DateTime?
durationMin       Int @default(30)
timezone          String   @default("UTC")
meetingProvider   MeetingProvider @default(manual)  // google_meet | zoom | manual
meetingLink       String?
googleEventId     String?  // for in-place updates/cancels
status            ConsultationStatus @default(pending)
                  // pending | confirmed | scheduled | completed
                  // cancelled | rescheduled | no_show
summaryNotes      String?
clientNotes       String?
cancellationReason String?
cancelledAt       DateTime?
confirmedAt       DateTime?
completedAt       DateTime?
confirmationToken String? @unique  // for guest cancel/reschedule via email
rescheduledFromId String?          // self-relation audit chain
reminderSentAt    DateTime?        // dedup watermark for cron
```

**Critical constraint** (line 1133 of `schema.prisma`):

```prisma
@@unique([assignedAdminId, scheduledAt])
```

This is the **entire race-prevention strategy** for the booking flow. Two concurrent `POST /consultations` for the same instant will both pass the availability check but only one will land in the DB; the other gets `P2002` mapped to `409 SLOT_UNAVAILABLE`. Concise and correct — *but only as long as* `assignedAdminId` is the same actor across both attempts (see §11.2 for the failure mode this is silent about).

The index list is well-chosen — there's a hot-path compound index `[serviceId, scheduledAt]` explicitly noted for calendar queries.

### 3.3 `AvailabilityRule`

Recurring weekly windows. `dayOfWeek` uses the JS convention (`0=Sun … 6=Sat`), keyed by the host's IANA `timezone`. Includes per-rule `slotDurationMin` and `bufferMin` overrides, plus an optional `serviceId` (null = applies to every bookable service for that host). Compound index `[hostUserId, isActive, dayOfWeek]` precisely covers the query in `getAvailableSlots`.

### 3.4 `AvailabilityException`

One-off overrides. Two types: `block` (subtractive — vacation days, blackout windows) and `custom` (additive — extra Saturday slots). `date` is stored as **UTC midnight of the local day** in the exception's own `timezone`. This is a clever convention but a brittle one — see §11.1.

---

## 4. The Booking Flow — `POST /api/v1/consultations`

### 4.1 Path

`consultationRoutes.js` → `protect` → `paymentRateLimiter` (10/hour/user) → `consultationController.create` → `consultationService.bookConsultation`.

### 4.2 What `bookConsultation` actually does

1. **Auth + input guards** — userId required, startUtc valid, not in the past, timezone present.
2. **`assertSlotIsAvailable`** — re-queries the available slots for that date in the user's timezone, then checks exact-millisecond match against the requested start. Closes the read-then-write race for non-malicious clients; the unique constraint handles the rest.
3. **`loadServicePolicy(serviceId)`** — fetches duration/buffer/notice/horizon (or built-in defaults when no service).
4. **`resolveHostUserId(serviceId)`** — three-step fallback: `Service.createdById` → `process.env.DEFAULT_HOST_USER_ID` → first admin sorted by `createdAt asc`. **In-process memoised** in `hostCache: Map`. Throws `BOOKING_NO_HOST` if nothing resolves.
5. **(Optional) ServiceOrder ownership check** if `serviceOrderId` supplied.
6. **`prisma.consultation.create`** with `status: "confirmed"` and `confirmedAt: now` when `autoConfirm` (default true). The unique constraint either accepts or rejects; `P2002` → 409.
7. **`provisionMeetingAndNotify(consultation)`** if auto-confirmed:
   - If Google Calendar isn't configured → log + diagnose, persist `meetingProvider="manual"`, `meetingLink=null`. **Booking still succeeds.**
   - Else → `googleCalendar.createCalendarEvent(...)` (which also dispatches Google's native invite email via `sendUpdates: "all"`). Stores `meetingLink`, `meetingProvider="google_meet"`, `googleEventId`.
   - On Google API failure → same fallback as "not configured" (the comment is explicit: "don't fail the booking; leave the link blank for admin attention").
8. **Email** — controller fires `sendConsultationConfirmationEmail` (locale-aware, ICS-attached) **after** the service returns. Fire-and-forget.

### 4.3 What's elegant about this

- **Single-writer guarantee** is delegated to the database (unique constraint) rather than to application-level locking. This is the *correct* pattern.
- **Best-effort side-effects after commit** — meeting-link provisioning and email are deliberately *outside* the transaction. A 502 from Google does not lose a booking.
- **Status-machine clarity** — `pending | confirmed | scheduled | completed | cancelled | rescheduled | no_show` covers every reachable lifecycle terminus.
- **Custom error codes** (`SLOT_UNAVAILABLE`, `PAST_SLOT`, `BAD_TIMEZONE`, etc.) so the frontend can drive UI without parsing English.

### 4.4 What's not yet right

See §11 — the bullet points worth knowing before you scale.

---

## 5. Availability Algorithm — `availabilityService.js`

This file is the most carefully written code in the booking subsystem.

### 5.1 Design choice: pure function + I/O shells

```
computeSlotsForDate({ dateLocal, displayTimezone, rules, exceptions,
                      busyIntervals, policy, now }) → slots
```

Zero database calls inside `computeSlotsForDate`. Every Prisma read is in `getAvailableSlots` or `getAvailableDaysInMonth`. This means the algorithm is unit-testable in milliseconds without spinning up a database — exactly the right partition.

### 5.2 Algorithm flow (per requested date)

1. Convert `dateLocal + "12:00"` in `displayTimezone` to UTC to obtain a DST-safe day-of-week anchor.
2. Filter rules: `isActive && dayOfWeek === dow`.
3. **Expand each rule** — `expandRuleForDate` walks the window with stride `slotDuration + buffer`, emitting `{ startUtc, endUtc }` pairs.
4. Expand `custom` exceptions the same way (additive windows).
5. Dedupe by `startUtc.getTime()` + sort ascending. (Rule + custom-exception can produce overlapping slots — dedupe is correct.)
6. Subtract `block` exceptions (full-window subtraction via standard interval-overlap predicate).
7. Subtract `busyIntervals` (existing pending/confirmed/scheduled consultations).
8. Apply `minNoticeHours` floor and `maxAdvanceDays` ceiling.

The interval-overlap predicate (`start < otherEnd && end > otherStart`) is canonical and correct.

### 5.3 DST handling

Properly delegates to `date-fns-tz` (`zonedTimeToUtc` / `utcToZonedTime`). The "noon-local anchor" trick to derive day-of-week avoids the midnight-DST-jump trap. **This is correct.** Many home-rolled scheduling systems get this exact case wrong.

### 5.4 `getAvailableDaysInMonth`

Iterates every day in the month (bounded by `bookingMaxAdvanceDays`), runs slot computation in **parallel batches of 7**. Each batch fans out 7 Prisma queries. For a 31-day month with 2-month horizon, that's potentially 90+ DB queries per calendar grid load. Acceptable today; flagged for the optimisation list in §11.5.

### 5.5 Host cache

In-process `Map` keyed by `serviceId`. Cleared on `createRule`. **Not cleared** on `Service.update` (e.g. when an admin changes `createdById`), and **not shared across PM2 cluster workers**. A single restart fixes either; with the in-process scale you have today it's not a real issue.

---

## 6. Reschedule Flow

### 6.1 Behaviour

```
PATCH /api/v1/consultations/:id/reschedule
body: { newStartUtc, newTimezone? }
```

1. Authorization: member can only reschedule their own; admin can do any.
2. State guard: `existing.status ∈ ACTIVE_BOOKING_STATUSES` (pending/confirmed/scheduled).
3. Policy window: member must give 12h notice; admin bypasses.
4. `assertSlotIsAvailable` for the new time.
5. **In a single Prisma `$transaction`**:
   - Mark the old row `status: "rescheduled", cancelledAt: now`.
   - Insert a new row inheriting host/service/user/notes/meeting-link/event-id, with `rescheduledFromId = old.id` and `status: "confirmed"`.
6. After the transaction commits: `googleCalendar.updateCalendarEvent(googleEventId, ...)` — best-effort, Google's `sendUpdates: "all"` issues the change notification.
7. Email fires from the controller after the service returns.

### 6.2 Strengths

- **Audit chain via `rescheduledFromId`** — the original row is preserved with all its notes; you can walk back any number of reschedules. This is better than mutating-in-place.
- **One Google Calendar event across the chain** — the new row inherits `googleEventId`, so the Meet link stays stable for the customer.

### 6.3 Sequence semantics for ICS

`icsGenerator.buildConsultationIcs` uses `rescheduledFromId ? 1 : 0` for `SEQUENCE`. Per RFC 5545 §3.8.7.4, sequence MUST increment monotonically across updates. For a **single** reschedule this works. For a **second** reschedule, the new row has `rescheduledFromId` set but `SEQUENCE` is still `1`, identical to the previous reschedule — many calendar clients will treat the second invite as a duplicate of the first and ignore the time change. Fix: derive sequence from the depth of the chain (count of ancestors) or store an explicit `sequence` column.

---

## 7. Cancel Flow

Straightforward soft-cancel:

```
status        = "cancelled"
cancelledAt   = now
cancellationReason = reason || null
```

- Member needs 12h notice; admin bypasses.
- Best-effort `googleCalendar.cancelCalendarEvent(googleEventId)` after DB commit; Google's `sendUpdates: "all"` mails the cancellation. 404/410 from Google is swallowed silently (event already gone — correct).
- Email follows from the controller with `METHOD:CANCEL` ICS so the customer's calendar removes the event in place. ✅

The 12h window is **hardcoded** in `assertWithinPolicyWindow({ hoursBefore: 12 })`. The `Service` model has `bookingMinNoticeHours` but it controls *booking notice*, not *cancellation notice*. Worth refactoring into a single `cancellationNoticeHours` column.

---

## 8. Google Calendar + Meet Integration (`src/lib/googleCalendar.js`)

This module is exceptionally well-thought-through. Two specific things stand out:

### 8.1 `looksLikeRefreshToken` heuristic

The comment is the best operator-empathy code I've seen in this repo:

> "The bootstrap script has a classic trap: it prompts the operator to paste the OAuth callback URL into the terminal […], then prints the refresh token for them to paste into .env. Mixing those two steps up — pasting the callback URL into .env instead of the printed token — produces a non-token value that googleapis rejects with `invalid_grant` on the FIRST API call, after every booking has already been confirmed."

`isConfigured()` returns false for that misconfiguration, which short-circuits the entire flow to the "manual" branch *before* a single booking is silently broken. `diagnoseConfig()` then surfaces a human message ("did you paste the callback URL by mistake?") on the regen endpoint. This is the kind of detail that costs you an afternoon once and saves a customer-facing failure forever.

### 8.2 Idempotency + graceful degradation

- `createCalendarEvent`: `conferenceData.createRequest.requestId = consultationId + random-salt` — prevents accidental collisions on retry.
- `cancelCalendarEvent`: swallows 404/410 (event already deleted).
- Failed Calendar create returns a structured error with `googleStatus`, `googleError`, `causeCode` — exactly what an operator needs to debug.

### 8.3 Single attendee constraint

Each event has at most one `attendee` (the booking client). Hosts are implicit (the calendar owner). For your current single-host single-customer model this is correct, but **adding co-hosts or a +1 invitee would require a schema change** to `Consultation` (no `additionalAttendees` field exists).

---

## 9. Email + ICS Layer

### 9.1 `utils/mailer.js`

Four locale-aware (en/es) mail flows:
- `sendConsultationConfirmationEmail` (`METHOD:REQUEST`)
- `sendConsultationRescheduledEmail` (`METHOD:REQUEST` with sequence ≥1)
- `sendConsultationCancelledEmail` (`METHOD:CANCEL`)
- `sendConsultationReminderEmail` (English only, called by cron)

Each attaches the ICS three times — `alternatives`, `attachments`, and Nodemailer's `icalEvent` — so Gmail, Outlook, and Apple Mail all surface "Add to calendar". This is the right amount of paranoia.

### 9.2 `utils/icsGenerator.js`

Production-grade. CRLF line endings, RFC 5545 §3.1 line folding (octet-aware to avoid splitting UTF-8 multi-byte sequences), text escaping for backslash/semicolon/comma/newline, `STATUS:CANCELLED` for cancels, embedded `VALARM` reminders matching the 24h/1h cron windows. This is what most teams don't get right; you did.

Minor gaps:
- `SEQUENCE` issue covered in §6.3.
- No `RRULE` support — fine because consultations are one-off, not recurring.
- `URL:` is not escaped — but URLs don't typically contain `;`, `,`, or backslash, so de facto safe.

### 9.3 Reminder duplication risk

The reminder email is plain English. The Google Calendar event itself ships email reminders (line 188 of `googleCalendar.js`: `{ method: "email", minutes: 60*24 }`). For Google-Meet bookings the customer will get **two** 24h reminders — yours plus Google's. Not catastrophic, mildly annoying. Either remove Google's `reminders.overrides` for email and keep yours, or remove the cron's 24h pass and keep Google's. (I'd keep yours: they're branded.)

---

## 10. Reminder Job + Scheduler

### 10.1 `bookingReminderJob.js`

Two windows: 24h±30min and 1h±5min. Every 5 minutes the cron pulls candidates with `reminderSentAt = null OR < 2h ago`, sends, updates the watermark. Plain, idempotent, defensible.

### 10.2 Edge case

The "2h re-eligibility" rule is a single watermark for two different windows. Worked example:

- T-24h: reminder fires, `reminderSentAt = now`.
- T-23h: still within the eligibility delay (≤2h).
- T-1h: 23 hours later, watermark is now way older than 2h → row eligible again. ✅

But: if the 24h reminder fails for any reason and **does not** update the watermark (the code only updates on success), the next 5-min tick re-attempts. Good. If it succeeds but the 1h cron fires within 2h of the 24h send (e.g. tight maintenance windows), the 1h reminder won't go. In practice these are 23 hours apart, so fine — but a `reminderSentAt24h` and `reminderSentAt1h` pair would be cleaner if you ever introduce a 4h reminder.

### 10.3 `scheduler.js`

Defensive about node-cron not being installed; defensive about `DISABLE_CRON=1` for staging. Each job registration is wrapped in its own try/catch so a failed registration of one job doesn't block another. ✅

One thing missing: the scheduler runs in **every** PM2 cluster worker. If you scale to >1 worker the reminder cron will run N times concurrently. Two mitigations: (a) wrap the body in `SELECT … FOR UPDATE SKIP LOCKED` (PostgreSQL only) to claim rows, or (b) restrict the cron to `process.env.NODE_APP_INSTANCE === "0"`. Today, at one worker, it's fine.

---

## 11. Bugs, Risks, and Recommended Fixes

### 11.1 ⚠️ `localDateTimeToUtc(dateLocal, "23:59", …)` — off-by-60s

```js
const dayEndUtc = localDateTimeToUtc(dateLocal, "23:59", displayTimezone)
// later:
scheduledAt: { lt: addDays(dayEndUtc, 1) }
```

This treats `23:59` as the end-of-day boundary, missing the final minute. A 30-min slot starting at `23:30` and ending at `23:59:59.999` ought to be valid; with this code, a hypothetical slot starting exactly at `23:59:30` is not excluded but the window also won't be inclusive of a 23:59:00–00:29:00 cross-midnight slot. The `±1 day` padding around the predicate paper over the edge, but the cleaner fix is to use `00:00` of the next day with strict-less-than, which the existing `lt: addDays(dayEndUtc, 1)` already implicitly does. Recommendation: switch the helper to compute next-day-midnight directly to remove the "23:59" magic number.

**Severity: low.** Hasn't caused a known bug, but it's a smell.

### 11.2 🔴 Unique-constraint model assumes a single host per slot

`@@unique([assignedAdminId, scheduledAt])` prevents one host from being double-booked at the same start time. It does *not* prevent two services with **different** `createdById` hosts from accidentally publishing the same physical time — but if both fall back to the same default admin (via the `DEFAULT_HOST_USER_ID` env var or the "first admin sorted asc" rule), you'd hit the constraint, which is the right outcome.

The real issue: **the constraint uses `scheduledAt` only**, not a `[scheduledAt, endsAt]` overlap predicate. Two bookings of 60 minutes each starting at 09:00 and 09:30 with the same `assignedAdminId` will both pass `@@unique` (different `scheduledAt`) but overlap by 30 minutes. The `assertSlotIsAvailable` re-check **does** catch this on the application path (it generates slots from rules then subtracts existing busy intervals, which use `endsAt`). But a direct row-insert bypassing the service layer — including the admin updating a row's `scheduledAt` directly — would silently create an overlap.

**Severity: medium.** Real today only if duration is variable per booking. Recommendation: add a PostgreSQL `EXCLUDE` constraint using a `tstzrange` (`USING gist (assignedAdminId WITH =, tstzrange(scheduledAt, endsAt) WITH &&)`). Prisma can't express this natively; declare it in a migration `Unsafe()` block.

### 11.3 🟠 Cancellation window is hardcoded, not policy-driven

```js
if (!isAdmin) assertWithinPolicyWindow(existing, { hoursBefore: 12 })
```

The `Service` model has `bookingMinNoticeHours` (controls when you can *book*) but no equivalent for *cancel/reschedule notice*. A premium service might want a 48h cancellation window; a free discovery call might want 1h. Recommendation: add `bookingCancellationNoticeHours` and `bookingRescheduleNoticeHours` to `Service`, default both to 12 to preserve current behaviour, read in `assertWithinPolicyWindow`.

### 11.4 🟠 `bookingRequiresPayment` is declared but never enforced

`Service.bookingRequiresPayment` exists in the schema and is never read anywhere in `bookConsultation`, `consultationService`, or `availabilityService`. A free booking should be allowed when `bookingRequiresPayment=false` and **rejected without a valid `serviceOrderId`** when true. Today, a client can book any "paid" service for free.

**Severity: high if you ever flip this flag on a real service.** Recommendation:

```js
if (policy.bookingRequiresPayment && !serviceOrderId) {
  throw Object.assign(new Error("This service requires a paid order"),
    { statusCode: 402, code: "PAYMENT_REQUIRED" })
}
```

### 11.5 🟡 `getAvailableDaysInMonth` does ~30 sequential slot computations

For a 31-day month, you make ~31 calls to `getAvailableSlots`, each of which runs 3 Prisma queries. ~93 round-trips per calendar grid render. Recommendation: rewrite as a *single* fetch of (rules, exceptions, all busy intervals in the month) then run `computeSlotsForDate` in a tight loop over the dates in-process. The pure-function design *is the reason this is easy*; you already paid the architectural price.

### 11.6 🟡 No public endpoint to fetch a service's booking policy

The frontend calendar component (`BookingCalendar.jsx`) probably re-renders slots after a booking succeeds. The duration / buffer / notice values live only on the `Service` row, but `/api/v1/availability/slots` returns slots with their own `durationMin` — it never returns the policy itself. Consider `GET /api/v1/services/:slug/booking-policy` returning `{ duration, buffer, minNoticeHours, maxAdvanceDays }` so the frontend can render explanatory copy ("Bookings open 60 days out, latest 24h before") without hardcoding numbers.

### 11.7 🟡 `paymentRateLimiter` reused for `POST /consultations`

The route comment explains the reasoning (10/hour/user, both flows touch expensive rows). Reasonable, but consider a dedicated `bookingRateLimiter` so the metric is queryable in isolation and the limit can be tuned (e.g. 5/hour) without affecting actual payments.

### 11.8 🟢 Authorization spot-check

- `consultationRoutes.js` — `protect` middleware applied after the public `by-token` lookup. ✅
- `adminAvailabilityRoutes.js` — `protect, adminOnly` on every endpoint. ✅
- `adminUpdateConsultation` allows the admin to set any `assignedAdminId` — but doesn't validate that the user with that id is actually an admin / active host. Recommendation: validate `User.role === "admin"` in the patch validator.

### 11.9 🟢 Missing `not_show` (typo guard) and observability hooks

The enum is `no_show` (correct). The frontend `bookingService.js` doesn't have a helper for the admin marking no-shows or completing meetings — admins use the generic `adminUpdateConsultation`. This is fine but adds friction in QA. Consider explicit `adminMarkNoShow(id)` / `adminMarkCompleted(id, summaryNotes)` helpers for clarity.

### 11.10 🟢 Reminder cron will multi-fire under PM2 cluster

Covered in §10.3. Today: single worker, no issue. Future: race two workers and you'll send duplicate reminders.

---

## 12. Concrete Patch Priority (recommended sprint)

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | Enforce `bookingRequiresPayment` in `bookConsultation` | XS | High (functional bug) |
| 2 | Make cancellation/reschedule windows service-policy-driven | S | High (product) |
| 3 | Add PostgreSQL `EXCLUDE` constraint for overlapping consultations | S | High (data integrity) |
| 4 | Fix ICS `SEQUENCE` to count reschedule depth | XS | Medium (calendar UX) |
| 5 | Rewrite `getAvailableDaysInMonth` to one-shot Prisma + in-process loop | S | Medium (perf) |
| 6 | Validate `assignedAdminId` in `adminUpdateConsultation` patch | XS | Medium (auth) |
| 7 | Add `GET /services/:slug/booking-policy` public endpoint | XS | Low (DX) |
| 8 | Drop Google's email reminder overrides to avoid duplicates | XS | Low (UX) |
| 9 | Cluster-safe reminder cron (instance-0 gate or row-locking) | S | Low (until you scale) |
| 10 | Dedicated `bookingRateLimiter` (observability) | XS | Low |

Total: ~2 days of focused work, all reversible, all unit-testable against the existing pure-function algorithm.

---

## 13. Things You're Doing Right (worth keeping)

These are the patterns I'd lift verbatim into another project:

1. **Pure-function algorithm + I/O shells in `availabilityService.js`** — full slot generation has zero Prisma calls; trivial to unit test.
2. **Stable error codes alongside HTTP status codes** — `SLOT_UNAVAILABLE`, `POLICY_WINDOW`, `BOOKING_NO_HOST` etc. let the frontend drive UI without parsing English.
3. **`looksLikeRefreshToken` operator-empathy heuristic** — flags the *one* misconfiguration mode that would otherwise corrupt every booking silently.
4. **DB-enforced concurrency** rather than application-level locking.
5. **Two-stage commit** — DB write inside transaction; provider side-effects (Calendar, email) outside it. Standard pattern, executed correctly.
6. **Reschedule preserves identity** via `rescheduledFromId` self-relation + inherited `googleEventId`.
7. **RFC-5545-compliant ICS** with proper line folding, escape sequences, and `METHOD:CANCEL`/`STATUS:CANCELLED`.
8. **Admin audit log inside the same transaction** as the consultation mutation — never one without the other.
9. **`DISABLE_CRON=1`** environment escape hatch.
10. **Best-effort everything** — Google Calendar failure does not lose bookings, email failure does not lose Calendar events, audit log failure does not lose anything.

---

## 14. Closing Note

Your booking module reads like someone who has shipped this kind of system before and knew where the foot-guns were. The remaining defects are not architectural — they're operational seams that show because the system is well-architected enough for the seams to even be visible. Fix the ten items in §12 and you have a multi-host-capable scheduling product the rest of the industry would charge for.

If you want, the natural next pieces are: (a) implementing the `EXCLUDE` constraint migration, (b) wiring the policy-driven cancellation windows, or (c) the multi-host extension (`Host` model, `hostId` on `AvailabilityRule`, breakup of the "first admin" fallback).
