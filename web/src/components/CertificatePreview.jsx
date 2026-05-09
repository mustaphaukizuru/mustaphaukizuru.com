import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ZoomIn, ZoomOut, Download, ExternalLink, ChevronLeft, ChevronRight,
  Loader2, ShieldCheck, FileText, Award,
} from "lucide-react"

import { useTranslation } from "react-i18next"
/**
 * CertificatePreview · adaptive credential tile
 *
 * Two render modes, decided per-tile:
 *
 *   1. PDF mode — when `src` is a same-origin path or .pdf URL we render
 *      page 1 as a canvas thumbnail. Click opens the in-app modal viewer
 *      with zoom, paging, download, and external-open.
 *
 *   2. Credential mode — when `src` is missing/"#"/external (e.g. a
 *      Coursera/Credly verify URL), we fall back to a proper credential
 *      card: large issuer logo or initial, title, issuer, year, and a
 *      "{t("certificate.verify")}" button that opens the URL in a new tab.
 *
 *  Why both? Some certificates are issued only as PDFs we host. Others
 *  live behind issuer verification pages (Coursera, Credly, Google).
 *  Rendering a Coursera URL as a PDF blows up pdfjs and shows a broken
 *  placeholder — the credential mode handles that case gracefully.
 *
 * Props:
 *   src           — public path to PDF OR external credential URL
 *   credentialUrl — optional explicit credential page; if present, takes
 *                   precedence over `src` for the "Verify" CTA
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
    // Same-origin absolute? Check origin if we can.
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
    return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short" })
  } catch { return null }
}

let pdfjsPromise = null

async function loadPdfjs() {
  if (pdfjsPromise) return pdfjsPromise
  pdfjsPromise = (async () => {
    // ESM build, with the matching worker via Vite's `?url` import.
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs")
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })()
  return pdfjsPromise
}

export default function CertificatePreview({
  src,
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
  // External URL or no PDF: render as a credential card. No modal — clicks
  // open the credential page in a new tab.
  if (!canPreview) {
    const initial = (issuer || title || "?").trim().charAt(0).toUpperCase()
    return (
      <a
        href={verifyHref || "#"}
        target={verifyHref ? "_blank" : undefined}
        rel={verifyHref ? "noopener noreferrer" : undefined}
        onClick={(e) => { if (!verifyHref) e.preventDefault() }}
        aria-label={verifyHref ? `Verify credential: ${title}` : title}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card-soft ring-1 ring-charcoal-80/8",
          "transition hover:-translate-y-1 hover:shadow-popover hover:ring-violet/25",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/35 focus-visible:ring-offset-2",
          className,
        )}
      >
        {/* Hero panel, gradient with issuer logo or initial */}
        <div className="relative aspect-[1.414/1] w-full overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(at 20% 0%, rgba(93,63,211,0.92), transparent 60%), " +
                "radial-gradient(at 100% 100%, rgba(53,0,80,0.95), transparent 55%), " +
                "linear-gradient(180deg, #3B2487 0%, #1A1B23 100%)",
            }}
          />
          {/* Subtle dot grid for depth */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]"
          />
          {/* Center mark, issuer logo or initial */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/[0.10] ring-1 ring-white/15 backdrop-blur-sm">
              {issuerLogo ? (
                <img
                  src={issuerLogo}
                  alt=""
                  className="h-12 w-12 object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="font-mono text-[28px] font-bold tracking-tight text-white">
                  {initial}
                </span>
              )}
            </div>
          </div>

          {/* Corner ribbon */}
          {verified && (
            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-mint/95 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              Verified
            </span>
          )}
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/[0.10] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/15">
            <Award className="h-3 w-3" aria-hidden="true" />
            Credential
          </span>

          {/* Verify hint on hover */}
          {verifyHref && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/90">
                {t("certificate.verify")}
              </span>
              <ExternalLink className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Body */}
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
              Issued · {issuedLine}
            </p>
          )}
        </div>
      </a>
    )
  }

  // ── PDF mode (original behaviour) ────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open certificate: ${title}`}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-card-soft ring-1 ring-charcoal-80/8",
          "transition hover:-translate-y-1 hover:shadow-popover hover:ring-violet/25",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/35 focus-visible:ring-offset-2",
          className,
        )}
      >
        <div className="relative aspect-[1.414/1] w-full overflow-hidden bg-[var(--color-mist)]">
          <PdfPageImage src={src} />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-charcoal/5" aria-hidden="true" />

          {/* Corner ribbon */}
          {verified && (
            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-mint/95 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow">
              <ShieldCheck className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              Verified
            </span>
          )}
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-charcoal/85 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            <FileText className="h-3 w-3" aria-hidden="true" />
            PDF
          </span>

          {/* Hover overlay */}
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
              Issued · {issuedLine}
            </p>
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <CertificateModal
            src={src}
            title={title}
            issuer={issuer}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/* ───────────────────────── PDF page image (thumbnail) ──────────────────── */

function PdfPageImage({ src, scale = 1.4 }) {
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
      } catch {
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
          <div className="flex flex-col items-center gap-2 text-violet/70">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]">Rendering</span>
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-violet">
          <div className="flex flex-col items-center gap-1.5 text-white/85">
            <FileText className="h-7 w-7" aria-hidden="true" />
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]">PDF</span>
          </div>
        </div>
      )}
    </>
  )
}

/* ─────────────────────────────── modal ─────────────────────────────────── */

function CertificateModal({ src, title, issuer, onClose }) {
  // Certificate strings live under the `about` namespace alongside the
  // tile copy. Using `common` here returned raw keys (e.g.
  // "certificate.renderError") because no matching subtree existed there.
  const { t } = useTranslation("about")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [state, setState] = useState("loading")
  const docRef = useRef(null)
  const canvasRef = useRef(null)

  // Lock body scroll
  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = orig }
  }, [])

  // Open document
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await loadPdfjs()
        const doc = await pdfjs.getDocument({ url: src, isEvalSupported: false }).promise
        if (cancelled) return
        docRef.current = doc
        setPageCount(doc.numPages)
        setState("ok")
      } catch {
        if (!cancelled) setState("error")
      }
    })()
    return () => { cancelled = true; try { docRef.current?.destroy?.() } catch { /* noop */ } }
  }, [src])

  // Render the current page whenever pageIndex or zoom changes
  const renderPage = useCallback(async () => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas) return
    const page = await doc.getPage(pageIndex)
    const viewport = page.getViewport({ scale: zoom * 1.6 })
    const ctx = canvas.getContext("2d", { alpha: false })
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
  }, [pageIndex, zoom])

  useEffect(() => { if (state === "ok") renderPage() }, [state, renderPage])

  // Esc + arrow keys
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") setPageIndex((i) => Math.min(pageCount, i + 1))
      if (e.key === "ArrowLeft") setPageIndex((i) => Math.max(1, i - 1))
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))
      if (e.key === "-") setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pageCount, onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Certificate: ${title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-charcoal/85 p-4 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-modal"
      >
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-charcoal-80/8 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-charcoal">{title}</p>
            {issuer && (
              <p className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-violet">
                {issuer}
              </p>
            )}
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <ToolbarButton onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))} label={t("certificate.zoomOut")}>
              <ZoomOut className="h-4 w-4" />
            </ToolbarButton>
            <span className="px-2 font-mono text-[11px] font-semibold tabular-nums text-charcoal-80/70">
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarButton onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))} label={t("certificate.zoomIn")}>
              <ZoomIn className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <a
            href={src}
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-charcoal-80/12 bg-white px-3 text-[12.5px] font-semibold text-charcoal-80/85 transition hover:border-violet/40 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            aria-label="Download PDF"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download
          </a>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal-80/65 transition hover:bg-charcoal-80/5 hover:text-violet"
            aria-label={t("certificate.openNewTab")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal-80/65 transition hover:bg-charcoal-80/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-auto bg-[var(--color-mist)] p-4 sm:p-8">
          {state === "loading" && (
            <div className="flex h-full min-h-[60vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-violet" />
            </div>
          )}
          {state === "error" && (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 text-charcoal-80/70">
              <FileText className="h-8 w-8" aria-hidden="true" />
              <p className="text-[13.5px]">{t("certificate.renderError")}</p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-[12.5px] font-semibold text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("certificate.openNewTab")}
              </a>
            </div>
          )}
          {state === "ok" && (
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                aria-label={`${title} · page ${pageIndex} of ${pageCount}`}
                className="max-w-full rounded-lg shadow-popover"
              />
            </div>
          )}
        </div>

        {/* Footer pagination */}
        {state === "ok" && pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-charcoal-80/8 bg-white px-4 py-3">
            <ToolbarButton
              onClick={() => setPageIndex((i) => Math.max(1, i - 1))}
              label={t("certificate.prevPage")}
              disabled={pageIndex <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </ToolbarButton>
            <span className="px-3 font-mono text-[11px] font-semibold tabular-nums text-charcoal-80/70">
              Page {pageIndex} / {pageCount}
            </span>
            <ToolbarButton
              onClick={() => setPageIndex((i) => Math.min(pageCount, i + 1))}
              label={t("certificate.nextPage")}
              disabled={pageIndex >= pageCount}
            >
              <ChevronRight className="h-4 w-4" />
            </ToolbarButton>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function ToolbarButton({ onClick, label, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-charcoal-80/65 transition hover:bg-charcoal-80/5 hover:text-violet disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
    >
      {children}
    </button>
  )
}

function cn(...args) { return args.filter(Boolean).join(" ") }
