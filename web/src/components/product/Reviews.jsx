import { useTranslation } from "react-i18next"
import { BadgeCheck } from "lucide-react"
import ProductReviews from "../ProductReviews"

/* ──────────────────────────────────────────────────────────────────────────
 *  Reviews — wraps the shared <ProductReviews> surface with a verified-purchase
 *  legend. The backend flags `isVerifiedPurchase` on each review and
 *  <ProductReviews> renders the per-review badge; this header explains it.
 *  ────────────────────────────────────────────────────────────────────────── */
export default function Reviews({ slug, productTitle }) {
  const { t } = useTranslation("product")
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-mint/25 bg-mint/8 px-4 py-3">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint/15 px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-mint-600 ring-1 ring-mint/30">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t("reviews.verifiedPurchase")}
        </span>
        <p className="text-micro leading-5 text-charcoal-80/70">{t("reviews.verifiedIntro")}</p>
      </div>
      <ProductReviews slug={slug} productTitle={productTitle} />
    </div>
  )
}
