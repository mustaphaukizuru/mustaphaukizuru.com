import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

/**
 * CompareContext · #3
 *
 * Holds the user's currently-selected products for side-by-side comparison.
 * Capped at 3 items (the page splits cleanly at 3 columns on desktop).
 *
 * Persisted in localStorage under `mu:compare` so the selection survives
 * navigation between Store / ProductDetail / the Compare page itself.
 *
 * Each entry is a flattened product snapshot:
 *   {
 *     slug, title, price, currency, coverImage, category,
 *     rating, reviewCount, downloadCount,
 *     fileType, fileSize, version,
 *     specifications,                     // raw JSON array — page renders the union of keys
 *     features                            // string[] of feature names
 *   }
 *
 * Frontend-only (per the suggestion). No backend coupling.
 */

const CompareContext = createContext(null)
const STORAGE_KEY = "mu:compare"
const MAX_ITEMS = 3

function readStorage() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

function writeStorage(items) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* quota — ignore */
  }
}

/**
 * Flatten a Product (raw API or hardcoded) into the comparison snapshot
 * shape. Returns null if the product lacks a slug.
 */
export function snapshotForCompare(product) {
  if (!product || !product.slug) return null
  const cover =
    product.coverImage ||
    product.images?.find?.((i) => i.isPrimary)?.url ||
    product.images?.[0]?.url ||
    null

  // Specifications can be JSON array of {key, value} (Product.specifications)
  // or a flat object — normalize to array
  let specs = product.specifications
  if (specs && !Array.isArray(specs) && typeof specs === "object") {
    specs = Object.entries(specs).map(([key, value]) => ({ key, value: String(value) }))
  }
  if (!Array.isArray(specs)) specs = []

  // Features: backend returns ProductFeature[] with `feature` (or `name`) field;
  // hardcoded fallbacks may use plain strings. Normalize to string[].
  const features = Array.isArray(product.features)
    ? product.features.map((f) => (typeof f === "string" ? f : (f.feature || f.name || ""))).filter(Boolean)
    : []

  return {
    slug: product.slug,
    title: product.title || "",
    price: product.price ?? null,
    currency: product.currency || "MXN",
    coverImage: cover,
    category: product.category || product.categoryRef?.name || null,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    downloadCount: product.downloadCount ?? null,
    fileType: product.fileType || null,
    fileSize: product.fileSize || null,
    version: product.version || null,
    specifications: specs,
    features,
  }
}

export function CompareProvider({ children }) {
  const [items, setItems] = useState([])

  // Hydrate from storage once on mount
  useEffect(() => {
    setItems(readStorage())
  }, [])

  // Persist on change
  useEffect(() => {
    writeStorage(items)
  }, [items])

  const has = useCallback((slug) => items.some((p) => p.slug === slug), [items])

  const add = useCallback((product) => {
    const snap = snapshotForCompare(product)
    if (!snap) return false
    setItems((prev) => {
      if (prev.some((p) => p.slug === snap.slug)) return prev
      if (prev.length >= MAX_ITEMS) return prev // capped
      return [...prev, snap]
    })
    return true
  }, [])

  const remove = useCallback((slug) => {
    setItems((prev) => prev.filter((p) => p.slug !== slug))
  }, [])

  const toggle = useCallback((product) => {
    const snap = snapshotForCompare(product)
    if (!snap) return
    setItems((prev) => {
      if (prev.some((p) => p.slug === snap.slug)) {
        return prev.filter((p) => p.slug !== snap.slug)
      }
      if (prev.length >= MAX_ITEMS) {
        // Replace the OLDEST entry — first in list — to keep UX flowing.
        return [...prev.slice(1), snap]
      }
      return [...prev, snap]
    })
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(() => ({
    items,
    count: items.length,
    isFull: items.length >= MAX_ITEMS,
    maxItems: MAX_ITEMS,
    has,
    add,
    remove,
    toggle,
    clear,
  }), [items, has, add, remove, toggle, clear])

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error("useCompare must be used inside <CompareProvider>")
  return ctx
}
