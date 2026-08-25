import { Link } from "react-router-dom"
import {
  X, ShoppingCart, Trash2, Plus, Minus,
  ArrowRight, Package, ShoppingBag,
} from "lucide-react"

import { useCart } from "../store/CartContext"
import { useTranslation } from "react-i18next"
import { Drawer } from "./ui/Drawer"

/**
 * CartDrawer · #2
 *
 * Slide-in right-side mini-cart that opens automatically after addToCart()
 * (set in CartContext) and is also reachable from the header cart icon.
 * Replaces the static badge-only feedback with a modern, immediate preview
 * of cart contents + line edits + checkout CTA.
 *
 * Accessibility:
 *   - Built on the canonical <Drawer> (components/ui/Drawer): role="dialog"
 *     + aria-modal + aria-labelledby, Escape, backdrop click, focus trap +
 *     restore, ref-counted body scroll lock, reduced-motion aware slide.
 *
 * Mounted once at the App root via App.jsx — singleton driven by context.
 */

import { formatPrice } from "../lib/format"

function fmt(price, currency = "MXN") {
  if (price == null) return ""
  return formatPrice(price, currency)
}

export default function CartDrawer() {
  const { t } = useTranslation("common")
  const {
    cartItems, subtotal, total, discount, appliedCoupon,
    drawerOpen, closeDrawer,
    updateQuantity, removeFromCart,
  } = useCart()

  const itemCount = cartItems.reduce((s, i) => s + (i.quantity || 1), 0)

  return (
    <Drawer
      open={drawerOpen}
      onClose={() => closeDrawer()}
      side="right"
      size="none"
      bare
      zIndex={90}
      ariaLabelledBy="cart-drawer-title"
      backdropClassName="bg-charcoal/45 backdrop-blur-[2px]"
      className="max-w-md bg-white shadow-[-12px_0_40px_rgba(0,0,0,0.18)]"
      transition={{ enter: 0.28, exit: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
                className="cursor-pointer rounded-lg p-1.5 text-charcoal-80/65 transition hover:bg-mist hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
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
                <p className="text-micro text-charcoal-80/65">
                  {t("cart.drawer.emptyBody")}
                </p>
                <Link
                  to="/store"
                  onClick={closeDrawer}
                  className="cursor-pointer mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
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
                      className="cursor-pointer block h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title || ""}
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
                        className="cursor-pointer block line-clamp-2 text-micro font-semibold text-charcoal hover:text-violet"
                      >
                        {item.title}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-charcoal-80/65">
                        {fmt(item.price, item.currency)} each
                      </div>

                      {/* Qty + remove */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-lg border border-charcoal-80/15">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.lineId || item.id, Math.max(1, (item.quantity || 1) - 1))}
                            aria-label={`Decrease quantity of ${item.title}`}
                            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-l-lg text-charcoal-80/65 transition hover:bg-mist hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
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
                            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-r-lg text-charcoal-80/65 transition hover:bg-mist hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.lineId || item.id)}
                          aria-label={`Remove ${item.title}`}
                          className="cursor-pointer rounded-md p-1 text-charcoal-80/40 transition hover:bg-rose/10 hover:text-rose focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30"
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
                    <div className="flex items-center justify-between text-mint-700">
                      <span>
                        Discount
                        {appliedCoupon?.code && (
                          <span className="ml-1 font-mono text-micro text-mint-700">({appliedCoupon.code})</span>
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
                    className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-4 py-3 text-meta font-semibold text-white shadow-[0_8px_22px_rgb(var(--color-violet-rgb)/0.24)] transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
                  >
                    Checkout <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/cart"
                    onClick={closeDrawer}
                    className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-violet/20 px-4 py-2.5 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                  >
                    {t("cart.drawer.viewFullCart")}
                  </Link>
                </div>
              </footer>
            )}
    </Drawer>
  )
}
