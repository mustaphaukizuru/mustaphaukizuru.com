# Architecture decision records

One short file per decision a future contributor would otherwise reopen: context, decision, consequences, date. Written in the same pull request as the code that decides it (the project's rule is that instructions change with the code). Numbered, never edited after acceptance; a reversal is a new record that supersedes the old one.

## Status has two values here, and the difference matters

**`accepted`** — decided, and the code implements it. Do not reopen without writing a superseding record.

**`proposed`** — *not decided.* The record exists so the question is visible and does not get answered by accident, in a hurry, by whoever touches that code next. A proposed record states what is true today, the options, and what blocks the choice. Nothing in it is a decision, and no code depends on one. Whoever decides edits that file to `accepted` in the same change as the code.

One record below is `proposed` because deciding it would mean inventing an answer: a pricing call with revenue consequences that belongs to the owner (T2-11).

0006 was `proposed` for the same reason and is now `accepted`: T5-2 built the endpoint it governs, so the question stopped being hypothetical and was answered in that change — which is exactly the transition this folder is for. 0002 made the same transition in T3-2: the dark-mode scope is decided (operator-only), with the cost of the alternative measured rather than guessed and the condition that would reopen it written down.

| # | Decision | Status | Item |
|---|---|---|---|
| [0001](0001-tracked-spa-bundle.md) | The SPA bundle is committed, not built on the server | accepted | T1-7 |
| [0002](0002-public-dark-mode-scope.md) | How far dark mode reaches | accepted | T3-2 |
| [0003](0003-product-currency.md) | Store prices are MXN, and the figures were wrong | accepted | T2-4 |
| [0004](0004-spanish-register-tu.md) | Spanish addresses the reader as `tú` | accepted | T2-5 / T2-8 |
| [0005](0005-gated-plan-tiers.md) | The expensive plan tiers are scoped on a call | accepted | T2-4 |
| [0006](0006-tracking-code-public-surface.md) | What an anonymous tracking code may reveal | accepted | T5-2 |
| [0007](0007-packages-vs-offerings.md) | Whether a package and a standalone offering may price the same work differently | **proposed** | T2-11 |
| [0008](0008-tracking-dates-and-health.md) | Dates and an on-time indicator on the anonymous tracking page | accepted | T5-12 |

`test/decisionRecords.test.js` checks the shape of every record and that this index lists each one with the status the file itself declares — an index that drifts from the records is worse than none.
