import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { API_BASE_URL } from "../lib/api"
import { useAuth } from "../context/AuthContext"
import {
  fetchCart as apiFetchCart,
  addCartItem as apiAddCartItem,
  updateCartItem as apiUpdateCartItem,
  removeCartItem as apiRemoveCartItem,
  clearServerCart as apiClearServerCart,
  mergeGuestCart as apiMergeGuestCart,
  applyCartCoupon as apiApplyCoupon,
  removeCartCoupon as apiRemoveCoupon,
} from "../services/cartService"

const CartContext = createContext(null)
const STORAGE_KEY = "ukizuru-cart"

/* ─────────────────────────────────────────────────────────────
 *  Image URL resolution
 * ───────────────────────────────────────────────────────────── */
function resolveImageUrl(url = "") {
  if (!url) return ""
  if (url.startsWith("http")) return url
  if (API_BASE_URL) return `${API_BASE_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`
  return url
}

function getPrimaryImage(product) {
  if (!Array.isArray(product?.images) || product.images.length === 0) {
    return product?.imageUrl || ""
  }
  const primary =
    product.images.find((image) => image?.isPrimary) ||
    product.images.find((image) => image?.imageRole === "cover") ||
    product.images[0]
  return resolveImageUrl(primary?.url || "")
}

/* ─────────────────────────────────────────────────────────────
 *  Shape adapters — unify guest + server carts into one shape
 * ───────────────────────────────────────────────────────────── */
function adaptGuestItem(raw) {
  return {
    id: raw.id,
    lineId: raw.id,
    productId: raw.id,
    slug: raw.slug || "",
    title: raw.title || "Untitled",
    price: Number(raw.price || 0),
    currency: raw.currency || "MXN",
    category: raw.category || "General",
    imageUrl: raw.imageUrl || "",
    quantity: Math.max(1, Math.floor(Number(raw.quantity) || 1)),
  }
}

function adaptServerItem(item) {
  const imageUrl = item.product?.imageUrl
    ? resolveImageUrl(item.product.imageUrl)
    : ""
  return {
    id: item.productId || item.serviceId || item.id,
    lineId: item.id,
    productId: item.productId || null,
    serviceId: item.serviceId || null,
    slug: item.product?.slug || item.service?.slug || "",
    title: item.titleSnapshot || item.product?.title || item.service?.title || "Untitled",
    price: Number(item.priceSnapshot || item.product?.price || item.service?.basePrice || 0),
    currency: item.product?.currency || item.service?.currency || "MXN",
    category: "General",
    imageUrl,
    quantity: item.quantity,
  }
}

/* ─────────────────────────────────────────────────────────────
 *  Provider
 * ───────────────────────────────────────────────────────────── */
export function CartProvider({ children }) {
  const { isAuthenticated, user } = useAuth()

  const [guestItems, setGuestItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [serverCart, setServerCart] = useState(null)
  const [loading, setLoading] = useState(false)

  // #2 · Cart drawer state — exposed via context so any callsite (header
  // cart icon, "added to cart" auto-open after addToCart) can toggle it.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openDrawer = () => setDrawerOpen(true)
  const closeDrawer = () => setDrawerOpen(false)
  const toggleDrawer = () => setDrawerOpen((v) => !v)
  const [error, setError] = useState(null)

  const mergedOnceRef = useRef(false)

  /* Guest-cart persistence */
  useEffect(() => {
    if (isAuthenticated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(guestItems)) } catch {}
  }, [guestItems, isAuthenticated])

  /* Hydrate from server + merge guest cart on login */
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setServerCart(null)
      mergedOnceRef.current = false
      return
    }

    let cancelled = false

    async function hydrate() {
      setLoading(true)
      setError(null)
      try {
        if (!mergedOnceRef.current && guestItems.length > 0) {
          mergedOnceRef.current = true
          const { cart } = await apiMergeGuestCart(
            guestItems.map((g) => ({ productId: g.productId || g.id, quantity: g.quantity }))
          )
          if (cancelled) return
          setServerCart(cart)
          setGuestItems([])
          try { localStorage.removeItem(STORAGE_KEY) } catch {}
        } else {
          const cart = await apiFetchCart()
          if (cancelled) return
          setServerCart(cart)
          mergedOnceRef.current = true
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not load your cart")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    hydrate()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id])

  /* Mutations — dual-mode */

  const addToCart = async (product, quantity = 1) => {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1))

    if (isAuthenticated) {
      setLoading(true)
      try {
        const cart = await apiAddCartItem({ productId: product.id, quantity: qty })
        setServerCart(cart)
        setError(null)
      } catch (err) {
        setError(err?.message || "Could not add to cart")
      } finally {
        setLoading(false)
      }
      return
    }

    setGuestItems((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        )
      }
      return [
        ...current,
        {
          id: product.id,
          slug: product.slug,
          title: product.title,
          price: Number(product.price || 0),
          currency: product.currency || "MXN",
          category: product.category || "General",
          imageUrl: getPrimaryImage(product),
          quantity: qty,
        },
      ]
    })
  
    // #2 · open the drawer when the cart gains an item
    setDrawerOpen(true)
  }

  const removeFromCart = async (identifier) => {
    if (isAuthenticated) {
      const lineId =
        serverCart?.items?.find((i) => i.id === identifier)?.id ||
        serverCart?.items?.find((i) => i.productId === identifier)?.id
      if (!lineId) return
      setLoading(true)
      try {
        const cart = await apiRemoveCartItem(lineId)
        setServerCart(cart)
      } catch (err) {
        setError(err?.message || "Could not remove item")
      } finally {
        setLoading(false)
      }
      return
    }
    setGuestItems((current) => current.filter((item) => item.id !== identifier))
  }

  const updateQuantity = async (identifier, quantity) => {
    const q = Number(quantity)
    if (!Number.isFinite(q)) return

    if (isAuthenticated) {
      const lineId =
        serverCart?.items?.find((i) => i.id === identifier)?.id ||
        serverCart?.items?.find((i) => i.productId === identifier)?.id
      if (!lineId) return
      setLoading(true)
      try {
        const cart = await apiUpdateCartItem(lineId, Math.max(0, Math.floor(q)))
        setServerCart(cart)
      } catch (err) {
        setError(err?.message || "Could not update quantity")
      } finally {
        setLoading(false)
      }
      return
    }

    if (q <= 0) {
      setGuestItems((current) => current.filter((item) => item.id !== identifier))
      return
    }
    setGuestItems((current) =>
      current.map((item) =>
        item.id === identifier ? { ...item, quantity: Math.floor(q) } : item
      )
    )
  }

  const clearCart = async () => {
    if (isAuthenticated) {
      setLoading(true)
      try {
        const cart = await apiClearServerCart()
        setServerCart(cart)
      } catch (err) {
        setError(err?.message || "Could not clear cart")
      } finally {
        setLoading(false)
      }
      return
    }
    setGuestItems([])
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  /* Coupon */

  const applyCoupon = async (code) => {
    if (!isAuthenticated) {
      const err = new Error("Please sign in to apply a coupon")
      setError(err.message)
      throw err
    }
    setLoading(true)
    try {
      const cart = await apiApplyCoupon(code)
      setServerCart(cart)
      setError(null)
      return cart
    } catch (err) {
      setError(err?.message || "Could not apply coupon")
      throw err
    } finally {
      setLoading(false)
    }
  }

  const removeCoupon = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      const cart = await apiRemoveCoupon()
      setServerCart(cart)
      setError(null)
    } catch (err) {
      setError(err?.message || "Could not remove coupon")
    } finally {
      setLoading(false)
    }
  }

  const refreshCart = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      const cart = await apiFetchCart()
      setServerCart(cart)
      setError(null)
    } catch (err) {
      setError(err?.message || "Could not refresh cart")
    } finally {
      setLoading(false)
    }
  }

  /* Derived unified view */

  const cartItems = useMemo(() => {
    if (isAuthenticated && serverCart) {
      return (serverCart.items || []).map(adaptServerItem)
    }
    return guestItems.map(adaptGuestItem)
  }, [isAuthenticated, serverCart, guestItems])

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  )

  const subtotal = useMemo(() => {
    if (isAuthenticated && serverCart?.totals) return serverCart.totals.subtotal || 0
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [cartItems, serverCart, isAuthenticated])

  const discount = isAuthenticated && serverCart?.totals ? serverCart.totals.discount || 0 : 0
  const tax = isAuthenticated && serverCart?.totals ? serverCart.totals.tax || 0 : 0
  const total = isAuthenticated && serverCart?.totals
    ? serverCart.totals.total || 0
    : Math.max(0, subtotal - discount + tax)

  const appliedCoupon = isAuthenticated ? serverCart?.appliedCoupon || null : null

  const value = {
    cartItems,
    cartCount,
    subtotal,
    discount,
    tax,
    total,
    appliedCoupon,
    addToCart,
    removeFromCart,
    drawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    updateQuantity,
    clearCart,
    applyCoupon,
    removeCoupon,
    refreshCart,
    loading,
    error,
    isAuthenticated,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error("useCart must be used inside CartProvider")
  return context
}