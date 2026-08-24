/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// SectionHeader · canonical re-export from components/system/SectionHeader.jsx
//
// NOTE: There is also a *legacy* ui/SectionHeading.jsx with a slightly
// different API (used by older marketing pages). Prefer SectionHeader from
// here for any new section header. SectionHeading remains exported for
// backwards-compat only.
// ════════════════════════════════════════════════════════════════════════════

export { default, SectionHeader } from "../system/SectionHeader"
