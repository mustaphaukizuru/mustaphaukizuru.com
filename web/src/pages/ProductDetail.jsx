import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, ChevronRight, Package } from "lucide-react"

import Seo from "../components/seo/Seo"
import { fetchProductBySlug } from "../services/productService"
import { useCart } from "../store/CartContext"
import { apiRequest } from "../lib/api"
import RecentlyViewed, { useTrackProductView } from "../components/RecentlyViewed"

import Gallery from "../components/product/Gallery"
import BuyBox, { MobileBuyBar } from "../components/product/BuyBox"
import FeatureList, {
  HighlightsBlock, SpecsTable, DescriptionWithFade, FAQSection,
} from "../components/product/FeatureList"
import FileList from "../components/product/FileList"
import LicenseUpdates from "../components/product/LicenseUpdates"
import Reviews from "../components/product/Reviews"
import Related from "../components/product/Related"
import {
  normalizeImages, normalizeHighlights, buildSeoDescription, buildJsonLd,
} from "../components/product/utils"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProductDetail — composition only. Presentation lives in components/product/*:
 *    Gallery · BuyBox (+MobileBuyBar) · FeatureList (+Highlights/Specs/
 *    Description/FAQ) · FileList · LicenseUpdates · Reviews · Related
 *
 *  Funnel: product page → Add to cart / Buy now (→ /checkout) → success page
 *  with instant downloads. Tab state is URL-synced (?tab=…).
 *  ────────────────────────────────────────────────────────────────────────── */

const VALID_TABS = ["description", "included", "specs", "reviews"]

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="aspect-[4/3] animate-pulse rounded-xl bg-violet-pale" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 w-16 animate-pulse rounded-xl bg-violet-pale" />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded-xl bg-violet-pale" />
          <div className="h-10 animate-pulse rounded-xl bg-violet-pale" />
          <div className="h-24 animate-pulse rounded-xl bg-violet-pale" />
          <div className="h-14 animate-pulse rounded-xl bg-violet-pale" />
        </div>
      </div>
    </div>
  )
}

export default function ProductDetail() {
  const { t } = useTranslation("product")
  const { slug } = useParams()
  const { addToCart } = useCart()

  const [product, setProduct] = useState(null)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [relatedProducts, setRelatedProducts] = useState([])

  const [searchParams, setSearchParams] = useSearchParams()
  useTrackProductView(product)

  const urlTab = searchParams.get("tab")
  const activeTab = VALID_TABS.includes(urlTab) ? urlTab : "description"
  const setActiveTab = (id) => {
    const next = new URLSearchParams(searchParams)
    if (id === "description") next.delete("tab")
    else next.set("tab", id)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")
      setQty(1)
      setAdded(false)
      try {
        const data = await fetchProductBySlug(slug)
        if (!data) throw new Error("Product not found.")
        setProduct(data)
      } catch (err) {
        setProduct(null)
        setError(err?.message || "Failed to load product.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // Related products — best-effort, never breaks the page.
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      try {
        const json = await apiRequest(`/api/products/${encodeURIComponent(slug)}/related`)
        if (!cancelled) setRelatedProducts(Array.isArray(json?.data) ? json.data : [])
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [slug])

  const images = useMemo(() => normalizeImages(product), [product])
  const highlights = useMemo(() => normalizeHighlights(product), [product])
  const price = Number(product?.price || 0)
  const currency = product?.currency || "MXN"

  useEffect(() => {
    if (!images.length) { setActiveImg(0); return }
    const primaryIndex = images.findIndex((img) => img.isPrimary)
    setActiveImg(primaryIndex >= 0 ? primaryIndex : 0)
  }, [images])

  function handleAdd() {
    if (!product) return
    addToCart({ ...product, quantity: qty }, qty)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 2000)
  }

  function handleBuyNow() {
    if (!product) return
    addToCart({ ...product, quantity: qty }, qty)
  }

  function handleShare() {
    if (!product) return
    const shareData = {
      title: product.title || "Product",
      text: product.shortDescription || product.description || "",
      url: window.location.href,
    }
    if (navigator.share) { navigator.share(shareData).catch(() => {}); return }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(window.location.href).catch(() => {})
  }

  if (loading) return <LoadingSkeleton />

  if (error || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-rose/10 text-red-500">
          <Package className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-section font-bold text-violet">{error || t("errors.notFound")}</h1>
        <Link
          to="/store"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3 text-meta font-semibold text-white transition hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.backToStore")}
        </Link>
      </div>
    )
  }

  const canonicalUrl = `https://mustaphaukizuru.com/store/${product.slug || slug}`
  const seoImage = images[activeImg]?.url || images[0]?.url || "https://mustaphaukizuru.com/og/og-default.png"
  const jsonLd = buildJsonLd({
    product, images, slug, price, canonicalUrl, categoryFallback: t("category.fallback"),
  })

  const fileCount = Array.isArray(product.files) ? product.files.length : 0
  const totalIncluded = (Array.isArray(product.features) ? product.features.length : 0) + fileCount

  const tabs = [
    { id: "description", label: t("tabs.description") },
    { id: "included",    label: t("tabs.included"), count: totalIncluded || null },
    { id: "specs",       label: t("tabs.specs") },
    { id: "reviews",     label: t("tabs.reviews"), count: product.reviewCount || null },
  ]

  return (
    <>
      <Seo
        title={product.metaTitle || product.title}
        description={buildSeoDescription(product)}
        canonical={canonicalUrl}
        image={seoImage}
        type="product"
        jsonLd={jsonLd}
      />

      <div className="bg-mist overflow-x-hidden w-full max-w-[100vw]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-meta text-charcoal-80/60">
            <Link to="/store" className="inline-flex items-center gap-1 font-medium text-violet hover:underline">
              <ArrowLeft className="h-4 w-4" />
              {t("misc.storeBreadcrumb")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-charcoal-80/50">{product.category || t("misc.product")}</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-w-[200px] truncate text-violet">{product.title}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
            {/* ── Left column: gallery + content ── */}
            <div className="flex flex-col gap-4">
              <Gallery images={images} activeImg={activeImg} onSelect={setActiveImg} product={product} />

              <HighlightsBlock specifications={product.specifications} />

              <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)]">
                <div className="flex overflow-x-auto rounded-t-xl border-b border-charcoal-80/10" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-meta font-semibold transition-all sm:flex-1 ${
                        activeTab === tab.id ? "border-b-2 border-violet text-violet" : "text-charcoal-80/60 hover:text-violet"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count != null && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-mono text-micro font-bold tabular-nums ${
                            activeTab === tab.id ? "bg-violet-pale text-violet" : "bg-charcoal-80/8 text-charcoal-80/60"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {activeTab === "description" && (
                    <DescriptionWithFade
                      description={product.description}
                      fullDescription={product.fullDescription}
                      shortDescription={product.shortDescription}
                    />
                  )}

                  {activeTab === "included" && (
                    <div className="space-y-6">
                      <FeatureList items={highlights} />

                      {highlights.length > 0 && fileCount > 0 && <div className="border-t border-charcoal-80/8" />}

                      {fileCount > 0 && (
                        <div>
                          <div className="mb-3 flex items-baseline justify-between">
                            <h3 className="text-meta font-bold text-charcoal">{t("detail.filesInProduct")}</h3>
                            <span className="font-mono text-micro text-charcoal-80/55 tabular-nums">
                              {t("info.fileCount", { count: fileCount })}
                            </span>
                          </div>
                          <FileList files={product.files} />
                        </div>
                      )}

                      {highlights.length === 0 && fileCount === 0 && (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-charcoal-80/15 bg-mist/40 px-6 py-10 text-center">
                          <Package className="h-8 w-8 text-charcoal-80/30" aria-hidden="true" />
                          <p className="text-meta font-semibold text-charcoal-80/60">{t("detail.contentsComing")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "specs" && <SpecsTable specifications={product.specifications} product={product} />}

                  {activeTab === "reviews" && <Reviews slug={slug} productTitle={product.title} />}
                </div>
              </div>

              <LicenseUpdates product={product} />
              <FAQSection faqs={product.productFaqs} />
            </div>

            {/* ── Right column: sticky buy box ── */}
            <div>
              <div className="sticky top-24 flex flex-col gap-5">
                <BuyBox
                  product={product}
                  price={price}
                  currency={currency}
                  qty={qty}
                  onQtyChange={setQty}
                  added={added}
                  onAddToCart={handleAdd}
                  onBuyNow={handleBuyNow}
                  onShare={handleShare}
                  onReviewClick={() => setActiveTab("reviews")}
                />
              </div>
            </div>
          </div>

          <Related items={relatedProducts} currentSlug={slug} />
        </div>

        <RecentlyViewed excludeSlug={product.slug} />
      </div>

      <MobileBuyBar
        price={price}
        currency={currency}
        productTitle={product.title}
        added={added}
        onAddToCart={handleAdd}
      />
    </>
  )
}
