# 0006 · What an anonymous tracking code may reveal

**Date:** 2026-09-05 · **Status:** accepted · **Item:** T5-2

> Superseded the `proposed` version of this record, which stated the question
> and the options without choosing. Decided here, in the change that builds
> the endpoint, as that record required.

## Context

T5-1 and T5-2 introduce a per-project tracking code and
`GET /api/v1/track/:code` — **the first unauthenticated endpoint on this
platform that returns data about a specific, named client engagement.**
Everything else public is either catalogue content (products, services, blog)
or write-only (contact, newsletter, webhooks).

A tracking code is shared the way tracking codes always are: pasted into
email, forwarded, screenshotted into a group chat. It has to be assumed public
the moment it is issued. Whatever the endpoint returns is therefore, in
practice, world-readable — read without any prior claim of identity, so there
is no user to attribute a leak to and no session to revoke.

The code carries about 2^39.3 of entropy. That is a lookup key, not a secret,
and it is never used for authorisation.

## Decision

**An allowlist, in one serializer, and the three open questions answered
conservatively.**

### The rule that outlives the first version

The endpoint returns **only fields named in one explicit projection**, and
that projection lives in a single function. Adding a field to it is a change
to this record, not a convenience during a frontend task. The risk was never
the first version; it is the fourth, when somebody adds the invoice total
because a page needed it.

### What it returns

- the project's **phase** (`projectStatus`) and percent complete
- **milestone titles with status** — titles only, no descriptions
- events with `visibility = "public"`, projected to **type, title and
  timestamp**
- a **count** of open document requests
- `startDate` and `dueDate`

`serializePublicEvent` deliberately drops `detail` even though only public
rows reach it. `detail` is free text written by whoever recorded the event,
and the anonymous surface must not depend on every future caller having been
careful about what they typed into it.

### 1. Is the project name public? **No.**

A project name is very often the client's own name, or names the thing they
have not announced yet ("Acme storefront relaunch"). The response carries a
`reference` — the tracking code itself — and the phase. Someone who holds the
code already knows which project it is; someone who found it does not learn
who the client is.

### 2. Are the deep links returned? **No.**

The `proposed` record flagged that returning `/portal/<token>` in a response
keyed by a shareable code turns a shareable code into a portal credential.
That is exactly what it does, so it is not returned. The response links to
`/portal` and `/dashboard` as **destinations without tokens**: someone who
belongs there can sign in, and someone who does not gains nothing.

### 3. Does the code expire? **At handover plus the grace window.**

`ClientProject.closedAt` already exists and `PROJECT_ACCESS_GRACE_DAYS`
already governs how long a closed project stays readable. The tracking
endpoint reuses both rather than inventing a second lifetime: a code stops
answering when the project has been closed longer than the grace window. A
code shared during delivery does not keep answering forever, and nothing new
has to be remembered or rotated.

### Behaviour under probing

- **Unknown code and expired code answer identically** — 404, same shape, same
  timing. A distinguishable "expired" response confirms that a code was once
  real, which is a small oracle but a free one to close.
- **Rate limited** at 30 per 15 minutes per IP, on top of the global limiter.
  Against 2^39 that makes enumeration impractical; the limit, not the length,
  is what does the work.
- **Ten consecutive misses from one IP is logged** at warn, so a sweep is
  visible rather than merely slow.

## Consequences

- The public page can show progress and cannot show identity, money, file
  names or comments. That is the intended trade: enough for "where is my
  project", nothing for someone who found a forwarded link.
- A frontend that wants more has to come back here first. That is the point.
- T5-7 tests this surface and T4-1's external reviewer is asked to grade it.
- If a client ever wants a genuinely public status page with their name on
  it, that is a per-project opt-in flag and a new record — not a change to
  the default.
