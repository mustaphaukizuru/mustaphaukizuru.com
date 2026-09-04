# Brand Identity v3.1 — citation index

**This is an index, not a specification.** Thirty-odd source comments cite
"Brand v3.1" or "Brand Identity v3.1" with a section number — `§00`, `§08`,
`§14` — and no such document was ever in this repository. The narrative brand
specification here is **§ 09 of [`PROJECT_INSTRUCTIONS.md`](PROJECT_INSTRUCTIONS.md),
"BRAND IDENTITY SYSTEM v3.0"**. The v3.1 revision reached the code without
reaching the documents, so the citations pointed at nothing (T2-7).

Rather than invent spec prose after the fact, this file records **where each
cited section's rule actually lives**, so every citation resolves to something
a reader can check. The implementation is the authority; if this index and the
code disagree, the code is right and this file is stale.

The token system's own reference is [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)
(versioned separately, v1.2), whose source of truth is
`web/src/styles/tokens.css`.

## Sections cited from source

| Cited as | The rule | Where it is implemented | Enforced by |
|---|---|---|---|
| `§00` "Default Mode: Light" | The canonical brand is the light surface. `system`, and any theme that is not explicitly `dark`, resolves to light. The admin and dashboard subtrees are anchored to light regardless. | `web/src/styles/tokens.css` (the `:root` palette is the light one), `web/src/components/ui/ThemeSwitcher.jsx`, `web/src/layout/DashboardLayout.jsx`, `web/src/components/admin/AdminSidebar.jsx` | — (dark-mode *scope* is still an open decision; T3-2 settles it and writes ADR 0002) |
| `§08` third-party brand colours | A vendor's own hue is preserved and never re-tinted to our palette — re-tinting a payment rail's mark breaks the trust cue it exists to provide. | `web/src/components/TechStackShowcase.jsx`; the exemption list in `web/scripts/check-raw-hex.mjs` (`ALLOW`, category "third-party brand marks") | `npm run lint:tokens` |
| `§14` numerals | KPIs, prices, metrics and timestamps set in JetBrains Mono with `tabular-nums`, so a changing figure does not shift the layout around it. | `web/src/lib/format.js`, `--font-mono` in `web/src/index.css` | `npm run lint:tokens` (font literals) |
| status-state tokens | Success / warning / danger / info tints come from tokens, never from ad-hoc hex. | `web/src/styles/tokens.css`, `web/src/pages/ErrorPage.jsx` | `npm run lint:tokens`, `npm run lint:contrast` |
| slide-template display type | Sora Extra-Bold for generated cover artwork. | `web/src/components/BlogCoverGradient.jsx` | — |

## Sections cited as v3.0

These resolve into `PROJECT_INSTRUCTIONS.md` § 09 and are correct as written:
`§ 04` (palette anchors), `§ 05`, `§ 09` ("The Proof Layer — Data
Visualization"), `§ 11`, `§ 18`.

## Keeping this honest

`test/documentCitations.test.js` greps the source for every
`<Document> v<major>.<minor>` citation and fails when the named version has no
document in `docs/`. That is what makes the difference between a citation and
a decoration.
