/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// ui · Master barrel · v2.0 · 2026-spec design system
// ────────────────────────────────────────────────────────────────────────────
// Single canonical entry point for the design system. Import everything you
// need from here:
//
//   import { Button, Input, Card, Modal, Tooltip, Tabs } from "@/components/ui"
//
// Two layers live behind this barrel:
//
//   1. Production primitives — token-driven, accessible, Framer-animated.
//      Source of truth lives HERE (components/ui/). components/system/ is a
//      folder of thin re-exports kept only so legacy `@/components/system`
//      imports keep working — never edit an implementation there.
//
//   2. New 2026-standard primitives created in this folder:
//        Form    · Checkbox · Radio · Switch · Select · Label · FormField
//        Action  · IconButton · Kbd · Divider
//        Overlay · Tooltip · Popover · DropdownMenu · CommandPalette
//        Disclos.· Tabs · Accordion · Pagination
//        Display · Avatar · Spinner · Progress
//        Modern  · ThemeSwitcher · AIPromptInput
//
// Legacy components (MetricCard, StatusBadge, EmptyState, SkeletonCard,
// SectionCard, PageHeader, PrimaryBtn, AlertBanner, TableWrapper, TableHead,
// SearchInput, Skeleton, SkeletonText, SkeletonAvatar, SkeletonRow,
// SkeletonMetricCard, SkeletonTable) live in ./legacy.jsx and are re-exported
// here verbatim so existing pages keep compiling. Do not import legacy
// components in new code — prefer the canonical primitives.
//
// Folder rule: KEEP IT FLAT. One level only. Each component owns its file.
// Headless behaviour is local; styling is Tailwind + CSS tokens; animations
// are Framer Motion; icons are Lucide React.
// ════════════════════════════════════════════════════════════════════════════

// ── Atomic / Form primitives ──────────────────────────────────────────────
export { Button } from "./Button"
export { Input } from "./Input"
export { Textarea } from "./Textarea"
export { Select } from "./Select"
export { Checkbox, CheckboxGroup } from "./Checkbox"
export { Radio, RadioGroup } from "./Radio"
export { Switch } from "./Switch"
export { Label } from "./Label"
export { FormField } from "./FormField"
export { IconButton } from "./IconButton"

// ── Surfaces & content ────────────────────────────────────────────────────
export { Card, CardHeader, CardBody, CardFooter } from "./Card"
export { Container } from "./Container"
export { SectionHeader } from "./SectionHeader"
export { EyebrowChip } from "./EyebrowChip"
export { Badge, STATUS_TO_TONE } from "./Badge"
export { Divider } from "./Divider"
export { Stat, AnimatedCount } from "./Stat"
export { EmptyStateSurface } from "./EmptyStateSurface"
export { SkeletonStat } from "./SkeletonPrimitives"

// ── Overlays & feedback ───────────────────────────────────────────────────
export { Modal, ModalFooter, Dialog, DialogFooter } from "./Modal"
export { Drawer, DrawerFooter, Sheet, SheetFooter } from "./Drawer"
// NOTE: For toasts, the app uses Sonner via /lib/Toaster + /context/ToastContext.
// The token-driven `ToastProvider` / `useToast` from /system/Toast are NOT
// re-exported here on purpose — they're a parallel implementation. Import them
// directly from "@/components/ui/Toast" if/when you want to migrate.
export { InlineBanner, Alert } from "./InlineBanner"
export { Tooltip } from "./Tooltip"
export { Popover } from "./Popover"
export { DropdownMenu } from "./DropdownMenu"
export {
  CommandPalette,
  useCommandPalette,
  useCommandShortcut,
} from "./CommandPalette"

// ── Disclosure & navigation ───────────────────────────────────────────────
export { Tabs, TabsList, TabsTrigger, TabsPanel } from "./Tabs"
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./Accordion"
export { Pagination } from "./Pagination"

// ── Data display ──────────────────────────────────────────────────────────
export { Avatar, AvatarGroup } from "./Avatar"

// ── Loading state ─────────────────────────────────────────────────────────
export { Spinner, DotsSpinner } from "./Spinner"
export { Progress } from "./Progress"

// ── 2026 specialty ────────────────────────────────────────────────────────
export { ThemeSwitcher, useTheme } from "./ThemeSwitcher"
export { AIPromptInput } from "./AIPromptInput"
export { Kbd } from "./Kbd"

// ── Legacy bridge (preserved — DO NOT use in new code) ────────────────────
export {
  MetricCard,
  StatusBadge,
  EmptyState,
  SkeletonCard,
  SectionCard,
  PageHeader,
  PrimaryBtn,
  AlertBanner,
  TableWrapper,
  TableHead,
  SearchInput,
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonRow,
  SkeletonMetricCard,
  SkeletonTable,
} from "./legacy"
