// ════════════════════════════════════════════════════════════════════════════
// system · barrel exports · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Single import point for the design-system primitives.
//
//     import {
//       Button, Input, Textarea, Card, EyebrowChip,
//       SectionHeader, Stat, EmptyState, Skeleton, Badge,
//       Container, InlineBanner, Modal, Drawer,
//       ToastProvider, useToast,
//     } from "@/components/system"
//
// Defaults are also re-exported for ergonomic single-name imports if preferred:
//     import Button from "@/components/system/Button"
//
// Companion docs:
//   · DESIGN_SYSTEM.md   (project root) — full spec
//   · COPY_VOICE.md      (project root) — writing rules
//   · ./README.md                        — usage guide for these components
// ════════════════════════════════════════════════════════════════════════════

// Tier 1 · primitives
export { default as Button } from "./Button"
export { default as Input } from "./Input"
export { default as Textarea } from "./Textarea"
export { default as Card } from "./Card"
export { default as EyebrowChip } from "./EyebrowChip"

// Tier 1 · composites
export { default as SectionHeader } from "./SectionHeader"
export { default as Stat, AnimatedCount } from "./Stat"
export { default as EmptyState } from "./EmptyState"
export {
  default as Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonStat,
} from "./Skeleton"
export { default as Badge, STATUS_TO_TONE } from "./Badge"

// Tier 2 · surfaces
export { default as Container } from "./Container"
export { default as InlineBanner } from "./InlineBanner"
export { default as Modal } from "./Modal"
export { default as Drawer } from "./Drawer"
export { default as ToastProvider, useToast } from "./Toast"
