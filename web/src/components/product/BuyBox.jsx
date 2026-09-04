import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { m } from "framer-motion"
import {
  Minus, Plus, ShoppingCart, Star, Zap, Lock, Check, Share2, User, BadgeCheck,
  Download, RefreshCw, CreditCard, ShieldCheck,
} from "lucide-react"
import { formatPrice } from "../../lib/format"
import { qualifiesForMsi, MAX_INSTALLMENTS } from "../../lib/installments"
import Badge from "../ui/Badge"
import { FileTypeStrip } from "./FileList"
import { formatCountAbbrev, formatUpdatedDate } from "./utils"

/* ──────────────────────────────────────────────────────────────────────────
 *  BuyBox — sticky purchase card (desktop) + MobileBuyBar (mobile).
 *
 *  Title · creator · social proof · file-type strip · short description ·
 *  price · qty · Add to cart · Buy now → /checkout · trust badges ·
 *  secure-payment note (Mercado Pago / PayPal) · share.
 *  ────────────────────────────────────────────────────────────────────────── */

const CREATOR = { name: "Mustapha Ukizuru", verified: true, storefrontUrl: "/about" }

function CreatorStrip() {
  const { t } = useTranslation("product")
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-charcoal-80/65">
      <span className="inline-flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 shrink-0 text-charcoal-80/40" aria-hidden="true" />
        <span>
          {t("creator.designedBy")}{" "}
          <Link to={CREATOR.storefrontUrl} className="font-semibold text-violet hover:underline">{CREATOR.name}</Link>
        </span>
      </span>
      {CREATOR.verified && (
        <>
          <span className="text-charcoal-80/30" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 text-violet">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-semibold">{t("creator.verifiedSeller")}</span>
          </span>
        </>
      )}
    </div>
  )
}

function SocialProofBar({ rating, reviewCount, downloadCount, updatedAt, onReviewClick }) {
  const { t, i18n } = useTranslation("product")
  const locale = i18n.language === "es" ? "es-MX" : "en-US"
  const hasRating = Number(rating) > 0
  const hasReviews = Number(reviewCount) > 0
  const hasDownloads = Number(downloadCount) > 0
  const updatedLabel = formatUpdatedDate(updatedAt, t, locale)
  if (!hasRating && !hasReviews && !hasDownloads && !updatedLabel) return null

  const reviewsWord = reviewCount === 1 ? t("social.reviewSingular") : t("social.reviewPlural")

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-charcoal-80/75">
      {(hasRating || hasReviews) && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5 text-terracotta" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(rating || 0) ? "fill-current" : "text-charcoal-80/15"}`} />
            ))}
          </span>
          {hasRating && <span className="font-mono font-semibold tabular-nums text-charcoal">{Number(rating).toFixed(1)}</span>}
          {hasReviews && (
            <button
              type="button"
              onClick={onReviewClick}
              className="text-charcoal-80/70 underline-offset-2 hover:text-violet hover:underline"
              aria-label={reviewCount === 1 ? t("social.seeReview") : t("social.seeReviews", { count: reviewCount })}
            >
              <span className="font-mono tabular-nums">({reviewCount})</span> {reviewsWord}
            </button>
          )}
        </span>
      )}

      {(hasRating || hasReviews) && (hasDownloads || updatedLabel) && <span className="text-charcoal-80/30" aria-hidden="true">·</span>}

      {hasDownloads && (
        <span className="inline-flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5 shrink-0 text-charcoal-80/40" aria-hidden="true" />
          <span>
            <span className="font-mono font-semibold tabular-nums text-charcoal">{formatCountAbbrev(downloadCount)}</span>{" "}
            <span className="text-charcoal-80/70">{t("misc.downloads")}</span>
          </span>
        </span>
      )}

      {hasDownloads && updatedLabel && <span className="text-charcoal-80/30" aria-hidden="true">·</span>}

      {updatedLabel && (
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-charcoal-80/40" aria-hidden="true" />
          <span>{t("misc.updated")} <span className="text-charcoal">{updatedLabel}</span></span>
        </span>
      )}
    </div>
  )
}

const TRUST_BADGES = [
  { icon: Lock,       key: "secureCheckout" },
  { icon: CreditCard, key: "paymentMethods" },
  { icon: RefreshCw,  key: "lifetimeUpdates" },
  { icon: Zap,        key: "instantDownload" },
]

function TrustBadges() {
  const { t } = useTranslation("product")
  return (
    <ul
      className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-micro text-charcoal-80/65 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
      aria-label={t("trust.ariaLabel")}
    >
      {TRUST_BADGES.map(({ icon: Icon, key }) => (
        <li key={key} className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 shrink-0 text-violet/70" aria-hidden="true" />
          <span className="leading-tight">{t(`trust.${key}`)}</span>
        </li>
      ))}
    </ul>
  )
}

/* T3 · licence tier picker — only rendered when the product carries more
 * than one active licence. Single-licence products keep the flat price. */
function LicenseTierPicker({ licenses, selectedTier, onChange, currency }) {
  const { t } = useTranslation("product")
  if (!Array.isArray(licenses) || licenses.length < 2) return null
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-micro font-semibold text-violet">{t("buyBox.licenseTier")}</legend>
      <div role="radiogroup" aria-label={t("buyBox.licenseTierAria")} className="grid gap-2">
        {licenses.map((lic) => {
          const active = lic.tier === selectedTier
          return (
            <button
              key={lic.tier}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(lic.tier)}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
                active
                  ? "border-violet bg-violet-pale shadow-[var(--shadow-lift-1)]"
                  : "border-charcoal-80/15 bg-mist hover:border-violet/40"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-meta font-bold text-violet">
                  {lic.name || t(`license.tierNames.${lic.tier}`, { defaultValue: lic.tier })}
                </span>
                <span className="block text-micro text-charcoal-80/65">
                  {lic.seats ? t("buyBox.seats", { count: lic.seats }) : t("license.seatsUnlimited")}
                </span>
              </span>
              <span className="shrink-0 text-meta font-bold tabular-nums text-violet">
                {formatPrice(lic.price, lic.currency || currency)}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function BuyBox({
  product, price, currency, qty, onQtyChange, added, onAddToCart, onBuyNow, onShare, onReviewClick,
  licenses = [], selectedTier = null, onTierChange = () => {},
}) {
  const { t } = useTranslation("product")

  return (
    <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e4)]">
      <h1 className="text-section font-bold leading-tight tracking-tight text-violet">{product.title}</h1>

      <CreatorStrip />

      <SocialProofBar
        rating={product.rating}
        reviewCount={product.reviewCount}
        downloadCount={product.downloadCount}
        updatedAt={product.updatedAt}
        onReviewClick={onReviewClick}
      />

      <FileTypeStrip files={product.files} />

      {product.shortDescription && (
        <p className="mt-2 text-meta leading-6 text-charcoal-80/65">{product.shortDescription}</p>
      )}

      <div className="mt-4 flex items-end gap-3">
        <span className="text-page font-bold leading-none text-violet">{formatPrice(price, currency)}</span>
      </div>
      {qualifiesForMsi(price * qty, currency) && (
        <div className="mt-2">
          <Badge tone="info" size="sm" icon={CreditCard} className="normal-case">
            {t("buyBox.msi", { months: MAX_INSTALLMENTS })}
          </Badge>
        </div>
      )}

      <LicenseTierPicker licenses={licenses} selectedTier={selectedTier} onChange={onTierChange} currency={currency} />

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <label className="shrink-0 text-micro font-semibold text-violet">{t("misc.qty")}</label>
          <div className="flex items-center overflow-hidden rounded-xl border border-charcoal-80/15 bg-mist">
            <button
              type="button"
              onClick={() => onQtyChange(Math.max(1, qty - 1))}
              aria-label={t("buyBox.decreaseQty")}
              className="flex h-10 w-10 items-center justify-center text-violet transition hover:bg-violet-pale"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[36px] text-center text-meta font-bold text-violet">{qty}</span>
            <button
              type="button"
              onClick={() => onQtyChange(qty + 1)}
              aria-label={t("buyBox.increaseQty")}
              className="flex h-10 w-10 items-center justify-center text-violet transition hover:bg-violet-pale"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-meta font-bold text-violet">= {formatPrice(price * qty, currency)}</div>
        </div>

        <button
          type="button"
          onClick={onAddToCart}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-body font-semibold text-white shadow-[var(--shadow-lift-3)] transition-all hover:-translate-y-0.5 ${
            added ? "bg-mint-600 shadow-[0_10px_28px_rgba(47,163,107,0.25)]" : "bg-violet hover:bg-violet-deep"
          }`}
        >
          {added ? (
            <><Check className="h-5 w-5" />{t("detail.addedToCart")}</>
          ) : (
            <><ShoppingCart className="h-5 w-5" />{t("detail.addToCart")}</>
          )}
        </button>

        <Link
          to="/checkout"
          onClick={onBuyNow}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet/20 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
        >
          {t("detail.buyNow")}
        </Link>

        <TrustBadges />

        {/* Secure-payment note — Mercado Pago / PayPal only */}
        <p className="mt-1 flex items-start gap-2 rounded-lg bg-mist px-3 py-2.5 text-micro leading-5 text-charcoal-80/65">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" aria-hidden="true" />
          <span>{t("buyBox.securePayment")}</span>
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onShare}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-charcoal-80/12 py-2.5 text-micro font-semibold text-charcoal-80/65 transition hover:border-violet/25 hover:text-violet"
        >
          <Share2 className="h-4 w-4" />
          {t("misc.share")}
        </button>
      </div>
    </div>
  )
}

/* Sticky bottom bar — mobile only, slides in after ~600px of scroll. */
export function MobileBuyBar({ price, currency, onAddToCart, added, productTitle }) {
  const { t } = useTranslation("product")
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function handleScroll() { setVisible(window.scrollY > 600) }
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <m.div
      initial={false}
      animate={{ y: visible ? 0 : 100, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal-80/10 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgb(var(--color-violet-rgb)/0.08)] backdrop-blur-md md:hidden"
      style={{ pointerEvents: visible ? "auto" : "none" }}
      role="region"
      aria-label={t("mobileBar.ariaLabel")}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-micro font-semibold text-charcoal-80/65">{productTitle}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-meta font-bold text-violet">{formatPrice(Number(price), currency)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddToCart}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-meta font-semibold text-white shadow-[var(--shadow-lift-1)] transition active:scale-95 ${
            added ? "bg-mint-600" : "bg-violet hover:bg-violet-deep"
          }`}
        >
          {added ? <><Check className="h-4 w-4" />{t("misc.added")}</> : <><ShoppingCart className="h-4 w-4" />{t("actions.addToCart")}</>}
        </button>
      </div>
    </m.div>
  )
}
