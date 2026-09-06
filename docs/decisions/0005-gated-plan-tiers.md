# 0005 · The expensive plan tiers are scoped on a call, not self-served

**Date:** 2026-09-04 · **Status:** accepted · **Item:** T2-4

## Context

The audience plans run from MXN 5,800 to MXN 90,000 per month, and every tier
linked straight into `/checkout/service?audience=<code>&tier=<key>`. A school
could put a 90,000/month retainer on a card without a call, without a written
scope, and without anyone having agreed what the first month contains.

Two properties of this platform make that worse than it looks:

- **Refunds are full-only** by policy — there are no partial refunds. So the
  first thing that goes wrong on a five-figure self-served retainer is a full
  reversal, with the work already started and nothing written down about what
  was owed.
- Delivery is one person. A retainer that arrives without a conversation
  arrives without capacity having been checked against it.

The cheaper tiers do not have this problem. A Professional Basic plan at MXN
5,800 is a product someone can reasonably buy from a page.

## Decision

A tier is **quote-only** — it links to `/book?plan=<audience>.<tier>` instead
of the checkout — when either is true:

1. it is named in `QUOTE_ONLY_TIERS` (the Business and Schools top tiers), or
2. its price is at or above `QUOTE_ONLY_MXN_PER_MONTH` (MXN 50,000/month).

Both rules, not one. The named list expresses the intent for the two tiers we
know about; the price threshold is what keeps holding, because prices come
from the database and are edited in `/admin/services`. A name-only list would
silently un-gate a tier the moment someone raised its price past the point
where a call is the responsible entry — which is precisely when it matters.

The threshold sits at 50,000 because it separates the two top tiers (70,000
and 90,000) from Schools Medium at 48,000, the most expensive tier a buyer can
still reasonably self-serve.

A gated tier reads "Book a call" as **visible link text**, not an aria-label:
the label is what tells a visitor the tier is scoped first, and visible text is
also what Lighthouse's `link-text` audit reads.

## Consequences

- Two tiers stop converting on the page and start converting on a call. That
  is intended: the call is where scope is agreed, and the proposal is where
  the number is confirmed.
- `BookConsultationPage` reads `?plan=` and shows which plan the visitor was
  looking at, so they do not have to re-explain it. An unknown or malformed
  value is ignored rather than echoed, since the value is rendered.
- There is no service slug in that link — an audience plan is not one of the
  four catalogue categories — which is why it is `?plan=` rather than
  `bookHref`'s `?service=`.
- Raising any tier past MXN 50,000 gates it automatically. Lowering one below
  does not un-gate the two named tiers.
- The generated packages reference prints which tiers are quote-only, so the
  document a proposal is written from says the same thing as the page.
