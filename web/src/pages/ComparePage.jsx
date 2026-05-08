import { useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  X, ArrowRight, Package, Star, Tag, Download, FileType,
  Sparkles, Trash2, ShoppingCart, ScaleIcon,
} from "lucide-react"

import Seo from "../components/seo/Seo"
import { useCompare } from "../context/CompareContext"
import { useCart } from "../store/CartContext"

import { useTranslation } from "react-i18next"
/**
 * ComparePage · #3
 *
 * Side-by-side comparison of up to 3 products selected via the "Compare"
 * toggle on each ProductCard. State lives in CompareContext (localStorage-
 * backed). No backend round-trip needed — snapshots are stored when the
 * user toggles compare from any product card.
 *
 * Layout:
 *   - Header strip with selected items + "Add up to N" empty slots
 *   - Comparison table (one column per product · rows for each attribute)
 *
 * Empty state nudges the user back to the store.
 */

function fmtPrice(price, currency = "MXN") {
  if (price == null) return ","
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, maximumFractionDigits: 2,
    }).format(Number(price))
  } catch {
    return `$${price}`
  }
}

function fmtBytes(bytes) {
  if (!bytes) return ","
  const KB = 1024, MB = KB * 1024
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`
  return `${bytes} B`
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
}

export default function ComparePage() {
  const { t } = useTranslation("store")
  const { items, remove, clear, maxItems } = useCompare()
  const { addToCart } = useCart()
  const navigate = useNavigate()

  // Build the union of all specification keys across the selected items
  // so each row appears once with values from each column.
  const specRows = useMemo(() => {
    const keyOrder = []
    const seen = new Set()
    for (const p of items) {
      for (const s of p.specifications || []) {
        if (!s.key) continue
        if (!seen.has(s.key)) { seen.add(s.key); keyOrder.push(s.key) }
      }
    }
    return keyOrder.map((key) => ({
      key,
      values: items.map((p) => {
        const match = (p.specifications || []).find((s) => s.key === key)
        return match?.value ?? ","
      }),
    }))
  }, [items])

  // Same for features (string[]) — show all features, mark which products include each
  const featureRows = useMemo(() => {
    const all = []
    const seen = new Set()
    for (const p of items) {
      for (const f of p.features || []) {
        if (!seen.has(f)) { seen.add(f); all.push(f) }
      }
    }
    return all.map((feature) => ({
      feature,
      includes: items.map((p) => Array.isArray(p.features) && p.features.includes(feature)),
    }))
  }, [items])

  if (items.length === 0) {
    return (
      <>
        <Seo
          title={t("compare.title")}
          description="Compare digital products side by side, pricing, file types, included features, and specifications."
        />
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center shadow-[0_4px_18px_rgba(93,63,211,0.04)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-pale text-violet">
              <ScaleIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-section font-bold text-charcoal">{t("compare.emptyTitle")}</h1>
            <p className="mx-auto mt-2 max-w-md text-meta text-charcoal-80/65">
              {t("compare.emptyBody")}</p>
            <Link
              to="/store"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-meta font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
            >
              {t("compare.browseStore")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </>
    )
  }

  function quickAdd(snapshot) {
    // Cart needs a product-shaped object; reuse the snapshot since it
    // already has slug/title/price/currency/coverImage.
    addToCart({
      id: snapshot.slug, // cart uses slug as id for products without DB id
      slug: snapshot.slug,
      title: snapshot.title,
      price: Number(snapshot.price || 0),
      currency: snapshot.currency,
      images: snapshot.coverImage ? [{ url: snapshot.coverImage, isPrimary: true }] : [],
    }, 1)
  }

  return (
    <>
      <Seo
        title={t("compare.title")}
        description="Side-by-side comparison of digital products, pricing, file types, features, and specifications."
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              Compare
            </span>
            <h1 className="mt-2 text-section font-bold tracking-tight text-violet sm:text-page">
              Side-by-side comparison
            </h1>
            <p className="mt-1 text-meta text-charcoal-80/65">
              Comparing <span className="font-mono font-semibold tabular-nums text-violet">{items.length}</span> of {maxItems} products.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/store"
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 px-4 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              {t("compare.addMoreStore")}
            </Link>
            <button
              type="button"
              onClick={() => { clear(); navigate("/store") }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-charcoal-80/15 px-4 py-2 text-micro font-semibold text-charcoal-80/75 transition hover:border-rose/40 hover:text-rose focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("compare.clearAll")}
            </button>
          </div>
        </header>

        {/* Card columns */}
        <motion.div
          {...fadeUp}
          className={`grid gap-4 ${
            items.length === 1 ? "max-w-md" :
            items.length === 2 ? "grid-cols-2 max-w-3xl" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {items.map((p) => (
            <article
              key={p.slug}
              className="relative flex flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_4px_18px_rgba(93,63,211,0.04)]"
            >
              {/* Remove */}
              <button
                type="button"
                onClick={() => remove(p.slug)}
                aria-label={`Remove ${p.title} from comparison`}
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-charcoal-80/55 shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur transition hover:bg-rose/10 hover:text-rose focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {/* Cover */}
              <Link to={`/store/${p.slug}`} className="block aspect-[4/3] overflow-hidden bg-violet-pale">
                {p.coverImage ? (
                  <img
                    src={p.coverImage}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-violet/35">
                    <Package className="h-10 w-10" aria-hidden="true" />
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col gap-3 p-4">
                {p.category && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-md bg-violet-pale px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-violet">
                    {p.category}
                  </span>
                )}
                <Link
                  to={`/store/${p.slug}`}
                  className="line-clamp-2 min-h-[2.6rem] text-meta font-bold leading-snug text-charcoal hover:text-violet"
                >
                  {p.title}
                </Link>

                <div className="flex items-center justify-between">
                  <div className="font-mono text-card font-bold tabular-nums text-violet">
                    {fmtPrice(p.price, p.currency)}
                  </div>
                  {p.rating > 0 && (
                    <div className="inline-flex items-center gap-1 font-mono text-micro tabular-nums text-charcoal-80/65">
                      <Star className="h-3 w-3 fill-terracotta text-terracotta" aria-hidden="true" />
                      {Number(p.rating).toFixed(1)}
                      {p.reviewCount > 0 && <span>({p.reviewCount})</span>}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => quickAdd(p)}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
                >
                  <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" /> {t("compare.addToCart")}
                </button>
              </div>
            </article>
          ))}

          {/* Empty placeholder slots */}
          {Array.from({ length: Math.max(0, maxItems - items.length) }).map((_, i) => (
            <Link
              key={`slot-${i}`}
              to="/store"
              className="flex aspect-[4/5] items-center justify-center rounded-2xl border-2 border-dashed border-charcoal-80/15 bg-mist text-charcoal-80/45 transition hover:border-violet/30 hover:bg-violet-pale/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
            >
              <span className="flex flex-col items-center gap-1.5 text-center">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <span className="text-micro font-semibold">{t("compare.addProduct")}</span>
              </span>
            </Link>
          ))}
        </motion.div>

        {/* Comparison table */}
        <motion.section {...fadeUp} className="mt-10 overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
          <header className="border-b border-charcoal-80/10 bg-mist px-5 py-3">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
              {t("compare.atGlance")}
            </h2>
          </header>
          <table className="w-full text-meta">
            <tbody>
              <CompareRow label="Price" Icon={Tag}>
                {items.map((p) => (
                  <td key={p.slug} className="px-4 py-3 font-mono font-bold tabular-nums text-violet">
                    {fmtPrice(p.price, p.currency)}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Rating" Icon={Star}>
                {items.map((p) => (
                  <td key={p.slug} className="px-4 py-3 font-mono tabular-nums">
                    {p.rating > 0
                      ? `${Number(p.rating).toFixed(1)} (${p.reviewCount})`
                      : <span className="text-charcoal-80/45">{t("compare.noReviews")}</span>}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Downloads" Icon={Download}>
                {items.map((p) => (
                  <td key={p.slug} className="px-4 py-3 font-mono tabular-nums">
                    {p.downloadCount != null ? Number(p.downloadCount).toLocaleString() : ","}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label={t("compare.fileType")} Icon={FileType}>
                {items.map((p) => (
                  <td key={p.slug} className="px-4 py-3 font-mono uppercase tracking-wider">
                    {p.fileType || ","}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label={t("compare.fileSize")} Icon={Download}>
                {items.map((p) => (
                  <td key={p.slug} className="px-4 py-3 font-mono tabular-nums">
                    {fmtBytes(p.fileSize)}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label="Version" Icon={Tag}>
                {items.map((p) => (
                  <td key={p.slug} className="px-4 py-3 font-mono">
                    {p.version || ","}
                  </td>
                ))}
              </CompareRow>
            </tbody>
          </table>

          {/* Specifications */}
          {specRows.length > 0 && (
            <>
              <header className="border-y border-charcoal-80/10 bg-mist px-5 py-3">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
                  Specifications
                </h2>
              </header>
              <table className="w-full text-meta">
                <tbody>
                  {specRows.map((row) => (
                    <CompareRow key={row.key} label={row.key}>
                      {row.values.map((value, i) => (
                        <td key={i} className="px-4 py-3 text-charcoal">
                          {value}
                        </td>
                      ))}
                    </CompareRow>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Features (checkmark grid) */}
          {featureRows.length > 0 && (
            <>
              <header className="border-y border-charcoal-80/10 bg-mist px-5 py-3">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
                  Features
                </h2>
              </header>
              <table className="w-full text-meta">
                <tbody>
                  {featureRows.map((row) => (
                    <CompareRow key={row.feature} label={row.feature}>
                      {row.includes.map((included, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          {included
                            ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-mint/15 text-mint">✓</span>
                            : <span className="font-mono text-charcoal-80/35">,</span>}
                        </td>
                      ))}
                    </CompareRow>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </motion.section>
      </div>
    </>
  )
}

function CompareRow({ label, Icon, children }) {
  return (
    <tr className="border-t border-charcoal-80/10 first:border-t-0">
      <th
        scope="row"
        className="w-44 bg-mist/40 px-4 py-3 text-left align-top font-mono text-[11px] font-semibold uppercase tracking-wider text-charcoal-80/65"
      >
        <span className="inline-flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
          {label}
        </span>
      </th>
      {children}
    </tr>
  )
}
