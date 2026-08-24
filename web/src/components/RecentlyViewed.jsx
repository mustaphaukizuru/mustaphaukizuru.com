/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Clock, ArrowRight } from "lucide-react"
import { m } from "framer-motion"

import { useTranslation } from "react-i18next"
/**
 * RecentlyViewed · #4
 *
 * Locally-tracked "recently viewed products" strip. Reads from localStorage
 * under the key `mu:recently-viewed`, which holds an array of:
 *
 *   [{ slug, title, price, currency, coverImage, viewedAt }]
 *
 * The companion `useTrackProductView()` hook (exported below) is mounted
 * inside ProductDetail to record each visit. The strip itself filters
 * out the currently-viewed product so users don't see the page they're
 * already on. Renders nothing when there's only one item (the current
 * page) or none.
 *
 * No backend involvement — fully client-side. M11 (recently viewed +
 * recommendations) was deferred at the schema level; this is the
 * lightweight 50-line replacement promised in the suggestions list.
 */

const STORAGE_KEY = "mu:recently-viewed"
const MAX_ITEMS = 12

function readStorage() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStorage(items) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* quota exceeded — silently ignore */
  }
}

/**
 * Mount inside ProductDetail. Records a visit on mount and keeps the
 * list deduplicated + capped at MAX_ITEMS, with most-recent first.
 */
export function useTrackProductView(product) {
  useEffect(() => {
    if (!product || !product.slug || !product.title) return
    const entry = {
      slug: product.slug,
      title: product.title,
      price: product.price ?? null,
      currency: product.currency || "MXN",
      coverImage:
        product.coverImage ||
        product.images?.find((i) => i.isPrimary)?.url ||
        product.images?.[0]?.url ||
        null,
      viewedAt: Date.now(),
    }
    const existing = readStorage().filter((p) => p.slug !== entry.slug)
    const next = [entry, ...existing].slice(0, MAX_ITEMS)
    writeStorage(next)
  }, [product?.slug])
}

/**
 * The visible strip. Pass `excludeSlug` to hide the current product.
 */
export default function RecentlyViewed({ excludeSlug, title = "Recently viewed" }) {
  const { t } = useTranslation("common")
  const [items, setItems] = useState([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setItems(readStorage())
  }, [])

  const filtered = items.filter((p) => p.slug && p.slug !== excludeSlug)
  if (filtered.length === 0) return null

  function fmtPrice(price, currency) {
    if (price == null) return ""
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "MXN",
        maximumFractionDigits: 0,
      }).format(Number(price))
    } catch {
      return `$${price}`
    }
  }

  function clear() {
    writeStorage([])
    setItems([])
  }

  return (
    <section
      aria-labelledby="recently-viewed-heading"
      className="border-t border-charcoal-80/10 bg-mist py-12"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet" aria-hidden="true" />
            <h2
              id="recently-viewed-heading"
              className="text-meta font-bold uppercase tracking-[0.18em] text-violet"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-micro font-semibold text-charcoal-80/55 hover:text-violet focus-visible:outline-none focus-visible:underline"
          >
            {t("components.clearHistory")}
          </button>
        </div>

        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 sm:gap-5">
          {filtered.map((p) => (
            <m.div
              key={p.slug}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="w-[180px] shrink-0 sm:w-[200px]"
            >
              <Link
                to={`/store/${p.slug}`}
                className="group block overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_14px_rgb(var(--color-violet-rgb)/0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_28px_rgb(var(--color-violet-rgb)/0.10)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                <div className="aspect-square w-full overflow-hidden bg-violet-pale">
                  {p.coverImage ? (
                    <img
                      src={p.coverImage}
                      alt={p.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-violet/30">
                      <ArrowRight className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-[2.4rem] text-micro font-semibold leading-snug text-charcoal">
                    {p.title}
                  </h3>
                  {p.price != null && (
                    <p className="mt-1.5 font-mono text-meta font-bold tabular-nums text-violet">
                      {fmtPrice(p.price, p.currency)}
                    </p>
                  )}
                </div>
              </Link>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  )
}
