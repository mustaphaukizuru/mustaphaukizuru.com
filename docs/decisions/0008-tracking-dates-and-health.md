# 0008 · Dates and an on-time indicator on the anonymous tracking page

**Date:** 2026-09-05 · **Status:** accepted · **Item:** T5-12
**Extends:** [0006 · What an anonymous tracking code may reveal](0006-tracking-code-public-surface.md)

## Decision

The public tracking response gains five fields:

| field | what it is |
|---|---|
| `health` | `on_track` \| `at_risk` \| `late` |
| `expectedAt` | the soonest date still ahead among open milestones |
| `lateCount` | how many open milestones are past their agreed date |
| `openCount` | how many milestones are open |
| `milestones[].dueDate`, `milestones[].estimatedAt` | per milestone |

0006 stays as written and is not edited. This record is the change to it that
0006's own text says any addition must be.

## Context

T5-12 gives the tracker the thing a phase strip cannot say: whether the work
will be ready when the client was told. That needs dates on the anonymous
surface, and 0006 governs what may appear there — its own text says adding a
field is a change to it rather than a convenience during a frontend task.

The three allowlist tests failed on the change, which is what they exist for.
This record is the answer they were asking for.

## Why this passes, when the invoice total does not

0006's rule is not "no more fields". It is that someone holding a forwarded
code learns only that **work is progressing**, and never anything about
money, identity, or content. The test for a new field is what it would tell a
stranger who was never meant to have the code.

These five say: *a date this client already agreed to, and whether it will be
met.* A client cannot have a schedule they were not told, so the dates were
already theirs; and "on time / behind / late" is a judgement about those
dates rather than new information about the work.

What that does NOT extend to, and the reason each is still refused:

- **an amount** — tells whoever holds a forwarded link what this engagement
  is worth, and whether the client is behind on paying for it
- **a milestone description** — carries scope notes, names and figures
- **a project or client name** — 0006's central prohibition, unchanged
- **why a date moved** — a reason is a conversation. The `milestone.rescheduled`
  event carries the two dates and nothing else, deliberately.

## The one thing this does leak, stated plainly

A stranger holding the code can now see that a project is **late**. That is a
small, real fact about the client's engagement with us that they could not
see before.

It is accepted because the alternative is worse for the same client: a
tracking page that shows a phase and a percentage while quietly omitting that
the date has passed is a page that misleads the person it was built for. A
tracker that only reports good news is not a tracker.

It is also bounded. "Late" says nothing about how late, what is late, why, or
what it costs — `lateCount` is a count of milestones, and the milestone
titles were already public under 0006.

## Two dates, not one

`dueDate` is the COMMITMENT: what was agreed, and what a slip is measured
against. `estimatedAt` is the current honest belief. Publishing only one
would defeat the feature — a client who sees both knows a date has moved; a
client who sees one discovers it on the day nothing arrives.

`health` is computed from both: late is measured against the commitment, at
risk is the estimate having passed it.

## Consequences

- The allowlist tests in `test/trackingGuardrails.test.js`,
  `test/projectTracking.test.js` and `test/projectPanels.test.js` are updated
  to the new set. They failed on this change, which is what they are for —
  the next addition will fail them too, and should.
- Closed milestones are excluded from every health calculation. A project
  that slipped once and finished would otherwise read "late" forever, and an
  indicator that is always red is not an indicator.
- A date that moves by more than two days writes a **public**
  `milestone.rescheduled` event. Two days rather than any movement, because
  an event per wobble teaches a client to stop reading the timeline.
