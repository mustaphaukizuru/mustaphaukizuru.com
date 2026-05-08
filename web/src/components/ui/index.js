// ════════════════════════════════════════════════════════════════════════════
// ui/index.js — resolution stub
// ────────────────────────────────────────────────────────────────────────────
// Vite's default resolver tries `.js` before `.jsx`. To prevent the JSX
// barrel from being shadowed, this file simply forwards to ./index.jsx —
// guaranteeing that `import "@/components/ui"` always lands on the same
// unified barrel regardless of resolver order.
// ════════════════════════════════════════════════════════════════════════════

export * from "./index.jsx"
