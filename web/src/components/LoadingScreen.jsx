import { useEffect, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// LoadingScreen — brand splash shown during initial app hydration
// ─────────────────────────────────────────────────────────────────────────────
export default function LoadingScreen({ onFinish }) {
  const [progress, setProgress] = useState(0)
  const [fading, setFading]     = useState(false)

  useEffect(() => {
    // Simulate loading progress
    const steps = [20, 45, 70, 90, 100]
    let i = 0
    const interval = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i])
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => {
          setFading(true)
          setTimeout(() => onFinish?.(), 400)
        }, 300)
      }
    }, 180)
    return () => clearInterval(interval)
  }, [onFinish])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#420060] transition-opacity duration-400"
      style={{ opacity: fading ? 0 : 1 }}
    >
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#FFCCAF]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

      {/* Logo mark */}
      <div className="relative flex flex-col items-center gap-6">
        {/* MU monogram */}
        <div
          className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/10 text-[2rem] font-bold tracking-tight text-white shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          MU
        </div>

        {/* Brand name */}
        <div className="flex flex-col items-center gap-1.5">
          <span
            className="text-[1.25rem] font-bold tracking-tight text-white"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Mustapha Ukizuru
          </span>
          <span className="text-[12px] font-medium uppercase tracking-[0.22em] text-white/45">
            Digital Platform
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-[3px] w-48 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#FFCCAF] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading label */}
        <span className="text-[11px] font-medium text-white/35">
          {progress < 100 ? "Loading…" : "Ready"}
        </span>
      </div>
    </div>
  )
}
