import { formatDate } from "../lib/format"
import { useEffect, useRef, useState } from "react"
import { Modal } from "./ui/Modal"
import {
  Award,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  X,
  ZoomIn,
} from "lucide-react"

import { useTranslation } from "react-i18next"

/**
 * CertificatePreview · adaptive credential tile
 *
 * Two render modes, decided per-tile:
 *
 *   1. PDF mode — `src` is a same-origin path or .pdf URL. The tile renders a
 *      PDF.js page-1 canvas thumbnail (best-effort; gracefully degrades to a
 *      branded placeholder if PDF.js can't load). Clicking opens the modal
 *      viewer, which renders the PDF in an <iframe> via the browser's native
 *      PDF viewer — no worker, no MIME-type gotchas, no CSP surprises.
 *
 *   2. Credential mode — `src` is missing, "#", or external (Coursera /
 *      Credly verify URL). The tile becomes a credential card; clicking
 *      opens the issuer page in a new tab.
 *
 *  Why iframe (not PDF.js) for the modal? PDF.js needs a same-origin module
 *  worker with the correct MIME type AND a permissive CSP. When any one of
 *  those isn't right (cached old worker, Hostinger MIME quirk, CSP missing
 *  worker-src), the renderer throws and we'd show a useless error state.
 *  An <iframe> to a same-origin PDF is rendered by the browser's built-in
 *  viewer (Chrome PDFium, Edge PDFium, Firefox PDF.js, Safari Preview) —
 *  zero JS dependency, works offline, supports zoom/print/download natively.
 *
 *  Tile thumbnail still uses PDF.js because no native browser API gives us
 *  a page-1 image. If PDF.js fails there, the tile downgrades to a refined
 *  branded placeholder (NOT a broken-image state).
 *
 * Props:
 *   src           — public path to PDF OR external credential URL
 *   thumbnail     — optional image URL (PNG/JPG) used as the tile preview.
 *                   When provided, renders an <img> instead of the PDF.js
 *                   canvas — faster, no worker dependency, and survives the
 *                   PDFs PDF.js can't decode (JBIG2, JPEG2000, etc.). On
 *                   <img> load error, falls back to the PDF.js renderer.
 *   credentialUrl — optional explicit credential page; if present, takes
 *                   precedence over `src` for the "Verify" CTA in
 *                   credential mode
 *   issuerLogo    — optional URL of an issuer logo (Coursera, Google, IBM)
 *   title         — required display title
 *   issuer        — optional secondary line ("Google for Education")
 *   year          — optional year string ("2023") — auto-derived from `date`
 *   date          — optional ISO string; used to derive a "Issued · Mar 2024" line
 *   verified      — boolean, shows the verified ribbon (default true)
 *   className     — extra classes on the outer card
 */

// Heuristic — is this src renderable inline as a PDF? Same-origin paths
// (`/documents/...`) and explicit `.pdf` URLs qualify. Cross-origin issuer
// verify pages (`https://coursera.org/verify/abc`) do not.
function isRenderablePdf(src) {
  if (!src) return false
  const s = String(src).trim()
  if (!s || s === "#") return false
  if (s.startsWith("/")) return true // same-origin static
  if (s.startsWith(".")) return true // relative
  if (/\.pdf($|\?)/i.test(s)) {
    try {
      if (typeof window !== "undefined") {
        const u = new URL(s, window.location.origin)
        return u.origin === window.location.origin
      }
    } catch { /* fallthrough */ }
    return false
  }
  return false
}

function deriveYear(year, date) {
  if (year) return String(year)
  if (!date) return null
  try { return String(new Date(date).getFullYear()) } catch { return null }
}

function deriveIssuedLine(date) {
  if (!date) return null
  try {
    return formatDate(date, undefined, { year: "numeric", month: "short", day: undefined })
  } catch { return null }
}

let pdfjsPromise = null

async function loadPdfjs() {
  if (pdfjsPromise) return pdfjsPromise
  pdfjsPromise = (async () => {
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs")
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })()
  return pdfjsPromise
}

// Dev-only logger. Production users never see this; engineers diagnosing
// a broken preview can paste the URL into the console and see exactly why
// pdfjs.getDocument rejected (worker MIME mismatch, fetch 404, etc).
function logDev(...args) {
  if (import.meta?.env?.DEV) {
     
    console.warn("[CertificatePreview]", ...args)
  }
}

export default function CertificatePreview({
  src,
  thumbnail,
  credentialUrl,
  issuerLogo,
  title,
  issuer,
  year,
  date,
  verified = true,
  className = "",
}) {
  const { t } = useTranslation("about")
  const [open, setOpen] = useState(false)
  const canPreview = isRenderablePdf(src)
  const verifyHref = credentialUrl || (canPreview ? null : src)
  const issuedYear = deriveYear(year, date)
  const issuedLine = deriveIssuedLine(date)

  // ── Credential mode ──────────────────────────────────────────────────
  if (!canPreview) {
    const initial = (issuer || title || "?").trim().charAt(0).toUpperCase()
    return (
      <a
        href={verifyHref || "#"}
        target={verifyHref ? "_blank" : undefined}
        rel={verifyHref ? "noopener noreferrer" : undefined}
        onClick={(e) => { if (!verifyHref) e.preventDefault() }}
        aria-label={verifyHref ? `${t("certificate.verifyLabel", { defaultValue: "Verify credential" })}: ${title}` : title}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card-soft ring-1 ring-charcoal-80/8",
          "transition hover:-translate-y-1 hover:shadow-popover hover:ring-violet/25",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/35 focus-visible:ring-offset-2",
          className,
        )}
      >
        <div className="relative aspect-[1.414/1] w-full overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(at 20% 0%, rgb(var(--color-violet-rgb)/0.92), transparent 60%), " +
                "radial-gradient(at 100% 100%, rgba(53,0,80,0.95), transparent 55%), " +
                "linear-gradient(180deg, var(--color-action-primary-active) 0%, var(--color-charcoal) 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.10] ring-1 ring-white/15 backdrop-blur-sm">
              {issuerLogo ? (
                <img src={issuerLogo} alt="" className="h-12 w-12 object-contain" loading="lazy" />
              ) : (
                <span className="font-mono text-[28px] font-bold tracking-tight text-white">{initial}</span>
              )}
            </div>
          </div>

          {verified && (
            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-mint/95 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              {t("certificate.verifiedBadge", { defaultValue: "Verified" })}
            </span>
          )}
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/[0.10] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/15">
            <Award className="h-3 w-3" aria-hidden="true" />
            {t("certificate.credentialBadge", { defaultValue: "Credential" })}
          </span>

          {verifyHref && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/90">
                {t("certificate.verify")}
              </span>
              <ExternalLink className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="line-clamp-2 min-h-[2.6rem] text-[14px] font-bold leading-snug text-charcoal">
            {title}
          </h3>
          {(issuer || issuedYear) && (
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-violet">
              {[issuer, issuedYear].filter(Boolean).join(" · ")}
            </p>
          )}
          {issuedLine && (
            <p className="text-[11px] tabular-nums text-charcoal-50">
              {t("certificate.issuedPrefix", { defaultValue: "Issued · " })}{issuedLine}
            </p>
          )}
        </div>
      </a>
    )
  }

  // ── PDF mode ─────────────────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card-soft ring-1 ring-charcoal-80/8",
          "transition hover:-translate-y-1 hover:shadow-popover hover:ring-violet/25",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/35 focus-visible:ring-offset-2",
          className,
        )}
      >
        <div className="relative aspect-[1.414/1] w-full overflow-hidden bg-slate-50">
          <CertificateThumbnail src={src} thumbnail={thumbnail} title={title} />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-charcoal/5" aria-hidden="true" />

          {verified && (
            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-mint/95 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              {t("certificate.verifiedBadge", { defaultValue: "Verified" })}
            </span>
          )}
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-charcoal/85 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            <FileText className="h-3 w-3" aria-hidden="true" />
            PDF
          </span>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-charcoal/60 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/85">
              {t("certificate.clickToOpen")}
            </span>
            <ZoomIn className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="line-clamp-2 min-h-[2.6rem] text-[14px] font-bold leading-snug text-charcoal">
            {title}
          </h3>
          {(issuer || issuedYear) && (
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-violet">
              {[issuer, issuedYear].filter(Boolean).join(" · ")}
            </p>
          )}
          {issuedLine && (
            <p className="text-[11px] tabular-nums text-charcoal-50">
              {t("certificate.issuedPrefix", { defaultValue: "Issued · " })}{issuedLine}
            </p>
          )}
        </div>
      </button>

      <CertificateModal
        open={open}
        src={src}
        title={title}
        issuer={issuer}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

/* ───────────────────────── Thumbnail dispatcher ─────────────────────────
 * Prefers a static image (PNG/JPG) when supplied — it's faster, has no
 * worker dependency, and survives PDFs that PDF.js can't decode (e.g.
 * Google's Certified Educator cert ships JBIG2 streams that pdf.js refuses).
 * If the image 404s or errors, we transparently fall back to PdfPageImage,
 * which itself degrades to a branded placeholder if PDF.js also fails.
 * ───────────────────────────────────────────────────────────────────── */
function CertificateThumbnail({ src, thumbnail, title }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = thumbnail && !imgFailed
  return showImage ? (
    <img
      src={thumbnail}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setImgFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <PdfPageImage src={src} title={title} />
  )
}

/* ───────────────────────── PDF page image (thumbnail) ──────────────────── */

function PdfPageImage({ src, title, scale = 1.4 }) {
  const ref = useRef(null)
  const [state, setState] = useState("loading") // loading · ok · error

  useEffect(() => {
    let cancelled = false
    let cleanupTask = null

    ;(async () => {
      try {
        const pdfjs = await loadPdfjs()
        const loadingTask = pdfjs.getDocument({ url: src, isEvalSupported: false })
        cleanupTask = loadingTask
        const doc = await loadingTask.promise
        if (cancelled) return
        const page = await doc.getPage(1)
        const viewport = page.getViewport({ scale })
        const canvas = ref.current
        if (!canvas || cancelled) return
        const ctx = canvas.getContext("2d", { alpha: false })
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: ctx, viewport }).promise
        if (!cancelled) setState("ok")
      } catch (err) {
        logDev("Thumbnail render failed for", src, err)
        if (!cancelled) setState("error")
      }
    })()

    return () => {
      cancelled = true
      try { cleanupTask?.destroy?.() } catch { /* noop */ }
    }
  }, [src, scale])

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          state === "ok" ? "opacity-100" : "opacity-0"
        }`}
      />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-violet">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]">
              Rendering
            </span>
          </div>
        </div>
      )}
      {/* Error state — refined branded placeholder.
          Visual is intentionally calm (slate-50 + steel icon) rather than
          alarming; the click still opens the modal where the iframe takes
          over and almost always renders fine. */}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-card-soft ring-1 ring-slate-200">
            <Award className="h-6 w-6 text-violet" strokeWidth={1.6} aria-hidden="true" />
          </div>
          <span className="line-clamp-2 max-w-[200px] text-[11.5px] font-semibold leading-tight text-steel-700">
            {title || "Certificate"}
          </span>
        </div>
      )}
    </>
  )
}

/* ─────────────────────────────── modal ─────────────────────────────────── */
/**
 * Modal viewer — renders the PDF via <iframe> using the browser's native
 * viewer. This is dramatically more reliable than PDF.js in production:
 * Chrome's PDFium, Edge's PDFium, Firefox's built-in PDF.js, and Safari's
 * Preview engine all handle same-origin PDFs in iframes with zero
 * configuration, regardless of MIME-type quirks or worker CSP rules.
 *
 * The viewer has a 5s onLoad watchdog — if the iframe never fires `load`
 * (e.g. CSP blocks framing, or the PDF is corrupt) we flip to an error
 * state with prominent Download + Open-in-new-tab CTAs. The user always
 * has a clear path forward.
 */
function CertificateModal({ open, src, title, issuer, onClose }) {
  const { t } = useTranslation("about")
  return (
    <Modal
      open={open}
      onClose={onClose}
      bare
      hideClose
      ariaLabel={`${t("certificate.modalLabel", { defaultValue: "Certificate" })}: ${title}`}
      placement="middle"
      size="none"
      zIndex={80}
      // Backdrop padding: edge-to-edge on mobile (so the modal becomes a
      // proper fullscreen viewer), narrow inset on desktop so the page
      // chrome behind is still acknowledged as context.
      wrapperClassName="p-0 sm:p-4 md:p-6"
      backdropClassName="bg-charcoal/85 backdrop-blur-md"
      // Sizing strategy:
      //   • Mobile: full-bleed (h-[100dvh] w-full, no rounding) — the
      //     PDF needs every pixel of vertical space, and a 12px gutter
      //     around the modal was eating ~24 px the iframe desperately
      //     needed for portrait-oriented certificate PDFs.
      //   • Desktop: large modal that scales WITH the viewport — the
      //     previous `min(92vh, 880px)` cap meant a 1440 p monitor
      //     showed 880 px of certificate plus 425 px of empty white
      //     space below. Removing the 880-px ceiling lets tall
      //     viewports finally render the full A4/landscape PDF.
      //   • Width: max-w-6xl (was 5xl) so landscape certificates have
      //     enough horizontal room before the iframe starts forcing
      //     its own zoom-out.
      className={[
        "flex flex-col overflow-hidden bg-white shadow-[0_24px_64px_rgba(0,0,0,0.35)]",
        "h-[100dvh] rounded-none",
        "sm:h-[min(94vh,calc(100dvh-2rem))] sm:max-w-5xl sm:rounded-2xl",
        "md:max-w-6xl",
      ].join(" ")}
    >
      <CertificateViewer src={src} title={title} issuer={issuer} onClose={onClose} />
    </Modal>
  )
}

/* Stateful viewer body — mounted only while the Modal is open so the load
 * watchdog restarts on every open. */
function CertificateViewer({ src, title, issuer, onClose }) {
  const { t }                = useTranslation("about")
  const [state, setState]    = useState("loading") // loading · ok · error
  const watchdogRef          = useRef(null)

  // Watchdog — if the iframe doesn't fire `load` within 5s, assume failure.
  useEffect(() => {
    watchdogRef.current = setTimeout(() => {
      setState((s) => (s === "loading" ? "error" : s))
      logDev("Iframe load watchdog tripped — falling back to download CTA for", src)
    }, 5000)
    return () => { if (watchdogRef.current) clearTimeout(watchdogRef.current) }
  }, [src])

  const handleIframeLoad = () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
    setState("ok")
  }

  const filename = (() => {
    try { return decodeURIComponent(src.split("/").pop() || "certificate.pdf") }
    catch { return "certificate.pdf" }
  })()

  return (
    <>
        {/* Header bar — title left · verified chip · actions right.
            Layout collapses gracefully on narrow widths: the verified chip
            hides on mobile (its meaning is conveyed by the issuer eyebrow),
            and the download label collapses to icon-only. */}
        <div className="flex items-center gap-2 border-b border-charcoal-80/8 bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[14px] font-bold text-charcoal">{title}</p>
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-mint/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-mint-700 sm:inline-flex">
                <ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden="true" />
                {t("certificate.verifiedBadge", { defaultValue: "Verified" })}
              </span>
            </div>
            {issuer && (
              <p className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-violet">
                {issuer}
              </p>
            )}
          </div>

          <a
            href={src}
            download={filename}
            className="cursor-pointer inline-flex h-9 items-center gap-1.5 rounded-full border border-charcoal-80/12 bg-white px-2.5 text-[12.5px] font-semibold text-charcoal-80/85 transition hover:border-violet/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 sm:px-3"
            aria-label={t("certificate.downloadLabel", { defaultValue: "Download PDF" })}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {t("certificate.downloadShort", { defaultValue: "Download" })}
            </span>
          </a>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal-80/65 transition hover:bg-charcoal-80/5 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            aria-label={t("certificate.openNewTab")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("certificate.closeLabel", { defaultValue: "Close" })}
            className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal-80/65 transition hover:bg-charcoal-80/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — slate-50 tint replaces the harsh pure-white whitespace that
            shows below short landscape certs. The native PDF viewer's own
            background blends with our canvas instead of clashing. */}
        <div className="relative flex-1 overflow-hidden bg-slate-100">
          {/* Always-mounted iframe so onLoad can fire. Hidden until ready. */}
          <iframe
            src={src}
            title={title}
            onLoad={handleIframeLoad}
            className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-200 ${
              state === "ok" ? "opacity-100" : "opacity-0"
            }`}
          />

          {state === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-violet" aria-hidden="true" />
            </div>
          )}

          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-card-soft ring-1 ring-slate-200">
                <FileText className="h-7 w-7 text-violet" strokeWidth={1.6} aria-hidden="true" />
              </div>
              <div className="max-w-md space-y-1">
                <p className="text-section-sm font-bold text-charcoal">
                  {t("certificate.renderError")}
                </p>
                <p className="text-[13.5px] leading-relaxed text-charcoal-80/65">
                  {t("certificate.renderErrorHelp", {
                    defaultValue: "Your browser couldn't preview this certificate inline. You can still download it or open it in a new tab.",
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a
                  href={src}
                  download={filename}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-[12.5px] font-semibold text-white shadow-[var(--shadow-lift-4)] transition hover:-translate-y-0.5 hover:bg-violet-deep"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("certificate.downloadShort", { defaultValue: "Download" })}
                </a>
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-charcoal-80/15 px-4 py-2 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("certificate.openNewTab")}
                </a>
              </div>
            </div>
          )}
        </div>
    </>
  )
}

function cn(...args) { return args.filter(Boolean).join(" ") }
