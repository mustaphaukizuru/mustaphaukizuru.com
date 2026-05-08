// ════════════════════════════════════════════════════════════════════════════
// SystemPreviewPage · /_system · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Internal showcase of every design-system primitive, in every variant,
// size, and state. Use it as:
//   · a visual regression spot-check after token edits
//   · a self-serve catalogue for choosing the right component
//   · a pressure-test for accessibility (keyboard nav, focus rings, motion)
//
// This page is intentionally NOT inside <PublicShell> — it stands alone so
// the components are seen on the bare canvas (the design surface).
//
// Mounted only when import.meta.env.DEV === true (see App.jsx). Production
// builds tree-shake the route out entirely.
// ════════════════════════════════════════════════════════════════════════════

import { useState } from "react"
import {
  Calendar,
  Mail,
  ArrowRight,
  Search,
  Sparkles,
  Plus,
  Trash2,
  Inbox,
  Users,
  ShoppingBag,
  DollarSign,
  Filter,
  CheckCircle2,
} from "lucide-react"

import {
  Button,
  Input,
  Textarea,
  Card,
  EyebrowChip,
  SectionHeader,
  Stat,
  EmptyState,
  Skeleton,
  Badge,
  Container,
  InlineBanner,
  Modal,
  Drawer,
  ToastProvider,
  useToast,
} from "../components/system"

// ── Section wrapper with anchor link ──────────────────────────────────────
function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 py-12 first:pt-4">
      <div className="mb-6 flex items-baseline gap-3">
        <h2 className="text-[22px] font-bold text-[var(--color-violet)]">{title}</h2>
        <a
          href={`#${id}`}
          className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-link)]"
        >
          #{id}
        </a>
      </div>
      <div className="space-y-8">{children}</div>
    </section>
  )
}

// ── Variant row — labels each example for quick comparison ────────────────
function Row({ label, children }) {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-[140px_1fr]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] sm:pt-2">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

// ── Sticky table of contents ──────────────────────────────────────────────
const TOC = [
  ["buttons", "Buttons"],
  ["inputs", "Inputs"],
  ["cards", "Cards"],
  ["eyebrows", "Eyebrow chips"],
  ["section-headers", "Section headers"],
  ["stats", "Stats"],
  ["empty-states", "Empty states"],
  ["skeletons", "Skeletons"],
  ["badges", "Badges"],
  ["banners", "Inline banners"],
  ["modal", "Modal"],
  ["drawer", "Drawer"],
  ["toasts", "Toasts"],
  ["typography", "Typography"],
  ["palette", "Palette"],
]

function TocSidebar() {
  return (
    <nav
      aria-label="Component sections"
      className="sticky top-6 hidden lg:block w-[200px] shrink-0"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-3">
        Components
      </div>
      <ul className="flex flex-col gap-1">
        {TOC.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="block rounded-md px-2 py-1.5 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-violet-pale)] hover:text-[var(--color-violet)] transition-colors duration-[var(--motion-fast)]"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ── Toast trigger (must be inside ToastProvider) ──────────────────────────
function ToastDemos() {
  const toast = useToast()
  return (
    <Row label="Toasts">
      <Button onClick={() => toast.success("Profile updated")}>Success</Button>
      <Button
        variant="destructive"
        onClick={() =>
          toast.error("Couldn't save changes", {
            description: "The connection dropped halfway through.",
            action: { label: "Retry", onClick: () => toast.info("Retrying…") },
          })
        }
      >
        Error with action
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.warning("Session expires in 1 minute")}
      >
        Warning
      </Button>
      <Button variant="ghost" onClick={() => toast.info("Reminder sent")}>
        Info
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          toast.info("Sticky note", {
            description: "Stays until you close it.",
            duration: 0,
          })
        }
      >
        Persistent
      </Button>
    </Row>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function SystemPreviewPage() {
  return (
    <ToastProvider>
      <PageBody />
    </ToastProvider>
  )
}

function PageBody() {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSide, setDrawerSide] = useState("right")
  const [inputValue, setInputValue] = useState("")
  const [textareaValue, setTextareaValue] = useState(
    "I'm looking for a partner to help us launch a new student-information system. We have ~600 users and a tight August deadline.",
  )

  return (
    <div className="min-h-screen bg-[var(--color-surface-mist)]">
      <Container size="xl" py="sm">
        {/* Page header */}
        <header className="border-b border-[var(--color-border-subtle)] pb-6 mb-2">
          <EyebrowChip tone="violet" pulse>
            Internal · /_system
          </EyebrowChip>
          <h1 className="mt-3 text-page font-bold text-[var(--color-violet)]">
            Design system preview
          </h1>
          <p className="mt-2 max-w-[64ch] text-lead text-[var(--color-text-secondary)]">
            Every primitive in every variant, size, and state. Use this page
            after token edits to spot-check visual regressions and verify
            keyboard / focus behaviour.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[var(--color-text-muted)]">
            <span>Tab to walk every focusable element.</span>
            <span aria-hidden="true">·</span>
            <span>Esc closes any open overlay.</span>
            <span aria-hidden="true">·</span>
            <span>Reduced-motion is honoured globally.</span>
          </div>
        </header>

        {/* Layout: sticky TOC + content */}
        <div className="flex gap-12">
          <TocSidebar />

          <main className="min-w-0 flex-1 divide-y divide-[var(--color-border-subtle)]">
            {/* ── BUTTONS ─────────────────────────────────────────────── */}
            <Section id="buttons" title="Buttons">
              <Row label="Variants · md">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </Row>
              <Row label="Sizes">
                <Button size="sm">Small (36)</Button>
                <Button size="md">Medium (44)</Button>
                <Button size="lg">Large (52)</Button>
              </Row>
              <Row label="With icons">
                <Button icon={Calendar}>Book a call</Button>
                <Button variant="secondary" iconRight={ArrowRight}>
                  See pricing
                </Button>
                <Button variant="ghost" icon={Plus}>
                  New project
                </Button>
                <Button variant="destructive" icon={Trash2}>
                  Delete
                </Button>
              </Row>
              <Row label="States">
                <Button loading>Saving</Button>
                <Button disabled>Disabled</Button>
                <Button variant="secondary" disabled>
                  Disabled
                </Button>
              </Row>
              <Row label="Tone · hero gap">
                <Button tone="hero" size="lg" icon={Sparkles}>
                  Hero call to action
                </Button>
              </Row>
              <Row label="Full width">
                <div className="w-full max-w-md">
                  <Button fullWidth icon={Mail}>
                    Send message
                  </Button>
                </div>
              </Row>
              <Row label="As anchor">
                <Button as="a" href="#buttons" iconRight={ArrowRight}>
                  Navigates as &lt;a&gt;
                </Button>
              </Row>
            </Section>

            {/* ── INPUTS ──────────────────────────────────────────────── */}
            <Section id="inputs" title="Inputs &amp; textareas">
              <Row label="Default">
                <div className="w-full max-w-md">
                  <Input
                    label="Your name"
                    placeholder="Jane Doe"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                </div>
              </Row>
              <Row label="With icon">
                <div className="w-full max-w-md">
                  <Input
                    label="Search projects"
                    icon={Search}
                    placeholder="Type to filter…"
                    hint="Matches name, status, owner."
                  />
                </div>
              </Row>
              <Row label="With trailing">
                <div className="w-full max-w-md">
                  <Input label="Project budget" trailing={<span className="text-[12px]">USD</span>} placeholder="0.00" />
                </div>
              </Row>
              <Row label="Required + error">
                <div className="w-full max-w-md">
                  <Input
                    label="Email"
                    type="email"
                    required
                    defaultValue="not-an-email"
                    error="Enter a valid email address."
                  />
                </div>
              </Row>
              <Row label="Disabled">
                <div className="w-full max-w-md">
                  <Input label="Account ID" defaultValue="acct_4f3a91c" disabled />
                </div>
              </Row>

              <Row label="Textarea + counter">
                <div className="w-full max-w-md">
                  <Textarea
                    label="Project brief"
                    rows={4}
                    autoGrow
                    maxLength={400}
                    value={textareaValue}
                    onChange={(e) => setTextareaValue(e.target.value)}
                    hint="Be specific about scope, users, and deadlines."
                  />
                </div>
              </Row>
              <Row label="Textarea · error">
                <div className="w-full max-w-md">
                  <Textarea
                    label="Reason for cancellation"
                    rows={3}
                    error="Tell us briefly why you're cancelling."
                  />
                </div>
              </Row>
            </Section>

            {/* ── CARDS ───────────────────────────────────────────────── */}
            <Section id="cards" title="Cards">
              <Row label="Static">
                <div className="w-full max-w-md">
                  <Card>
                    <Card.Header
                      title="Strategic STEM Roadmap"
                      subtitle="A six-week consulting engagement."
                    />
                    <Card.Body className="mt-4">
                      <p className="text-[var(--color-text-secondary)]">
                        Discover, design, and deliver a roadmap your leadership team
                        will actually use.
                      </p>
                    </Card.Body>
                  </Card>
                </div>
              </Row>
              <Row label="Interactive">
                <div className="w-full max-w-md">
                  <Card variant="interactive" as="a" href="#cards">
                    <Card.Header
                      title="Browse the store"
                      action={<ArrowRight className="h-5 w-5 text-[var(--color-violet)]" aria-hidden="true" />}
                    />
                    <Card.Body className="mt-2 text-[var(--color-text-secondary)]">
                      Hover lifts the card -2px and elevates the shadow.
                    </Card.Body>
                  </Card>
                </div>
              </Row>
              <Row label="Feature">
                <div className="w-full max-w-md">
                  <Card variant="feature">
                    <Card.Header title="Featured this month" subtitle="School Solutions Bundle" />
                    <Card.Body className="mt-3">
                      <p className="text-[var(--color-text-secondary)]">
                        Violet-tinted surface for highlight blocks.
                      </p>
                    </Card.Body>
                    <Card.Footer>
                      <Button variant="secondary" size="sm">
                        Learn more
                      </Button>
                      <Button size="sm">Get a quote</Button>
                    </Card.Footer>
                  </Card>
                </div>
              </Row>
              <Row label="Dark">
                <div className="w-full max-w-md">
                  <Card variant="dark">
                    <Card.Header title="Inverted surface" subtitle="For night-mode teasers and hero embeds." />
                    <Card.Body className="mt-3 text-[var(--color-text-on-dark-muted)]">
                      Ring + focus colors switch automatically.
                    </Card.Body>
                  </Card>
                </div>
              </Row>
            </Section>

            {/* ── EYEBROW CHIPS ───────────────────────────────────────── */}
            <Section id="eyebrows" title="Eyebrow chips">
              <Row label="Tones">
                <EyebrowChip>Brand default</EyebrowChip>
                <EyebrowChip tone="cream">Cream</EyebrowChip>
                <EyebrowChip tone="success">Open to work</EyebrowChip>
                <EyebrowChip tone="info">New</EyebrowChip>
                <EyebrowChip tone="warning">Heads up</EyebrowChip>
              </Row>
              <Row label="Inverse">
                <div className="rounded-[14px] bg-[var(--color-violet)] p-5">
                  <EyebrowChip tone="violet-inverse" pulse>
                    Now booking · May
                  </EyebrowChip>
                </div>
              </Row>
              <Row label="With icon">
                <EyebrowChip icon={Sparkles}>What's new</EyebrowChip>
                <EyebrowChip tone="success" icon={CheckCircle2}>
                  Verified
                </EyebrowChip>
              </Row>
            </Section>

            {/* ── SECTION HEADERS ─────────────────────────────────────── */}
            <Section id="section-headers" title="Section headers">
              <Card padding="lg">
                <SectionHeader
                  eyebrow="What I do"
                  title="Software, strategy, and student-ready systems"
                  subtitle="Three practices, one outcome, your team ships better software, faster."
                />
              </Card>
              <Card padding="lg">
                <SectionHeader
                  align="center"
                  size="page"
                  eyebrow="Pricing"
                  title="Simple, scoped engagements"
                  subtitle="Pick a packaged sprint or custom-quote a longer engagement."
                />
              </Card>
              <Card padding="lg">
                <SectionHeader
                  eyebrow="Latest projects"
                  title="What I'm shipping this quarter"
                  subtitle="Three live builds, student dashboards, billing, and a custom CMS."
                  action={
                    <Button variant="secondary" iconRight={ArrowRight} size="sm">
                      View all
                    </Button>
                  }
                />
              </Card>
              <div className="rounded-[14px] bg-[var(--color-violet)] p-8">
                <SectionHeader
                  onDark
                  eyebrow="Hero band"
                  title="Headers on dark surfaces"
                  subtitle="Tone + colors invert automatically."
                />
              </div>
            </Section>

            {/* ── STATS ───────────────────────────────────────────────── */}
            <Section id="stats" title="Stats">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <Stat label="Active members" value={1284} icon={Users} trend={12} caption="vs last 30d" />
                </Card>
                <Card>
                  <Stat label="Orders this week" value={37} icon={ShoppingBag} trend={-3} caption="vs last week" />
                </Card>
                <Card>
                  <Stat
                    label="Revenue"
                    prefix="$"
                    value={48230.5}
                    decimals={2}
                    icon={DollarSign}
                    trend={28}
                    caption="MTD"
                  />
                </Card>
              </div>
              <Card variant="dark">
                <Stat
                  onDark
                  label="Uptime"
                  value={99.98}
                  suffix="%"
                  decimals={2}
                  caption="Last 30 days"
                />
              </Card>
            </Section>

            {/* ── EMPTY STATES ────────────────────────────────────────── */}
            <Section id="empty-states" title="Empty states">
              <EmptyState
                icon={Inbox}
                title="No orders yet"
                description="When customers buy a product, you'll see them here."
                action={<Button as="a" href="#empty-states">Browse the store</Button>}
                secondary={
                  <a href="#empty-states" className="text-[var(--color-text-link)] hover:underline">
                    Set up your first product
                  </a>
                }
              />
              <EmptyState
                variant="plain"
                size="sm"
                icon={Search}
                title="Nothing matched"
                description="Try a different keyword or clear the filter."
              />
            </Section>

            {/* ── SKELETONS ───────────────────────────────────────────── */}
            <Section id="skeletons" title="Skeletons">
              <div className="grid gap-4 sm:grid-cols-2">
                <Skeleton.Card />
                <Card>
                  <Skeleton.Stat />
                </Card>
              </div>
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton.Avatar size="lg" />
                  <div className="flex-1">
                    <Skeleton w="w-1/3" h="h-3" />
                    <div className="mt-2">
                      <Skeleton w="w-1/4" h="h-2" />
                    </div>
                  </div>
                </div>
                <Skeleton.Text lines={4} />
              </Card>
            </Section>

            {/* ── BADGES ──────────────────────────────────────────────── */}
            <Section id="badges" title="Badges">
              <Row label="Status (auto)">
                <Badge status="paid" />
                <Badge status="pending" />
                <Badge status="failed" />
                <Badge status="cancelled" />
                <Badge status="refunded" />
                <Badge status="in_progress" />
                <Badge status="resolved" />
                <Badge status="confirmed" />
                <Badge status="no_show" />
                <Badge status="completed" />
              </Row>
              <Row label="Tone (manual)">
                <Badge tone="success">Live</Badge>
                <Badge tone="warning">Beta</Badge>
                <Badge tone="danger">Down</Badge>
                <Badge tone="info">Updated</Badge>
                <Badge tone="violet">Member</Badge>
                <Badge tone="dark">Admin</Badge>
                <Badge tone="neutral">Archived</Badge>
              </Row>
              <Row label="Sizes">
                <Badge tone="violet" size="sm">
                  Small
                </Badge>
                <Badge tone="violet" size="md">
                  Medium
                </Badge>
                <Badge tone="violet" size="lg">
                  Large
                </Badge>
              </Row>
              <Row label="Live + pulse">
                <Badge tone="success" dot pulse>
                  Live
                </Badge>
                <Badge tone="info" dot pulse>
                  Now booking
                </Badge>
              </Row>
            </Section>

            {/* ── INLINE BANNERS ──────────────────────────────────────── */}
            <Section id="banners" title="Inline banners">
              <InlineBanner tone="info" title="Heads up">
                MercadoPago will return invalid_request if the public key is missing.
              </InlineBanner>
              <InlineBanner tone="success" title="Saved">
                Profile changes are live.
              </InlineBanner>
              <InlineBanner
                tone="warning"
                title="Storage almost full"
                actions={
                  <>
                    <Button size="sm" variant="ghost">
                      Manage
                    </Button>
                    <Button size="sm">Upgrade</Button>
                  </>
                }
                onDismiss={() => undefined}
              >
                You're at 92% of your media library quota.
              </InlineBanner>
              <InlineBanner tone="danger" variant="solid" title="Payment declined">
                The card issuer rejected the transaction. Try a different card or contact your bank.
              </InlineBanner>
            </Section>

            {/* ── MODAL ───────────────────────────────────────────────── */}
            <Section id="modal" title="Modal">
              <Row label="Open">
                <Button onClick={() => setModalOpen(true)}>Open modal</Button>
              </Row>

              <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Cancel this booking?"
                description="This frees up the slot for someone else."
                size="sm"
              >
                <p className="text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
                  You can re-book any open slot from this page later. The
                  client will receive an updated calendar invite by email.
                </p>
                <Modal.Footer>
                  <Button variant="ghost" onClick={() => setModalOpen(false)}>
                    Keep booking
                  </Button>
                  <Button variant="destructive" onClick={() => setModalOpen(false)}>
                    Yes, cancel it
                  </Button>
                </Modal.Footer>
              </Modal>
            </Section>

            {/* ── DRAWER ──────────────────────────────────────────────── */}
            <Section id="drawer" title="Drawer">
              <Row label="Side">
                <Button
                  variant="secondary"
                  icon={Filter}
                  onClick={() => {
                    setDrawerSide("right")
                    setDrawerOpen(true)
                  }}
                >
                  Right
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDrawerSide("left")
                    setDrawerOpen(true)
                  }}
                >
                  Left
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDrawerSide("bottom")
                    setDrawerOpen(true)
                  }}
                >
                  Bottom (sheet)
                </Button>
              </Row>

              <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                side={drawerSide}
                title="Filter projects"
                description="Narrow the list by status, owner, or service."
              >
                <div className="grid gap-4">
                  <Input label="Search" icon={Search} placeholder="Project name…" />
                  <Input label="Owner" placeholder="Anyone" />
                  <Textarea label="Notes" rows={3} hint="Optional, included in the saved view." />
                </div>
                <Drawer.Footer>
                  <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                    Reset
                  </Button>
                  <Button onClick={() => setDrawerOpen(false)}>Apply filters</Button>
                </Drawer.Footer>
              </Drawer>
            </Section>

            {/* ── TOASTS ──────────────────────────────────────────────── */}
            <Section id="toasts" title="Toasts">
              <ToastDemos />
            </Section>

            {/* ── TYPOGRAPHY ──────────────────────────────────────────── */}
            <Section id="typography" title="Typography">
              <Card>
                <p className="text-display text-[var(--color-violet)]">Display 40 / 64</p>
                <p className="text-page text-[var(--color-violet)] mt-3">Page 32 / 48</p>
                <p className="text-section text-[var(--color-violet)] mt-3">Section 24 / 32</p>
                <p className="text-card text-[var(--color-text-primary)] mt-3">Card 18 / 20</p>
                <p className="text-lead text-[var(--color-text-primary)] mt-3">
                  Lead 16 / 17, used for subheads and section intros where breathing room matters.
                </p>
                <p className="text-body text-[var(--color-text-primary)] mt-3">
                  Body 14 / 15, the workhorse paragraph size for descriptions and narrative copy.
                </p>
                <p className="text-meta text-[var(--color-text-muted)] mt-3">
                  Meta 12 / 13, labels, captions, helper text under inputs.
                </p>
                <p className="text-micro text-[var(--color-text-muted)] mt-3">
                  Micro 10 / 11, eyebrow chips and stat tile labels
                </p>
              </Card>
            </Section>

            {/* ── PALETTE ─────────────────────────────────────────────── */}
            <Section id="palette" title="Palette">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Swatch token="--color-violet" label="Violet" />
                <Swatch token="--color-violet-deep" label="Violet deep" onDark />
                <Swatch token="--color-violet-pale" label="Violet pale" />
                <Swatch token="--color-violet-ghost" label="Violet ghost" />
                <Swatch token="--color-terracotta" label="Terracotta" />
                <Swatch token="--color-terracotta-deep" label="Terracotta deep" />
                <Swatch token="--color-charcoal-80" label="Charcoal 80" onDark />
                <Swatch token="--color-azure" label="Azure" onDark />
                <Swatch token="--color-feedback-success" label="Success" onDark />
                <Swatch token="--color-feedback-warning" label="Warning" onDark />
                <Swatch token="--color-feedback-danger" label="Danger" onDark />
                <Swatch token="--color-feedback-info" label="Info" onDark />
              </div>
            </Section>

            <footer className="py-12 text-[12px] text-[var(--color-text-muted)]">
              Design system v1.0 · See <code>DESIGN_SYSTEM.md</code> + <code>COPY_VOICE.md</code> at the project root.
            </footer>
          </main>
        </div>
      </Container>
    </div>
  )
}

// ── Color swatch (small helper, page-local) ───────────────────────────────
function Swatch({ token, label, onDark = false }) {
  return (
    <div className="rounded-[10px] overflow-hidden border border-[var(--color-border-subtle)]">
      <div className="h-16" style={{ background: `var(${token})` }} />
      <div className={`px-3 py-2 ${onDark ? "" : ""}`}>
        <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">{label}</div>
        <code className="text-[11px] text-[var(--color-text-muted)]">{token}</code>
      </div>
    </div>
  )
}
