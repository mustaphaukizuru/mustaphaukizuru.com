import { useEffect, useId, useRef } from "react"
import { Search, X } from "lucide-react"

import { useTranslation } from "react-i18next"
/* ──────────────────────────────────────────────────────────────────────────
 *  SearchInput · Batch 6C · Component consolidation
 *
 *  Standalone search input primitive. Consolidates 5+ duplicate inline
 *  search inputs across the codebase (Store, PortfolioPage, AdminMedia,
 *  AdminEmailTemplates, AdminPortfolio, etc).
 *
 *  Note: <DataTable /> from Batch 6B-2 already has its own internal search
 *  built in. This primitive is for STANDALONE use — pages that show a
 *  filter strip with search but don't use DataTable.
 *
 *  Features:
 *    - Search icon prefix
 *    - X-clear button when value is non-empty
 *    - Optional `onClear` callback (defaults to onChange("") if omitted)
 *    - Configurable size (sm: 32px / md: 36px / lg: 40px)
 *    - Configurable width (full | sm | md | lg)
 *    - Auto-generated id linking aria-label
 *    - Cmd/Ctrl+K to focus (optional via shortcut prop)
 *    - Forwarded ref support for programmatic focus
 *
 *  ── API ─────────────────────────────────────────────────────────────────
 *
 *  <SearchInput
 *    value={query}
 *    onChange={setQuery}
 *    placeholder="Search products..."
 *    aria-label="Search products"
 *    size="md"
 *    width="full"
 *    shortcut                      // adds ⌘K hint + binds the key
 *  />
 *  ──────────────────────────────────────────────────────────────────── */

const SIZES = {
  sm: { input: "h-8 pl-8 pr-7 text-[11px]", icon: "h-3 w-3", xBtn: "h-3 w-3" },
  md: { input: "h-9 pl-9 pr-7 text-micro", icon: "h-3.5 w-3.5", xBtn: "h-3 w-3" },
  lg: { input: "h-10 pl-10 pr-8 text-meta", icon: "h-4 w-4", xBtn: "h-3.5 w-3.5" },
}

const WIDTHS = {
  full: "w-full",
  sm: "w-full sm:w-[180px]",
  md: "w-full sm:w-[240px]",
  lg: "w-full sm:w-[320px]",
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search\u2026",
  size = "md",
  width = "full",
  shortcut = false,
  disabled = false,
  className = "",
  inputRef,
  ...rest
}) {
  const { t } = useTranslation("common")
  const reactId = useId()
  const id = `search-${reactId}`
  const internalRef = useRef(null)
  const ref = inputRef ?? internalRef

  // Optional Cmd/Ctrl+K to focus
  useEffect(() => {
    if (!shortcut) return undefined
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shortcut, ref])

  function handleClear() {
    if (onClear) onClear()
    else if (typeof onChange === "function") onChange({ target: { value: "" } })
    ref.current?.focus()
  }

  const sizeCfg = SIZES[size] || SIZES.md
  const widthCls = WIDTHS[width] || WIDTHS.full

  return (
    <div className={`relative ${widthCls} ${className}`}>
      <Search
        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-80/40 ${sizeCfg.icon}`}
        aria-hidden="true"
      />
      <input
        id={id}
        ref={ref}
        type="search"
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={rest["aria-label"] || placeholder}
        className={`${sizeCfg.input} ${widthCls} rounded-lg border border-charcoal-80/12 bg-white text-violet placeholder:text-charcoal-80/35 outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20 disabled:cursor-not-allowed disabled:opacity-60`}
        {...rest}
      />
      {shortcut && !value && (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-charcoal-80/12 bg-charcoal-80/5 px-1 font-mono text-[10px] font-bold text-charcoal-80/65 sm:inline-flex">
          {typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform) ? "\u2318" : "Ctrl"}
          K
        </kbd>
      )}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t("system.clearSearch")}
          className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-charcoal-80/40 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
        >
          <X className={sizeCfg.xBtn} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default SearchInput
