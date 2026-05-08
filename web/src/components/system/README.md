# Design System Components

Reusable React primitives for **mustaphaukizuru.com**, built against the brand's design tokens (`web/src/styles/tokens.css`) and codified in `DESIGN_SYSTEM.md` + `COPY_VOICE.md` at the project root.

These components are **additive** — the legacy primitives in `web/src/components/ui/index.jsx` continue to work during migration. Adopt these incrementally, page by page.

---

## Quick start

```jsx
import {
  Button, Input, Textarea, Card, EyebrowChip,
  SectionHeader, Stat, EmptyState, Skeleton, Badge,
  Container, InlineBanner, Modal, Drawer,
  ToastProvider, useToast,
} from "@/components/system"
```

Mount `<ToastProvider>` once near the root of `<App />` so any descendant can call `useToast()`.

---

## Component index

### Tier 1 · Primitives

| Component | What it is | Key props |
|---|---|---|
| `Button` | All clickable affordances | `variant` `size` `tone` `icon` `iconRight` `loading` `fullWidth` `as` |
| `Input` | Single-line field with label / hint / error | `label` `hint` `error` `icon` `trailing` `required` |
| `Textarea` | Multi-line field with optional auto-grow + counter | `label` `hint` `error` `autoGrow` `maxLength` `rows` |
| `Card` | Surface for grouped content | `variant` `padding` `as` · sub-components `Card.Header` `Card.Body` `Card.Footer` |
| `EyebrowChip` | Brand-signature uppercase pre-headline | `tone` `icon` `pulse` |

### Tier 1 · Composites

| Component | What it is | Key props |
|---|---|---|
| `SectionHeader` | Eyebrow → Title → Subtitle stack with optional action | `eyebrow` `title` `subtitle` `action` `align` `size` `onDark` |
| `Stat` | KPI tile with animated count + optional trend | `label` `value` `prefix` `suffix` `decimals` `caption` `trend` `icon` `onDark` |
| `EmptyState` | Zero-result placeholder with icon, copy, action | `icon` `title` `description` `action` `secondary` `variant` `size` |
| `Skeleton` | Loading shimmer; sub-components for common shapes | `w` `h` `rounded` · sub-components `Skeleton.Text` `Skeleton.Card` `Skeleton.Avatar` `Skeleton.Stat` |
| `Badge` | Status / category pill with auto-tone mapping | `status` (auto) **or** `tone` · `size` `dot` `pulse` `icon` |

### Tier 2 · Surfaces

| Component | What it is | Key props |
|---|---|---|
| `Container` | Centered max-width wrapper with responsive gutters | `size` `py` `as` |
| `InlineBanner` | Persistent in-page notice | `tone` `variant` `title` `actions` `onDismiss` |
| `Modal` | Blocking dialog with focus trap, ESC, backdrop dismiss | `open` `onClose` `title` `description` `size` · sub-component `Modal.Footer` |
| `Drawer` | Slide-in panel (right / left / bottom) | `open` `onClose` `side` `size` `title` `description` · sub-component `Drawer.Footer` |
| `ToastProvider` / `useToast` | Ephemeral notifications | `toast.success` `.error` `.warning` `.info` · per-call `{ description, duration, action }` |

---

## Recipes

### Form with validation

```jsx
import { Card, Input, Textarea, Button, InlineBanner } from "@/components/system"

function ContactForm({ onSubmit, error, submitting }) {
  return (
    <Card padding="lg">
      <Card.Header
        title="Send a message"
        subtitle="I'll reply within one business day."
      />
      <Card.Body>
        {error && (
          <InlineBanner tone="danger" title="Something went wrong" className="mb-5">
            {error}
          </InlineBanner>
        )}
        <form onSubmit={onSubmit} className="grid gap-4">
          <Input label="Your name" name="name" required />
          <Input label="Email" type="email" name="email" required />
          <Textarea
            label="What's on your mind?"
            name="message"
            rows={5}
            maxLength={2000}
            autoGrow
            required
          />
        </form>
      </Card.Body>
      <Card.Footer>
        <Button variant="ghost" type="button">Cancel</Button>
        <Button type="submit" loading={submitting}>Send message</Button>
      </Card.Footer>
    </Card>
  )
}
```

### Dashboard stat row

```jsx
import { Container, Stat } from "@/components/system"
import { Users, ShoppingBag, DollarSign } from "lucide-react"

function StatRow({ data }) {
  return (
    <Container size="xl">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active members" value={data.members} icon={Users} trend={12} caption="vs last 30d" />
        <Stat label="Orders this week" value={data.orders} icon={ShoppingBag} trend={-3} caption="vs last week" />
        <Stat label="Revenue" prefix="$" value={data.revenue} decimals={2} icon={DollarSign} trend={28} />
      </div>
    </Container>
  )
}
```

### Confirmation modal with destructive action

```jsx
import { useState } from "react"
import { Modal, Button } from "@/components/system"

function CancelBookingButton({ booking, onCancelled }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>Cancel booking</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this booking?"
        description={`This frees up ${booking.startsAt} for someone else.`}
        size="sm"
      >
        <p className="text-[14px] text-[var(--color-text-secondary)]">
          You can re-book any open slot from this page later.
        </p>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await onCancelled?.()
              setBusy(false)
              setOpen(false)
            }}
          >
            Yes, cancel booking
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
```

### Toast notifications

```jsx
// Mount once, near the root:
//   <ToastProvider><App /></ToastProvider>

import { useToast, Button } from "@/components/system"

function SaveButton({ onSave }) {
  const toast = useToast()
  return (
    <Button
      onClick={async () => {
        try {
          await onSave()
          toast.success("Profile updated")
        } catch (e) {
          toast.error("Couldn't save changes", {
            description: e.message,
            action: { label: "Retry", onClick: () => onSave() },
          })
        }
      }}
    >
      Save changes
    </Button>
  )
}
```

### Empty state in a list page

```jsx
import { EmptyState, Button } from "@/components/system"
import { Inbox } from "lucide-react"

<EmptyState
  icon={Inbox}
  title="No orders yet"
  description="When customers buy a product, you'll see them here."
  action={<Button as="a" href="/store">Browse the store</Button>}
/>
```

---

## Behavioural rules (from `DESIGN_SYSTEM.md`)

1. **Buttons preserve width while loading.** Spinner replaces inner content; layout never jumps.
2. **Inputs are 44px tall, never larger.** Label sits above; helper / error sits below.
3. **Cards use `--shadow-rest` at idle and `--shadow-hover` only when interactive.**
4. **Section spacing is fixed:** Eyebrow → 12px → Title → 8px → Subtitle → 40 / 48px → content.
5. **Modals trap focus and restore it on close.** Always provide a `title` for screen readers.
6. **Toasts auto-dismiss after 4.5s.** Hover pauses the timer. `duration: 0` makes them sticky.
7. **All animations honour `prefers-reduced-motion`** — globally suppressed via `tokens.css`.
8. **Every tone uses a WCAG 2.1 AA validated text/bg pair** — never invent ad-hoc colors.

---

## Migrating from `components/ui/index.jsx`

| Legacy | Replacement | Notes |
|---|---|---|
| `PrimaryBtn` | `Button` | New variants/sizes; loading preserves width |
| `MetricCard` | `Stat` (inside `Card`) | Stat handles the value + trend; wrap in Card if you want the surface |
| `StatusBadge` | `Badge` | Pass `status` prop and tone is auto-mapped |
| `EmptyState` | `EmptyState` (system) | Same name — switch the import path |
| `SectionCard` | `Card` with `Card.Header` | Composition over monolith |
| `PageHeader` | `SectionHeader size="page"` | Use the new system version |
| `AlertBanner` | `InlineBanner` | More tones, dismiss button, optional actions |
| `SkeletonCard` | `Skeleton.Card` | Same shape, token-driven shimmer |
| `TableWrapper` / `TableHead` | (keep for now) | Will be replaced in a future Table primitive |

The migration path is **page-by-page**, not big-bang. Both layers can coexist indefinitely.

---

## File map

```
web/src/components/system/
├── Button.jsx            ← primitive
├── Input.jsx             ← primitive
├── Textarea.jsx          ← primitive
├── Card.jsx              ← primitive (+ Card.Header / Body / Footer)
├── EyebrowChip.jsx       ← primitive
├── SectionHeader.jsx     ← composite
├── Stat.jsx              ← composite (+ AnimatedCount)
├── EmptyState.jsx        ← composite
├── Skeleton.jsx          ← composite (+ .Text/.Card/.Avatar/.Stat)
├── Badge.jsx             ← composite (+ STATUS_TO_TONE map)
├── Container.jsx         ← surface
├── InlineBanner.jsx      ← surface
├── Modal.jsx             ← surface (+ Modal.Footer)
├── Drawer.jsx            ← surface (+ Drawer.Footer)
├── Toast.jsx             ← surface (ToastProvider + useToast)
├── index.js              ← barrel — single import point
└── README.md             ← this file
```
