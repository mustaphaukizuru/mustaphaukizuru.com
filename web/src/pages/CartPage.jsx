import { useState } from "react"
import { useTranslation } from "react-i18next"
import { LocalizedLink as Link } from "../components/LocalizedLink"
import useNavigate from "../hooks/useLocalizedNavigate"
import { m, AnimatePresence } from "framer-motion"
import {
  Minus, Plus, Trash2, ArrowRight, ShoppingCart,
  Package, Shield, Zap, Tag, X, ChevronRight,
  Check, ArrowLeft, ShoppingBag,
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"
import { formatPrice } from "../lib/format"
import { includedTax, TAX_RATE_PCT } from "../lib/tax"

/* ──────────────────────────────────────────────────────────────────────────
 *  CartPage · F08.A · Batch 5
 *
 *  Refinements applied:
 *    - Line items now use Trash2 (Lucide) with subtle shake animation on
 *      click instead of a generic X icon.
 *    - All prices render in JetBrains Mono with tabular-nums for column-
 *      stable digit alignment.
 *    - Order summary "Total" row uses larger JetBrains Mono bold per F08.A
 *      spec.
 *    - Coupon success state copy refined to "Discount applied: -$X.XX"
 *      (was "applied — saving $X.XX").
 *    - Empty state preserved verbatim ("Your cart is empty" + ShoppingBag).
 *    - Primary checkout CTA promoted to Innovation Gradient (the ONE CTA
 *      on this page per brand v3.0 rule).
 *    - Bug fix: replaced mojibake characters with proper minus sign.
 *
 *  Preserved verbatim:
 *    - All cart context method calls (updateQuantity, removeFromCart,
 *      clearCart, applyCoupon, removeCoupon)
 *    - All routes and navigation flow
 *    - Cart item layout structure
 *    - Trust badges
 *  ──────────────────────────────────────────────────────────────────── */

const STORE_CATEGORIES = ["All", "Templates", "IT Toolkits", "CS Resources", "STEM & Robotics", "Business Res."]

function Container({ children, className = "" }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty cart state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyCart() {
  // I18N · the previous build called t() here without a useTranslation
  // hook in scope — would have ReferenceError'd on render. ErrorBoundary
  // hid the crash; now the hook is mounted properly.
  const { t } = useTranslation("cart")
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <m.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "backOut" }}
        className="relative"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-violet-pale text-violet">
          <ShoppingBag className="h-12 w-12" aria-hidden="true" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-mist bg-violet font-mono text-micro font-bold tabular-nums text-white">
          0
        </div>
      </m.div>

      <h2 className="mt-6 text-section font-bold text-violet">{t("empty.title")}</h2>
      <p className="mx-auto mt-2 max-w-sm text-meta leading-6 text-charcoal-80/65">
        {t("empty.subtitleLong")}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/store"
          className="inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-meta font-semibold text-white shadow-[var(--shadow-lift-3)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" /> {t("empty.browseStore")}
        </Link>
        <Link
          to="/services"
          className="inline-flex items-center gap-2 rounded-xl border border-violet/20 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          {t("empty.viewServices")}
        </Link>
      </div>

      {/* Category quick links */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-micro font-semibold uppercase tracking-[0.18em] text-charcoal-80/40">{t("empty.browseByCategory")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {STORE_CATEGORIES.slice(1).map((cat) => (
            <Link
              key={cat}
              to={`/store?category=${encodeURIComponent(cat)}`}
              className="rounded-xl border border-charcoal-80/12 bg-white px-3.5 py-2 text-micro font-semibold text-charcoal-80/70 transition hover:border-violet/25 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              {cat}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single cart item row — F08.A · Trash2 with shake animation on click
// ─────────────────────────────────────────────────────────────────────────────
function CartItem({ item, onUpdateQty, onRemove }) {
  const { t } = useTranslation("cart")
  const imgUrl = item.imageUrl
    ? (item.imageUrl.startsWith("http") ? item.imageUrl : `${API_BASE_URL}${item.imageUrl}`)
    : null
  // Local broken-image flag — flips to true on <img> onError so we can
  // gracefully fall back to the Package icon instead of showing a
  // browser-default broken-image glyph.
  const [imgBroken, setImgBroken] = useState(false)

  // Track shake state — fires once when delete is clicked, then unmounts
  // via AnimatePresence's exit animation
  const [shaking, setShaking] = useState(false)

  function handleRemove() {
    setShaking(true)
    // Allow the shake to play before triggering the remove (which kicks off
    // the exit animation). 220 ms = duration of the keyframe sequence below.
    window.setTimeout(() => onRemove(item.id), 220)
  }

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="group overflow-hidden rounded-xl border border-charcoal-80/10 bg-white p-3 shadow-[var(--shadow-e2)] sm:p-5"
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Image */}
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-violet-pale sm:h-[90px] sm:w-[90px]">
          {imgUrl && !imgBroken ? (
            <img
              src={imgUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-violet/30">
              <Package className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-1 min-w-0 flex-col gap-1.5 sm:gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-lg bg-violet-pale px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-violet">
                {item.category || t("item.categoryFallback")}
              </span>
              <h3 className="mt-1 text-meta font-bold leading-tight text-violet sm:text-body sm:truncate">{item.title}</h3>
            </div>
            {/* F08.A · Trash2 with shake animation on click */}
            <m.button
              type="button"
              onClick={handleRemove}
              animate={shaking ? { x: [0, -3, 3, -3, 3, -2, 2, 0], rotate: [0, -4, 4, -4, 4, 0] } : { x: 0, rotate: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-transparent text-charcoal-80/35 transition hover:border-rose/20 hover:bg-rose/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30/40 focus-visible:ring-offset-2"
              aria-label={t("actions.removeItem")}
              title={t("actions.removeFromCart")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </m.button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            {/* Qty controls */}
            <div className="flex items-center overflow-hidden rounded-xl border border-charcoal-80/12 bg-mist">
              <button
                type="button"
                onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
                aria-label={t("actions.decreaseQty")}
                className="flex h-8 w-8 items-center justify-center text-violet transition hover:bg-violet-pale disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="min-w-[28px] text-center font-mono text-meta font-bold tabular-nums text-violet">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                aria-label={t("actions.increaseQty")}
                className="flex h-8 w-8 items-center justify-center text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Price · F08.A · JetBrains Mono · tabular-nums */}
            <div className="text-right">
              <div className="font-mono text-body font-bold tabular-nums text-violet sm:text-card">
                {formatPrice(item.price * item.quantity)}
              </div>
              {item.quantity > 1 && (
                <div className="font-mono text-micro tabular-nums text-charcoal-80/65">
                  {formatPrice(item.price)} {t("item.each")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </m.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order summary sidebar — F08.A · all numerics in JetBrains Mono
// ─────────────────────────────────────────────────────────────────────────────
function OrderSummary({ items, subtotal, discount = 0, total, appliedCoupon, isAuthenticated }) {
  // I18N · same hook-shadow bug as EmptyCart — t() was being called here
  // without the hook in scope. Mounted now.
  const { t } = useTranslation("cart")
  const navigate = useNavigate()
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e4)] lg:sticky lg:top-24">
      <div className="border-b border-charcoal-80/10 px-6 py-5">
        <h2 className="text-card font-bold text-violet">{t("summary.title")}</h2>
        <p className="mt-1 text-micro text-charcoal-80/65">
          {t("itemCount", { count: itemCount })}
        </p>
      </div>

      <div className="px-6 py-5">
        {/* Line items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-meta">
              <span className="min-w-0 flex-1 truncate text-charcoal-80/70">
                {item.title}
                {item.quantity > 1 && (
                  <span className="ml-1.5 font-mono tabular-nums text-charcoal-80/65">×{item.quantity}</span>
                )}
              </span>
              <span className="shrink-0 font-mono font-semibold tabular-nums text-violet">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="my-5 border-t border-charcoal-80/10" />

        {/* Subtotal · discount · fee · total, F08.A spec */}
        <div className="space-y-3 text-meta">
          <div className="flex justify-between text-charcoal-80/65">
            <span>{t("summary.subtotal", "Subtotal")}</span>
            <span className="font-mono font-semibold tabular-nums text-violet">{formatPrice(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-mint-700">
              <span>
                {t("summary.discount")}
                {appliedCoupon?.code && (
                  <span className="ml-1 text-micro text-mint-700">({appliedCoupon.code})</span>
                )}
              </span>
              <span className="font-mono font-semibold tabular-nums">−{formatPrice(discount)}</span>
            </div>
          )}

          <div className="flex justify-between text-charcoal-80/65">
            <span>{t("summary.taxIncluded", { rate: TAX_RATE_PCT })}</span>
            <span className="font-mono tabular-nums">{formatPrice(includedTax(total ?? subtotal))}</span>
          </div>

          {/* Total, F08.A · large JetBrains Mono bold */}
          <div className="flex items-baseline justify-between border-t border-charcoal-80/10 pt-3">
            <span className="text-body font-bold text-violet">{t("summary.total")}</span>
            <span className="font-mono text-section font-extrabold tabular-nums text-violet">
              {formatPrice(total ?? subtotal)}
            </span>
          </div>
        </div>

        {/* F08.A · Checkout button with Innovation Gradient (the ONE CTA) */}
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              navigate("/login", { state: { from: "/checkout" } })
            } else {
              navigate("/checkout")
            }
          }}
          // Brand v3 §06 Sacred Rule — the Innovation Gradient (bg-grad-innovation)
          // owns conversion CTAs. Replaced the previous hand-rolled 3-stop
          // gradient (which included an off-palette Tailwind violet-600) with the canonical
          // 2-stop utility class so the cart's primary action matches the
          // checkout button visually and stays in the sanctioned palette.
          className="group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-grad-innovation py-4 text-body font-semibold text-white shadow-[0_12px_32px_rgb(var(--color-violet-rgb)/0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgb(var(--color-violet-rgb)/0.42)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          {isAuthenticated ? (
            <>{t("actions.checkout")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></>
          ) : (
            <>{t("actions.signInToCheckout")} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></>
          )}
        </button>

        <Link
          to="/store"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-charcoal-80/12 py-3 text-meta font-medium text-charcoal-80/65 transition hover:border-violet/20 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {t("actions.continueShopping")}
        </Link>

        {/* Trust badges */}
        <div className="mt-5 space-y-2.5 border-t border-charcoal-80/10 pt-5">
          {[
            { icon: Shield, key: "ssl" },
            { icon: Zap,    key: "instant" },
            { icon: Check,  key: "dashboard" },
          ].map(({ icon: Icon, key }) => (
            <div key={key} className="flex items-center gap-2.5 text-micro text-charcoal-80/65">
              <Icon className="h-3.5 w-3.5 shrink-0 text-violet" aria-hidden="true" />
              {t(`trust.${key}`)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CartPage
// ─────────────────────────────────────────────────────────────────────────────
export default function CartPage() {
  const { t } = useTranslation("cart")
  const {
    cartItems, updateQuantity, removeFromCart, clearCart, subtotal,
    discount, total, appliedCoupon, applyCoupon, removeCoupon, loading: cartLoading,
  } = useCart()
  const { isAuthenticated } = useAuth()

  const [couponCode, setCouponCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const [couponBusy, setCouponBusy] = useState(false)

  async function handleApplyCoupon(e) {
    e?.preventDefault?.()
    setCouponError("")
    if (!isAuthenticated) {
      setCouponError(t("summary.couponSignIn"))
      return
    }
    const code = (couponCode || "").trim().toUpperCase()
    if (!code) { setCouponError(t("summary.couponEnter")); return }
    setCouponBusy(true)
    try {
      await applyCoupon(code)
      setCouponCode("")
    } catch (err) {
      setCouponError(err?.message || t("summary.couponInvalid"))
    } finally {
      setCouponBusy(false)
    }
  }

  async function handleRemoveCoupon() {
    setCouponError("")
    try { await removeCoupon() } catch { /* context surfaces error */ }
  }

  return (
    <div className="min-h-[60vh] bg-mist">
      <Container className="py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <nav className="mb-2 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/65" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-violet">{t("header.breadcrumb.home")}</Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <Link to="/store" className="hover:text-violet">{t("header.breadcrumb.store")}</Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="font-medium text-violet">{t("header.breadcrumb.cart")}</span>
            </nav>

            <h1 className="text-section font-bold tracking-tight text-violet sm:text-page lg:text-page">
              {t("header.title")}
            </h1>

            {cartItems.length > 0 && (
              <p className="mt-1 text-meta text-charcoal-80/65">
                {t("itemCount", { count: cartItems.reduce((s, i) => s + i.quantity, 0) })}
              </p>
            )}
          </div>

          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="inline-flex w-fit items-center gap-1.5 self-start rounded-md text-meta font-medium text-charcoal-80/65 transition hover:text-red-500 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30/40 focus-visible:ring-offset-2 sm:self-auto"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("header.clearCart")}
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Cart items */}
            <div className="min-w-0">
              <div className="flex flex-col gap-3">
                <AnimatePresence mode="popLayout">
                  {cartItems.map((item) => (
                    <CartItem
                      key={item.id}
                      item={item}
                      onUpdateQty={updateQuantity}
                      onRemove={removeFromCart}
                    />
                  ))}
                </AnimatePresence>

                {/* Promo code */}
                {appliedCoupon ? (
                  /* F08.A · "Discount applied: -$X.XX" */
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-mint/30 bg-mint/8 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className="text-meta font-semibold text-mint-700">
                        {t("summary.discountApplied")}{" "}
                        <span className="font-mono tabular-nums">−{formatPrice(discount)}</span>
                      </span>
                      {appliedCoupon.code && (
                        <code className="ml-1 rounded-md bg-white/60 px-2 py-0.5 font-mono text-micro font-semibold text-mint-700">
                          {appliedCoupon.code}
                        </code>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      disabled={cartLoading}
                      className="shrink-0 rounded-lg p-1.5 text-mint transition hover:bg-mint/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint/40 focus-visible:ring-offset-2"
                      aria-label={t("summary.couponRemove")}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleApplyCoupon}
                    className="mt-2 flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Tag className="h-4 w-4 shrink-0 text-charcoal-80/35" aria-hidden="true" />
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value); setCouponError("") }}
                        placeholder={isAuthenticated ? t("summary.couponPlaceholderAuth") : t("summary.couponPlaceholderGuest")}
                        disabled={!isAuthenticated || couponBusy}
                        autoComplete="off"
                        aria-label={t("summary.couponLabel")}
                        className="w-full min-w-0 bg-transparent text-meta text-violet outline-none placeholder:text-charcoal-80/35 disabled:opacity-60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!isAuthenticated || couponBusy}
                      className="w-full shrink-0 rounded-xl border border-violet/20 px-4 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 sm:w-auto"
                    >
                      {couponBusy ? t("summary.applying") : t("summary.applyCoupon")}
                    </button>
                  </form>
                )}

                {couponError && (
                  <p className="px-1 text-micro text-rose-700" role="alert">{couponError}</p>
                )}
              </div>
            </div>

            <OrderSummary
              items={cartItems}
              subtotal={subtotal}
              discount={discount}
              total={total}
              appliedCoupon={appliedCoupon}
              isAuthenticated={isAuthenticated}
            />
          </div>
        )}
      </Container>
    </div>
  );
}
