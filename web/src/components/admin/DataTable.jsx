import { useEffect, useMemo, useState } from "react"
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, X,
  Inbox, RefreshCw, MoreHorizontal,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

/* ──────────────────────────────────────────────────────────────────────────
 *  DataTable · F10.H + F10.L · Batch 6B-2
 *
 *  Single shared primitive that all admin list pages should use, replacing
 *  the bespoke `<table>` markup that currently lives in each page.
 *
 *  Features (F10.H):
 *    - Sortable column headers (chevron rotates on toggle)
 *    - Sticky header on vertical scroll
 *    - Row hover with subtle highlight
 *    - Empty state with icon + descriptive message
 *    - Pagination at bottom + rows-per-page selector (10 / 25 / 50)
 *    - Search input that filters across configurable keys
 *    - Action buttons via render functions in column definitions
 *
 *  Features (F10.L):
 *    - Optional row selection with header "select all" checkbox
 *    - Floating bulk-actions toolbar that animates in when rows are
 *      selected. Slot-based — pages provide their own action buttons.
 *
 *  Accessibility:
 *    - role="table" / colheader / row / cell with proper ARIA on sortable
 *      headers
 *    - aria-sort attribute reflects active sort direction
 *    - aria-busy on loading state
 *    - aria-live="polite" on bulk-actions toolbar so SR announces selection
 *
 *  ── API ─────────────────────────────────────────────────────────────────
 *
 *  <DataTable
 *    columns={[
 *      {
 *        key: 'orderNumber',                    // unique column key
 *        label: 'Order #',                      // header text
 *        sortable: true,                        // makes header clickable
 *        align: 'left' | 'right' | 'center',    // optional, default 'left'
 *        width: '1.3fr',                        // CSS grid track size
 *        searchable: true,                      // include in search filter
 *        getValue: (row) => row.orderNumber,    // sort/search value
 *        render: (row) => <SomeJSX />,          // optional, defaults to getValue()
 *      },
 *    ]}
 *    rows={data}
 *    rowKey={(row) => row.id}
 *    loading={false}
 *    onRefresh={() => load()}                   // shows refresh button
 *    initialSort={{ key: 'createdAt', dir: 'desc' }}
 *    pageSize={25}                              // initial rows-per-page
 *    pageSizeOptions={[10, 25, 50]}
 *    selectable={true}                          // enables row checkboxes
 *    bulkActions={[
 *      { label: 'Delete selected', icon: Trash2, onClick: (rows) => ..., variant: 'danger' },
 *      { label: 'Export CSV', icon: Download, onClick: (rows) => ... },
 *    ]}
 *    searchPlaceholder="Search orders..."
 *    emptyState={{ icon: ShoppingCart, title: 'No orders', description: '...' }}
 *  />
 *  ──────────────────────────────────────────────────────────────────── */

/* ── SortableHeaderButton ─────────────────────────────────────────────── */
function SortableHeaderButton({ label, active, dir, onClick, align }) {
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label} ${active ? (dir === "asc" ? "ascending" : "descending") : ""}`}
      className={`group inline-flex w-full items-center gap-1.5 rounded ${justify} text-left transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1 ${
        active ? "text-violet" : "text-charcoal-80/65"
      }`}
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span>
      <span className="flex flex-col leading-none">
        <ChevronUp className={`h-2 w-2 transition ${active && dir === "asc" ? "text-violet" : "text-charcoal-80/30 group-hover:text-violet/50"}`} aria-hidden="true" />
        <ChevronDown className={`-mt-0.5 h-2 w-2 transition ${active && dir === "desc" ? "text-violet" : "text-charcoal-80/30 group-hover:text-violet/50"}`} aria-hidden="true" />
      </span>
    </button>
  )
}

/* ── PaginationControls ───────────────────────────────────────────────── */
function PaginationControls({ page, totalPages, total, pageSize, pageSizeOptions, onPageChange, onPageSizeChange, range }) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-col gap-3 border-t border-charcoal-80/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-micro text-charcoal-80/65">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-charcoal-80/12 bg-white px-2 py-1 font-mono text-micro tabular-nums text-violet outline-none transition focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="font-mono text-micro tabular-nums text-charcoal-80/55">
          {range || `${start}\u2013${end} of ${total}`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white text-charcoal-80/65 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="px-3 font-mono text-micro tabular-nums text-charcoal-80/65">
          Page {page} of {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white text-charcoal-80/65 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/* ── BulkActionsToolbar · animates in when selection > 0 ──────────────── */
function BulkActionsToolbar({ selectedCount, actions, onClear, totalCount }) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 lg:left-[296px]"
          role="region"
          aria-live="polite"
          aria-label={`${selectedCount} of ${totalCount} rows selected`}
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-violet/20 bg-white px-4 py-2.5 shadow-[0_18px_44px_rgba(93,63,211,0.18)]">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-violet px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-white">
                {selectedCount}
              </span>
              <span className="text-meta font-medium text-charcoal-80/85">
                row{selectedCount === 1 ? "" : "s"} selected
              </span>
            </div>
            <span className="h-5 w-px bg-charcoal-80/15" aria-hidden="true" />
            <div className="flex items-center gap-2">
              {actions.map((action, idx) => {
                const Icon = action.icon
                const isDanger = action.variant === "danger"
                return (
                  <button
                    key={`${action.label}-${idx}`}
                    type="button"
                    onClick={action.onClick}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 ${
                      isDanger
                        ? "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 focus-visible:ring-rose-300/40"
                        : "border border-charcoal-80/12 bg-white text-violet hover:border-violet/20 hover:bg-violet-pale focus-visible:ring-azure/30"
                    }`}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {action.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selection"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-charcoal-80/10 hover:text-charcoal-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
function TableSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-2 p-4" role="status" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-[#f5eff6]/60" />
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */
export default function DataTable({
  columns,
  rows,
  rowKey,
  loading = false,
  onRefresh,
  initialSort,
  pageSize: initialPageSize = 25,
  pageSizeOptions = [10, 25, 50],
  selectable = false,
  bulkActions = [],
  searchPlaceholder = "Search…",
  emptyState,
  toolbar,
  rowAction,
}) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState(initialSort?.key || null)
  const [sortDir, setSortDir] = useState(initialSort?.dir || "desc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selected, setSelected] = useState(() => new Set())

  // Reset page if rows shrink below current page
  useEffect(() => { setPage(1) }, [search, sortKey, sortDir, pageSize])

  // Build CSS grid template from column widths
  const gridCols = useMemo(() => {
    const tracks = []
    if (selectable) tracks.push("36px")
    columns.forEach((c) => tracks.push(c.width || "1fr"))
    return tracks.join(" ")
  }, [columns, selectable])

  // Filter
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase().trim()
    return rows.filter((row) =>
      columns.some((c) => {
        if (c.searchable === false) return false
        if (c.searchable !== true && !c.getValue) return false
        const val = c.getValue ? c.getValue(row) : row[c.key]
        return String(val ?? "").toLowerCase().includes(q)
      })
    )
  }, [rows, search, columns])

  // Sort
  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return filteredRows
    const getVal = col.getValue || ((r) => r[col.key])
    return [...filteredRows].sort((a, b) => {
      const av = getVal(a)
      const bv = getVal(b)
      // Robust comparison handling numbers, dates, strings, nulls
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av
      }
      const da = av instanceof Date ? av.getTime() : (typeof av === "string" && /^\d{4}-\d{2}-\d{2}/.test(av) ? new Date(av).getTime() : null)
      const db = bv instanceof Date ? bv.getTime() : (typeof bv === "string" && /^\d{4}-\d{2}-\d{2}/.test(bv) ? new Date(bv).getTime() : null)
      if (da != null && db != null) return sortDir === "asc" ? da - db : db - da
      const sa = String(av).toLowerCase()
      const sb = String(bv).toLowerCase()
      if (sa < sb) return sortDir === "asc" ? -1 : 1
      if (sa > sb) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [filteredRows, sortKey, sortDir, columns])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const pagedRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [sortedRows, page, pageSize]
  )

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  function toggleRow(key) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      // If everything on current page is selected, clear; otherwise select all on current page
      const pageKeys = pagedRows.map((r) => rowKey(r))
      const allSelected = pageKeys.every((k) => prev.has(k))
      const next = new Set(prev)
      if (allSelected) pageKeys.forEach((k) => next.delete(k))
      else pageKeys.forEach((k) => next.add(k))
      return next
    })
  }

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(rowKey(r))),
    [rows, selected, rowKey]
  )

  const allOnPageSelected = pagedRows.length > 0 && pagedRows.every((r) => selected.has(rowKey(r)))
  const someOnPageSelected = pagedRows.some((r) => selected.has(rowKey(r))) && !allOnPageSelected

  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-charcoal-80/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {toolbar}
          <span className="font-mono text-micro tabular-nums text-charcoal-80/55">
            {sortedRows.length} {sortedRows.length === 1 ? "result" : "results"}
            {search && rows.length !== sortedRows.length && <span className="ml-1 text-charcoal-80/40">of {rows.length}</span>}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={`dt-search-${columns[0]?.key}`} className="sr-only">{searchPlaceholder}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
            <input
              id={`dt-search-${columns[0]?.key}`}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-[220px] rounded-lg border border-charcoal-80/12 bg-[#fafafa] pl-9 pr-7 text-micro text-violet outline-none transition focus:border-violet/40 focus:bg-white focus:ring-[3px] focus:ring-azure/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-charcoal-80/40 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white text-charcoal-80/65 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[600px] overflow-auto" role="region" aria-label="Data table">
        {loading && rows.length === 0 ? (
          <TableSkeleton />
        ) : sortedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
              {emptyState?.icon ? <emptyState.icon className="h-7 w-7" aria-hidden="true" /> : <Inbox className="h-7 w-7" aria-hidden="true" />}
            </div>
            <h3 className="mt-4 text-card font-bold text-violet">
              {search ? "No matching results" : (emptyState?.title || "Nothing here yet")}
            </h3>
            <p className="mt-1 max-w-sm text-meta text-charcoal-80/65">
              {search
                ? `No rows match "${search}". Try a different search term.`
                : (emptyState?.description || "Records will appear here once data is available.")}
            </p>
            {emptyState?.action && <div className="mt-5">{emptyState.action}</div>}
          </div>
        ) : (
          <div role="table" aria-rowcount={sortedRows.length} className="min-w-full">
            {/* Header, sticky */}
            <div
              role="row"
              className="sticky top-0 z-10 grid items-center gap-3 border-b border-charcoal-80/10 bg-[#fbf8fb] px-4 py-2.5 backdrop-blur"
              style={{ gridTemplateColumns: gridCols }}
            >
              {selectable && (
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => { if (el) el.indeterminate = someOnPageSelected }}
                    onChange={toggleAll}
                    aria-label="Select all rows on this page"
                    className="h-4 w-4 cursor-pointer rounded border-charcoal-80/30 text-violet accent-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                  />
                </div>
              )}
              {columns.map((col) => {
                const align = col.align || "left"
                const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
                return (
                  <div
                    key={col.key}
                    role="columnheader"
                    aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className={`flex items-center ${justify}`}
                  >
                    {col.sortable ? (
                      <SortableHeaderButton
                        label={col.label}
                        active={sortKey === col.key}
                        dir={sortDir}
                        onClick={() => handleSort(col.key)}
                        align={align}
                      />
                    ) : (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
                        {col.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Rows */}
            {pagedRows.map((row, idx) => {
              const key = rowKey(row)
              const isSelected = selected.has(key)
              return (
                <div
                  key={key}
                  role="row"
                  aria-rowindex={(page - 1) * pageSize + idx + 2}
                  className={`group grid items-center gap-3 border-b border-charcoal-80/6 px-4 py-3 text-meta last:border-b-0 transition ${
                    isSelected ? "bg-violet-pale/40" : "hover:bg-[#fafafa]"
                  } ${rowAction ? "cursor-pointer" : ""}`}
                  style={{ gridTemplateColumns: gridCols }}
                  onClick={rowAction ? () => rowAction(row) : undefined}
                  onKeyDown={rowAction ? (e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rowAction(row) }
                  } : undefined}
                  tabIndex={rowAction ? 0 : undefined}
                >
                  {selectable && (
                    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        aria-label={`Select row`}
                        className="h-4 w-4 cursor-pointer rounded border-charcoal-80/30 text-violet accent-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                      />
                    </div>
                  )}
                  {columns.map((col) => {
                    const align = col.align || "left"
                    const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
                    const value = col.render ? col.render(row) : (col.getValue ? col.getValue(row) : row[col.key])
                    return (
                      <div key={col.key} role="cell" className={`flex min-w-0 items-center ${justify}`}>
                        <div className="min-w-0 truncate">{value}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {sortedRows.length > 0 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          total={sortedRows.length}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Bulk actions toolbar */}
      {selectable && bulkActions.length > 0 && (
        <BulkActionsToolbar
          selectedCount={selectedRows.length}
          totalCount={rows.length}
          actions={bulkActions.map((a) => ({
            ...a,
            onClick: () => a.onClick(selectedRows),
          }))}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  )
}
