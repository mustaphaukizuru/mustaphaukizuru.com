import { useEffect, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence } from "framer-motion"
import { Heart, ShoppingCart, Trash2, Package, AlertCircle, ExternalLink } from "lucide-react"
import {
  fetchWishlist,
  removeFromWishlist,
  moveWishlistItemToCart,
} from "../services/wishlistService"
import { useCart } from "../store/CartContext"
import { useToast } from "../context/ToastContext"
import { EmptyState, SectionCard, SkeletonCard } from "../components/ui/index"
import { API_BASE_URL } from "../lib/api"

/* ────────────────────────────────────────────────────────────────────────────
 * DashboardWishlistPage — /dashboard/wishlist
 *
 * Grid of saved products. Each card: image, title, price, [Move to Cart] +
 * [Remove]. Inactive products are still shown (with a disabled state) so the
 * user can see what they saved, but can only remove — not move-to-cart.
 *
 * I18N · Phase 119A — strings keyed under `dashboard.wishlist.*`. The
 * intro subtitle uses i18next plural suffix (subtitle_one / subtitle_other)
 * based on `total`. Toast messages are also keyed.
 * ──────────────────────────────────────────────────────────────────────── */

function resolveImageUrl(url = "") {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function pickCoverImage(product) {
  const imgs = Array.isArray(product?.images) ? product.images : []
  if (imgs.length === 0) return null
  const primary = imgs.find((i) => i?.isPrimary) || imgs.find((i) => i?.imageRole === "cover") || imgs[0]
  return resolveImageUrl(primary?.url)
}

function formatPrice(value, currency = "MXN") {
  const amount = Number(value || 0)
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}

export default function DashboardWishlistPage() {
  const { t } = useTranslation("dashboard")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState(null)

  const { addToCart } = useCart()
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    async function load() {
      setLoading(true); setError("")
      try {
        const data = await fetchWishlist()
        setItems(data)
      } catch (err) {
        setError(err?.toUserMessage?.() || err?.message || t("wishlist.errors.load"))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRemove(item) {
    if (busyId) return
    setBusyId(item.id)

    // Optimistic
    const prev = items
    setItems((current) => current.filter((x) => x.id !== item.id))

    try {
      await removeFromWishlist(item.id)
      showSuccess(t("wishlist.toast.removed"))
    } catch (err) {
      setItems(prev)
      showError(err?.toUserMessage?.() || err?.message || t("wishlist.errors.remove"))
    } finally {
      setBusyId(null)
    }
  }

  async function handleMoveToCart(item) {
    if (busyId || !item.product || item.product.isActive === false) return
    setBusyId(item.id)

    const prev = items
    setItems((current) => current.filter((x) => x.id !== item.id))

    try {
      const product = await moveWishlistItemToCart(item.id)
      if (product) {
        addToCart(product, 1)
        showSuccess(t("wishlist.toast.movedNamed", { title: product.title }))
      } else {
        showSuccess(t("wishlist.toast.movedGeneric"))
      }
    } catch (err) {
      setItems(prev)
      showError(err?.toUserMessage?.() || err?.message || t("wishlist.errors.moveCart"))
    } finally {
      setBusyId(null)
    }
  }

  const activeCount = useMemo(
    () => items.filter((i) => i.product?.isActive !== false).length,
    [items]
  )

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <section className="space-y-5">
        <SkeletonCard height="h-[80px]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} height="h-[320px]" />)}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-meta text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Intro */}
      <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.1em] text-violet">
              <Heart className="h-3 w-3 fill-current" /> {t("wishlist.intro.savedForLater")}
            </div>
            <h2 className="mt-3 text-subsection font-bold text-violet">{t("wishlist.intro.title")}</h2>
            <p className="mt-1 text-meta text-charcoal-80/70">
              {items.length === 0
                ? t("wishlist.intro.subtitleEmpty")
                : t("wishlist.intro.subtitle", { count: items.length, total: items.length, active: activeCount })}
            </p>
          </div>
          <Link
            to="/store"
            className="hidden items-center gap-2 rounded-xl border border-violet/15 px-3.5 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale sm:inline-flex"
          >
            {t("wishlist.intro.browseStore")} <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("wishlist.empty.title")}
          description={t("wishlist.empty.body")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {items.map((item) => {
              const p = item.product || {}
              const image = pickCoverImage(p)
              const unavailable = !item.product || p.isActive === false
              const isBusy = busyId === item.id

              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.26, ease: "easeOut" }}
                  className="flex flex-col overflow-hidden rounded-xl border border-[#E9E3DD] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:shadow-[0_16px_36px_rgba(93,63,211,0.08)]"
                >
                  <Link to={`/store/${p.slug || ""}`} className="block">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-mist">
                      {image ? (
                        <img src={image} alt={p.title || t("wishlist.card.untitled")} className="h-full w-full object-cover transition duration-500 hover:scale-[1.02]" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#7A7A7A]">
                          <Package className="h-10 w-10 opacity-30" />
                        </div>
                      )}
                      {unavailable && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="rounded-full bg-white/90 px-3 py-1 text-micro font-bold uppercase tracking-wider text-violet">
                            {t("wishlist.card.unavailable")}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <Link to={`/store/${p.slug || ""}`}>
                      <h3 className="line-clamp-2 text-meta font-semibold leading-snug text-charcoal transition-colors hover:text-violet">
                        {p.title || t("wishlist.card.untitled")}
                      </h3>
                    </Link>
                    <p className="mt-1.5 line-clamp-2 text-micro leading-5 text-charcoal-80">
                      {p.shortDescription || t("wishlist.card.noDescription")}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#F0EBF4] pt-3">
                      <p className="text-body font-bold tracking-tight text-violet">
                        {formatPrice(p.price, p.currency || "MXN")}
                      </p>
                      <span className="text-micro font-medium text-charcoal-80/50">
                        {t("wishlist.card.savedOn", { date: new Date(item.addedAt).toLocaleDateString() })}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveToCart(item)}
                        disabled={isBusy || unavailable}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet px-3 py-2.5 text-micro font-semibold text-white transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        {isBusy ? t("wishlist.card.busy") : t("wishlist.card.moveToCart")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(item)}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center rounded-lg border border-charcoal-80/15 px-3 py-2.5 text-micro font-medium text-charcoal-80 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label={t("wishlist.card.remove")}
                        title={t("wishlist.card.remove")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}
