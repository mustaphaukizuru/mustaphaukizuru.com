import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  Package,
  Loader2,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react"

import { apiRequest, API_BASE_URL } from "../lib/api"
import { useTranslation } from "react-i18next"
import { Modal } from "./ui/Modal"

/**
 * SearchPalette · V2 — command-palette style
 *
 * Dark violet gradient surface · scope chip · rich result rows · keyboard
 * footer · concentric-ring empty state. Mounted once at the App root via
 * `<SearchPalette />`. Open via:
 *
 *   - ⌘K (Mac) / Ctrl+K (Win/Linux)
 *   - "/" key (when not focused on an input)
 *   - window.dispatchEvent(new Event("ukz:open-search"))    ← used by Header / Mobile
 *
 * Closes via Esc, backdrop click, or selecting a result.
 *
 * Backend contract (unchanged from V1):
 *   GET /api/v1/products/search?q=<query>&limit=8
 *   →  { items: [{ id, slug, title, shortDescription, price, currency, images: [{ url }] }, ...], total }
 */

const DEBOUNCE_MS = 220
const RESULT_LIMIT = 8

const PALETTE_BG =
  "radial-gradient(at 20% 0%, rgb(var(--color-violet-rgb)/0.95) 0px, transparent 60%), " +
  "radial-gradient(at 100% 100%, rgba(61,42,138,0.95) 0px, transparent 55%), " +
  "linear-gradient(180deg, var(--color-action-primary-active) 0%, var(--color-charcoal) 100%)"

/* ─────────────────────────── helpers ────────────────────────────────────── */

function isMac() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.platform || navigator.userAgent || ""
  return /Mac|iPhone|iPad|iPod/i.test(ua)
}

function formatPrice(value, currency) {
  if (value == null || value === "") return ""
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "MXN",
      maximumFractionDigits: 2,
    }).format(Number(value))
  } catch {
    return "$" + Number(value).toFixed(2)
  }
}

function resolveImage(url) {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

/* ─────────────────────────── main component ────────────────────────────── */

export default function SearchPalette() {
  const { t } = useTranslation("common")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState("")

  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()

  /* Track narrow-viewport state so we can pick the shorter placeholder
   * (the verbose "Type a command or search…" string overflows on iPhone
   * SE / Pixel-class widths even with min-w-0 + the scope chip hidden).
   * Subscribing to matchMedia is cheap and only fires on actual breakpoint
   * crossings, not every resize tick. Initialised eagerly from window so
   * the first paint is correct (no SSR in this app). */
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 639px)").matches
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(max-width: 639px)")
    const handler = (e) => setIsNarrow(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  /* Global key + custom-event listeners */
  useEffect(() => {
    function onKey(e) {
      const isToggle = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")
      if (isToggle) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (!open && e.key === "/") {
        const tag = document.activeElement && document.activeElement.tagName
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault()
          setOpen(true)
        }
      }
    }
    function onCustom() {
      setOpen(true)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("ukz:open-search", onCustom)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("ukz:open-search", onCustom)
    }
  }, [open])

  /* Reset + focus on open */
  useEffect(() => {
    if (!open) return
    setQuery("")
    setResults([])
    setActive(0)
    setError("")
  }, [open])

  /* Debounced search */
  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setActive(0)
      setError("")
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const url = `/api/v1/products/search?q=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`
        const res = await apiRequest(url)
        const items = Array.isArray(res && res.items)
          ? res.items
          : Array.isArray(res && res.data)
          ? res.data
          : []
        setResults(items)
        setActive(0)
      } catch (err) {
        const friendly =
          (err && typeof err.toUserMessage === "function" && err.toUserMessage()) ||
          (err && err.message) ||
          "Search failed."
        setError(friendly)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, open])

  /* Keep active row visible inside the scrollable list */
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${active}"]`)
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [active, results])

  function moveActive(delta) {
    setActive((prev) => {
      if (!results.length) return 0
      const next = prev + delta
      if (next < 0) return results.length - 1
      if (next >= results.length) return 0
      return next
    })
  }

  function selectItem(item) {
    if (!item) return
    setOpen(false)
    if (item.slug) navigate(`/store/${item.slug}`)
  }

  function onInputKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (results[active]) selectItem(results[active])
    }
  }

  const showIdle = !query.trim() && !loading && !error
  const showLoading = loading
  const showError = !loading && Boolean(error)
  const showEmpty = !loading && !error && Boolean(query.trim()) && results.length === 0
  const showResults = !loading && results.length > 0

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      bare
      hideClose
      ariaLabel="Search"
      placement="top"
      size="none"
      motion="slide-down"
      zIndex={80}
      initialFocusRef={inputRef}
      // Mobile · tighter outer padding and a higher palette position so
      // when the on-screen keyboard pops up the input still sits above
      // the fold. Desktop keeps the original 12vh drop so the palette
      // lands at the visual centre of attention. (Padding lives in the
      // Modal "top" placement.)
      backdropClassName="bg-charcoal/55 backdrop-blur-md"
      panelStyle={{ background: PALETTE_BG }}
      // rounded-2xl on mobile (less bulky on narrow viewports);
      // rounded-3xl on sm+ keeps the desktop softness.
      className="max-w-2xl overflow-hidden rounded-2xl text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10 sm:rounded-3xl"
    >
            {/* Subtle dot grid for depth */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]"
            />

            {/* ─── Top bar · search input row ───────────────────────────
                Layout rules:
                  · Mobile (<sm, <640px):
                      - tighter gaps + padding
                      - scope chip hidden (was eating ~80px of the row)
                      - shorter placeholder ("Search products…") so the
                        text never visibly truncates on iPhone SE / Pixel
                      - 44x44 X close button (WCAG AA touch target)
                  · Desktop (sm+):
                      - scope chip visible, ESC kbd hint chip preserved
                      - verbose placeholder for command-palette feel

                Overflow guards:
                  · `overflow-hidden` on this row absorbs any sub-pixel
                    rendering rounding that would otherwise push the X
                    off the right edge.
                  · Every fixed-width child carries `shrink-0`.
                  · The input gets `min-w-0` so flex can shrink it below
                    its intrinsic placeholder width without overflowing. */}
            <div className="relative flex items-center gap-2 overflow-hidden border-b border-white/10 px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
              <Search
                className="h-5 w-5 shrink-0 text-white/55"
                aria-hidden="true"
              />

              {/* Scope chip — desktop only. Purely informational (single
                  scope today); on mobile every pixel of input width matters. */}
              <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-white/[0.08] px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70 ring-1 ring-white/10 sm:inline-flex">
                <Package className="h-3 w-3" aria-hidden="true" />
                Products
              </span>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={
                  isNarrow
                    ? t("search.placeholderShort", { defaultValue: "Search products…" })
                    : t("search.placeholder2")
                }
                className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder-white/40 outline-none sm:text-[15.5px]"
                autoComplete="off"
                spellCheck="false"
                aria-label={t("search.searchAria")}
              />

              {/* Close affordance — uniform action, dual presentation:
                  · sm+ : "ESC" keyboard chip teaches the binding.
                  · <sm : 44x44 X icon button — meets WCAG AA touch target,
                          replaces the meaningless "ESC" hint on phones
                          that don't have an Esc key. */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("search.closeAria")}
                className="cursor-pointer hidden h-7 items-center gap-1 rounded-md bg-white/[0.08] px-2 font-mono text-[11px] font-semibold text-white/65 ring-1 ring-white/10 transition hover:bg-white/[0.14] hover:text-white sm:inline-flex"
              >
                ESC
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("search.closeAria")}
                className="cursor-pointer inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white ring-1 ring-white/15 transition active:scale-95 active:bg-white/[0.20] hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:hidden"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* ─── Body · states ──────────────────────────────────────── */}
            <div ref={listRef} className="relative max-h-[55vh] overflow-y-auto">
              {showIdle ? <IdleState /> : null}
              {showLoading ? <LoadingState /> : null}
              {showError ? (
                <ErrorState
                  message={error}
                  onRetry={() => setQuery((q) => q + " ")}
                />
              ) : null}
              {showEmpty ? (
                <EmptyState
                  query={query}
                  onClear={() => setQuery("")}
                />
              ) : null}
              {showResults ? (
                <ul className="p-2" role="listbox">
                  {results.map((item, i) => (
                    <ResultRow
                      key={(item && item.id) || i}
                      idx={i}
                      item={item}
                      active={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => selectItem(item)}
                    />
                  ))}
                </ul>
              ) : null}
            </div>

            {/* ─── Footer · keyboard hints + brand mark ────────────────
                The hint row is keyboard-only ergonomics — hidden on mobile
                where there's no keyboard. The outer container also goes
                `hidden sm:flex` so it doesn't render as an empty striped
                bar when both children are display:none on small viewports. */}
            <div className="relative hidden items-center justify-between gap-3 border-t border-white/10 bg-black/15 px-5 py-3 sm:flex">
              <div className="hidden flex-wrap items-center gap-3 text-[11.5px] font-medium text-white/55 sm:flex">
                <KbCombo>
                  <Kbd>
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  </Kbd>
                  <Kbd>
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  </Kbd>
                  <span>navigate</span>
                </KbCombo>
                <KbCombo>
                  <Kbd>
                    <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
                  </Kbd>
                  <span>open</span>
                </KbCombo>
                <KbCombo>
                  <Kbd>esc</Kbd>
                  <span>close</span>
                </KbCombo>
                <KbCombo>
                  <Kbd>{isMac() ? "⌘" : "Ctrl"}</Kbd>
                  <Kbd>K</Kbd>
                  <span>toggle</span>
                </KbCombo>
              </div>

              <span className="hidden items-center gap-1.5 text-[11px] text-white/40 sm:inline-flex">
                {t("search.searchBy")}{" "}
                <span className="font-semibold text-terracotta/85">
                  {t("search.brandSig")}
                </span>
              </span>
            </div>
    </Modal>
  )
}

/* ─────────────────────────── states ─────────────────────────────────────── */

function IdleState() {
  const { t } = useTranslation("common")
  return (
    <div className="px-5 py-10 text-center sm:py-14">
      <ConcentricRings>
        <Search className="h-5 w-5 text-white/80" aria-hidden="true" />
      </ConcentricRings>
      <p className="text-[14.5px] font-semibold text-white/90">
        {t("search.startTyping")}
      </p>
      {/* Keyboard-binding hint is desktop-only — these glyphs (↑ ↓ ↵) are
          meaningless on touch devices and add visual noise to the empty
          state on narrow viewports. */}
      <p className="mt-1.5 hidden text-[12.5px] text-white/45 sm:block">
        Press <Kbd inline>↑</Kbd> <Kbd inline>↓</Kbd> {t("search.navigate")}{" "}
        <Kbd inline>↵</Kbd> {t("search.openHint")}
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2
        className="h-5 w-5 animate-spin text-white/65"
        aria-label="Searching"
      />
    </div>
  )
}

function EmptyState({ query, onClear }) {
  const { t } = useTranslation("common")
  return (
    <div className="px-5 py-12 text-center">
      <ConcentricRings>
        <Search className="h-5 w-5 text-white/80" aria-hidden="true" />
      </ConcentricRings>
      <p className="text-[14.5px] font-semibold text-white">{t("search.noResults")}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-white/55">
        <span className="text-white/85">{'"'}{query}{'"'}</span> didn{"’"}{t("search.noMatch")}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[12.5px] font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.10]"
      >
        {t("search.clear")}
      </button>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  const { t } = useTranslation("common")
  return (
    <div className="px-5 py-12 text-center">
      <ConcentricRings>
        <Search className="h-5 w-5 text-rose-300" aria-hidden="true" />
      </ConcentricRings>
      <p className="text-[14px] font-semibold text-rose-300">
        {t("search.errorTitle")}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-white/55">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[12.5px] font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.10]"
      >
        {t("search.errorBody")}
      </button>
    </div>
  )
}

/* ─────────────────────────── result row ────────────────────────────────── */

function ResultRow({ idx, item, active, onClick, onMouseEnter }) {
  const cover = resolveImage(item && item.images && item.images[0] && item.images[0].url)
  const price = formatPrice(item && item.price, item && item.currency)
  const rowClass = active
    ? "bg-white/[0.10] ring-1 ring-white/20"
    : "ring-1 ring-transparent hover:bg-white/[0.06]"
  return (
    <li role="option" aria-selected={active}>
      <button
        type="button"
        data-idx={idx}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className={`cursor-pointer flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${rowClass}`}
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.08] ring-1 ring-white/10">
          {cover ? (
            <img
              src={cover}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-4 w-4 text-white/55" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-white">
            {item && item.title}
          </span>
          {item && item.shortDescription ? (
            <span className="block truncate text-[12px] text-white/50">
              {item.shortDescription}
            </span>
          ) : null}
        </span>
        {price ? (
          <span className="font-mono text-[12px] font-bold text-terracotta">
            {price}
          </span>
        ) : null}
        <CornerDownLeft
          className={`h-3.5 w-3.5 transition ${
            active ? "text-white/85" : "text-white/30"
          }`}
          aria-hidden="true"
        />
      </button>
    </li>
  )
}

/* ─────────────────────────── primitives ────────────────────────────────── */

function ConcentricRings({ children }) {
  // Slightly smaller on mobile so the empty state doesn't push the body
  // height below the keyboard fold on 360-wide viewports.
  return (
    <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full border border-white/10"
      />
      <span
        aria-hidden="true"
        className="absolute inset-2 rounded-full border border-white/12"
      />
      <span
        aria-hidden="true"
        className="absolute inset-4 rounded-full border border-white/15"
      />
      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] ring-1 ring-white/15 sm:h-12 sm:w-12">
        {children}
      </span>
    </div>
  )
}

function Kbd({ children, inline = false }) {
  const base =
    "inline-flex items-center justify-center rounded-md bg-white/[0.08] ring-1 ring-white/10 font-mono font-semibold text-white/85"
  const size = inline
    ? "h-4 min-w-4 px-1 text-[10px]"
    : "h-5 min-w-5 px-1 text-[10.5px]"
  return <kbd className={`${base} ${size}`}>{children}</kbd>
}

function KbCombo({ children }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>
}
