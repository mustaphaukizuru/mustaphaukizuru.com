# Consulting Booking Flow · audit + fixes + operator notes

**Date:** May 6, 2026  
**Scope:** End-to-end audit of the consultation booking flow — slot
discovery, booking creation, race-protection, reschedule/cancel, and
email side-effects. Patches applied for code-fixable gaps.

## Headline finding

**Spanish customers booking consultations were getting English emails.**
The consultation flow ran on the legacy hardcoded-HTML mailer
functions in `src/utils/mailer.js`, completely bypassing the
template-DB locale routing that landed in I18N Phases 4A/5B. A
Mexican customer who clicked "Reservar consulta" in Spanish, picked
a slot, and confirmed got back:

- Subject: "Booking confirmed · ..." (English)
- Body: "Thanks for booking. Here are your meeting details:" (English)
- CTA: "View in Dashboard" (English)
- Footer: "Need to change plans? ... at least 12 hours before the call."

That breaks the bilingual launch promise at the most important
touchpoint — the moment a customer commits.

Fixed.

## Issues found and fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **High (bilingual rollout)** | All three consultation emails (confirmation / reschedule / cancellation) hardcoded English copy | Added `bookingCopy(locale)` helper in mailer.js with full Spanish strings; controller resolves locale via `resolveUserLocale({ req })` and threads it through |
| 2 | Medium (DoS) | No rate limit on `POST /api/v1/consultations` — authenticated user could spam bookings + emails | Added `paymentRateLimiter` (10/hour/user). Reschedule/cancel intentionally NOT rate-limited (corrective actions) |
| 3 | Low (observability) | Reminder email function `sendConsultationReminderEmail` exists but isn't called from anywhere — 24h-before reminders never fire | Documented as operator-side task (needs cron/scheduled-task wiring) |

## What was already solid

The booking flow is otherwise excellently architected:

- **Race protection at the schema level** —
  `@@unique([assignedAdminId, scheduledAt])` guarantees that two
  simultaneous booking attempts at the same start time → exactly one
  succeeds. The other gets P2002 → mapped to 409.
- **Stale-data defence** — `assertSlotIsAvailable()` re-validates the
  requested startUtc against the live availability list before
  writing. Closes the read-then-write race window for non-malicious
  clients; the unique-constraint handles the rest.
- **12-hour window enforcement** on cancel/reschedule — members get
  it, admin can override.
- **Reschedule audit chain** — old row marked `rescheduled` not
  deleted; new row carries `rescheduledFromId` pointing back. Full
  history preserved.
- **Token-based guest cancel/reschedule** — cancel/reschedule emails
  embed a 32-byte URL-safe token; recipient can act on the booking
  without logging in.
- **ICS calendar attachment** — every confirmation/reschedule/cancel
  email carries the proper `method: REQUEST` or `method: CANCEL` ICS
  payload so customers' calendar apps add or remove the event
  automatically.
- **Service-order linkage** — bookings created against a paid
  ServiceOrder validate `userId` ownership before writing.
- **Past-time guard** — `bookConsultation` rejects `startUtc` before
  `new Date()`.
- **Booking policy resolved per service** — `loadServicePolicy` reads
  the duration/buffer/notice/advance fields off `Service` so each
  service can have its own booking rules without code changes.
- **Atomic reschedule** — old-cancel + new-create wrapped in a
  Prisma `$transaction` so either both rows land or neither does.

## Operator-side smoke tests · run before public booking launch

These need a real Hostinger deployment + an inbox to verify emails:

### Booking creation

1. **Spanish locale email** — sign in with a Spanish-locale profile
   (or set `Accept-Language: es-MX` on the request), book a
   consultation, confirm the email subject reads "Reservación
   confirmada" and the body is in Spanish.
2. **English locale email** — same as above with English profile,
   confirm regression-free.
3. **ICS attachment** — open the email in Apple Mail / Outlook /
   Gmail mobile, confirm the calendar event appears with correct
   start time + duration + meeting link (when present).
4. **Stale-slot defence** — open two browser tabs to /book/:slug,
   load the same slot list, click the same slot in both tabs.
   Second click → 409 SLOT_UNAVAILABLE.
5. **Past-time guard** — manually craft a request with `startUtc`
   set to a past time. → 400 PAST_SLOT.
6. **Rate limit** — book 11 times in an hour. The 11th → 429.

### Reschedule + cancel

7. **12-hour window** — try to cancel a booking less than 12 hours
   from start time as a regular member. → 400 POLICY_WINDOW.
   Same as admin → succeeds.
8. **Reschedule audit** — reschedule a booking, query both rows.
   Old: status=rescheduled, cancelledAt set. New: status=confirmed,
   rescheduledFromId points to old.
9. **Token-based guest cancel** — open the cancel link from the
   confirmation email in an incognito window (no auth). The
   `/by-token/:token` endpoint should return the booking metadata
   (no email/sensitive fields). Cancel from there → success.

### Reminder emails (post-launch)

10. **Wire a cron/scheduled-task** — `sendConsultationReminderEmail`
    is implemented but isn't called from anywhere. Production-ready
    options:
    - **Hostinger cron** — run `node scripts/send-reminders.js`
      every 30 minutes; the script queries
      `consultation.findMany({ where: { scheduledAt: { gte: now+23h, lt: now+25h }, status: "confirmed", reminder24hSentAt: null } })`
      and fires reminders.
    - **PM2 or Upstart task** — a Node interval timer running inside
      the main app process.
    - **External scheduler** — cron-job.org pinging an
      authenticated `/api/admin/consultations/run-reminders` endpoint.
    The schema doesn't currently have a `reminder24hSentAt` column —
    add via `npx prisma db push` after deciding which scheduler
    approach to use.
11. **No-show flow** — `markNoShow` is referenced in service
    comments but no admin endpoint surfaces it. Add to
    `adminConsultationsController` if no-show tracking is launch-required.

## Files changed

```
src/controllers/consultationController.js  — locale resolution + threading
src/routes/consultationRoutes.js           — paymentRateLimiter on POST
src/utils/mailer.js                        — bookingCopy() i18n helper +
                                              three function bodies updated
docs/BOOKING_FLOW_REPORT.md                — this file
```

## What was deliberately deferred

- **Migrating consultation emails to DB-backed `EmailTemplate` rows** —
  rejected. The ICS calendar attachment is critical UX and the template
  service doesn't yet support attachments. Branching copy in the legacy
  mailer keeps full ICS support.
- **Reminder email scheduler** — needs an operator decision on cron vs.
  in-process timer vs. external pinger, plus a schema migration to
  track `reminder24hSentAt`. Documented above as a launch-readiness task.
- **`markNoShow` admin endpoint surfacing** — depends on whether
  Mustapha wants no-show tracking exposed in the admin UI before
  public launch.
- **Calendar provider integration** (Google Calendar / Cal.com) —
  bigger feature, out of scope. The current ICS-attachment approach
  is a perfectly valid v1.

## Verification

- 504 / 504 source files parse cleanly via Babel.
- All three patched files validated independently.
- Mexican Spanish copy follows the user-preferences style guide:
  - `tú` form (informal-professional)
  - "reservar" not "agendar" for booking actions
  - Tech terms preserved as loanwords where idiomatic
  - RAE-compliant accents
- Backward-compatible — every new parameter is optional. Calls to
  the email functions without `{ locale }` continue to render
  English exactly as before.

---

**Bottom line:** The booking flow was already well-built — race
protection, audit chain, atomic reschedules, ICS attachments, the
12-hour policy window. The big launch blocker was the silent English-
only email regression that would have undermined the bilingual rollout
at the most important touchpoint. Fixed. Plus a rate limit so an
authenticated user can't spam bookings. Eleven operator-side smoke
tests listed for sandbox + real-inbox verification.
