import { Link, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Scale, X, ArrowRight, Package } from "lucide-react"

import { useCompare } from "../context/CompareContext"
import { useTranslation } from "react-i18next"

/**
 * CompareBar · #3
 *
 * Floating sticky bar that appears at the bottom of any page when one or
 * more products are in the compare queue. Mounted once at the App root.
 *
 * Hides itself on the /compare page (where the comparison is already
 * the primary content) and on auth pages (login/signup) to keep those
 * focused.
 *
 * Each item shows a small thumbnail with an X to remove. The "View
 * comparison" CTA links to /compare.
 */

const HIDDEN_ON = ["/compare", "/login", "/signup", "/forgot-password", "/reset-password"]

export default function CompareBar() {
  const { t } = useTranslation("common")
  const { items, remove, clear, maxItems } = useCompare()
  const { pathname } = useLocation()

  if (items.length === 0) return null
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null

  return (
    <AnimatePresence>
      <motion.div
        key="compare-bar"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:left-auto"
        role="region"
        aria-label={t("ui.compare.trayAria")}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-charcoal-80/15 bg-white px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <div className="flex shrink-0 items-center gap-1.5 px-1">
            <Scale className="h-4 w-4 text-violet" aria-hidden="true" />
            <span className="hidden font-mono text-[11px] font-bold uppercase tracking-wider text-charcoal-80/65 sm:inline">
              Compare
            </span>
            <span className="rounded-full bg-violet px-1.5 py-0 font-mono text-[10px] font-bold tabular-nums text-white">
              {items.length}/{maxItems}
            </span>
          </div>

          {/* Thumbnails, flex-1 so it shrinks/scrolls on narrow screens */}
          <ul className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {items.map((p) => (
              <li key={p.slug} className="relative shrink-0">
                <Link
                  to={`/store/${p.slug}`}
                  className="block h-9 w-9 overflow-hidden rounded-lg bg-violet-pale ring-1 ring-charcoal-80/10 transition hover:ring-violet/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
                  title={p.title}
                >
                  {p.coverImage ? (
                    <img src={p.coverImage} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-violet/45">
                      <Package className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(p.slug)}
                  aria-label={`Remove ${p.title} from compare`}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-charcoal text-white shadow-md transition hover:bg-rose focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={clear}
            aria-label={t("ui.compare.clearAria")}
            className="hidden rounded-lg p-1.5 text-charcoal-80/45 transition hover:bg-mist hover:text-charcoal sm:inline-flex"
            title={t("ui.compare.clearAll")}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <Link
            to="/compare"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-micro font-semibold text-white shadow-[0_4px_12px_rgba(93,63,211,0.20)] transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
          >
            <span className="hidden sm:inline">{t("ui.compare.viewComparison")}</span>
            <span className="sm:hidden">Compare</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
