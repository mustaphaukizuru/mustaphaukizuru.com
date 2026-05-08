import { useEffect, useRef, useState } from "react"

import markViolet from "../assets/logo-mark/m-mark-violet.svg"
import { useTranslation } from "react-i18next"

/**
 * LoadingScreen · V3 — single-mark brand splash.
 *
 * Design notes
 * ────────────
 * The previous V2 stacked the violet "M" tile **above** the white wordmark,
 * which read as a "double logo" on small viewports. V3 collapses to a single
 * mark — the official `logo-mark` asset on a white tile — surrounded by a
 * conic-gradient orbit ring, gentle breathing, a tagline cycler, and the
 * Innovation-Gradient progress bar that already lives in the brand system.
 *
 * Lifecycle
 *   1. Fades in instantly (CSS).
 *   2. Orbit ring rotates · inner tile breathes · progress walks 4 stops.
 *   3. After ~1.6 s, the "{t("loading.skipLabel")}" pill appears and a `localStorage`
 *      flag lets returning visitors bypass future splashes.
 *   4. On 100 % (or skip), fades out 400 ms, then `onFinish()` fires.
 *
 * Accessibility
 *   • role="status" / aria-live="polite" / aria-busy
 *   • progressbar with aria-value{now,min,max}
 *   • Skip button has an explicit aria-label
 *   • Honors prefers-reduced-motion via CSS
 */

const TAGLINES = [
  "Technology Consulting",
  "Digital Products",
  "STEM & School Solutions",
]

const SKIP_KEY = "ukz-splash-skip"

export default function LoadingScreen({ onFinish }) {
  const { t } = useTranslation("common")
  const [progress, setProgress] = useState(0)
  const [tagIndex, setTagIndex] = useState(0)
  const [showSkip, setShowSkip] = useState(false)
  const [fading, setFading] = useState(false)
  const finishedRef = useRef(false)

  // Returning visitors skip immediately
  useEffect(() => {
    try {
      if (localStorage.getItem(SKIP_KEY) === "1") {
        finishedRef.current = true
        setFading(true)
        setTimeout(() => onFinish?.(), 200)
      }
    } catch { /* ignore storage errors */ }
  }, [onFinish])

  // Progress walker
  useEffect(() => {
    if (finishedRef.current) return
    const steps = [22, 48, 74, 92, 100]
    let i = 0
    const tid = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i++])
      } else {
        clearInterval(tid)
        setTimeout(() => finish(), 280)
      }
    }, 190)
    return () => clearInterval(tid)
  }, [])

  // Rotating tagline
  useEffect(() => {
    if (finishedRef.current) return
    const tid = setInterval(() => {
      setTagIndex((i) => (i + 1) % TAGLINES.length)
    }, 1600)
    return () => clearInterval(tid)
  }, [])

  // Reveal skip button after 1.6 s
  useEffect(() => {
    if (finishedRef.current) return
    const tid = setTimeout(() => setShowSkip(true), 1600)
    return () => clearTimeout(tid)
  }, [])

  function finish() {
    if (finishedRef.current) return
    finishedRef.current = true
    setFading(true)
    setTimeout(() => onFinish?.(), 400)
  }

  function skip() {
    try { localStorage.setItem(SKIP_KEY, "1") } catch { /* ignore */ }
    finish()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!fading}
      aria-label="Loading mustaphaukizuru.com"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-violet transition-opacity duration-[400ms]"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      {/* Mesh background, same language as the V2 hero + footer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(at 20% 20%, rgba(124,58,237,0.55) 0px, transparent 50%)," +
            "radial-gradient(at 80% 0%, rgba(2,132,199,0.40) 0px, transparent 55%)," +
            "radial-gradient(at 0% 100%, rgba(233,196,106,0.32) 0px, transparent 50%)," +
            "radial-gradient(at 80% 100%, rgba(93,63,211,0.55) 0px, transparent 55%)",
        }}
      />
      {/* Subtle dot grid, adds tactile depth without competing with the mark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:32px_32px]"
      />

      {/* ── Centerpiece, single mark, no wordmark ──────────────────────── */}
      <div className="relative flex flex-col items-center gap-8">
        {/* Orbit ring + breathing tile */}
        <div className="relative flex h-32 w-32 items-center justify-center">
          {/* Outer conic-gradient orbit (rotates) */}
          <div
            aria-hidden="true"
            className="ukz-splash-orbit absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg," +
                " rgba(255,255,255,0) 0deg," +
                " rgba(255,255,255,0.85) 90deg," +
                " #E9C46A 170deg," +
                " #7DD3FC 240deg," +
                " rgba(255,255,255,0) 360deg)",
              WebkitMask:
                "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
              mask:
                "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            }}
          />

          {/* Soft glow halo behind the tile, breathes with it */}
          <div
            aria-hidden="true"
            className="ukz-splash-halo absolute h-24 w-24 rounded-3xl bg-white/30 blur-2xl"
          />

          {/* White tile carrying the violet M-mark (the only logo on screen) */}
          <div className="ukz-splash-tile relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.40)] ring-1 ring-white/30">
            <img
              src={markViolet}
              alt={t("loading.brandAlt")}
              className="h-11 w-11"
              draggable={false}
            />
          </div>
        </div>

        {/* Rotating tagline, replaces the removed wordmark, keeps brand identity */}
        <div className="h-4 overflow-hidden">
          <div
            className="flex flex-col gap-0 transition-transform duration-500"
            style={{ transform: `translateY(${tagIndex * -100}%)` }}
          >
            {TAGLINES.map((t) => (
              <span
                key={t}
                className="text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/75"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Innovation gradient progress bar */}
        <div
          className="relative mt-1 h-[3px] w-60 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #E9C46A 0%, #FFFFFF 50%, #7DD3FC 100%)",
              boxShadow: "0 0 14px rgba(255,255,255,0.45)",
            }}
          />
        </div>

        {/* Skip splash */}
        <button
          type="button"
          onClick={skip}
          className={`mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/75 ring-1 ring-white/15 backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
            showSkip ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label={t("loading.skipAria")}
        >
          {t("loading.skipLabel")}
        </button>
      </div>

      {/*
       * Animations are scoped to the splash. We keep them inline so the
       * splash is fully self-contained (no Tailwind plugin or global CSS
       * dependency). Reduced-motion users get a calm, static splash.
       */}
      <style>{`
        @keyframes ukz-splash-orbit-spin { to { transform: rotate(360deg); } }
        @keyframes ukz-splash-tile-breath {
          0%, 100% { transform: scale(1); box-shadow: 0 24px 70px rgba(0,0,0,0.40); }
          50% { transform: scale(1.04); box-shadow: 0 30px 80px rgba(0,0,0,0.50); }
        }
        @keyframes ukz-splash-halo-breath {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.10); }
        }
        .ukz-splash-orbit { animation: ukz-splash-orbit-spin 2.4s linear infinite; }
        .ukz-splash-tile { animation: ukz-splash-tile-breath 2.6s ease-in-out infinite; }
        .ukz-splash-halo { animation: ukz-splash-halo-breath 2.6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .ukz-splash-orbit,
          .ukz-splash-tile,
          .ukz-splash-halo { animation: none; }
        }
      `}</style>
    </div>
  )
}
