/* ────────────────────────────────────────────────────────────────────────────
 * ServiceDemo — single lazy slot for the one flagship interactive demo.
 *
 * Only `ai-automation` has a demo (WhatsApp lead qualifier). Other categories
 * render nothing. The demo chunk is fetched only once the placeholder scrolls
 * within ~200px of the viewport (IntersectionObserver), then React.lazy mounts.
 * ──────────────────────────────────────────────────────────────────────────── */
import { Suspense, lazy, useEffect, useRef, useState } from "react"

const DEMOS = {
  "ai-automation": lazy(() => import("./WhatsAppQualifierDemo")),
}

export default function ServiceDemo({ slug }) {
  const Demo = DEMOS[slug]
  const ref = useRef(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    if (!Demo || near) return undefined
    const el = ref.current
    // eslint-disable-next-line react-hooks/set-state-in-effect -- no IntersectionObserver (old browser/SSR): load eagerly
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return undefined }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect() } },
      { rootMargin: "200px 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [Demo, near])

  if (!Demo) return null
  return (
    <div ref={ref} className="min-h-[24rem]">
      {near && (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />}>
          <Demo />
        </Suspense>
      )}
    </div>
  )
}
