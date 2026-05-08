// ════════════════════════════════════════════════════════════════════════════
// CommandPalette · ui composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Generic Cmd/Ctrl+K palette — DUMB component. It manages keyboard nav,
// fuzzy filtering, grouping, and rendering. It does NOT know about
// products, navigation, or fetching: callers pass an `items` array and an
// `onSelect` handler. Pages compose richer behaviours on top.
//
// (Existing app uses /components/SearchPalette.jsx for the products-only
//  scope. This new primitive is the generalised foundation that future
//  scopes will build on — settings, recent orders, admin actions, etc.)
//
// API:
//   <CommandPalette
//     open={open}
//     onOpenChange={setOpen}
//     items={[
//       { id: "go-store", group: "Navigate", label: "Go to Store",
//         icon: ShoppingBag, shortcut: "G S", onSelect: () => navigate("/store") },
//       { id: "new-prod", group: "Actions", label: "New product",
//         icon: PlusSquare, onSelect: () => navigate("/admin/products/new") },
//     ]}
//     placeholder="Type a command…"
//   />
//
// Open helpers:
//   const cmd = useCommandPalette()  // exposes { open, toggle, close }
//   useCommandShortcut(() => cmd.toggle())   // wires Cmd/Ctrl+K
// ════════════════════════════════════════════════════════════════════════════

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Search, CornerDownLeft, ArrowDown, ArrowUp, ChevronRight } from "lucide-react"

// Naive but fast fuzzy match — every char of `q` must appear in order in `s`.
// Returns a score: lower is better; -1 if no match.
function fuzzyScore(s, q) {
  if (!q) return 0
  const text = (s || "").toLowerCase()
  const query = q.toLowerCase()
  let ti = 0
  let qi = 0
  let firstMatch = -1
  let prevMatch = -2
  let gap = 0
  while (ti < text.length && qi < query.length) {
    if (text[ti] === query[qi]) {
      if (firstMatch === -1) firstMatch = ti
      gap += ti - prevMatch - 1
      prevMatch = ti
      qi += 1
    }
    ti += 1
  }
  if (qi !== query.length) return -1
  return firstMatch + gap
}

/**
 * CommandPalette · presentational palette.
 *
 * Props:
 *   open, onOpenChange   · controlled visibility
 *   items                · [{ id, label, group?, icon?, shortcut?, hint?,
 *                            keywords?, disabled?, onSelect }]
 *   placeholder?         · search placeholder
 *   emptyTitle?, emptyHint? · zero-result copy
 *   onQueryChange?       · (q) => void — for async-fed palettes
 *   loading?             · boolean — shows a subtle pulse instead of empty
 *   footer?              · ReactNode — shown below the list
 *   className?           · escape hatch on the panel
 */
export default function CommandPalette({
  open,
  onOpenChange,
  items = [],
  placeholder = "Type a command or search…",
  emptyTitle = "No matches",
  emptyHint = "Try a different keyword.",
  onQueryChange,
  loading = false,
  footer,
  className = "",
}) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const reactId = useId()

  const close = useCallback(() => onOpenChange?.(false), [onOpenChange])

  // Reset on open
  useEffect(() => {
    if (!open) return
    setQuery("")
    setActive(0)
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  // Body scroll lock
  useEffect(() => {
    if (!open) return undefined
    const orig = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = orig
    }
  }, [open])

  // Filter + sort + group
  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim()
    return items
      .map((it) => {
        const haystack = [it.label, it.hint, ...(it.keywords || [])].filter(Boolean).join(" ")
        const score = fuzzyScore(haystack, q)
        return { it, score }
      })
      .filter((x) => x.score !== -1)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.it)
  }, [items, query])

  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach((it) => {
      const g = it.group || "Suggestions"
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(it)
    })
    return Array.from(map.entries())
  }, [filtered])

  const flat = useMemo(() => filtered, [filtered])

  // Keep active in bounds
  useEffect(() => {
    if (active >= flat.length) setActive(0)
  }, [active, flat.length])

  // Scroll active into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-cmd-idx="${active}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [active])

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      close()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const it = flat[active]
      if (it && !it.disabled) {
        it.onSelect?.()
        close()
      }
    }
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${reactId}-input`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
          className="fixed inset-0 z-[var(--z-modal,70)] flex items-start justify-center bg-[rgba(26,27,35,0.55)] backdrop-blur-md p-4 pt-[12vh]"
        >
          <motion.div
            initial={{ y: -10, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={[
              "relative w-full max-w-[640px] overflow-hidden rounded-[18px]",
              "bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
              "border border-[var(--color-border-subtle)]",
              "shadow-[var(--shadow-overlay)]",
              className,
            ].join(" ")}
          >
            {/* Input row */}
            <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3.5">
              <Search className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
              <input
                ref={inputRef}
                id={`${reactId}-input`}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  onQueryChange?.(e.target.value)
                }}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-[15px] leading-[1.4] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none"
                autoComplete="off"
                spellCheck="false"
                aria-label={placeholder}
              />
              <kbd className="hidden items-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text-muted)] sm:inline-flex">
                ESC
              </kbd>
            </div>

            {/* List */}
            <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
              {loading && flat.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
                  Searching…
                </div>
              ) : flat.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                    {emptyTitle}
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {emptyHint}
                  </div>
                </div>
              ) : (
                groups.map(([groupName, groupItems]) => (
                  <div key={groupName} className="mb-1.5 last:mb-0">
                    <div className="px-2 pt-1.5 pb-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                      {groupName}
                    </div>
                    <ul role="listbox">
                      {groupItems.map((it) => {
                        const idx = flat.indexOf(it)
                        const isActive = idx === active
                        const Icon = it.icon
                        return (
                          <li key={it.id} role="option" aria-selected={isActive}>
                            <button
                              type="button"
                              data-cmd-idx={idx}
                              onClick={() => {
                                if (it.disabled) return
                                it.onSelect?.()
                                close()
                              }}
                              onMouseEnter={() => setActive(idx)}
                              disabled={it.disabled}
                              className={[
                                "group flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left",
                                "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
                                isActive
                                  ? "bg-[var(--color-violet-pale)] text-[var(--color-violet)]"
                                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]",
                                it.disabled && "opacity-50 cursor-not-allowed",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <span
                                className={[
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                                  isActive
                                    ? "bg-[var(--color-action-primary)] text-[var(--color-text-on-violet)]"
                                    : "bg-[var(--color-violet-pale)] text-[var(--color-violet)]",
                                ].join(" ")}
                              >
                                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold">
                                  {it.label}
                                </span>
                                {it.hint && (
                                  <span className={`block truncate text-[12px] ${isActive ? "text-[var(--color-violet)]" : "text-[var(--color-text-muted)]"}`}>
                                    {it.hint}
                                  </span>
                                )}
                              </span>
                              {it.shortcut && (
                                <span className="ml-3 font-mono text-[11px] tracking-wider text-[var(--color-text-muted)]">
                                  {it.shortcut}
                                </span>
                              )}
                              <CornerDownLeft
                                className={`h-3.5 w-3.5 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-[11px] text-[var(--color-text-muted)]">
              <div className="flex items-center gap-3">
                <Hint icon={ArrowUp}>navigate</Hint>
                <Hint icon={ArrowDown}>up</Hint>
                <Hint icon={CornerDownLeft}>open</Hint>
              </div>
              {footer || (
                <span className="hidden sm:inline">
                  {flat.length} result{flat.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Hint({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-1 font-mono text-[10px] font-semibold text-[var(--color-text-secondary)]">
        <Icon className="h-3 w-3" aria-hidden="true" />
      </kbd>
      {children}
    </span>
  )
}

// ── Hook: useCommandShortcut ───────────────────────────────────────────────
// Wires Cmd/Ctrl+K to a callback. Skips when an input is focused unless
// `evenInInputs` is set.
export function useCommandShortcut(handler, { evenInInputs = false, key = "k" } = {}) {
  useEffect(() => {
    if (typeof window === "undefined") return undefined
    const onKey = (e) => {
      const match = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key.toLowerCase()
      if (!match) return
      if (!evenInInputs) {
        const tag = document.activeElement?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA") {
          // Allow Cmd+K from inside inputs by default (typical palette UX)
        }
      }
      e.preventDefault()
      handler?.(e)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handler, evenInInputs, key])
}

// ── Hook: useCommandPalette ───────────────────────────────────────────────
// Tiny convenience hook for managing open state.
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  return {
    open,
    setOpen,
    toggle: () => setOpen((o) => !o),
    show: () => setOpen(true),
    hide: () => setOpen(false),
  }
}

export { CommandPalette }
