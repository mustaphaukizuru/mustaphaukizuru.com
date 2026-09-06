import { useTranslation } from "react-i18next"
import { LocalizedLink as Link } from "./LocalizedLink"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

/**
 * SectionErrorFallback · an error state sized for a page section, not a
 * viewport.
 *
 * The default <ErrorBoundary> fallback is a full-viewport brand takeover
 * (min-h-[100dvh], violet, its own brand mark and home link). That is the
 * right thing at the top of the tree, where nothing else survived. It is the
 * wrong thing INSIDE <main>: the header and footer are still mounted and
 * working, and painting a second full-screen page between them buries the
 * navigation the user needs to get out.
 *
 * So this one is calm and contained. Same primitives as the top-level UI
 * (brand tokens, same icon, same two actions) so error states feel like one
 * system — but it sits in the content column and leaves the chrome alone.
 * A user who hits this can still reach the cart, the account menu, and the
 * footer links, which is the point of scoping the boundary in the first
 * place.
 *
 * `onReset` comes from the boundary and clears its caught error; `Home`
 * navigates, and the boundary's `resetKey` (the pathname) then clears it
 * for free.
 */
export default function SectionErrorFallback({ onReset }) {
  const { t } = useTranslation("common")

  return (
    <div
      role="alert"
      className="mx-auto my-16 w-full max-w-lg rounded-2xl border border-charcoal-80/10 bg-white px-6 py-10 text-center shadow-[var(--shadow-e4)]"
    >
      <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/12 ring-1 ring-terracotta/20">
        <AlertTriangle className="h-6 w-6 text-terracotta-800" strokeWidth={1.8} aria-hidden="true" />
      </div>

      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-charcoal-80/55">
        {t("errorBoundary.title")}
      </p>
      <h2 className="mt-2 text-[clamp(20px,3vw,26px)] font-bold leading-tight text-violet">
        {t("errorBoundary.sectionBody")}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-charcoal-80/70">
        {t("errorBoundary.sectionHint")}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full bg-violet px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[var(--shadow-lift-1)] transition hover:-translate-y-[1px] hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t("errorBoundary.tryAgain")}
        </button>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-charcoal-80/15 bg-white px-5 py-2.5 text-[13.5px] font-semibold text-charcoal-80 transition hover:bg-violet-ghost focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
        >
          <Home size={14} aria-hidden="true" />
          {t("errorBoundary.backHome")}
        </Link>
      </div>
    </div>
  )
}
