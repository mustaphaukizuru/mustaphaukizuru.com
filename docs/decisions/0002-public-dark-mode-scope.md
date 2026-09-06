# 0002 · How far dark mode reaches

**Date:** 2026-09-05 · **Status:** accepted · **Item:** T3-2

## Decision

**Option (a): operator-only.** Dark mode reaches the dashboard and admin
subtrees and stops there. The public site is light, always, and does not
honour `prefers-color-scheme`. Public dark is deferred with no date; the
condition that would reopen it is written below.

## Context

Dark mode was implemented, and deliberately narrow. `web/src/styles/tokens.css`
scopes it as `[data-theme="dark"] [data-dashboard-shell]`: the root attribute
that `ThemeSwitcher` sets, combined with a subtree marker, so the override
paints only inside the dashboard. A user who toggles dark in `/dashboard` and
then opens `/about` gets the canonical light brand.

Two things pulled against that scope, and both have now been resolved rather
than left to pull:

1. **`Brand v3.1 §00` says "Default Mode: Light"** — which the code read as
   "light is canonical", but which did not say whether the public site may
   offer dark at all. This record answers that: it may not, for now.
2. **An `!important` block in `web/src/index.css`** forced anchor colours.
   Its own comment said removing it was T3-2's job. It is gone (see below);
   it was a cascade-layer defect, never a decision.

## Why (a) and not (b) or (c)

Not because dark is unwanted. Because of what (b) actually costs, measured
rather than guessed:

- `web/scripts/check-contrast.mjs` declares **74 shipped colour pairs** and
  carries a **300-finding baseline** of known text-on-light debt. Every one of
  those would need a second audit against a dark palette, and the baseline
  would need a second copy. The gate that currently catches new debt would
  stop being able to tell which palette a finding belongs to.
- Every hero gradient and image scrim needs a dark variant, and the OG images
  and the printed service catalogue stay light regardless — so a dark public
  site would still hand a light card to every share and every PDF.
- The public tree is 866 sites of `bg-white` and friends. The retrofit is a
  token flip only if those sites are already semantic, and today they are not.

Against that: the visitor cost of (a) is one bright page for someone whose OS
is dark. Real, and much smaller.

(c) — public dark, opt-in only — was rejected as the worst of the three: it
pays the full palette-audit cost of (b) to serve only the visitors who go
looking for a toggle, and it makes the toggle mean two different things
depending on which part of the site you are on.

## What changes this decision

Not a preference. One of:

- The contrast gate can carry two palettes without losing its ratchet, and
  the public tree is built from semantic surface tokens (`--bg`,
  `--bg-elevated`) rather than `bg-white`. Every new public section is being
  built that way, which is what makes the eventual retrofit a token flip.
- Or measured demand: real-user telemetry showing a meaningful share of
  visitors on a dark OS bouncing from the light pages.

Whoever reopens it writes a superseding record; this one is not edited.

## What T3-2 shipped alongside the decision

**The 66 `!important` dashboard rules are gone.** They restated every Tailwind
utility the dashboard uses, at every opacity band, in dark mode. They are
replaced by redefining the brand VARIABLES those utilities resolve — a
Tailwind v4 utility compiles `text-charcoal-80/65` to
`color-mix(in oklab, var(--color-charcoal-80) 65%, transparent)`, so one line
covers the base class, all twelve bands, and the border, divide, background
and placeholder families that share the variable. Nothing needs `!important`:
the shim selector is (0,3,0) and the utility it beats is (0,1,0).

The caveat, recorded because it is a real trade: the opacity variants also
emit a hex fallback for browsers without `color-mix()`, and a variable cannot
reach it. `color-mix` has been baseline since 2023 (Chrome 111, Safari 16.2,
Firefox 113), this is a signed-in surface, and dark is opt-in — so the
exposure is a visitor on a five-year-old browser seeing dark-on-dark muted
text in a theme they chose. That is a better trade than sixty-six rules.

What stays an explicit rule is what a variable cannot express: `--color-white`
is a card surface AND a button label, so redefining it would put dark ink on
a violet button; `--color-violet` is text AND a button fill, and Violet Light
behind white text fails AA. Those two flip by class.

**The seven `!important` anchor patches in `index.css` are gone.** Their own
comment recorded that the layered `a { color: inherit }` fix had made them
redundant. Two were worse than redundant: `a[class*="text-white/"]` forced
solid white on any anchor written `text-white/60`, so a footer link asking
for muted got prominent and the distinction the designer drew did not exist
on links.

**The theme is painted before the first paint.** `useTheme` applied
`data-theme` in an effect, so a dark user got a full white frame on every
reload. A six-line blocking script in the head does the same resolution the
hook does. The two are duplicated — one has to run before any module loads —
and a test asserts they agree on the key, the values, and the rule that
anything but an explicit `"dark"` is light.

**`theme-color` follows the flip.** Royal Violet above a near-black page reads
as a rendering bug rather than as branding.

`web/e2e/dark-mode.spec.js` holds all of it to a real browser: every opacity
band flips (including one that never had a rule, which is the point), light
mode is unchanged, the public tree does not leak, white cards flip while white
button labels do not, and the anchor keeps its own colour at its own opacity.

## Consequences

- The public site never needs a dark audit until this record is superseded.
- `ThemeSwitcher` offers a control whose reach is narrower than its label
  suggests. Accepted: it is only ever rendered inside the dashboard sidebar.
- A new dashboard component using an opacity band nobody anticipated is now
  covered automatically. Under the old shim it was a bug waiting for someone
  to notice grey-on-grey text and add a sixty-seventh rule.
