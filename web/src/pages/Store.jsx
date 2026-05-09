import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Search, X, LayoutGrid, Rows3, SlidersHorizontal, ShoppingCart, Star,
  Check, Eye, Package, PackageOpen, ArrowRight, ChevronLeft, ChevronRight,
  Sparkles, Download, BookOpen, Cpu, Wrench, Briefcase, FlaskConical,
} from "lucide-react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { useCart } from "../store/CartContext"
import { fetchProducts, fetchFeaturedProducts } from "../services/productService"
import StoreHero from "../components/heroes/StoreHero"
import { API_BASE_URL } from "../lib/api"
import { getFileTypeStyles } from "../lib/fileTypeIcons"

/* ──────────────────────────────────────────────────────────────────────────
 *  Store · F05 · Batch 4
 *
 *  Refinements applied:
 *    F05.B · Filter toolbar polish — Deep Azure focus rings on inputs,
 *            consistent control sizing, refined sort styling.
 *    F05.C · Skeleton loading — refined to match real card aspect ratio
 *            (4:3 image + text rows), no full-screen flash.
 *    F05.D · Empty state — Lucide PackageOpen illustration, refined copy,
 *            kept structure.
 *    F05.E · Results count — "Showing 12 of 47 products" line above the
 *            grid, JetBrains Mono numbers.
 *    F05.F · Pagination — CRITICAL FIX: <StorePagination /> was defined but
 *            never rendered in the prior version. Now wired into the main
 *            return. Mojibake characters in the prior pagination buttons
 *            replaced with proper Lucide ChevronLeft/Right icons.
 *    F05.A · Applied to StoreProductCard since /store renders that internal
 *            card (not the shared <ProductCard> component): file-type chips,
 *            independent New + Featured badges, motion lift, mono price,
 *            conditional rating row.
 *
 *  Preserved verbatim:
 *    - Page hero (StoreHero)
 *    - Category filter pill bar logic
 *    - Sort/view-mode toggle behavior
 *    - List view mode and StoreListItem structure
 *    - All filtering/sorting logic
 *    - fetchProducts API call (B02)
 *  ──────────────────────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CATEGORY DEFINITIONS — exactly 6 store categories
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { labelKey: "categories.all",          value: "",                              icon: Sparkles,     color: "bg-violet-pale text-violet" },
  { labelKey: "categories.templates",    value: "Templates",                     icon: BookOpen,     color: "bg-[#eef3fb] text-[#2f5ea8]" },
  { labelKey: "categories.itToolkits",   value: "Digital & IT Toolkits",         icon: Cpu,          color: "bg-[#f6efe3] text-[#9c5c00]" },
  { labelKey: "categories.csResources",  value: "Computer Science Resources",    icon: FlaskConical, color: "bg-[#e8f4ea] text-[#3b8f47]" },
  { labelKey: "categories.stemRobotics", value: "STEM & Robotics Kits",          icon: Wrench,       color: "bg-[#fff3e2] text-[#b46909]" },
  { labelKey: "categories.businessRes",  value: "Digital Business Resources",    icon: Briefcase,    color: "bg-[#eef2ff] text-[#4f46e5]" },
]

const SORT_OPTIONS = [
  { labelKey: "sortOptions.priceLow",  value: "price-low" },
  { labelKey: "sortOptions.priceHigh", value: "price-high" },
  { labelKey: "sortOptions.newest",    value: "newest" },
  { labelKey: "sortOptions.nameAsc",   value: "name-asc" },
]

function resolveImg(product) {
  const imgs = Array.isArray(product?.images) ? product.images : []
  const img = imgs.find((i) => i?.imageRole === "cover") || imgs[0]
  if (!img?.url) return null
  return img.url.startsWith("http") ? img.url : `${API_BASE_URL}${img.url}`
}

/* ── Derive distinct file-type chips for a product (max 3) ────────────── */
function getFileTypeChips(product) {
  const files = Array.isArray(product?.files) ? product.files : []
  const seen = new Set()
  const chips = []
  for (const f of files) {
    const styles = getFileTypeStyles(f.fileType || f.fileName || "")
    const key = styles.label || styles.fileType || ""
    if (!key || seen.has(key)) continue
    seen.add(key)
    chips.push(styles)
    if (chips.length >= 3) break
  }
  if (chips.length === 0 && product?.fileType) {
    chips.push(getFileTypeStyles(product.fileType))
  }
  return chips
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR — F05.B · refined focus rings, consistent sizing
// ─────────────────────────────────────────────────────────────────────────────
function StoreToolbar({ search, setSearch, activeCategory, setActiveCategory, sort, setSort, viewMode, setViewMode, total, onReset }) {
  const { t } = useTranslation("store")
  const hasFilters = activeCategory !== "" || search.trim() || sort !== "price-low"

  return (
    <aside
      id="categories"
      aria-label={t("toolbar.filtersAria")}
      // scroll-mt-24 offsets the sticky site header so the rail is visible
      // when StoreHero's "Browse categories" CTA jumps via the #categories hash.
      className="scroll-mt-24 sticky top-[88px] flex flex-col gap-5 self-start rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_18px_rgba(93,63,211,0.04)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-violet" aria-hidden="true" />
          <h2 className="text-meta font-bold text-charcoal">{t("toolbar.filtersTitle")}</h2>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-micro font-semibold text-violet hover:text-violet-deep focus-visible:outline-none focus-visible:underline"
          >
            {t("toolbar.reset")}
          </button>
        )}
      </div>

      {/* Search */}
      <div>
        <label htmlFor="store-search" className="sr-only">{t("toolbar.searchAria")}</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
          <input
            id="store-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("filters.search")}
            className="h-10 w-full rounded-xl border border-charcoal-80/15 bg-mist pl-9 pr-8 text-meta text-violet outline-none placeholder:text-charcoal-80/40 focus:border-violet/40 focus-visible:ring-[3px] focus-visible:ring-azure/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("toolbar.clearSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-charcoal-80/40 transition hover:text-violet"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category list (vertical) */}
      <div>
        <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-charcoal-80/55">
          {t("toolbar.categoryHeader")}
        </h3>
        <div className="flex flex-col gap-1">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.value
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setActiveCategory(cat.value)}
                aria-pressed={active}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-meta font-medium transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
                  active
                    ? "bg-violet text-white shadow-[0_4px_12px_rgba(93,63,211,0.20)]"
                    : "text-charcoal-80/75 hover:bg-violet-pale hover:text-violet"
                }`}
              >
                <span>{t(cat.labelKey)}</span>
                {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sort */}
      <div>
        <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-charcoal-80/55">
          {t("toolbar.sortHeader")}
        </h3>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label={t("toolbar.sortAria")}
          className="h-10 w-full rounded-xl border border-charcoal-80/15 bg-mist px-3 text-meta font-medium text-violet outline-none focus:border-violet/40 focus-visible:ring-[3px] focus-visible:ring-azure/30"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
          ))}
        </select>
      </div>

      {/* View toggle */}
      <div>
        <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-charcoal-80/55">
          {t("toolbar.viewHeader")}
        </h3>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-charcoal-80/15">
          {[{ mode: "grid", Icon: LayoutGrid, labelKey: "toolbar.viewGrid" }, { mode: "list", Icon: Rows3, labelKey: "toolbar.viewList" }].map(({ mode, Icon, labelKey }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-micro font-semibold transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:z-10 ${
                viewMode === mode
                  ? "bg-violet text-white"
                  : "bg-white text-charcoal-80/65 hover:bg-violet-pale hover:text-violet"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="rounded-xl bg-violet-pale px-3 py-2.5 text-center font-mono text-micro font-semibold tabular-nums text-violet">
        {t("results.found", { count: total })}
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE PRODUCT CARD — F05.A applied to the internal store card
// ─────────────────────────────────────────────────────────────────────────────
function StoreProductCard({ product }) {
  const { t } = useTranslation("store")
  const { addToCart } = useCart()
  const [added, setAdded] = useState(false)
  const imgUrl = resolveImg(product)
  const price = Number(product?.price || 0)
  const cat = product?.category || t("card.categoryFallback")

  // F05.A · independent flags + file chips + rating
  const showNew = Boolean(product?.isNew)
  const showFeatured = Boolean(product?.isFeatured)
  const fileChips = useMemo(() => getFileTypeChips(product), [product])
  const rating = Number(product?.rating || 0)
  const reviewCount = Number(product?.reviewCount || 0)
  const showRating = reviewCount > 0 && rating > 0

  function handleAdd(e) {
    e.preventDefault(); e.stopPropagation()
    addToCart(product, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition-shadow duration-200 hover:shadow-[0_18px_44px_rgba(93,63,211,0.10)]"
    >
      <Link
        to={`/store/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-violet-pale p-3"
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.title}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-violet/30">
            <Package className="h-10 w-10" aria-hidden="true" />
          </div>
        )}

        {/* F05.A · "New" badge top-left (Soft Terracotta + Charcoal text) */}
        {showNew && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-0.5 text-micro font-bold text-charcoal shadow-[0_4px_10px_rgba(255,168,134,0.40)]">
            <Sparkles className="h-2.5 w-2.5" aria-hidden="true" /> New
          </span>
        )}

        {/* F05.A · "Featured" badge top-right (Violet Ghost + Violet text) */}
        {showFeatured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-violet/15 bg-violet-pale px-2.5 py-0.5 text-micro font-bold text-violet shadow-sm">
            <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> Featured
          </span>
        )}

        {/* F05.A · file-type chips bottom-left (max 3 distinct) */}
        {fileChips.length > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-1">
            {fileChips.map((chip, i) => (
              <span
                key={`${chip.label}-${i}`}
                className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-md"
                style={{
                  background: chip.background,
                  color: chip.color,
                  borderColor: chip.borderColor,
                }}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <span className="self-start rounded-lg bg-violet-pale px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet">
          {cat}
        </span>

        <Link to={`/store/${product.slug}`} className="mt-1.5 block">
          <h3 className="line-clamp-2 text-body font-bold leading-5 text-violet transition hover:text-violet-deep">
            {product.title}
          </h3>
        </Link>

        {/* F05.A · rating row only when reviewCount > 0 */}
        {showRating && (
          <div className="mt-1.5 flex items-center gap-1.5 text-micro">
            <Star className="h-3.5 w-3.5 fill-current text-terracotta" aria-hidden="true" />
            <span className="font-mono font-semibold tabular-nums text-violet">{rating.toFixed(1)}</span>
            <span className="font-mono tabular-nums text-charcoal-80/55">({reviewCount})</span>
          </div>
        )}

        <p className="mt-1.5 line-clamp-2 flex-1 text-meta leading-5 text-charcoal-80/65">
          {product.shortDescription || product.description}
        </p>

        <div className="mt-1.5 flex items-center gap-1.5 text-micro text-charcoal-80/45">
          <Download className="h-3.5 w-3.5 text-violet" aria-hidden="true" /> {t("card.instantAccess")}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-charcoal-80/8 pt-3">
          {/* F05.A · price in JetBrains Mono · tabular-nums */}
          <span className="font-mono text-card font-bold tabular-nums text-violet">
            ${price.toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            <Link
              to={`/store/${product.slug}`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-charcoal-80/12 text-charcoal-80/60 transition hover:border-violet/25 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              aria-label={t("card.viewDetails")}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={handleAdd}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-micro font-semibold text-white transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                added ? "bg-mint" : "bg-violet hover:bg-violet-deep"
              }`}
            >
              {added ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
              {added ? t("card.added") : t("card.addShort")}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST ITEM
// ─────────────────────────────────────────────────────────────────────────────
function StoreListItem({ product }) {
  const { t } = useTranslation("store")
  const { addToCart } = useCart()
  const [added, setAdded] = useState(false)
  const imgUrl = resolveImg(product)
  const price = Number(product?.price || 0)

  return (
    <div className="flex overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:shadow-[0_12px_32px_rgba(93,63,211,0.08)]">
      <div className="aspect-square w-[160px] shrink-0 overflow-hidden rounded-xl bg-violet-pale p-3 sm:w-[200px]">
        {imgUrl ? (
          <img src={imgUrl} alt={product.title} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-violet/30">
            <Package className="h-8 w-8" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <span className="rounded-lg bg-violet-pale px-2.5 py-0.5 text-micro font-semibold uppercase text-violet">
            {product.category || t("card.categoryFallback")}
          </span>
          <Link to={`/store/${product.slug}`}>
            <h3 className="mt-1.5 text-body font-bold text-violet transition hover:text-violet-deep">{product.title}</h3>
          </Link>
          <p className="mt-1 text-meta leading-5 text-charcoal-80/65 line-clamp-2">
            {product.shortDescription || product.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-subsection font-bold tabular-nums text-violet">${price.toFixed(2)}</span>
          <div className="flex items-center gap-2">
            <Link
              to={`/store/${product.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 px-4 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {t("card.view")}
            </Link>
            <button
              type="button"
              onClick={() => { addToCart(product, 1); setAdded(true); setTimeout(() => setAdded(false), 1400) }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-micro font-semibold text-white transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${added ? "bg-mint" : "bg-violet hover:bg-violet-deep"}`}
            >
              {added ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
              {added ? t("card.added") : t("card.addToCart")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — F05.D · refined typography + PackageOpen illustration
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onReset }) {
  const { t } = useTranslation("store")
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-violet/10 blur-2xl" aria-hidden="true" />
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
          <PackageOpen className="h-9 w-9" aria-hidden="true" />
        </div>
      </div>
      <h3 className="mt-6 text-card font-bold text-violet">{t("empty.title")}</h3>
      <p className="mt-2 max-w-sm text-meta leading-6 text-charcoal-80/65">
        {t("empty.subtitle")}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-violet/20 bg-white px-5 py-3 text-meta font-semibold text-violet transition hover:-translate-y-0.5 hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" /> {t("empty.resetFilters")}
        </button>
      )}
    </div>
  )
}

/* ── F05.C · skeleton card matching real card aspect ratio ─────────────── */
function SkeletonCard() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
      <div className="aspect-square w-full animate-pulse bg-violet-pale" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-3 w-16 animate-pulse rounded-full bg-violet-pale" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-violet-pale" />
        <div className="h-3 w-full animate-pulse rounded bg-violet-pale/70" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-violet-pale/60" />
        <div className="mt-3 flex items-center justify-between border-t border-charcoal-80/8 pt-3">
          <div className="h-5 w-16 animate-pulse rounded bg-violet-pale" />
          <div className="h-7 w-20 animate-pulse rounded-xl bg-violet-pale" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STORE PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 12

/* ── F05.F · pagination (was defined but never rendered before) ────────── */
function StorePagination({ page, totalPages, onChange }) {
  const { t } = useTranslation("store")
  if (totalPages <= 1) return null

  // For long lists, show ellipsis: 1 … 5 6 [7] 8 9 … 20
  function getPageButtons() {
    const pages = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }
    pages.push(1)
    if (page > 4) pages.push("…")
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (page < totalPages - 3) pages.push("…")
    pages.push(totalPages)
    return pages
  }

  return (
    <nav aria-label={t("pagination.ariaLabel")} className="flex items-center justify-center gap-2 pt-10">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label={t("pagination.previousAria")}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-charcoal-80/12 bg-white text-violet transition hover:bg-violet-pale disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      {getPageButtons().map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1.5 font-mono tabular-nums text-charcoal-80/50">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={t("pagination.pageAria", { page: p })}
            aria-current={p === page ? "page" : undefined}
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono text-meta font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
              p === page
                ? "bg-violet text-white shadow-[0_4px_12px_rgba(93,63,211,0.22)]"
                : "border border-charcoal-80/12 bg-white text-violet hover:bg-violet-pale"
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label={t("pagination.nextAria")}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-charcoal-80/12 bg-white text-violet transition hover:bg-violet-pale disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  )
}

export default function Store() {
  const { t } = useTranslation("store")
  const [products, setProducts] = useState([])
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [activeCategory, setCategory] = useState("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("price-low")
  const [viewMode, setViewMode] = useState("grid")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [activeCategory, search, sort])

  useEffect(() => {
    async function load() {
      setLoading(true); setError("")
      try {
        // Fetch the main listing + featured products in parallel
        const [data, featured] = await Promise.all([
          fetchProducts(activeCategory),
          // Only fetch featured on initial mount (when no category is filtered)
          activeCategory === "" ? fetchFeaturedProducts(5) : Promise.resolve(null),
        ])
        setProducts(Array.isArray(data) ? data : [])
        if (Array.isArray(featured)) {
          setFeaturedProducts(featured)
        }
      } catch (err) {
        setError(err.message || t("errors.loadFailed"))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [activeCategory])

  const filtered = useMemo(() => {
    let r = [...products]
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((p) =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      )
    }
    switch (sort) {
      case "price-low": r.sort((a, b) => Number(a.price) - Number(b.price)); break
      case "price-high": r.sort((a, b) => Number(b.price) - Number(a.price)); break
      case "name-asc": r.sort((a, b) => a.title.localeCompare(b.title)); break
      case "newest": r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break
    }
    return r
  }, [products, search, sort])

  const hasFilters = activeCategory !== "" || search.trim() || sort !== "price-low"
  const resetFilters = () => { setCategory(""); setSearch(""); setSort("price-low"); setPage(1) }
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages))
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)
  const paginated = filtered.slice(startIdx, endIdx)

  if (loading) {
    return (
      <>
        <StoreHero total={products.length} featuredProducts={featuredProducts} />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 h-12 animate-pulse rounded-xl bg-white" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="bg-mist">
      <StoreHero total={products.length} featuredProducts={featuredProducts} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:gap-8">
          <StoreToolbar
            search={search} setSearch={setSearch}
            activeCategory={activeCategory} setActiveCategory={setCategory}
            sort={sort} setSort={setSort}
            viewMode={viewMode} setViewMode={setViewMode}
            total={filtered.length}
            onReset={resetFilters}
          />

          <div id="products" className="scroll-mt-24">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-meta text-red-700">{error}</div>
        )}

        {/* Section label + F05.E results count */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              {t("section.collection")}
            </span>
            <h2 className="mt-2 text-subsection font-bold text-violet">
              {activeCategory || t("section.allProducts")}
            </h2>
          </div>

          {filtered.length > 0 && (
            <p className="text-micro text-charcoal-80/65">
              {t("results.showing")}{" "}
              <span className="font-mono font-semibold tabular-nums text-violet">
                {startIdx + 1}–{endIdx}
              </span>{" "}
              {t("results.of")}{" "}
              <span className="font-mono font-semibold tabular-nums text-violet">
                {filtered.length}
              </span>{" "}
              {filtered.length !== 1 ? t("results.productPlural") : t("results.productSingular")}
            </p>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
        ) : (
          <>
            {viewMode === "list" ? (
              <div className="space-y-4">
                {paginated.map((p) => <StoreListItem key={p.id} product={p} />)}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3">
                {paginated.map((p) => <StoreProductCard key={p.id} product={p} />)}
              </div>
            )}

            {/* F05.F · paginate */}
            <StorePagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
