/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// Button · canonical re-export
// ────────────────────────────────────────────────────────────────────────────
// The production Button primitive lives in components/system/Button.jsx.
// This thin wrapper makes it accessible from the unified ui/ entry point
// without duplicating the implementation. Update the source — not this file.
// ════════════════════════════════════════════════════════════════════════════

export { default, Button } from "../system/Button"
