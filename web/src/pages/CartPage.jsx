import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Minus, Plus, Trash2, ArrowRight, ShoppingCart,
  Package, Shield, Zap, Tag, X, ChevronRight,
  Check, ArrowLeft, ShoppingBag,
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"

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
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "backOut" }}
        className="relative"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
          <ShoppingBag className="h-12 w-12" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#F7F9F4] bg-[#420060] text-[11px] font-bold text-white">
          0
        </div>
      </motion.div>

      <h2 className="mt-6 text-[1.5rem] font-bold text-[#420060]">Your cart is empty</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-6 text-[#634F40]/60">
        Browse the store and add digital products or consulting packages to get started.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/store"
          className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]"
        >
          <ShoppingCart className="h-4 w-4" /> Explore Store
        </Link>
        <Link
          to="/services"
          className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/20 px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef] hover:-translate-y-0.5"
        >
          View Services
        </Link>
      </div>

      {/* Category quick links */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#634F40]/40">Browse by category</p>
        <div className="flex flex-wrap justify-center gap-2">
          {STORE_CATEGORIES.slice(1).map((cat) => (
            <Link
              key={cat}
              to={`/store?category=${encodeURIComponent(cat)}`}
              className="rounded-xl border border-[#634F40]/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-[#634F40]/70 transition hover:border-[#420060]/25 hover:text-[#420060]"
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
// Single cart item row
// ─────────────────────────────────────────────────────────────────────────────
function CartItem({ item, onUpdateQty, onRemove }) {
  const imgUrl = item.imageUrl
    ? (item.imageUrl.startsWith("http") ? item.imageUrl : `${API_BASE_URL}${item.imageUrl}`)
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      className="group overflow-hidden rounded-xl border border-[#634F40]/10 bg-white p-3 shadow-[0_2px_10px_rgba(66,0,96,0.04)] sm:p-5"
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Image */}
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-[#ede4ef] sm:h-[90px] sm:w-[90px]">
          {imgUrl ? (
            <img src={imgUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[#420060]/30">
              <Package className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-1 min-w-0 flex-col gap-1.5 sm:gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-lg bg-[#ede4ef] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#420060] sm:text-[10px]">
                {item.category || "Digital"}
              </span>
              <h3 className="mt-1 text-[13px] font-bold leading-tight text-[#420060] sm:text-[15px] sm:truncate">{item.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-transparent text-[#634F40]/30 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
              aria-label="Remove item"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            {/* Qty controls */}
            <div className="flex items-center overflow-hidden rounded-xl border border-[#634F40]/12 bg-[#fafafa]">
              <button
                type="button"
                onClick={() => onUpdateQty(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="flex h-8 w-8 items-center justify-center text-[#420060] transition hover:bg-[#ede4ef] disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[28px] text-center text-[13px] font-bold text-[#420060]">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center text-[#420060] transition hover:bg-[#ede4ef]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Price */}
            <div className="text-right">
              <div className="text-[15px] font-bold text-[#420060] sm:text-[17px]">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
              {item.quantity > 1 && (
                <div className="text-[11px] text-[#634F40]/45">
                  ${item.price.toFixed(2)} each
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order summary sidebar
// ─────────────────────────────────────────────────────────────────────────────
function OrderSummary({ items, subtotal, isAuthenticated }) {
  const navigate = useNavigate()
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="rounded-xl border border-[#634F40]/10 bg-white shadow-[0_8px_24px_rgba(66,0,96,0.06)] lg:sticky lg:top-24">
      <div className="border-b border-[#634F40]/10 px-6 py-5">
        <h2 className="text-[17px] font-bold text-[#420060]">Order Summary</h2>
        <p className="mt-1 text-[12px] text-[#634F40]/55">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="px-6 py-5">
        {/* Line items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-[#634F40]/70">
                {item.title}
                {item.quantity > 1 && (
                  <span className="ml-1.5 text-[#634F40]/45">×{item.quantity}</span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-[#420060]">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-5 border-t border-[#634F40]/10" />

        {/* Subtotal / fee / total */}
        <div className="space-y-3 text-[14px]">
          <div className="flex justify-between text-[#634F40]/65">
            <span>Subtotal</span>
            <span className="font-semibold text-[#420060]">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[#634F40]/65">
            <span>Service fee</span>
            <span className="font-semibold text-[#2FA36B]">Free</span>
          </div>
          <div className="flex justify-between border-t border-[#634F40]/10 pt-3">
            <span className="text-[16px] font-bold text-[#420060]">Total</span>
            <span className="text-[20px] font-bold text-[#420060]">${subtotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Checkout button */}
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              navigate("/login", { state: { from: "/checkout" } })
            } else {
              navigate("/checkout")
            }
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#420060] py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]"
        >
          {isAuthenticated ? (
            <>Proceed to Checkout <ArrowRight className="h-4 w-4" /></>
          ) : (
            <>Sign In to Checkout <ArrowRight className="h-4 w-4" /></>
          )}
        </button>

        <Link
          to="/store"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#634F40]/12 py-3 text-[13px] font-medium text-[#634F40]/65 transition hover:border-[#420060]/20 hover:text-[#420060]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Continue Shopping
        </Link>

        {/* Trust badges */}
        <div className="mt-5 space-y-2.5 border-t border-[#634F40]/10 pt-5">
          {[
            { icon: Shield, text: "SSL encrypted secure checkout" },
            { icon: Zap,    text: "Instant digital delivery" },
            { icon: Check,  text: "Download from your dashboard" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-[11px] text-[#634F40]/50">
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#420060]" />
              {text}
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
  const { cartItems, updateQuantity, removeFromCart, clearCart, subtotal } = useCart()
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-[60vh] bg-[#F7F9F4]">
      <Container className="py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <nav className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-[#634F40]/50">
              <Link to="/" className="hover:text-[#420060]">Home</Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <Link to="/store" className="hover:text-[#420060]">Store</Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-[#420060]">Cart</span>
            </nav>

            <h1 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2rem] lg:text-[2.2rem]">
              Shopping Cart
            </h1>

            {cartItems.length > 0 && (
              <p className="mt-1 text-[14px] text-[#634F40]/60">
                {cartItems.reduce((s, i) => s + i.quantity, 0)} item
                {cartItems.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="inline-flex w-fit items-center gap-1.5 self-start text-[13px] font-medium text-[#634F40]/60 transition hover:text-red-500 sm:self-auto"
            >
              <Trash2 className="h-4 w-4" />
              Clear cart
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
                <div className="mt-2 flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-white p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Tag className="h-4 w-4 shrink-0 text-[#634F40]/35" />
                    <input
                      type="text"
                      placeholder="Discount code"
                      className="w-full min-w-0 bg-transparent text-[13px] text-[#420060] outline-none placeholder:text-[#634F40]/35"
                    />
                  </div>

                  <button
                    type="button"
                    className="w-full shrink-0 rounded-xl border border-[#420060]/20 px-3.5 py-2 text-[12px] font-semibold text-[#420060] transition hover:bg-[#ede4ef] sm:w-auto"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
              <OrderSummary
                items={cartItems}
                subtotal={subtotal}
                isAuthenticated={isAuthenticated}
              />
            </div>
          </div>
        )}
      </Container>
    </div>
  )
}
