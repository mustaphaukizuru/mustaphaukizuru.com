import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import Header from "./Header"
import ErrorBoundary from "../components/ErrorBoundary"
import SectionErrorFallback from "../components/SectionErrorFallback"
import Footer from "./Footer"
import ScrollProgress from "../components/motion/ScrollProgress"

/* ════════════════════════════════════════════════════════════════════════
   PublicShell · the chrome wrapping every public route (see App.jsx).
   ────────────────────────────────────────────────────────────────────────
   Carries the three accessibility primitives every WCAG 2.1 AA layout
   needs:
     1. Skip-to-content link that becomes visible only on keyboard focus,
        letting users bypass the (~60 nav stops in) header on every page.
     2. <main id="main-content"> as the skip-link target and the canonical
        landmark for screen readers ("main region").
     3. Lazy-defined tab order — Header before children before Footer —
        so visual flow matches tab flow.

   Matches the same pattern AuthShell, AdminLayout, and DashboardLayout
   already use (each has its own skip link). Closes the long-standing
   gap on the public website that brand v3 §11 calls out:
     "Keyboard nav: tab order follows visual flow, modals trap focus,
      ESC dismisses overlays."
   ════════════════════════════════════════════════════════════════════════ */
export default function PublicShell({ children }) {
  const { t } = useTranslation("common")
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-mist" style={{ color: "var(--color-charcoal-80)" }}>
      <ScrollProgress />
      {/* Skip link · visually hidden until a keyboard user focuses it.
          Same visual treatment as DashboardLayout / AdminLayout for
          consistency across the platform. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-violet focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-white focus:shadow-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
      >
        {t("a11y.skipToContent", { defaultValue: "Skip to main content" })}
      </a>

      <Header />

      {/* Main landmark · id="main-content" is the skip-link target.
          tabIndex=-1 lets the browser focus this region after the user
          activates the skip link, so the next Tab keystroke moves into
          the actual content rather than back to the header. */}
      {/* Scoped error boundary · a render error inside a page used to bubble
          to the single top-level boundary in App.jsx and replace EVERYTHING
          with a full-viewport error page — header, footer, cart, account
          menu, all gone. Catching it here keeps the chrome alive so the
          user can still navigate away. The pathname is the reset key: a
          crash on one route clears itself the moment the user leaves it. */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <ErrorBoundary
          resetKey={pathname}
          fallback={({ onReset }) => <SectionErrorFallback onReset={onReset} />}
        >
          {children}
        </ErrorBoundary>
      </main>

      <Footer />
    </div>
  )
}
