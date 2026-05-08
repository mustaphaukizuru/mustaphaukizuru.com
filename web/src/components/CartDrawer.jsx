import { useEffect } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ShoppingCart, Trash2, Plus, Minus,
  ArrowRight, Package, ShoppingBag,
} from "lucide-react"

import { useCart } from "../store/CartContext"
import { useTranslation } from "react-i18next"

/**
 * CartDrawer · #2
 *
 * Slide-in right-side mini-cart that opens automatically after addToCart()
 * (set in CartContext) and is also reachable from the header cart icon.
 * Replaces the static badge-only feedback with a modern, immediate preview
 * of cart contents + line edits + checkout CTA.
 *
 * Accessibility:
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - Escape closes
 *   - Backdrop click closes
 *   - Body scroll locked while open
 *   - Focus management: drawer is focusable on open
 *
 * Mounted once at the App root via App.jsx — singleton driven by context.
 */

function fmt(price, currency = "MXN") {
  if (price == null) return ""
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, maximumFractionDigits: 2,
    }).format(Number(price))
  } catch {
    return `$${Number(price).toFixed(2)}`
  }
}

export default function CartDrawer() {
  const { t } = useTranslation("common")
  const {
    cartItems, subtotal, total, discount, appliedCoupon,
    drawerOpen, closeDrawer,
    updateQuantity, removeFromCart,
  } = useCart()

  // Body scroll lock + ESC handler
  useEffect(() => {
    if (!drawerOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(e) {
      if (e.key === "Escape") closeDrawer()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = original
      window.removeEventListener("keydown", onKey)
    }
  }, [drawerOpen, closeDrawer])

  const itemCount = cartItems.reduce((s, i) => s + (i.quantity || 1), 0)

  return (
    <AnimatePresence>
      {drawerOpen && (
        <motion.div
          key="cart-drawer-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[90]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-charcoal/45 backdrop-blur-[2px]"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.18)]"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-charcoal-80/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-violet" aria-hidden="true" />
                <h2 id="cart-drawer-title" className="text-meta font-bold text-charcoal">
                  {t("cart.drawer.title")}
                </h2>
                {itemCount > 0 && (
                  <span className="rounded-full bg-violet px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white">
                    {itemCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label={t("cart.drawer.closeAria")}
                className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-mist hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            {/* Body */}
            {cartItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-pale text-violet">
                  <ShoppingBag className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-meta font-bold text-charcoal">{t("cart.drawer.emptyTitle")}</h3>
                <p className="text-micro text-charcoal-80/55">
                  {t("cart.drawer.emptyBody")}
                </p>
                <Link
                  to="/store"
                  onClick={closeDrawer}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
                >
                  {t("cart.drawer.browseStore")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-charcoal-80/10 overflow-y-auto px-3 py-2">
                {cartItems.map((item) => (
                  <li key={item.lineId || item.id} className="flex items-start gap-3 py-3">
                    {/* Thumbnail */}
                    <Link
                      to={`/store/${item.slug}`}
                      onClick={closeDrawer}
                      className="block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-violet/40">
                          <Package className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}
                    </Link>

                    {/* Body */}
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/store/${item.slug}`}
                        onClick={closeDrawer}
                        className="block line-clamp-2 text-micro font-semibold text-charcoal hover:text-violet"
                      >
                        {item.title}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-charcoal-80/55">
                        {fmt(item.price, item.currency)} each
                      </div>

                      {/* Qty + remove */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-lg border border-charcoal-80/15">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.lineId || item.id, Math.max(1, (item.quantity || 1) - 1))}
                            aria-label={`Decrease quantity of ${item.title}`}
                            className="flex h-7 w-7 items-center justify-center rounded-l-lg text-charcoal-80/65 transition hover:bg-mist hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                            disabled={(item.quantity || 1) <= 1}
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <span className="min-w-[2rem] px-1 text-center font-mono text-micro font-semibold tabular-nums text-charcoal">
                            {item.quantity || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.lineId || item.id, (item.quantity || 1) + 1)}
                            aria-label={`Increase quantity of ${item.title}`}
                            className="flex h-7 w-7 items-center justify-center rounded-r-lg text-charcoal-80/65 transition hover:bg-mist hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.lineId || item.id)}
                          aria-label={`Remove ${item.title}`}
                          className="rounded-md p-1 text-charcoal-80/40 transition hover:bg-rose/10 hover:text-rose focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-meta font-bold tabular-nums text-violet">
                        {fmt((item.price || 0) * (item.quantity || 1), item.currency)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Footer · totals + CTAs · only when items present */}
            {cartItems.length > 0 && (
              <footer className="border-t border-charcoal-80/10 bg-mist px-5 py-4">
                <div className="space-y-1 text-meta">
                  <div className="flex items-center justify-between text-charcoal-80/75">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{fmt(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between text-mint">
                      <span>
                        Discount
                        {appliedCoupon?.code && (
                          <span className="ml-1 font-mono text-micro text-mint/80">({appliedCoupon.code})</span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums">−{fmt(discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-charcoal-80/10 pt-2 text-card font-bold text-charcoal">
                    <span>Total</span>
                    <span className="font-mono tabular-nums text-violet">{fmt(total)}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    to="/checkout"
                    onClick={closeDrawer}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-meta font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.24)] transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
                  >
                    Checkout <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/cart"
                    onClick={closeDrawer}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/20 px-4 py-2.5 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                  >
                    {t("cart.drawer.viewFullCart")}
                  </Link>
                </div>
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
