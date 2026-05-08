# `components/ui` — Design System (v2 · 2026)

The single canonical entry point for all UI primitives on **mustaphaukizuru.com**.

```jsx
import {
  Button,
  Input,
  Card,
  Modal,
  Tooltip,
  Tabs,
  Switch,
  CommandPalette,
  ThemeSwitcher,
  AIPromptInput,
} from "@/components/ui"
```

---

## Layers

| Layer | Where the implementation lives | What you see in `ui/` |
|---|---|---|
| **Production primitives** (mature, in-use) | `components/system/*.jsx` | thin re-export wrappers (`Button.jsx`, `Input.jsx`, `Card.jsx`, `Modal.jsx`, `Drawer.jsx`, `Toast.jsx`, `Stat.jsx`, `EyebrowChip.jsx`, `SectionHeader.jsx`, `Container.jsx`, `Badge.jsx`, `Textarea.jsx`, `InlineBanner.jsx`, `EmptyStateSurface.jsx`) |
| **2026 primitives** (new in v2) | `components/ui/*.jsx` | `Checkbox`, `Radio`, `Switch`, `Select`, `Label`, `FormField`, `IconButton`, `Tooltip`, `Popover`, `DropdownMenu`, `CommandPalette`, `Tabs`, `Accordion`, `Avatar`, `Spinner`, `Progress`, `Pagination`, `Kbd`, `Divider`, `ThemeSwitcher`, `AIPromptInput` |
| **Legacy** (compat only) | `components/ui/legacy.jsx` | `MetricCard`, `StatusBadge`, `EmptyState`, `SkeletonCard`, `SectionCard`, `PageHeader`, `PrimaryBtn`, `AlertBanner`, `TableWrapper`, `TableHead`, `SearchInput`, `Skeleton*` family |

---

## Rules

1. **Dumb components.** Every primitive in this folder is presentational. They receive props, emit events. They never call `apiRequest`, hit `localStorage` (except `ThemeSwitcher`, which owns the theme contract), or know about routing.
2. **Tailwind + CSS tokens, never inline hex.** Brand swap goes through `tokens.css`. The few hardcoded brand-tinted palettes (e.g. `Avatar` initials backgrounds) are intentional decorations.
3. **Framer Motion for motion.** No CSS-only animation. `prefers-reduced-motion` honored.
4. **Lucide React for icons.** No alternate icon libraries.
5. **A11y is non-negotiable.** Every interactive component ships with proper ARIA, keyboard nav, focus management, and reduced-motion support.
6. **Flat folder.** One level. New primitive → one file at `components/ui/<Name>.jsx` + one `export` line in `index.jsx`.

---

## Migration cheat-sheet

| Legacy | Use instead |
|---|---|
| `<StatusBadge status="paid" />` | `<Badge status="paid" />` |
| `<PrimaryBtn variant="ghost">` | `<Button variant="ghost">` |
| `<AlertBanner type="error" message=… />` | `<Alert tone="danger" title=…>` (or `<InlineBanner tone="danger">`) |
| `<EmptyState title=… description=… />` | `<EmptyStateSurface icon={…} title=… description=… action={<Button>…</Button>} />` |
| `<SkeletonCard />` | `<Skeleton.Card />` (from `system/Skeleton`) |
| `<SectionCard title=… subtitle=… />` | `<Card><Card.Header title=… subtitle=… /></Card>` |
| `<PageHeader title=… />` | `<SectionHeader size="page" title=… />` |
| `<TableWrapper><TableHead columns=… /></TableWrapper>` | `<DataTable />` (`components/admin/DataTable`) |

---

## Component index

### Form & input

- `Button` · primary action, 4 variants, 3 sizes, loading state
- `IconButton` · square icon-only button
- `Input` · single-line text field with label/hint/error
- `Textarea` · multi-line input, optional autogrow + counter
- `Select` · brand-styled native `<select>`
- `Checkbox` · single + `Checkbox.Group`, indeterminate
- `Radio` · always inside `Radio.Group`, full keyboard nav
- `Switch` · binary on/off (use for instant-effect settings)
- `Label` · standalone form label
- `FormField` · wraps any control with the label/hint/error stack

### Layout & content

- `Container` · centered max-width wrapper with section padding
- `Card` + `Card.Header` / `Card.Body` / `Card.Footer`
- `SectionHeader` · eyebrow → title → subtitle composition
- `EyebrowChip` · brand pill above section titles
- `Stat` · KPI tile with animated count + trend chip
- `Divider` · horizontal/vertical separator, optional centered label
- `EmptyStateSurface` · zero-result placeholder with CTA
- `Badge` · status pill (vocabulary matches DB enums)

### Overlay & feedback

- `Modal` (`Dialog`) + `Modal.Footer` · blocking decisions; focus-trapped
- `Drawer` (`Sheet`) + `Drawer.Footer` · side/bottom slide-in panel
- `ToastProvider` + `useToast` · ephemeral notifications
- `InlineBanner` (`Alert`) · contextual notice inside a page or form
- `Tooltip` · hover/focus label, viewport-aware
- `Popover` · click-anchored floating panel
- `DropdownMenu` · selectable menu with type-ahead + arrow nav
- `CommandPalette` + `useCommandPalette` + `useCommandShortcut` · ⌘K palette

### Disclosure & navigation

- `Tabs` (3 variants: `underline`/`pill`/`segmented`)
- `Accordion` (3 variants: `bordered`/`ghost`/`card`, single/multiple)
- `Pagination` · numbered with smart truncation

### Data & loading

- `Avatar` + `Avatar.Group` · image with initials fallback, status dot
- `Spinner` + `DotsSpinner`
- `Progress` · determinate or indeterminate
- (For skeletons of card/text/avatar shapes, use `Skeleton` from `system/Skeleton`)

### 2026 specialty

- `ThemeSwitcher` + `useTheme` · light/dark/system, segmented or switch variant
- `AIPromptInput` · chat composer with model selector, suggestions, send/stop
- `Kbd` · keyboard-key chip with auto Mac/Windows symbol translation

---

## Quick reference: design tokens consumed

All primitives read from these CSS variables (defined in `web/src/styles/tokens.css`).
Update tokens — primitives follow.

```
--color-action-primary, --color-action-primary-hover, --color-action-primary-active
--color-action-secondary(-hover), --color-action-ghost-hover
--color-action-destructive(-hover)
--color-text-primary, --color-text-secondary, --color-text-muted
--color-text-on-violet, --color-text-on-dark, --color-text-on-dark-muted
--color-text-link(-hover)
--color-surface-card, --color-surface-elevated, --color-surface-dark, --color-surface-cream
--color-border-subtle, --color-border-default, --color-border-strong
--color-border-violet, --color-border-violet-strong, --color-border-on-dark
--color-violet, --color-violet-pale, --color-violet-ghost
--color-feedback-{success,warning,danger,info}{,-bg,-text}
--motion-fast, --motion-base, --ease-standard, --ease-decelerate, --ease-spring
--radius-md, --radius-lg, --radius-full
--shadow-rest, --shadow-hover, --shadow-overlay
--z-tooltip, --z-popover, --z-modal, --z-toast
```

---

## Adding a new primitive

1. Create `components/ui/<Name>.jsx` — keep it dumb, accessible, and Tailwind-first.
2. Use CSS tokens, not raw hex (except brand-decoration palettes).
3. Add Framer Motion only if it adds clarity, not just decoration.
4. Add the export to `index.jsx`.
5. Document the component in this README under the right section.
