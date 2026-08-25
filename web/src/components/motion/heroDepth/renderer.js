/**
 * 2D-canvas "gradient mesh" renderer — four soft radial blobs in brand hues
 * (Royal Violet / azure / gold) drifting on slow Lissajous paths, plus a gentle
 * pointer parallax. Rendered at a quarter of the CSS size and upscaled by CSS
 * (the browser's bilinear filter does the blur for free), so one frame costs a
 * handful of gradient fills on a ~300x200 bitmap.
 *
 * createHeroDepth(canvas) -> { start, stop, destroy } | null
 */
const BLOBS = [
  { c: [93, 63, 211], a: 0.22, r: 0.55, x: 0.15, y: 0.25, fx: 0.11, fy: 0.07, px: 0.06 }, // violet
  { c: [2, 132, 199], a: 0.16, r: 0.5, x: 0.85, y: 0.1, fx: 0.08, fy: 0.13, px: -0.04 }, // azure
  { c: [233, 196, 106], a: 0.14, r: 0.45, x: 0.08, y: 0.95, fx: 0.06, fy: 0.09, px: 0.03 }, // gold
  { c: [124, 92, 235], a: 0.12, r: 0.6, x: 0.6, y: 0.7, fx: 0.05, fy: 0.04, px: -0.07 }, // violet light
]
const SCALE = 0.25
const FRAME_MS = 1000 / 30

export function createHeroDepth(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true })
  if (!ctx) return null

  let raf = 0
  let running = false
  let last = 0
  let w = 0
  let h = 0
  // pointer target / eased value, in -0.5..0.5
  let tx = 0
  let ty = 0
  let ex = 0
  let ey = 0

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    w = Math.max(1, Math.round(rect.width * SCALE))
    h = Math.max(1, Math.round(rect.height * SCALE))
    canvas.width = w
    canvas.height = h
  }

  const onPointer = (e) => {
    tx = e.clientX / window.innerWidth - 0.5
    ty = e.clientY / window.innerHeight - 0.5
  }
  const onLeave = () => {
    tx = 0
    ty = 0
  }

  const draw = (t) => {
    ex += (tx - ex) * 0.05
    ey += (ty - ey) * 0.05
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = "lighter"
    const s = t / 1000
    for (const b of BLOBS) {
      const cx = (b.x + Math.sin(s * b.fx * Math.PI * 2) * 0.12 + ex * b.px) * w
      const cy = (b.y + Math.cos(s * b.fy * Math.PI * 2) * 0.1 + ey * b.px) * h
      const r = b.r * Math.max(w, h)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      const [cr, cg, cb] = b.c
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${b.a})`)
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
  }

  const loop = (t) => {
    if (!running) return
    raf = requestAnimationFrame(loop)
    if (t - last < FRAME_MS) return // cap at 30 fps
    last = t
    draw(t)
  }

  const start = () => {
    if (running) return
    running = true
    last = 0
    raf = requestAnimationFrame(loop)
  }
  const stop = () => {
    running = false
    cancelAnimationFrame(raf)
  }

  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  window.addEventListener("pointermove", onPointer, { passive: true })
  window.addEventListener("pointerleave", onLeave, { passive: true })

  return {
    start,
    stop,
    destroy() {
      stop()
      ro.disconnect()
      window.removeEventListener("pointermove", onPointer)
      window.removeEventListener("pointerleave", onLeave)
      ctx.clearRect(0, 0, w, h)
    },
  }
}
