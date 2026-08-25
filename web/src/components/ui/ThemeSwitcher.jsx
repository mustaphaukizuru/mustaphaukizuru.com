/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// ThemeSwitcher · ui composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Light / Dark / System theme picker. Pure presentational shell:
//   · Mounts the data-theme attribute on <html>
//   · Reads + writes localStorage("theme")
//   · Reacts to OS preference changes when set to "system"
//
// Two visual variants:
//   · "segmented" (default)  — three-state segmented control (matches Tabs)
//   · "switch"               — single icon toggle (light ↔ dark, no system)
//
// Token cooperation: this primitive only flips data-theme. Your tokens.css
// must define overrides under `[data-theme="dark"]` to actually re-paint the
// app. If those overrides aren't there yet, this still works — it just
// quietly waits for the design tokens to land.
// ════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react"
import { Sun, Moon, MonitorSmartphone } from "lucide-react"

const STORAGE_KEY = "theme"
const VALID = ["light", "dark", "system"]
// Brand Identity v3.1 §00 — "Default Mode: Light".
// First-time visitors land on the canonical light brand; users who
// explicitly toggle to dark or system have their choice persisted in
// localStorage and respected on every subsequent visit. "system" is
// available as an opt-in but is NEVER the implicit default — that
// would let OS-dark users see a brand-incongruent first impression
// of the dashboard before they've even chosen.
const DEFAULT_THEME = "light"

function readStored() {
  if (typeof window === "undefined") return DEFAULT_THEME
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return VALID.includes(v) ? v : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

// systemPrefersDark · retained for future use but currently unread.
// Per Brand v3.1 §00 "Default Mode: Light", the System option now
// resolves to Light regardless of OS preference — the dashboard's
// canonical brand floor is light, and a user who specifically wants
// dark can pick the explicit "Dark" segment instead.
// eslint-disable-next-line no-unused-vars
function systemPrefersDark() {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(theme) {
  if (typeof document === "undefined") return
  // Brand v3.1 §00 — System (and any non-explicit theme) resolves to
  // Light. Users who want dark must select Dark explicitly. This is
  // the brand-canonical-light guarantee: an OS-dark visitor never lands
  // on a dark dashboard before they've expressed an explicit preference.
  const effective = theme === "dark" ? "dark" : "light"
  document.documentElement.setAttribute("data-theme", effective)
  document.documentElement.style.colorScheme = effective
}

/**
 * useTheme · headless hook for app-level theme control.
 *
 * Returns:
 *   { theme, setTheme, effective, mounted }
 */
export function useTheme() {
  const [theme, setThemeState] = useState(DEFAULT_THEME)
  const [mounted, setMounted] = useState(false)

  // Hydrate once on the client
  useEffect(() => {
    const stored = readStored()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setThemeState(stored)
    applyTheme(stored)
    setMounted(true)
  }, [])

  // OS-preference listener is intentionally NOT installed. Per Brand
  // v3.1 §00, "System" resolves to Light (the brand-canonical default)
  // rather than following the OS. Without this listener, an OS theme
  // change on a user sitting on the "System" segment won't repaint —
  // they'll stay on Light. To follow OS, the user must explicitly pick
  // Dark when they want it.

  const setTheme = useCallback((next) => {
    if (!VALID.includes(next)) return
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore quota errors */
    }
    applyTheme(next)
  }, [])

  // Per Brand v3.1 §00, anything other than explicit "dark" resolves to
  // "light". This `effective` value drives the switch-variant icon
  // (Sun / Moon) — System now visibly shows the Sun, matching the
  // light render. Stay consistent with applyTheme above.
  const effective = theme === "dark" ? "dark" : "light"

  return { theme, setTheme, effective, mounted }
}

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: MonitorSmartphone },
]

/**
 * ThemeSwitcher · UI control — wires to useTheme automatically.
 *
 * Props:
 *   variant?    · "segmented" (default) · "switch"
 *   size?       · "sm" · "md" (default)
 *   className?  · escape hatch
 */
export default function ThemeSwitcher({
  variant = "segmented",
  size = "md",
  className = "",
}) {
  const { theme, setTheme, effective } = useTheme()

  if (variant === "switch") {
    const next = effective === "dark" ? "light" : "dark"
    const Icon = effective === "dark" ? Moon : Sun
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`Activate ${next} mode`}
        className={[
          "cursor-pointer inline-flex items-center justify-center rounded-full",
          "h-9 w-9 text-[var(--color-text-secondary)]",
          "border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]",
          "transition-[background-color,color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
          "hover:text-[var(--color-violet)] hover:border-[var(--color-border-violet)] hover:bg-[var(--color-violet-pale)]",
          "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--color-violet-rgb)/0.18)]",
          className,
        ].join(" ")}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  const sizeCls =
    size === "sm" ? "h-8 px-2 text-[12px]" : "h-9 px-2.5 text-[13px]"

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={[
        "inline-flex items-center rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1 gap-0.5",
        className,
      ].join(" ")}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={[
              "cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] font-semibold",
              sizeCls,
              "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
              "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--color-violet-rgb)/0.18)]",
              active
                ? "bg-[var(--color-violet-pale)] text-[var(--color-violet)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
            ].join(" ")}
            aria-label={label}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export { ThemeSwitcher }
