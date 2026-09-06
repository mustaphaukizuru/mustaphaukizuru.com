# 0003 · Store prices are MXN, and the figures were wrong

**Date:** 2026-09-04 · **Status:** accepted · **Item:** T2-4

## Context

Six downloadable products were seeded at 10 to 18 with `currency: "MXN"`
hardcoded in `prisma/seed/products-seed.js`, and the `Product.currency` column
defaults to `MXN` in the schema. So a toolkit was on sale for ten pesos —
about USD 0.50, less than the payment-processing fee on the transaction, and
below the amount either gateway will meaningfully settle.

The figures were authored as USD. The catalogue's own pricing basis is
`USD 30/hour at a flat 20 MXN/USD`, so the whole project thinks in dollars and
publishes in pesos; somebody wrote the dollar amount into the peso column.

Three other things were true and constrained the fix:

- three service-shaped rows in the same seed carried 150, 300 and 120, which
  are plausible as either currency, so the mistake was not visually obvious;
- `prisma/seed/services-seed.js` set `currency: "USD"` on the four legacy
  service rows, so the database already held two currencies;
- the seed's `update` branch deliberately refreshes only marketing copy so
  admin price edits survive a re-run, which means the seed cannot correct
  rows that already exist.

## Decision

**MXN, everywhere, with the figures corrected by the documented basis.**

Prices are authored as `priceUsd` in the seed and the row price is
`priceUsd * MXN_PER_USD` (20). `assertPlausiblePrices()` refuses to seed any
product whose converted price is under MXN 50 — the shape of the original
mistake, so it cannot recur silently.

Switching the column to USD was rejected. MXN is the schema default, IVA at
16 % and CFDI invoicing are computed in it, the primary market is Mexico, and
MercadoPago settles in pesos. A mixed-currency catalogue would reach the cart,
the order totals, the refund path and the invoice service — a much larger
change than a conversion, in exchange for nothing the buyer sees.

`scripts/fix-store-products.js` corrects rows already in a database, since the
seed will not. It is idempotent (a price already above the floor is skipped),
reversible with `--undo`, and guarded like `db:push` — local unless
`ALLOW_PROD_DB=1` is set deliberately.

## Consequences

- Six live prices go up twentyfold, from MXN 10–18 to MXN 200–360. That is the
  correction, not a repricing: nobody intended to sell a toolkit for fifty US
  cents. It still needs the owner to run the script against production after a
  backup, and to read the `--dry-run` first.
- Any order taken at the old price stands. The script touches products only.
- `pageSeo.js` reads `product.currency` for the OG price meta, so the corrected
  rows are also what crawlers and shopping surfaces see.
- The legacy `currency: "USD"` service rows are retired (see T2-4), so the
  database holds one currency again.
- A future genuine second currency is a bigger decision than this one, and
  reopening it means designing for mixed-currency carts, not flipping a column.
