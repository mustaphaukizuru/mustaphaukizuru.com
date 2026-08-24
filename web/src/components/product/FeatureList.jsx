import { useState } from "react"
import { m, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { CheckCircle2, Star, Package, ChevronDown, ChevronUp, HelpCircle } from "lucide-react"
import { validFaqs } from "./utils"

/* ──────────────────────────────────────────────────────────────────────────
 *  FeatureList — the descriptive content blocks of the product page.
 *
 *  Exports:
 *    default FeatureList   "What you get" check-bullet list (normalized highlights)
 *    HighlightsBlock       Etsy-style scannable key/value bullets (≤ 6)
 *    SpecsTable            formal 2-col details table + synthesized platform rows
 *    DescriptionWithFade   collapsible description with gradient fade
 *    FAQSection            single-expand accordion (hides when empty)
 *  ────────────────────────────────────────────────────────────────────────── */

/* ── Bullet reveal · roadmap step 35 ──────────────────────────────────────
 * Restrained in-view stagger: 40ms apart, 8px rise, once only. Under
 * `prefers-reduced-motion` the list renders as plain static markup — no
 * variants, no observer. LazyMotion-safe (`m.` components only).
 * ──────────────────────────────────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1]

const LIST_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const BULLET_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}

const BULLET_CLASS = "group flex items-start gap-3 text-meta leading-6 text-charcoal-80/85"
const BULLET_ICON_CLASS =
  "mt-1 h-4 w-4 shrink-0 text-mint-600 transition-transform duration-200 ease-out motion-safe:group-hover:scale-110"

export default function FeatureList({ items = [] }) {
  const { t } = useTranslation("product")
  const reduced = useReducedMotion()
  if (!Array.isArray(items) || items.length === 0) return null

  return (
    <div>
      <h3 className="mb-3 text-meta font-bold text-charcoal">{t("detail.whatYouGet")}</h3>
      {reduced ? (
        <ul className="space-y-2.5">
          {items.map((feature, i) => (
            <li key={i} className={BULLET_CLASS}>
              <CheckCircle2 className={BULLET_ICON_CLASS} aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      ) : (
        <m.ul
          className="space-y-2.5"
          variants={LIST_VARIANTS}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {items.map((feature, i) => (
            <m.li key={i} className={BULLET_CLASS} variants={BULLET_VARIANTS}>
              <CheckCircle2 className={BULLET_ICON_CLASS} aria-hidden="true" />
              {feature}
            </m.li>
          ))}
        </m.ul>
      )}
    </div>
  )
}

function cleanSpecRows(specifications) {
  if (!Array.isArray(specifications)) return []
  return specifications.filter(
    (s) => s && typeof s.key === "string" && typeof s.value === "string" && s.key.trim() && s.value.trim(),
  )
}

export function HighlightsBlock({ specifications }) {
  const { t } = useTranslation("product")
  const rows = cleanSpecRows(specifications).slice(0, 6)
  if (rows.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)] sm:p-6">
      <h2 className="mb-3 inline-flex items-center gap-2 text-meta font-bold text-violet">
        <Star className="h-4 w-4 fill-current" aria-hidden="true" />
        {t("highlights.title")}
      </h2>
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={`${row.key}-${i}`} className="flex items-start gap-2.5 text-meta leading-6 text-charcoal-80/85">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-mint-600" aria-hidden="true" />
            <span>
              <span className="font-semibold text-charcoal">{row.key}:</span> {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SpecsTable({ specifications, product }) {
  const { t, i18n } = useTranslation("product")
  const locale = i18n.language === "es" ? "es-MX" : "en-US"
  const rows = cleanSpecRows(specifications)

  const synthetic = []
  if (product?.category) synthetic.push({ key: t("info.category"), value: product.category })
  if (product?.deliveryType) synthetic.push({ key: t("info.delivery"), value: product.deliveryType })
  if (product?.files?.length) {
    synthetic.push({ key: t("info.files"), value: t("info.fileCount", { count: product.files.length }) })
  }
  if (product?.updatedAt) {
    const d = new Date(product.updatedAt)
    if (!Number.isNaN(d.getTime())) {
      synthetic.push({
        key: t("info.lastUpdated"),
        value: d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }),
      })
    }
  }

  const allRows = [...rows, ...synthetic]
  if (allRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-charcoal-80/15 bg-mist/40 px-6 py-10 text-center">
        <Package className="h-8 w-8 text-charcoal-80/30" aria-hidden="true" />
        <p className="text-meta font-semibold text-charcoal-80/60">{t("detail.specsComing")}</p>
      </div>
    )
  }

  return (
    <dl className="overflow-hidden rounded-xl border border-charcoal-80/10">
      {allRows.map((row, i) => (
        <div
          key={`${row.key}-${i}`}
          className={`grid grid-cols-1 gap-1 px-4 py-3 text-meta sm:grid-cols-[160px_1fr] sm:gap-4 sm:py-3.5 ${
            i % 2 === 0 ? "bg-white" : "bg-mist/35"
          }`}
        >
          <dt className="font-semibold text-charcoal-80/65">{row.key}</dt>
          <dd className="text-charcoal">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DescriptionWithFade({
  description,
  fullDescription,
  shortDescription,
  collapsedHeight = 240,
  fadeColor = "248, 250, 252", // --mist #F8FAFC
}) {
  const { t } = useTranslation("product")
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  // Callback ref measures on attach so no separate effect is needed.
  const measureRef = (node) => {
    if (!node) return
    const overflows = node.scrollHeight > collapsedHeight + 8
    if (overflows !== isOverflowing) setIsOverflowing(overflows)
  }

  const text = description || shortDescription || t("description.fallback")

  return (
    <div className="space-y-4">
      <div
        ref={measureRef}
        className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: expanded || !isOverflowing ? "none" : `${collapsedHeight}px` }}
      >
        <div className="max-w-prose space-y-4 text-meta leading-7 text-charcoal-80/80">
          <div>{text}</div>
          {fullDescription && <div className="border-t border-charcoal-80/8 pt-4">{fullDescription}</div>}
        </div>

        {!expanded && isOverflowing && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background: `linear-gradient(to bottom, rgba(${fadeColor}, 0) 0%, rgba(${fadeColor}, 0.85) 60%, rgba(${fadeColor}, 1) 100%)`,
            }}
          />
        )}
      </div>

      {isOverflowing && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-meta font-bold text-charcoal underline-offset-4 transition hover:bg-violet-pale hover:text-violet hover:no-underline"
            aria-expanded={expanded}
          >
            <span className="underline">{expanded ? t("description.showLess") : t("description.learnMore")}</span>
            {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  )
}

export function FAQSection({ faqs }) {
  const { t } = useTranslation("product")
  const [openIndex, setOpenIndex] = useState(0)
  const rows = validFaqs(faqs)
  if (rows.length === 0) return null

  return (
    <section
      aria-labelledby="faq-heading"
      className="mt-8 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
    >
      <div className="mb-5 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-violet" aria-hidden="true" />
        <h2 id="faq-heading" className="text-section font-bold text-violet">{t("detail.faqTitle")}</h2>
      </div>

      <ul className="divide-y divide-charcoal-80/8">
        {rows.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <li key={`${faq.question}-${i}`} className="py-1">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 py-3 text-left transition hover:text-violet"
              >
                <span className="flex-1 text-meta font-semibold text-charcoal">{faq.question}</span>
                <span className="mt-0.5 shrink-0 rounded-full bg-violet-pale p-1 text-violet transition" aria-hidden="true">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {isOpen && (
                <div className="max-w-prose pb-4 pr-9 text-meta leading-7 text-charcoal-80/80">{faq.answer}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
