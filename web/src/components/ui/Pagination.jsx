// ════════════════════════════════════════════════════════════════════════════
// Pagination · ui composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Numbered page navigation. Smart-truncates the page list with ellipses so
// the row stays compact even with hundreds of pages.
//
// Algorithm:
//   · Always show: 1, last, current, current±1
//   · Insert "…" between non-adjacent groups
//   · Collapse single-page gaps (e.g. 1 … 3 4 5 → 1 2 3 4 5)
//
// Accessibility:
//   · <nav aria-label="Pagination"> wrapper
//   · Current page button has aria-current="page"
//   · Prev/next have aria-labels and disabled state when at edges
// ════════════════════════════════════════════════════════════════════════════

import { ChevronLeft, ChevronRight } from "lucide-react"

import { useTranslation } from "react-i18next"
const SIZE = {
  sm: "h-8 min-w-8 px-2 text-[12px]",
  md: "h-9 min-w-9 px-2.5 text-[13px]",
  lg: "h-10 min-w-10 px-3 text-[14px]",
}

function buildPageList(current, total, siblings = 1) {
  if (total <= 7 + siblings * 2) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const left = Math.max(2, current - siblings)
  const right = Math.min(total - 1, current + siblings)
  const showLeftDots = left > 3
  const showRightDots = right < total - 2

  const list = [1]
  if (showLeftDots) list.push("…")
  else for (let i = 2; i < left; i += 1) list.push(i)
  for (let i = left; i <= right; i += 1) list.push(i)
  if (showRightDots) list.push("…")
  else for (let i = right + 1; i < total; i += 1) list.push(i)
  list.push(total)
  return list
}

/**
 * Pagination · classic numbered control.
 *
 * Props:
 *   page          · current page (1-indexed)
 *   pageCount     · total pages
 *   onPageChange  · (page) => void
 *   siblings?     · number of pages around current (default 1)
 *   size?         · "sm" · "md" (default) · "lg"
 *   showEdges?    · boolean — show "First / Last" labels too (default false)
 *   className?    · outer wrapper
 */
export default function Pagination({
  page,
  pageCount,
  onPageChange,
  siblings = 1,
  size = "md",
  showEdges = false,
  className = "",
}) {
  const { t } = useTranslation("common")
  if (!pageCount || pageCount < 1) return null
  const cur = Math.min(Math.max(1, page || 1), pageCount)
  const list = buildPageList(cur, pageCount, siblings)
  const sizeCls = SIZE[size] || SIZE.md

  const baseBtn =
    "inline-flex items-center justify-center rounded-[8px] font-semibold tabular-nums " +
    "transition-[background-color,color,border-color,box-shadow] " +
    "duration-[var(--motion-fast)] ease-[var(--ease-standard)] " +
    "border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] " +
    "text-[var(--color-text-secondary)] hover:text-[var(--color-violet)] " +
    "hover:border-[var(--color-border-violet)] hover:bg-[var(--color-violet-pale)] " +
    "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--color-violet-rgb)/0.18)] " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--color-surface-card)] disabled:hover:text-[var(--color-text-secondary)]"

  const activeBtn =
    "bg-[var(--color-action-primary)] text-[var(--color-text-on-violet)] " +
    "border-[var(--color-action-primary)] hover:bg-[var(--color-action-primary-hover)] " +
    "hover:text-[var(--color-text-on-violet)] hover:border-[var(--color-action-primary-hover)]"

  return (
    <nav
      aria-label="Pagination"
      className={["inline-flex items-center gap-1.5", className].filter(Boolean).join(" ")}
    >
      {showEdges && (
        <button
          type="button"
          onClick={() => onPageChange?.(1)}
          disabled={cur === 1}
          aria-label={t("ui.pagination.first")}
          className={[baseBtn, sizeCls].join(" ")}
        >
          First
        </button>
      )}

      <button
        type="button"
        onClick={() => onPageChange?.(cur - 1)}
        disabled={cur === 1}
        aria-label={t("ui.pagination.previous")}
        className={[baseBtn, sizeCls].join(" ")}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      {list.map((p, idx) =>
        p === "…" ? (
          <span
            key={`ellipsis-${idx}`}
            aria-hidden="true"
            className={[
              "inline-flex items-center justify-center",
              sizeCls,
              "text-[var(--color-text-muted)]",
            ].join(" ")}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange?.(p)}
            aria-current={p === cur ? "page" : undefined}
            aria-label={`Page ${p}`}
            className={[baseBtn, sizeCls, p === cur ? activeBtn : ""].join(" ")}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange?.(cur + 1)}
        disabled={cur === pageCount}
        aria-label={t("ui.pagination.next")}
        className={[baseBtn, sizeCls].join(" ")}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>

      {showEdges && (
        <button
          type="button"
          onClick={() => onPageChange?.(pageCount)}
          disabled={cur === pageCount}
          aria-label={t("ui.pagination.last")}
          className={[baseBtn, sizeCls].join(" ")}
        >
          Last
        </button>
      )}
    </nav>
  )
}

export { Pagination }
