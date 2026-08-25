/* eslint-disable react-refresh/only-export-components -- exports the openSearchPalette helper alongside the trigger */
// ════════════════════════════════════════════════════════════════════════════
// layout/header/SearchTrigger.jsx · desktop search icon button
// ────────────────────────────────────────────────────────────────────────────
// Opens the global SearchPalette via the `ukz:open-search` event. ⌘K / Ctrl+K
// is handled inside SearchPalette itself; this is the pointer affordance.
// ════════════════════════════════════════════════════════════════════════════
import { Search } from "lucide-react"

export function isMac() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.platform || navigator.userAgent || ""
  return /Mac|iPhone|iPad|iPod/i.test(ua)
}

export function openSearchPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ukz:open-search"))
  }
}


/* Search icon button — opens the global SearchPalette modal. */
export default function SearchTrigger() {
  const shortcut = isMac() ? "⌘K" : "Ctrl K"
  const aria = `Search · ${shortcut}`
  return (
    <button
      type="button"
      onClick={openSearchPalette}
      aria-label={aria}
      title={aria}
      className="cursor-pointer inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-80/75 transition hover:bg-violet/8 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
    >
      <Search className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
