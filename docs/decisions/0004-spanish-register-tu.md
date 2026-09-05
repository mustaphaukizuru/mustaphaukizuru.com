# 0004 · Spanish addresses the reader as `tú`

**Date:** 2026-09-04 · **Status:** accepted · **Item:** T2-5 / T2-8

## Context

Spanish has two registers for addressing a reader, and a site has to pick one:
`tú` (informal, direct) or `usted` (formal, deferential). Mixing them inside
one page reads as carelessness in a way an English reader never experiences,
and the choice is not neutral — it sets how the practice sounds.

The Spanish copy already answers this in practice. Across
`web/src/i18n/locales/es/*.json`, `servicesCatalogue.js`'s `*Es` fields,
`pageSeoEs.js` and `prisma/seed-audience-plans.js`:

- `tu` appears 202 times, `tus` 47, plus `puedes`, `tienes`, `necesitas`,
  `quieres`, and `tú` itself;
- **`usted` appears nowhere at all**, in any file.

The apparent third-person verbs that a grep turns up — `se puede hacer`,
`no tiene archivos descargables`, `el Consultor puede conservar`, `también te
puede interesar` — are impersonal or third-person constructions, not `usted`
address.

**Corrected 2026-09-04 (T2-5).** This record originally concluded "there is no
register drift to fix". That was wrong, and wrong in an instructive way: the
scan behind it looked for the pronoun `usted` and a short list of verbs, and
the register does not live in the pronoun — it lives in the conjugation.
`web/src/i18n/locales/es/schools.json` asked "¿Trabaja con colegios
pequeños?" in `usted` while every other question on the site asks in `tú`,
which reads as a different person answering that one question. Fixed in T2-5.
The decision below is unchanged; only the claim that it was already perfectly
applied was false.

## Decision

**`tú`.** Spanish is authored in the informal register, and it is authored
first — the catalogue's Spanish fields are the primary voice, with English as
a faithful translation, which is what `servicesCatalogue.js` has said since it
was written.

This matches the audience. The primary market is Mexico, the buyers are SMB
owners, independent professionals and school directors, and the practice is
one named person rather than a firm. `usted` would put a counter between the
reader and the person they would actually work with.

Two exceptions, and only two:

- **Legal and fiscal text** — terms, privacy, refund policy, CFDI and invoice
  copy — keeps its own conventional formal register where Mexican legal usage
  expects it. That text is quoting an obligation, not speaking to a prospect.
- **Quoted third-party material** keeps whatever register it came with.

## Consequences

- Any new Spanish string uses `tú`. A reviewer can check a translation against
  one rule instead of arguing about tone per string.
- Machine translation defaults to `usted` for business copy in most engines,
  so translated drafts need a register pass before they land. This is the
  likeliest way the rule gets broken.
- Reversing it later is a full re-translation of every user-facing string, not
  a find-and-replace: the register changes verb forms, pronouns and possessive
  agreement throughout. That is why it is written down now, while it costs
  nothing to state.
- T2-5 still owns the remaining work this record does not do: translating the
  sellable content that has no Spanish yet. That is a coverage problem, not a
  register one.
