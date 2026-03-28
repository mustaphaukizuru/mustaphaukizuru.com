import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft, Minus, Plus, ShoppingCart, Download,
  ShieldCheck, CheckCircle2, Star, ChevronRight,
  Package, Zap, Lock, Users, FileText, Check,
  Share2, Heart, Eye
} from "lucide-react"
import { fetchProductBySlug } from "../services/productService"
import { useCart } from "../store/CartContext"
import { API_BASE_URL } from "../lib/api"

function resolveUrl(url = "") {
  if (!url) return ""
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function normalizeImages(product) {
  const raw = Array.isArray(product?.images) ? product.images : []
  return raw
    .filter((img) => img?.url)
    .slice(0, 6)
    .map((img, i) => ({
      id: img.id || `img-${i}`,
      url: resolveUrl(img.url),
      alt: img.altText || product?.title || `Preview ${i + 1}`,
      role: img.imageRole || "preview",
      isPrimary: Boolean(img.isPrimary),
    }))
}

function normalizeHighlights(product) {
  if (Array.isArray(product?.features) && product.features.length > 0) {
    return product.features
      .map((f) => typeof f === "string" ? f : (f?.featureText || f?.label || f?.title || ""))
      .filter(Boolean)
      .slice(0, 8)
  }
  return [
    "Instant digital download",
    "Ready to implement",
    "Professional quality",
    "Practical and structured",
    "Supports implementation",
  ]
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="aspect-[4/3] animate-pulse rounded-xl bg-[#ede4ef]" />
          <div className="flex gap-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-16 w-16 animate-pulse rounded-xl bg-[#ede4ef]" />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded-xl bg-[#ede4ef]" />
          <div className="h-10 animate-pulse rounded-xl bg-[#ede4ef]" />
          <div className="h-24 animate-pulse rounded-xl bg-[#ede4ef]" />
          <div className="h-14 animate-pulse rounded-xl bg-[#ede4ef]" />
        </div>
      </div>
    </div>
  )
}

export default function ProductDetail() {
  const { slug }      = useParams()
  const { addToCart } = useCart()

  const [product, setProduct]   = useState(null)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty]           = useState(1)
  const [added, setAdded]       = useState(false)
  const [wishlisted, setWishlisted] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState("")
  const [activeTab, setActiveTab] = useState("description")

  useEffect(() => {
    async function load() {
      setLoading(true); setError("")
      try {
        const data = await fetchProductBySlug(slug)
        if (!data) throw new Error("Product not found.")
        setProduct(data)
      } catch (err) {
        setError(err.message || "Failed to load product.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  const images     = useMemo(() => normalizeImages(product), [product])
  const highlights = useMemo(() => normalizeHighlights(product), [product])
  const price      = Number(product?.price || 0)

  // Set primary image on load
  useEffect(() => {
    if (!images.length) return
    const primary = images.findIndex((i) => i.isPrimary)
    setActiveImg(primary >= 0 ? primary : 0)
  }, [images])

  function handleAdd() {
    if (!product) return
    addToCart({ ...product, quantity: qty }, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (loading) return <LoadingSkeleton />

  if (error || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-red-50 text-red-500">
          <Package className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-[1.5rem] font-bold text-[#420060]">{error || "Product not found"}</h1>
        <Link to="/store" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#420060] px-6 py-3 text-[14px] font-semibold text-white hover:-translate-y-0.5 transition">
          <ArrowLeft className="h-4 w-4" /> Back to Store
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: "description", label: "Description" },
    { id: "features",    label: "Features" },
    { id: "details",     label: "Details" },
  ]

  return (
    <div className="bg-[#F7F9F4]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-[#634F40]/60">
          <Link to="/store" className="inline-flex items-center gap-1 font-medium text-[#420060] hover:underline">
            <ArrowLeft className="h-4 w-4" /> Store
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#634F40]/50">{product.category || "Product"}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate max-w-[200px] text-[#420060]">{product.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">

          {/* ── LEFT: Gallery ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Main image */}
            <motion.div
              key={activeImg}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="relative overflow-hidden rounded-xl bg-[#ede4ef] shadow-[0_8px_32px_rgba(66,0,96,0.08)]"
              style={{ aspectRatio: "4/3" }}
            >
              {images[activeImg] ? (
                <img
                  src={images[activeImg].url}
                  alt={images[activeImg].alt}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[#420060]/25">
                  <Package className="h-16 w-16" />
                </div>
              )}

              {/* Badges overlay */}
              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                {product.category && (
                  <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#420060] backdrop-blur-sm">
                    {product.category}
                  </span>
                )}
                {product.isFeatured && (
                  <span className="flex items-center gap-1 rounded-lg bg-[#420060] px-2.5 py-1 text-[10px] font-bold text-white">
                    <Star className="h-3 w-3 fill-current" /> Featured
                  </span>
                )}
                {product.isNew && (
                  <span className="rounded-lg bg-[#2FA36B] px-2.5 py-1 text-[10px] font-bold text-white">New</span>
                )}
              </div>
            </motion.div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={`shrink-0 h-16 w-16 overflow-hidden rounded-xl border-2 transition-all ${
                      activeImg === i
                        ? "border-[#420060] shadow-[0_0_0_3px_rgba(66,0,96,0.15)]"
                        : "border-[#634F40]/12 hover:border-[#420060]/40"
                    }`}
                  >
                    <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Tabs for mobile/desktop description */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <div className="flex overflow-hidden rounded-t-xl border-b border-[#634F40]/10">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3.5 text-[13px] font-semibold transition-all ${
                      activeTab === tab.id
                        ? "border-b-2 border-[#420060] text-[#420060]"
                        : "text-[#634F40]/60 hover:text-[#420060]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === "description" && (
                  <div className="text-[14px] leading-7 text-[#634F40]/80">
                    {product.description || product.shortDescription ||
                      "This digital product is professionally crafted to deliver immediate implementation value. Built to save time and reduce setup friction."}
                  </div>
                )}
                {activeTab === "features" && (
                  <ul className="space-y-3">
                    {highlights.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] text-[#634F40]/80">
                        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#2FA36B]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                {activeTab === "details" && (
                  <div className="space-y-3 text-[13px]">
                    {[
                      { label: "Format",   value: product.fileType || "ZIP / PDF" },
                      { label: "Version",  value: product.version || "1.0" },
                      { label: "Category", value: product.category || "Digital" },
                      { label: "Delivery", value: "Instant download after purchase" },
                      { label: "License",  value: "Single user, personal/professional use" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between border-b border-[#634F40]/8 pb-3 last:border-b-0">
                        <span className="text-[#634F40]/55">{label}</span>
                        <span className="font-semibold text-[#420060]">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Value props */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Zap,         title: "Instant Access",   desc: "Download immediately after payment" },
                { icon: Lock,        title: "Secure Checkout",  desc: "SSL encrypted transactions" },
                { icon: ShieldCheck, title: "Quality Assured",  desc: "Professional standard content" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 rounded-xl border border-[#634F40]/10 bg-white p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-[#420060]">{title}</div>
                    <div className="mt-0.5 text-[11px] text-[#634F40]/60">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Purchase panel ───────────────────────────────────── */}
          <div>
            <div className="sticky top-24 flex flex-col gap-5">

              {/* Product info */}
              <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_8px_24px_rgba(66,0,96,0.06)]">

                {/* Stars */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 text-[#FFCCAF]">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                  </div>
                  <span className="text-[12px] text-[#634F40]/50">(5.0)</span>
                </div>

                <h1 className="mt-3 text-[1.5rem] font-bold leading-tight tracking-tight text-[#420060]">
                  {product.title}
                </h1>

                {product.shortDescription && (
                  <p className="mt-2 text-[14px] leading-6 text-[#634F40]/65">
                    {product.shortDescription}
                  </p>
                )}

                {/* Price */}
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-[2.2rem] font-bold leading-none text-[#420060]">
                    ${price.toFixed(2)}
                  </span>
                  <span className="mb-1 rounded-full bg-[#e8f4ea] px-2.5 py-0.5 text-[11px] font-bold text-[#2FA36B]">
                    USD
                  </span>
                </div>

                {/* Qty + Add */}
                <div className="mt-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <label className="shrink-0 text-[12px] font-semibold text-[#420060]">Qty</label>
                    <div className="flex items-center overflow-hidden rounded-xl border border-[#634F40]/15 bg-[#fafafa]">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="flex h-10 w-10 items-center justify-center text-[#420060] transition hover:bg-[#ede4ef]"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[36px] text-center text-[14px] font-bold text-[#420060]">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => q + 1)}
                        className="flex h-10 w-10 items-center justify-center text-[#420060] transition hover:bg-[#ede4ef]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-[13px] font-bold text-[#420060]">
                      = ${(price * qty).toFixed(2)}
                    </div>
                  </div>

                  {/* Add to cart */}
                  <button
                    type="button"
                    onClick={handleAdd}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] transition-all hover:-translate-y-0.5 ${
                      added ? "bg-[#2FA36B] shadow-[0_10px_28px_rgba(47,163,107,0.25)]" : "bg-[#420060] hover:bg-[#2d003f]"
                    }`}
                  >
                    {added ? (
                      <><Check className="h-5 w-5" /> Added to Cart!</>
                    ) : (
                      <><ShoppingCart className="h-5 w-5" /> Add to Cart</>
                    )}
                  </button>

                  {/* Checkout */}
                  <Link
                    to="/checkout"
                    onClick={() => { if (!added) addToCart({ ...product, quantity: qty }, qty) }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#420060]/20 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]"
                  >
                    Buy Now
                  </Link>
                </div>

                {/* Wishlist + Share */}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWishlisted(!wishlisted)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-[12px] font-semibold transition ${
                      wishlisted ? "border-red-200 bg-red-50 text-red-600" : "border-[#634F40]/12 text-[#634F40]/60 hover:border-red-200 hover:text-red-500"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
                    {wishlisted ? "Wishlisted" : "Wishlist"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.share?.({ title: product.title, url: window.location.href })}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#634F40]/12 py-2.5 text-[12px] font-semibold text-[#634F40]/60 transition hover:border-[#420060]/25 hover:text-[#420060]"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                </div>
              </div>

              {/* What's included */}
              <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
                <h3 className="mb-4 text-[14px] font-bold text-[#420060]">What's Included</h3>
                <div className="space-y-2.5">
                  {highlights.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[13px] text-[#634F40]/75">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2FA36B]" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3-step access */}
              <div className="rounded-xl border border-[#420060]/12 bg-[#faf7fb] p-5">
                <h3 className="mb-4 text-[14px] font-bold text-[#420060]">How to Access</h3>
                <div className="space-y-3">
                  {[
                    "Complete secure checkout",
                    "Receive confirmation email",
                    "Download from your dashboard",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-[13px] text-[#634F40]/75">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#420060] text-[10px] font-bold text-white">
                        {i + 1}
                      </div>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
