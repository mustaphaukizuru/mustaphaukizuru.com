# 0002 · How far dark mode reaches

**Date:** 2026-09-04 · **Status:** proposed — NOT DECIDED · **Item:** T3-2

> This record exists so the next contributor does not decide it by accident.
> It states what is true today and what the options are. It does not choose.
> T3-2 chooses, and edits this file to `accepted` in the same change.

## Context

Dark mode is implemented, and deliberately narrow. `web/src/styles/tokens.css`
scopes it as `[data-theme="dark"] [data-dashboard-shell]`: the root attribute
that `ThemeSwitcher` sets, combined with a subtree marker, so the override
paints only inside the dashboard. A user who toggles dark in `/dashboard` and
then opens `/about` gets the canonical light brand. The comment in that file
says that is the intent.

Only semantic tokens flip (`--color-surface-*`, `--color-text-*`,
`--color-feedback-*-bg`). Brand anchors (`--color-mist`, `--color-charcoal`,
`--color-violet`) stay fixed so `bg-charcoal text-white` pairs never invert
into invisibility.

Two things pull against that scope:

1. **`Brand v3.1 §00` says "Default Mode: Light"** — which the code reads as
   "light is canonical", but which does not say whether the public site may
   offer dark at all. There is no v3.1 document; see
   `docs/BRAND_IDENTITY_v3.1.md`, which indexes where each cited rule is
   actually implemented.
2. **An `!important` block in `web/src/index.css`** (around line 320) forces
   anchor colours — `a.text-white`, `a.text-violet`, `a[class*="text-mist/"]`
   and friends. Its own comment says removing it is T3-2's job. It exists
   because Tailwind v4 puts utilities in a cascade layer, and the unlayered
   `a { color: … }` base rule beat them; the fix landed as `!important` under
   time pressure rather than as a layer correction.

## Options

**(a) Operator-only, as today.** Dark stays inside the dashboard and admin
subtrees. The public site is light, always. Cheapest, and matches "Default
Mode: Light" read strictly. Costs: a visitor with a system dark preference
gets a bright page, and the marketing surfaces never get audited in dark.

**(b) Whole site, `prefers-color-scheme` respected.** Every public page gets a
dark palette. Costs: every one of the shipped colour pairs needs a second
contrast audit (`web/scripts/check-contrast.mjs` currently declares 74 pairs
against one palette), every hero gradient and image scrim needs a dark
variant, and the OG images and printed catalogue stay light regardless.

**(c) Whole site, opt-in only.** Dark reaches the public pages but only when
someone actively toggles it; the system preference is not honoured. Halves the
"surprise" risk of (b) and keeps first paint predictable, at the cost of
respecting the reader's stated preference less.

## What has to be true either way

The `!important` anchor block is a defect, not a decision, and it goes in T3-2
regardless of the outcome. The correct fix is a cascade-layer correction (the
base rule belongs in `@layer base`, which is where T2-1 already moved
`a { color: inherit }` after it caused 2.54:1 link contrast on every page).

## Consequences of leaving it open

`ThemeSwitcher` keeps offering a control whose reach is narrower than a user
would guess from the label. That is the current cost, and it is small; the
cost of guessing wrong here is a palette audit that has to be redone.
