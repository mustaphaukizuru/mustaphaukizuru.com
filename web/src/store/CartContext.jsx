import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { API_BASE_URL } from "../lib/api"

const CartContext = createContext(null)

// ─────────────────────────────────────────────────────────────
// Safe image URL resolver (handles all environments)
// ─────────────────────────────────────────────────────────────
function resolveImageUrl(url = "") {
  if (!url) return ""

  // already absolute (https://...)
  if (url.startsWith("http")) return url

  // ensure no double slashes
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`
  }

  // production → relative path
  return url
}

function getPrimaryImage(product) {
  if (!Array.isArray(product?.images) || product.images.length === 0) {
    return ""
  }

  const primary =
    product.images.find((image) => image?.isPrimary) ||
    product.images.find((image) => image?.imageRole === "cover") ||
    product.images[0]

  return resolveImageUrl(primary?.url || "")
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem("ukizuru-cart")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Persist cart
  useEffect(() => {
    try {
      localStorage.setItem("ukizuru-cart", JSON.stringify(cartItems))
    } catch {}
  }, [cartItems])

  const addToCart = (product, quantity = 1) => {
    const normalizedQuantity = Math.max(1, Number(quantity) || 1)

    setCartItems((current) => {
      const existing = current.find((item) => item.id === product.id)

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + normalizedQuantity }
            : item
        )
      }

      return [
        ...current,
        {
          id: product.id,
          slug: product.slug,
          title: product.title,
          price: Number(product.price || 0),
          currency: product.currency || "USD",
          category: product.category || "General",
          imageUrl: getPrimaryImage(product),
          quantity: normalizedQuantity,
        },
      ]
    })
  }

  const removeFromCart = (productId) => {
    setCartItems((current) => current.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId, quantity) => {
    const normalizedQuantity = Number(quantity)

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCartItems((current) =>
      current.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.floor(normalizedQuantity) }
          : item
      )
    )
  }

  const clearCart = () => {
    setCartItems([])
  }

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  )

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * item.quantity,
        0
      ),
    [cartItems]
  )

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartCount,
    subtotal,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error("useCart must be used inside CartProvider")
  }

  return context
}