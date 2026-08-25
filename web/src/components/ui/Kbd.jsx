// ════════════════════════════════════════════════════════════════════════════
// Kbd · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Keyboard key indicator. Use in command palettes, shortcut hints, and docs.
// Auto-translates "mod" to ⌘ on Mac and Ctrl on Windows/Linux.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, Children } from "react"

const SIZE = {
  sm: "h-4 min-w-4 px-1 text-[10px]",
  md: "h-5 min-w-5 px-1.5 text-[11px]",
  lg: "h-6 min-w-6 px-2 text-[12px]",
}

function isMac() {
  if (typeof navigator === "undefined") return false
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || "")
}

const SYMBOLS = {
  mod: { mac: "⌘", other: "Ctrl" },
  cmd: { mac: "⌘", other: "⌘" },
  ctrl: { mac: "⌃", other: "Ctrl" },
  alt: { mac: "⌥", other: "Alt" },
  shift: { mac: "⇧", other: "Shift" },
  enter: { mac: "↵", other: "↵" },
  esc: { mac: "esc", other: "Esc" },
  tab: { mac: "⇥", other: "Tab" },
  up: { mac: "↑", other: "↑" },
  down: { mac: "↓", other: "↓" },
  left: { mac: "←", other: "←" },
  right: { mac: "→", other: "→" },
  delete: { mac: "⌫", other: "Del" },
  space: { mac: "␣", other: "Space" },
}

function translate(token, mac) {
  const lower = String(token).toLowerCase()
  const map = SYMBOLS[lower]
  if (!map) return token
  return mac ? map.mac : map.other
}

/**
 * Kbd · keyboard key indicator.
 *
 * Either pass a single `keys` string like "mod+k" / "shift+enter" — auto-split
 * on "+" — or compose multiple <Kbd> manually.
 *
 * Props:
 *   keys?      · "mod+k" style string
 *   children?  · single key text (e.g. "K") if you don't want to use `keys`
 *   size?      · "sm" · "md" (default) · "lg"
 *   tone?      · "default" (light) · "dark"
 *   className?
 */
export default function Kbd({
  keys,
  children,
  size = "md",
  tone = "default",
  className = "",
}) {
  const [mac, setMac] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- platform detection after mount (SSR-safe)
  useEffect(() => setMac(isMac()), [])

  const sizeCls = SIZE[size] || SIZE.md
  const toneCls =
    tone === "dark"
      ? "bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.85)] border-[rgba(255,255,255,0.10)]"
      : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]"

  const baseClass = [
    "inline-flex items-center justify-center rounded border font-mono font-semibold",
    sizeCls,
    toneCls,
    className,
  ]
    .filter(Boolean)
    .join(" ")

  // String form — split into multiple kbds joined by no separator
  if (keys) {
    const tokens = keys.split("+").map((s) => s.trim()).filter(Boolean)
    return (
      <span className="inline-flex items-center gap-1">
        {tokens.map((tok, i) => (
          <kbd key={i} className={baseClass}>
            {translate(tok, mac)}
          </kbd>
        ))}
      </span>
    )
  }

  // Children form — wrap as-is
  return <kbd className={baseClass}>{Children.count(children) === 0 ? null : children}</kbd>
}

export { Kbd }
