import { Component } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"

import markViolet from "../assets/logo-mark/m-mark-violet.svg"
import { friendlyMessage } from "../lib/sanitize"
import i18next from "i18next"

/**
 * ErrorBoundary · top-level safety net
 *
 * Catches any uncaught render-time error in the React tree and renders a
 * brand-aligned fallback so users never see a white screen. Errors are
 * forwarded to:
 *   - console.error (development)
 *   - window.Sentry?.captureException (production, if Sentry is loaded)
 *   - the optional `onError` prop for app-level telemetry hooks
 *
 * Mount once at the very top of the tree, OUTSIDE the router, so router
 * crashes are still caught:
 *
 *   <ErrorBoundary>
 *     <BrowserRouter>...</BrowserRouter>
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
    this.handleReset = this.handleReset.bind(this)
    this.handleReload = this.handleReload.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  /**
   * Recover on navigation.
   *
   * A class boundary holds its caught error in state, and nothing clears it
   * when the route changes — so a crash on /about would stay on screen after
   * the user clicked through to /store, even though /store would have
   * rendered fine. Callers pass the pathname (or any identity for "what is
   * being shown") as `resetKey`; when it changes, the boundary retries.
   *
   * Deliberately only on CHANGE, not on every update: re-rendering the same
   * broken subtree would loop straight back into the error.
   */
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.handleReset()
    }
  }

  componentDidCatch(error, info) {
    this.setState({ info })

    // Forward to Sentry if it's loaded (we use @sentry/node on the backend
    // and may add @sentry/browser later — both attach to window.Sentry).
    if (typeof window !== "undefined" && window.Sentry?.captureException) {
      try {
        window.Sentry.captureException(error, { contexts: { react: { componentStack: info?.componentStack } } })
      } catch { /* swallow telemetry errors */ }
    }

    // Telemetry hook for the host app.
    this.props.onError?.(error, info)

    // Always log in development.
    if (import.meta?.env?.DEV) {
       
      console.error("[ErrorBoundary]", error, info)
    }
  }

  handleReset() {
    this.setState({ error: null, info: null })
  }

  handleReload() {
    if (typeof window !== "undefined") window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // Optional custom fallback — components that don't want the full-page
    // brand error UI (e.g., <Header> wrapping itself so a Header crash
    // falls back to a minimal sticky brand-bar instead of a brand-violet
    // takeover) can pass a `fallback` ReactNode. Keeps the default
    // behavior backwards-compatible for the top-level mount.
    if (this.props.fallback !== undefined) {
      // A function fallback receives the reset handler, so a section-level
      // UI can offer "Try again" without reaching into boundary state. A
      // plain node is still accepted for the existing static-fallback callers.
      return typeof this.props.fallback === "function"
        ? this.props.fallback({ error, onReset: this.handleReset })
        : this.props.fallback
    }

    const message = friendlyMessage(error?.message, "Something went wrong rendering this page.")
    const isDev = !!import.meta?.env?.DEV

    return (
      <div
        role="alert"
        className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-violet px-4 py-16 text-white"
      >
        {/* Mesh accents */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-terracotta/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-[480px] w-[480px] rounded-full bg-azure/20 blur-3xl" aria-hidden="true" />

        <div className="relative w-full max-w-lg text-center">
          {/* Brand mark — single source of truth · same tile treatment as
              the splash screen so error and load states feel coherent. */}
          <Link
            to="/"
            aria-label={i18next.t("errorBoundary.homeAria", { ns: "common" })}
            className="group relative mx-auto mb-10 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/30 transition hover:-translate-y-[2px]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 rounded-3xl bg-white/20 opacity-0 blur-xl transition group-hover:opacity-100"
            />
            <img src={markViolet} alt={i18next.t("errorBoundary.brandAlt", { ns: "common" })} className="h-9 w-9" draggable={false} />
          </Link>

          <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <AlertTriangle className="h-7 w-7 text-terracotta" strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
            {i18next.t("errorBoundary.title", { ns: "common" })}
          </p>
          <h1 className="mt-2 text-[clamp(28px,4.5vw,40px)] font-bold leading-tight">
            {i18next.t("errorBoundary.body", { ns: "common" })}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-white/70">
            {message}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13.5px] font-semibold text-violet shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)] transition hover:-translate-y-[1px] hover:bg-white/95 active:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Reload
            </button>
            <Link
              to="/"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40"
            >
              <Home size={14} aria-hidden="true" />
              {i18next.t("errorBoundary.backHome", { ns: "common" })}
            </Link>
          </div>

          {isDev && (
            <details className="mx-auto mt-10 max-w-lg rounded-2xl border border-white/15 bg-white/[0.04] p-4 text-left text-[12px] text-white/70">
              <summary className="cursor-pointer font-semibold uppercase tracking-[0.14em] text-white/55">
                {i18next.t("errorBoundary.devDetail", { ns: "common" })}
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/75">
                {String(error?.stack || error?.message || error)}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
