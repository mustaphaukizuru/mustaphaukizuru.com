import { useEffect, useMemo, useState } from "react"
import { Search, X, LayoutGrid, Rows3, SlidersHorizontal, ShoppingCart, Star, Check, Eye, Package, ArrowRight, Sparkles, Download, BookOpen, Cpu, Wrench, Briefcase, FlaskConical } from "lucide-react"
import { Link } from "react-router-dom"
import { useCart } from "../store/CartContext"
import { fetchProducts } from "../services/productService"
import { API_BASE_URL } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CATEGORY DEFINITIONS — exactly 6 store categories
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "All",           value: "",                          icon: Sparkles,    color: "bg-[#ede4ef] text-[#420060]" },
  { label: "Templates",      value: "Templates",                 icon: BookOpen,    color: "bg-[#eef3fb] text-[#2f5ea8]" },
  { label: "IT Toolkits",    value: "Digital & IT Toolkits",     icon: Cpu,         color: "bg-[#f6efe3] text-[#9c5c00]" },
  { label: "CS Resources",   value: "Computer Science Resources", icon: FlaskConical, color: "bg-[#e8f4ea] text-[#3b8f47]" },
  { label: "STEM & Robotics",value: "STEM & Robotics Kits",      icon: Wrench,      color: "bg-[#fff3e2] text-[#b46909]" },
  { label: "Business Res.",  value: "Digital Business Resources", icon: Briefcase,   color: "bg-[#eef2ff] text-[#4f46e5]" },
]

const SORT_OPTIONS = [
  { label: "Price: Low to High", value: "price-low" },
  { label: "Price: High to Low", value: "price-high" },
  { label: "Newest First",       value: "newest" },
  { label: "Name: A → Z",       value: "name-asc" },
]

function resolveImg(product) {
  const imgs = Array.isArray(product?.images) ? product.images : []
  const img = imgs.find((i) => i?.imageRole === "cover") || imgs[0]
  if (!img?.url) return null
  return img.url.startsWith("http") ? img.url : `${API_BASE_URL}${img.url}`
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE HERO
// ─────────────────────────────────────────────────────────────────────────────
function StoreHero({ total }) {
  return (
    <section className="relative overflow-hidden bg-[#420060] px-6 py-16 sm:px-8 lg:px-16 lg:py-20">
      {/* Background elements */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-[#FFCCAF]/10 blur-2xl" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_400px]">
          {/* Left copy */}
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">
              <Sparkles className="h-3.5 w-3.5" /> Premium Digital Store
            </span>
            <h1 className="text-[2.4rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[3rem]">
              Tools & Resources Built for{" "}
              <span className="text-[#FFCCAF]">Real-World Results</span>
            </h1>
            <p className="max-w-xl text-[16px] leading-7 text-white/60">
              Professionally crafted digital products for educators, creators, schools, and technology professionals. Everything structured for immediate implementation.
            </p>
            <div className="flex flex-wrap gap-3">
              {["Instant download", "Professional quality", "Implementation-ready"].map((t) => (
                <span key={t} className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-[12px] font-medium text-white/70">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right stat cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Products Available", value: `${total}+`, bg: "bg-white", text: "text-[#420060]", sub: "text-[#634F40]/60" },
              { label: "Categories",         value: "6",         bg: "bg-[#FFCCAF]", text: "text-[#420060]", sub: "text-[#420060]/60" },
              { label: "Best For",           value: "Schools",   bg: "bg-white/10", text: "text-white", sub: "text-white/40" },
              { label: "Delivery",           value: "Instant",   bg: "bg-white/10", text: "text-white", sub: "text-white/40" },
            ].map(({ label, value, bg, text, sub }) => (
              <div key={label} className={`rounded-xl p-5 ${bg}`}>
                <div className={`text-[11px] font-medium ${sub}`}>{label}</div>
                <div className={`mt-1 text-[1.6rem] font-bold leading-none ${text}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR — search + categories + sort in ONE LINE
// ─────────────────────────────────────────────────────────────────────────────
function StoreToolbar({ search, setSearch, activeCategory, setActiveCategory, sort, setSort, viewMode, setViewMode, total, onReset }) {
  const hasFilters = activeCategory !== "" || search.trim() || sort !== "price-low"

  return (
    <div className="sticky top-[64px] z-20 border-b border-[#634F40]/10 bg-[#F7F9F4]/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-none">

          {/* Search — compact */}
          <div className="relative shrink-0 w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#634F40]/40 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-[34px] w-full rounded-xl border border-[#634F40]/15 bg-white pl-8 pr-3 text-[12px] text-[#420060] outline-none focus:border-[#420060]/40 placeholder:text-[#634F40]/35"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#634F40]/35 hover:text-[#420060]">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="h-5 w-px shrink-0 bg-[#634F40]/12" />

          {/* Category pills — compact */}
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.value
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setActiveCategory(cat.value)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-[#420060] text-white shadow-[0_4px_12px_rgba(66,0,96,0.20)]"
                    : "border border-[#634F40]/12 bg-white text-[#634F40]/65 hover:border-[#420060]/25 hover:text-[#420060]"
                }`}
              >
                {cat.label}
              </button>
            )
          })}

          <div className="h-5 w-px shrink-0 bg-[#634F40]/12" />

          {/* Sort — compact */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[#634F40]/12 bg-white px-2.5 py-1.5">
            <SlidersHorizontal className="h-3 w-3 text-[#634F40]/35" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-[#420060] outline-none"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex shrink-0 overflow-hidden rounded-xl border border-[#634F40]/12 bg-white">
            {[{mode:"grid",Icon:LayoutGrid},{mode:"list",Icon:Rows3}].map(({mode,Icon}) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)}
                className={`flex h-[34px] w-8 items-center justify-center transition ${viewMode===mode ? "bg-[#420060] text-white" : "text-[#634F40]/55 hover:text-[#420060]"}`}
              >
                <Icon className="h-3 w-3" />
              </button>
            ))}
          </div>

          {hasFilters && (
            <button type="button" onClick={onReset}
              className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}

          <span className="ml-auto shrink-0 text-[11px] text-[#634F40]/45">
            {total} item{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT CARD — clean, brand-consistent
// ─────────────────────────────────────────────────────────────────────────────
function StoreProductCard({ product }) {
  const { addToCart } = useCart()
  const [added, setAdded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const imgUrl = resolveImg(product)
  const price = Number(product?.price || 0)
  const cat = product?.category || "Digital"

  function handleAdd(e) {
    e.preventDefault(); e.stopPropagation()
    addToCart(product, 1)
    setAdded(true)
    setTimeout(() => setAdded(false), 1400)
  }

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_4px_16px_rgba(66,0,96,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(66,0,96,0.10)]"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <Link to={`/store/${product.slug}`} className="block relative overflow-hidden bg-[#ede4ef]" style={{ aspectRatio: "4/3" }}>
        {imgUrl ? (
          <img src={imgUrl} alt={product.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-[#420060]/30">
            <Package className="h-10 w-10" />
          </div>
        )}
        {/* Category badge */}
        <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#420060] backdrop-blur-sm">
          {cat}
        </span>
        {product.isFeatured && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-[#420060] px-2.5 py-1 text-[10px] font-bold text-white">
            <Star className="h-3 w-3 fill-current" /> Featured
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1 text-[#FFCCAF]">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-current" />
          ))}
          <span className="ml-1 text-[11px] text-[#634F40]/50">(5.0)</span>
        </div>

        <Link to={`/store/${product.slug}`} className="mt-1.5 block">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-5 text-[#420060] transition hover:text-[#2d003f]">
            {product.title}
          </h3>
        </Link>

        <p className="mt-1.5 line-clamp-2 flex-1 text-[13px] leading-5 text-[#634F40]/65">
          {product.shortDescription || product.description}
        </p>

        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#634F40]/45">
          <Download className="h-3.5 w-3.5 text-[#420060]" /> Instant access
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[#634F40]/8 pt-3">
          <span className="text-[18px] font-bold text-[#420060]">
            ${price.toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            <Link to={`/store/${product.slug}`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#634F40]/12 text-[#634F40]/60 transition hover:border-[#420060]/25 hover:text-[#420060]"
            >
              <Eye className="h-3.5 w-3.5" />
            </Link>
            <button type="button" onClick={handleAdd}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white transition ${
                added ? "bg-[#2FA36B]" : "bg-[#420060] hover:bg-[#2d003f]"
              }`}
            >
              {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              {added ? "Added" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST ITEM
// ─────────────────────────────────────────────────────────────────────────────
function StoreListItem({ product }) {
  const { addToCart } = useCart()
  const [added, setAdded] = useState(false)
  const imgUrl = resolveImg(product)
  const price = Number(product?.price || 0)

  return (
    <div className="flex overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_4px_16px_rgba(66,0,96,0.04)] transition hover:shadow-[0_12px_32px_rgba(66,0,96,0.08)]">
      <div className="h-auto w-[160px] shrink-0 overflow-hidden bg-[#ede4ef] sm:w-[200px]">
        {imgUrl ? (
          <img src={imgUrl} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[#420060]/30">
            <Package className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <span className="rounded-lg bg-[#ede4ef] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#420060]">
            {product.category || "Digital"}
          </span>
          <Link to={`/store/${product.slug}`}>
            <h3 className="mt-1.5 text-[16px] font-bold text-[#420060] transition hover:text-[#2d003f]">{product.title}</h3>
          </Link>
          <p className="mt-1 text-[13px] leading-5 text-[#634F40]/65 line-clamp-2">
            {product.shortDescription || product.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[20px] font-bold text-[#420060]">${price.toFixed(2)}</span>
          <div className="flex items-center gap-2">
            <Link to={`/store/${product.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#420060]/20 px-4 py-2 text-[12px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]"
            >
              <Eye className="h-3.5 w-3.5" /> View
            </Link>
            <button type="button" onClick={() => { addToCart(product,1); setAdded(true); setTimeout(()=>setAdded(false),1400) }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition ${added?"bg-[#2FA36B]":"bg-[#420060] hover:bg-[#2d003f]"}`}
            >
              {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              {added ? "Added" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
        <Search className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-[18px] font-bold text-[#420060]">No products found</h3>
      <p className="mt-2 max-w-sm text-[14px] text-[#634F40]/60">Try a different search term or select another category.</p>
      {hasFilters && (
        <button type="button" onClick={onReset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#420060]/20 px-5 py-3 text-[13px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]"
        >
          <X className="h-4 w-4" /> Reset Filters
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STORE PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 12 // 3 rows × 4 cols — show pagination after 2 rows (8 items)

function StorePagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 pt-10">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/12 bg-white text-[#420060] transition hover:bg-[#ede4ef] disabled:opacity-40"
      >
        ‹
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-semibold transition ${
            p === page
              ? "bg-[#420060] text-white shadow-[0_4px_12px_rgba(66,0,96,0.22)]"
              : "border border-[#634F40]/12 bg-white text-[#420060] hover:bg-[#ede4ef]"
          }`}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/12 bg-white text-[#420060] transition hover:bg-[#ede4ef] disabled:opacity-40"
      >
        ›
      </button>
    </div>
  )
}

export default function Store() {
  const [products, setProducts]         = useState([])
  const [activeCategory, setCategory]   = useState("")
  const [search, setSearch]             = useState("")
  const [sort, setSort]                 = useState("price-low")
  const [viewMode, setViewMode]         = useState("grid")
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState("")
  const [page, setPage]                 = useState(1)

  // Reset page when category changes
  useEffect(() => { setPage(1) }, [activeCategory, search, sort])

  useEffect(() => {
    async function load() {
      setLoading(true); setError("")
      try {
        const data = await fetchProducts(activeCategory)
        setProducts(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err.message || "Failed to load products.")
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
      case "price-low":  r.sort((a,b) => Number(a.price)-Number(b.price)); break
      case "price-high": r.sort((a,b) => Number(b.price)-Number(a.price)); break
      case "name-asc":   r.sort((a,b) => a.title.localeCompare(b.title)); break
      case "newest":     r.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)); break
    }
    return r
  }, [products, search, sort])

  const hasFilters = activeCategory !== "" || search.trim() || sort !== "price-low"
  const resetFilters = () => { setCategory(""); setSearch(""); setSort("price-low"); setPage(1) }

  // Reset to page 1 on filter change
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedFiltered = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  if (loading) {
    return (
      <>
        <div className="h-[280px] animate-pulse bg-[#420060]/20" />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 h-12 animate-pulse rounded-xl bg-white" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className="h-[340px] animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="bg-[#F7F9F4]">
      <StoreHero total={products.length} />

      <StoreToolbar
        search={search} setSearch={setSearch}
        activeCategory={activeCategory} setActiveCategory={setCategory}
        sort={sort} setSort={setSort}
        viewMode={viewMode} setViewMode={setViewMode}
        total={filtered.length}
        onReset={resetFilters}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
        )}

        {/* Section label */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">
              Store Collection
            </span>
            <h2 className="mt-2 text-[1.4rem] font-bold text-[#420060]">
              {activeCategory || "All Products"}
            </h2>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
        ) : viewMode === "list" ? (
          <div className="space-y-4">
            {paginatedFiltered.map((p) => <StoreListItem key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedFiltered.map((p) => <StoreProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
