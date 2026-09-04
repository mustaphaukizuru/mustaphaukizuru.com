# 0006 · What an anonymous tracking code may reveal

**Date:** 2026-09-04 · **Status:** proposed — NOT DECIDED · **Item:** T5-2

> This record exists so the next contributor does not decide it by accident.
> It states the constraint and the shape of the contract. T5-2 builds it and
> edits this file to `accepted` in the same change, with the final field list.

## Context

T5-1 and T5-2 introduce a per-project tracking code and
`GET /api/v1/track/:code` — **the first unauthenticated endpoint on this
platform that returns data about a specific, named client engagement.**
Everything else public is either catalogue content (products, services, blog)
or write-only (contact, newsletter, webhooks).

A tracking code is shared the way tracking codes always are: pasted into
email, forwarded, screenshotted into a group chat. It has to be assumed
public the moment it is issued. So whatever the endpoint returns is, in
practice, world-readable — and it is read without any prior claim of identity,
so there is no user to attribute a leak to and no session to revoke.

The plan already narrows it: phase and percent complete, milestone titles with
status, `visibility = "public"` events (type, title, timestamp, no detail), a
count of open document requests, and two deep links. Explicitly never:
amounts, file names, comment bodies, or the client's name. Unknown codes 404
with the same timing as a hit, and a rate limiter allows 30 attempts per 15
minutes per IP against 40 bits of code entropy.

## What is actually undecided

The mechanism is designed; the **contract** is not written down, and it is the
contract that matters, because the endpoint will be extended later by someone
who did not design it. Three questions:

1. **Is the project name public?** The plan lists "project name" in the
   response. A project name is very often the client's name, or names the
   thing they have not announced yet ("Acme storefront relaunch"). Options:
   return it, return a client-chosen public label, or return nothing but the
   phase.
2. **Are the deep links safe to return?** `/portal/<token>` in a response
   keyed by a shareable code turns a shareable code into a portal credential.
   The portal has its own PIN (T5-8), which may or may not be enough.
3. **Does the code expire?** Nothing in the plan retires a code at handover,
   so a code shared during delivery keeps answering forever.

## The rule this record proposes, whatever the answers

The endpoint returns **only fields on an explicit allowlist**, the allowlist
lives in one serializer, and adding a field to it is a decision someone
writes down here — never a convenience during a frontend task. The risk is
not the first version; it is the fourth, when somebody adds the invoice total
"because the page needs it".

T5-7 tests this surface and T4-1's external reviewer is asked to grade it.

## Consequences of leaving it open

None yet — the endpoint does not exist. It must not ship before this record is
`accepted`, because "what may this return" is exactly the question that gets
answered implicitly by whatever the first page happens to render.
